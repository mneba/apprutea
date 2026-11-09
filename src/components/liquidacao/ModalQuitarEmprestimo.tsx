'use client';

import { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Loader2,
  DollarSign,
  CreditCard,
  CheckCircle,
  Wallet,
  Banknote,
} from 'lucide-react';

// =====================================================
// TIPOS
// =====================================================

// O CONTRATO É DE `fn_quitar_emprestimo`, e é ela que manda. Os três campos
// de conta abaixo são exatamente as três variáveis dela, com os mesmos nomes:
//
//   v_saldo_bruto         = Σ valor_saldo das parcelas EM ABERTO
//   v_credito_a_usar      = LEAST(crédito, saldo_bruto)
//   v_dinheiro_necessario = saldo_bruto − credito_a_usar
//
// E ela RECUSA `p_valor_pagamento` diferente do dinheiro necessário por mais
// de 0,01 — nas duas direções. Então a tela não tem liberdade de cálculo: ou
// repete a conta da função, ou o botão não funciona.
interface DadosQuitacao {
  emprestimo_id: string;
  cliente_nome: string;
  /** Σ `valor_saldo` das parcelas em aberto — o BRUTO, sem desconto nenhum. */
  saldo_bruto: number;
  /** Σ `saldo_excedente` das parcelas. */
  credito_disponivel: number;
  /** O que a função vai consumir de crédito: nunca mais que o saldo bruto. */
  credito_a_usar: number;
  /** O que o cliente tem de entregar em dinheiro. */
  valor_dinheiro: number;
  /** Por que a função recusaria, ou null. Medido ANTES de habilitar o botão. */
  impedimento: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  emprestimoId: string;
  clienteNome: string;
  rotaId: string;
  liquidacaoId: string;
  onQuitacaoSucesso?: () => void;
}

// =====================================================
// HELPERS
// =====================================================

// `$` e as duas casas — regra do Mauricio, 04/11/2026. O sistema opera em
// mais de um país e não existe campo de moeda no schema.
function formatarMoeda(valor: number): string {
  return '$ ' + new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor || 0);
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function ModalQuitarEmprestimo({
  isOpen,
  onClose,
  emprestimoId,
  clienteNome,
  rotaId,
  liquidacaoId,
  onQuitacaoSucesso,
}: Props) {
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  
  const [dados, setDados] = useState<DadosQuitacao | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<'DINHEIRO' | 'TRANSFERENCIA' | 'PIX'>('DINHEIRO');

  // Carregar dados do empréstimo
  useEffect(() => {
    if (isOpen && emprestimoId) {
      carregarDados();
    }
  }, [isOpen, emprestimoId]);

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setErro(null);
      setSucesso(false);
      setFormaPagamento('DINHEIRO');
    }
  }, [isOpen]);

  const carregarDados = async () => {
    setCarregando(true);
    setErro(null);
    
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // UMA consulta, na mesma tabela da função: as duas somas saem daqui.
      //
      // ⚠ Isto lia `emprestimos.valor_saldo` e subtraía o crédito. Era
      // desconto DUPLO — aquela coluna já vem líquida, porque o gatilho
      // `atualizar_saldo_emprestimo` faz `GREATEST(0, Σ abertas − crédito)`.
      // Na Camila Rafaela dava `max(35 − 135, 0)` = 0, e a tela mandava 0 em
      // `p_valor_pagamento`; a função recusava com "Dinheiro necessário: 35".
      // Quitar pelo web um empréstimo COM crédito nunca funcionou — são 23
      // empréstimos nessa situação hoje.
      //
      // A função, essa, já tinha sido consertada do mesmo erro: ver o
      // "⭐⭐⭐ CORREÇÃO CENTRAL" no corpo dela.
      const { data: parcelas, error: errParcelas } = await supabase
        .from('emprestimo_parcelas')
        .select('status, valor_saldo, saldo_excedente')
        .eq('emprestimo_id', emprestimoId);

      if (errParcelas) throw errParcelas;
      if (!parcelas || parcelas.length === 0) {
        throw new Error('Empréstimo sem parcelas');
      }

      const ABERTAS = ['PENDENTE', 'PARCIAL', 'VENCIDO'];
      const saldoBruto = parcelas
        .filter((p) => ABERTAS.includes(p.status))
        .reduce((acc, p) => acc + (parseFloat(p.valor_saldo) || 0), 0);
      // O `> 0` repete o `WHERE ep.saldo_excedente > 0` da função. Hoje dá no
      // mesmo — medido: 51.826 parcelas, zero nulas e zero negativas, menor
      // valor 0,00 —, mas somar tudo seria uma divergência esperando um dado
      // negativo aparecer. Duas réguas no mesmo fluxo é o formato de erro que
      // este projeto já pagou várias vezes.
      const creditoDisponivel = parcelas
        .filter((p) => (parseFloat(p.saldo_excedente) || 0) > 0)
        .reduce((acc, p) => acc + (parseFloat(p.saldo_excedente) || 0), 0);

      const creditoAUsar = Math.min(creditoDisponivel, saldoBruto);
      const valorDinheiro = saldoBruto - creditoAUsar;

      // As duas recusas da função, antecipadas — com o mesmo texto, para o
      // operador não ver uma coisa na tela e outra no erro.
      let impedimento: string | null = null;
      if (saldoBruto <= 0) {
        impedimento = 'Não há parcelas em aberto para quitar.';
      } else if (creditoDisponivel > saldoBruto + 0.01) {
        impedimento = `Crédito (${formatarMoeda(creditoDisponivel)}) maior que as parcelas `
          + `em aberto (${formatarMoeda(saldoBruto)}). Resolva a sobra de `
          + `${formatarMoeda(creditoDisponivel - saldoBruto)} antes de quitar.`;
      }

      setDados({
        emprestimo_id: emprestimoId,
        cliente_nome: clienteNome,
        saldo_bruto: saldoBruto,
        credito_disponivel: creditoDisponivel,
        credito_a_usar: creditoAUsar,
        valor_dinheiro: valorDinheiro,
        impedimento,
      });
      
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      setErro(err.message || 'Erro ao carregar dados do empréstimo');
    } finally {
      setCarregando(false);
    }
  };

  const handleConfirmarQuitacao = async () => {
    if (!dados || !liquidacaoId) return;
    if (dados.impedimento) return;
    
    setProcessando(true);
    setErro(null);
    
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // `p_valor_pagamento` tem de ser EXATO: a função recusa fora de ±0,01.
      //
      // `p_valor_credito` está na assinatura e a função o IGNORA — ela calcula
      // o próprio `v_credito_a_usar`, porque o crédito nunca pode sobrar
      // depois da quitação (foi a escolha do operador que apagava crédito, no
      // caso thalles). Mandamos o valor certo de qualquer forma.
      const valorPagamento = dados.valor_dinheiro;
      const valorCredito = dados.credito_a_usar;
      
      const { data, error } = await supabase.rpc('fn_quitar_emprestimo', {
        p_emprestimo_id: emprestimoId,
        p_valor_pagamento: valorPagamento,
        p_valor_credito: valorCredito,
        p_forma_pagamento: formaPagamento,
        p_latitude: null,
        p_longitude: null,
        p_precisao_gps: null,
        p_liquidacao_id: liquidacaoId,
        p_user_id: null, // Será pego via auth.uid()
      });
      
      if (error) throw error;
      
      const resultado = Array.isArray(data) ? data[0] : data;
      
      if (!resultado?.sucesso) {
        throw new Error(resultado?.mensagem || 'Erro ao quitar empréstimo');
      }
      
      setSucesso(true);
      
      // Aguardar 2 segundos e fechar
      setTimeout(() => {
        onQuitacaoSucesso?.();
        onClose();
      }, 2000);
      
    } catch (err: any) {
      console.error('Erro na quitação:', err);
      setErro(err.message || 'Erro ao processar quitação');
    } finally {
      setProcessando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-green-600 to-green-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Quitar Empréstimo</h2>
              <p className="text-white/80 text-sm">Quitação antecipada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={processando}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : erro && !dados ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-600">{erro}</p>
              <button
                onClick={carregarDados}
                className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Tentar novamente
              </button>
            </div>
          ) : sucesso ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Empréstimo Quitado!
              </h3>
              <p className="text-gray-500">
                Todas as parcelas foram marcadas como pagas.
              </p>
            </div>
          ) : dados ? (
            <div className="space-y-5">
              {/* Nome do Cliente */}
              <div className="text-center pb-4 border-b">
                <p className="text-sm text-gray-500">Cliente</p>
                <p className="text-lg font-semibold text-gray-900">{dados.cliente_nome}</p>
              </div>

              {/* Valores */}
              <div className="space-y-3">
                {/* A conta se lê de cima para baixo e FECHA:
                    parcelas em aberto − crédito a usar = dinheiro. */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">Parcelas em aberto</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatarMoeda(dados.saldo_bruto)}
                  </span>
                </div>

                {dados.credito_disponivel > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-500" />
                      <span className="text-blue-700">
                        Crédito a usar
                        {dados.credito_a_usar < dados.credito_disponivel
                          ? ` (de ${formatarMoeda(dados.credito_disponivel)})`
                          : ''}
                      </span>
                    </div>
                    <span className="font-semibold text-blue-700">
                      - {formatarMoeda(dados.credito_a_usar)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border-2 border-green-200">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-green-600" />
                    <span className="text-green-800 font-medium">Valor em dinheiro</span>
                  </div>
                  <span className="text-xl font-bold text-green-700">
                    {formatarMoeda(dados.valor_dinheiro)}
                  </span>
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DINHEIRO', 'TRANSFERENCIA', 'PIX'] as const).map((forma) => (
                    <button
                      key={forma}
                      onClick={() => setFormaPagamento(forma)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formaPagamento === forma
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {forma === 'DINHEIRO' ? 'Dinheiro' : forma === 'TRANSFERENCIA' ? 'Transf.' : 'PIX'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aviso — ou o motivo pelo qual a função vai recusar. Dizer
                  isto ANTES do clique é a diferença entre "não posso quitar
                  porque o crédito excede a dívida" e um erro vermelho depois
                  de apertar um botão verde. */}
              {dados.impedimento ? (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800">
                    <p className="font-medium">Não é possível quitar agora</p>
                    <p>{dados.impedimento}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">Atenção!</p>
                    <p>Todas as parcelas restantes serão marcadas como pagas. Esta ação é irreversível.</p>
                  </div>
                </div>
              )}

              {/* Erro */}
              {erro && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erro}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!carregando && !sucesso && dados && (
          <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
            <button
              onClick={onClose}
              disabled={processando}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmarQuitacao}
              disabled={processando || !!dados.impedimento}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Confirmar Quitação
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}