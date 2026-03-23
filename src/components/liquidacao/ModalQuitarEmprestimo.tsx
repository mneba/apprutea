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

interface DadosQuitacao {
  emprestimo_id: string;
  cliente_nome: string;
  valor_saldo: number;        // emprestimos.valor_saldo
  credito_disponivel: number; // SUM(saldo_excedente)
  saldo_real: number;         // valor_saldo - credito_disponivel
  valor_dinheiro: number;     // MAX(saldo_real - credito_disponivel, 0)
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

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
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
      
      // Buscar saldo do empréstimo
      const { data: emprestimo, error: errEmp } = await supabase
        .from('emprestimos')
        .select('id, valor_saldo')
        .eq('id', emprestimoId)
        .single();
      
      if (errEmp) throw errEmp;
      if (!emprestimo) throw new Error('Empréstimo não encontrado');
      
      // Buscar crédito disponível (saldo_excedente das parcelas)
      const { data: parcelas, error: errParcelas } = await supabase
        .from('emprestimo_parcelas')
        .select('saldo_excedente')
        .eq('emprestimo_id', emprestimoId)
        .gt('saldo_excedente', 0);
      
      if (errParcelas) throw errParcelas;
      
      const creditoDisponivel = (parcelas || []).reduce(
        (acc, p) => acc + (parseFloat(p.saldo_excedente) || 0), 
        0
      );
      
      const valorSaldo = parseFloat(emprestimo.valor_saldo) || 0;
      const saldoReal = Math.max(valorSaldo - creditoDisponivel, 0);
      const valorDinheiro = Math.max(saldoReal - creditoDisponivel, 0);
      
      setDados({
        emprestimo_id: emprestimoId,
        cliente_nome: clienteNome,
        valor_saldo: valorSaldo,
        credito_disponivel: creditoDisponivel,
        saldo_real: saldoReal,
        valor_dinheiro: Math.max(saldoReal, 0), // Valor que precisa pagar em dinheiro
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
    
    setProcessando(true);
    setErro(null);
    
    try {
      const supabase = (await import('@/lib/supabase/client')).createClient();
      
      // Calcular valores para a função
      const valorPagamento = dados.valor_dinheiro; // Valor em dinheiro necessário
      const valorCredito = Math.min(dados.credito_disponivel, dados.saldo_real); // Crédito a usar
      
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
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-600">Saldo devedor</span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatarMoeda(dados.valor_saldo)}
                  </span>
                </div>

                {dados.credito_disponivel > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-500" />
                      <span className="text-blue-700">Crédito disponível</span>
                    </div>
                    <span className="font-semibold text-blue-700">
                      - {formatarMoeda(dados.credito_disponivel)}
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

              {/* Aviso */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Atenção!</p>
                  <p>Todas as parcelas restantes serão marcadas como pagas. Esta ação é irreversível.</p>
                </div>
              </div>

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
              disabled={processando}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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