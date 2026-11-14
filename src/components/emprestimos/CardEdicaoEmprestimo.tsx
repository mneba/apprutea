'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Calendar,
  AlertTriangle,
  Edit3,
  RefreshCw,
  Percent,
  DollarSign,
  Hash,
  Calculator,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { InputNumero } from '@/components/ui/InputNumero';

// =====================================================
// TIPOS
// =====================================================

type FrequenciaPagamento = 'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'FLEXIVEL';

interface EmprestimoParaEdicao {
  id: string;
  valor_principal: number;
  valor_total: number;
  valor_saldo: number;
  numero_parcelas: number;
  parcelas_pagas?: number;
  taxa_juros: number;
  frequencia_pagamento: FrequenciaPagamento;
  dia_semana_cobranca?: number | null;
  dias_semana_cobranca?: number[] | null;
  dia_mes_cobranca?: number | null;
  dias_mes_cobranca?: number[] | null;
  status: string;
  observacoes?: string;
}

interface CardEdicaoEmprestimoProps {
  emprestimo: EmprestimoParaEdicao;
  onSucesso?: () => void;
  onRenegociar?: (emprestimoId: string) => void;
}

// =====================================================
// CONSTANTES
// =====================================================

const FREQUENCIAS: { value: FrequenciaPagamento; label: string; icone: string }[] = [
  { value: 'DIARIO', label: 'Diário', icone: '📅' },
  { value: 'SEMANAL', label: 'Semanal', icone: '📆' },
  { value: 'QUINZENAL', label: 'Quinzenal', icone: '🗓️' },
  { value: 'MENSAL', label: 'Mensal', icone: '📊' },
  { value: 'FLEXIVEL', label: 'Flexível', icone: '⚡' },
];

const DIAS_SEMANA = [
  { value: 0, label: 'Dom', completo: 'Domingo' },
  { value: 1, label: 'Seg', completo: 'Segunda' },
  { value: 2, label: 'Ter', completo: 'Terça' },
  { value: 3, label: 'Qua', completo: 'Quarta' },
  { value: 4, label: 'Qui', completo: 'Quinta' },
  { value: 5, label: 'Sex', completo: 'Sexta' },
  { value: 6, label: 'Sáb', completo: 'Sábado' },
];

// =====================================================
// HELPERS
// =====================================================

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

// Data de hoje no fuso LOCAL (YYYY-MM-DD).
// Não usar toISOString(): ele converte para UTC e, à noite (UTC-3),
// devolve a data do dia seguinte.
function hojeLocalISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function CardEdicaoEmprestimo({
  emprestimo,
  onSucesso,
  onRenegociar,
}: CardEdicaoEmprestimoProps) {
  // Estados - Frequência
  const [editando, setEditando] = useState(false);
  const [frequencia, setFrequencia] = useState<FrequenciaPagamento>(emprestimo.frequencia_pagamento);
  // O CONJUNTO É O ESTADO; O ESCALAR É DERIVADO.
  //
  // Desde 11/10/2026 o semanal cobra em mais de um dia da semana. O Postgres
  // guarda `dias_semana_cobranca` (conjunto, autoridade do cronograma) e
  // `dia_semana_cobranca` (o primeiro do conjunto, para os leitores antigos).
  // Dois estados aqui divergiriam na primeira ramificação que esquecesse um
  // deles, e o sintoma seria cronograma num dia e rótulo em outro.
  const diasDoEmprestimo = (): number[] => {
    const conjunto = emprestimo.dias_semana_cobranca;
    if (conjunto && conjunto.length > 0) return [...conjunto].sort((a, b) => a - b);
    return emprestimo.dia_semana_cobranca != null ? [emprestimo.dia_semana_cobranca] : [];
  };

  const [diasSemana, setDiasSemana] = useState<number[]>(diasDoEmprestimo);

  // O CONJUNTO VEM DA TABELA, NÃO DA VIEW.
  //
  // `ModalDetalhesCliente` monta este empréstimo a partir de
  // `vw_historico_emprestimos_cliente`, que expõe o escalar e não o conjunto.
  // Acrescentar coluna a uma view exige apendá-la no fim da lista — o
  // `CREATE OR REPLACE VIEW` recusa inserir no meio — e achar onde termina a
  // lista de colunas de uma view longa é adivinhação sobre `FROM` que pode
  // estar dentro de subconsulta.
  //
  // Uma coluna por id é leitura sem regra de negócio no meio, o mesmo padrão
  // do `diasSemanaEmprestimos.ts` do app do vendedor. Enquanto não chega, o
  // card mostra o escalar — nunca fica vazio.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('emprestimos')
        .select('dias_semana_cobranca')
        .eq('id', emprestimo.id)
        .maybeSingle();

      const conjunto = (data as any)?.dias_semana_cobranca as number[] | null | undefined;
      if (!vivo || !conjunto || conjunto.length === 0) return;
      // Não atropela edição em curso: se o admin já mexeu, o que vale é a tela.
      setDiasSemana(prev => (editando ? prev : [...conjunto].sort((a, b) => a - b)));
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emprestimo.id]);
  const diaSemana = diasSemana.length > 0 ? diasSemana[0] : null;

  /** Liga/desliga um dia. O último marcado não desliga: a validação do
   *  Salvar já exige pelo menos um, e deixar zerar só adiantaria o erro. */
  const alternarDiaSemana = (dia: number) => {
    setDiasSemana(prev => {
      if (prev.includes(dia)) return prev.length === 1 ? prev : prev.filter(d => d !== dia);
      return [...prev, dia].sort((a, b) => a - b);
    });
  };
  const [diaMes, setDiaMes] = useState<number | null>(emprestimo.dia_mes_cobranca ?? null);
  const [diasFlexiveis, setDiasFlexiveis] = useState<number[]>(emprestimo.dias_mes_cobranca ?? []);
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>('');
  
  // Estados - Valores do Empréstimo (NOVOS)
  const [valorPrincipal, setValorPrincipal] = useState<number>(emprestimo.valor_principal);
  const [taxaJuros, setTaxaJuros] = useState<number>(emprestimo.taxa_juros);
  const [numeroParcelas, setNumeroParcelas] = useState<number>(emprestimo.numero_parcelas);
  
  // Estados - UI
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [requerRenegociacao, setRequerRenegociacao] = useState(false);
  const [parcelasAtrasadas, setParcelasAtrasadas] = useState(0);

  /**
   * As três grandezas da redistribuição, lidas das PARCELAS — as mesmas que
   * `fn_alterar_emprestimo_completo` calcula em `v_qtd_ficam`,
   * `v_valor_ja_pago` e `v_saldo_das_ficam`.
   *
   * A tela não pode inventar a conta. Antes ela mostrava
   * `valor_total / numero_parcelas`, que é o que a função faz APENAS quando
   * não há pagamento: com pagamento, o que se divide é só o saldo que falta,
   * entre as parcelas que serão recriadas. Com a taxa agora editável isso
   * aparece na cara — o admin decide olhando este número.
   *
   * É a lição da quitação (08/11/2026): repetir, do mesmo dado, as variáveis
   * da função, em vez de derivar uma conta parecida.
   *
   * `null` enquanto a consulta não voltou (ou se ela falhar): aí as fórmulas
   * caem na derivação antiga. Degradação, não regressão.
   */
  const [redistrib, setRedistrib] = useState<
    { qtdFicam: number; jaPago: number; saldoFicam: number } | null
  >(null);

  // Cálculos automáticos
  const calculosNovos = useMemo(() => {
    const juros = valorPrincipal * (taxaJuros / 100);
    const valorTotal = Math.round(valorPrincipal * (1 + taxaJuros / 100) * 100) / 100;

    // `v_saldo_para_novas` e `v_qtd_novas`, iguais aos da função.
    const temPgto = !!redistrib && (redistrib.qtdFicam > 0 || redistrib.jaPago > 0);
    const saldoParaNovas = temPgto
      ? valorTotal - redistrib!.jaPago - redistrib!.saldoFicam
      : valorTotal;
    const qtdNovas = numeroParcelas - (redistrib?.qtdFicam ?? 0);

    const valorParcela =
      qtdNovas > 0 ? Math.round((saldoParaNovas / qtdNovas) * 100) / 100 : 0;

    return { juros, valorTotal, valorParcela, saldoParaNovas, qtdNovas };
  }, [valorPrincipal, taxaJuros, numeroParcelas, redistrib]);

  // Data mínima da primeira parcela = data da LIQUIDAÇÃO aberta.
  // (fallback para hoje-local apenas enquanto a liquidação não carregou)
  const [dataLiquidacao, setDataLiquidacao] = useState<string | null>(null);
  const dataMinima = dataLiquidacao || hojeLocalISO();

  // ---------------------------------------------------------------
  // REGRAS DE VALIDAÇÃO DA ALTERAÇÃO
  // ---------------------------------------------------------------
  const MAX_PARCELAS = 48;

  // Parcelas já pagas: não é permitido reduzir para <= esse número.
  // ⚠ A função conta `valor_pago > 0`, que inclui PARCIAL; `parcelas_pagas`
  //   conta só as quitadas. Quando a consulta voltou, vale a dela.
  const parcelasPagas = emprestimo.parcelas_pagas ?? 0;
  const parcelasComPagamento = redistrib?.qtdFicam ?? parcelasPagas;
  const minParcelas = Math.max(1, parcelasComPagamento + 1);

  // Total já pago pelo cliente (valor_total contratado - saldo devedor)
  const totalPago = Math.max(0, (emprestimo.valor_total || 0) - (emprestimo.valor_saldo || 0));

  /**
   * Empréstimo que já recebeu dinheiro: só o VALOR PRINCIPAL fica travado.
   *
   * Regra do Mauricio (13/11/2026): "o principal será travado; única
   * alteração é permitir alterar % de juros, e todo o resto poderá ser
   * alterado, exceto valor principal".
   *
   * O princípio é o que separa os dois campos: o PRINCIPAL é o dinheiro que
   * saiu do caixa, e corrigi-lo obriga a anular o lançamento e relançar na
   * liquidação de origem — que pode estar fechada, e cujo saldo as
   * liquidações posteriores já copiaram (o degrau da escada, que custou o
   * `reencadear_dias_posteriores` em 05/10/2026). A TAXA é só cálculo:
   * mudá-la não move lançamento nenhum, porque `fn_alterar_emprestimo_completo`
   * guarda todo o bloco do dinheiro por `abs(v_delta_principal) > 0.01`.
   *
   * O cronograma — frequência, dia de cobrança, número de parcelas — sempre
   * foi livre. Em todos esses casos as parcelas que já receberam dinheiro
   * ficam congeladas e só o saldo restante é redistribuído.
   *
   * `fn_alterar_emprestimo_completo` recusa o principal de qualquer jeito e
   * devolve `requer_renegociacao`. Travar aqui é para o usuário não preencher
   * um formulário inteiro para ouvir não no fim.
   */
  const temPagamento = parcelasPagas > 0 || totalPago > 0;

  // O empréstimo precisa continuar em aberto após a alteração.
  // É a guarda `v_saldo_para_novas <= 0` da função, com a mesma conta — e
  // ela deixou de ser teórica: baixar muito a taxa de um empréstimo quase
  // pago zera o que sobra a distribuir.
  const alteracaoQuitaEmprestimo = calculosNovos.saldoParaNovas <= 0;

  // Empréstimos encerrados não podem ser alterados
  const statusBloqueado = ['QUITADO', 'CANCELADO'].includes((emprestimo.status || '').toUpperCase());

  // Validações de contexto (liquidação aberta / limite de taxa do vendedor)
  const [liquidacaoAberta, setLiquidacaoAberta] = useState<boolean | null>(null);
  const [taxaMaximaVendedor, setTaxaMaximaVendedor] = useState<number | null>(null);
  const [trabalhaDomingo, setTrabalhaDomingo] = useState<boolean>(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: emp } = await supabase
          .from('emprestimos')
          .select('rota_id, vendedor_id')
          .eq('id', emprestimo.id)
          .maybeSingle();
        if (!emp || cancelado) return;

        // Rota trabalha aos domingos?
        const { data: rota } = await supabase
          .from('rotas')
          .select('trabalha_domingo')
          .eq('id', (emp as any).rota_id)
          .maybeSingle();
        if (!cancelado && rota) {
          setTrabalhaDomingo(!!(rota as any).trabalha_domingo);
        }

        const { data: liq } = await supabase
          .from('liquidacoes_diarias')
          .select('id, data_liquidacao')
          .eq('rota_id', (emp as any).rota_id)
          .in('status', ['ABERTO', 'REABERTO'])
          .limit(1);
        if (!cancelado) {
          const temLiq = Array.isArray(liq) && liq.length > 0;
          setLiquidacaoAberta(temLiq);
          if (temLiq) {
            // data_liquidacao é uma data "crua" do banco — usar como string,
            // sem passar por new Date() (evita deslocamento de fuso).
            const dl = String((liq as any)[0].data_liquidacao || '').slice(0, 10);
            if (dl) setDataLiquidacao(dl);
          }
        }

        const { data: restr } = await supabase
          .from('restricoes_vendedor')
          .select('validar_taxa_juros, taxa_juros_maxima')
          .eq('vendedor_id', (emp as any).vendedor_id)
          .maybeSingle();
        if (!cancelado && restr && (restr as any).validar_taxa_juros) {
          setTaxaMaximaVendedor((restr as any).taxa_juros_maxima ?? null);
        }

        // As parcelas que FICAM. É o mesmo filtro do DELETE da função, e ele
        // tem DOIS termos desde 14/11/2026: `valor_pago > 0` OU ter qualquer
        // registro em `pagamentos_parcelas`, vivo ou estornado.
        //
        // O segundo entrou porque `pagamentos_parcelas.parcela_id` é
        // ON DELETE RESTRICT: a parcela com pagamento estornado não sai, e
        // apagar o registro do estorno apagaria a auditoria de um dinheiro
        // que entrou e voltou. A função POUPA essa parcela — então o preview
        // tem de poupá-la também, ou os dois mostram contas diferentes.
        // Ver sql/2026-11-14_delete_de_parcela_sem_travar.sql
        //
        // E não é o status: `PARCIAL` é parcela com pagamento e entra aqui.
        const { data: todas } = await supabase
          .from('emprestimo_parcelas')
          .select('valor_pago, valor_saldo, pagamentos_parcelas(id)')
          .eq('emprestimo_id', emprestimo.id);
        const parc = (todas || []).filter(
          (p: any) =>
            Number(p.valor_pago || 0) > 0 ||
            (Array.isArray(p.pagamentos_parcelas) ? p.pagamentos_parcelas.length : 0) > 0
        );
        if (!cancelado && Array.isArray(todas)) {
          setRedistrib({
            qtdFicam: parc.length,
            jaPago: parc.reduce((s, p: any) => s + Number(p.valor_pago || 0), 0),
            saldoFicam: parc.reduce((s, p: any) => s + Number(p.valor_saldo || 0), 0),
          });
        }
      } catch {
        /* silencioso: não bloqueia a edição por falha de consulta */
      }
    })();
    return () => { cancelado = true; };
  }, [emprestimo.id]);

  const taxaAcimaDoLimite =
    taxaMaximaVendedor !== null && taxaJuros > taxaMaximaVendedor;

  // Resetar ao mudar empréstimo
  useEffect(() => {
    setFrequencia(emprestimo.frequencia_pagamento);
    setDiasSemana(diasDoEmprestimo());
    setDiaMes(emprestimo.dia_mes_cobranca ?? null);
    setDiasFlexiveis(emprestimo.dias_mes_cobranca ?? []);
    setDataPrimeiraParcela('');
    setValorPrincipal(emprestimo.valor_principal);
    setTaxaJuros(emprestimo.taxa_juros);
    setNumeroParcelas(emprestimo.numero_parcelas);
    setEditando(false);
    setErro(null);
    setSucesso(null);
    setRequerRenegociacao(false);
  }, [emprestimo.id]);

  // Verificar mudanças
  const mudouFrequencia = frequencia !== emprestimo.frequencia_pagamento;
  const mudouValorPrincipal = valorPrincipal !== emprestimo.valor_principal;
  const mudouTaxaJuros = taxaJuros !== emprestimo.taxa_juros;
  const mudouNumeroParcelas = numeroParcelas !== emprestimo.numero_parcelas;
  const mudouValores = mudouValorPrincipal || mudouTaxaJuros || mudouNumeroParcelas;
  
  const houveMudanca = 
    mudouFrequencia ||
    mudouValores ||
    JSON.stringify(diasSemana) !== JSON.stringify(diasDoEmprestimo()) ||
    diaMes !== emprestimo.dia_mes_cobranca ||
    JSON.stringify(diasFlexiveis) !== JSON.stringify(emprestimo.dias_mes_cobranca || []);

  // Validar se pode salvar
  /**
   * O MOTIVO de não dar para salvar, ou null quando dá.
   *
   * Relato do Mauricio em 13/11/2026: *"fui fazer o teste e o botão não fica
   * ativado"*. Ele estava certo, e a tela não contava por quê: `podeSalvar`
   * tinha CATORZE guardas e o aviso amarelo explicava QUATRO. As outras dez
   * — inclusive o mínimo de parcelas, que era a dele — desligavam o botão em
   * silêncio.
   *
   * ⚠ **As frases existiam**, em `validar()`. Só que `validar()` roda no
   * submit, e o submit nunca acontece porque o botão está desabilitado.
   * **Mensagem presa atrás da própria guarda que ela explica é mensagem que
   * ninguém lê** — e o usuário fica procurando o que mudou de errado numa
   * tela que já sabe a resposta.
   *
   * Agora é UMA lista: ela decide o `disabled`, escreve o aviso e valida o
   * envio. Duas listas das mesmas regras divergem — é o formato de erro que
   * este projeto já pagou várias vezes.
   */
  const motivoBloqueio = (): string | null => {
    if (statusBloqueado)
      return `Empréstimo ${emprestimo.status} não pode ser alterado.`;

    if (liquidacaoAberta !== true)
      return 'É necessário ter uma liquidação aberta (ou reaberta) nesta rota para alterar o empréstimo.';

    if ((mudouFrequencia || mudouValores) && !dataPrimeiraParcela)
      return 'Informe a data da primeira parcela pendente.';

    if (dataPrimeiraParcela && dataPrimeiraParcela < dataMinima)
      return `A data da primeira parcela não pode ser anterior à data da liquidação (${dataMinima.split('-').reverse().join('/')}).`;

    if (valorPrincipal <= 0) return 'O valor principal deve ser maior que zero.';

    if (taxaJuros < 0) return 'A taxa de juros não pode ser negativa.';

    if (numeroParcelas < minParcelas)
      return parcelasComPagamento > 0
        ? `O número de parcelas não pode ser menor que ${minParcelas}: ${parcelasComPagamento} parcela(s) já receberam pagamento e ficam como estão, e é preciso sobrar ao menos uma para receber o saldo.`
        : 'O número de parcelas deve ser no mínimo 1.';

    if (numeroParcelas > MAX_PARCELAS)
      return emprestimo.numero_parcelas > MAX_PARCELAS
        ? `O número de parcelas não pode ser maior que ${MAX_PARCELAS}, e este empréstimo tem ${emprestimo.numero_parcelas}. Reduza o campo para ${MAX_PARCELAS} ou menos — as parcelas já pagas ficam, e o saldo é redistribuído nas restantes.`
        : `O número de parcelas não pode ser maior que ${MAX_PARCELAS}.`;

    if (alteracaoQuitaEmprestimo)
      return `O saldo a distribuir ficou em ${formatarMoeda(calculosNovos.saldoParaNovas)} — a alteração quitaria o empréstimo. Para encerrá-lo, use a quitação.`;

    if (taxaAcimaDoLimite)
      return `A taxa de juros excede o limite permitido para este vendedor (${taxaMaximaVendedor}%).`;

    if (frequencia === 'SEMANAL' && diasSemana.length === 0)
      return 'Selecione pelo menos um dia da semana para cobrança.';

    if (frequencia === 'SEMANAL' && diasSemana.includes(0) && !trabalhaDomingo)
      return 'Esta rota não trabalha aos domingos. Desmarque o domingo.';

    if (frequencia === 'MENSAL' && diaMes === null)
      return 'Selecione o dia do mês para cobrança.';

    if (frequencia === 'FLEXIVEL' && diasFlexiveis.length === 0)
      return 'Selecione pelo menos um dia do mês.';

    return null;
  };

  // `houveMudanca` fica FORA do motivo, de propósito: botão apagado antes de
  // mexer em qualquer coisa é óbvio, e um aviso amarelo ao abrir o card seria
  // ruído em cima de uma tela que não tem problema nenhum.
  const podeSalvar = () => houveMudanca && motivoBloqueio() === null;

  // Handler para salvar
  const handleSalvar = async () => {
    // Uma lista só, a mesma que desabilita o botão e escreve o aviso. Esta
    // guarda é a rede: o botão desabilitado já impede chegar aqui, mas o
    // envio não pode depender de um `disabled` da interface.
    const motivo = motivoBloqueio();
    if (motivo) {
      setErro(motivo);
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    setRequerRenegociacao(false);

    try {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.rpc('fn_alterar_emprestimo_completo', {
        p_emprestimo_id: emprestimo.id,
        p_user_id: user.id,
        p_valor_principal: mudouValorPrincipal ? valorPrincipal : null,
        p_taxa_juros: mudouTaxaJuros ? taxaJuros : null,
        p_numero_parcelas: mudouNumeroParcelas ? numeroParcelas : null,
        p_frequencia_pagamento: frequencia,
        p_dia_semana_cobranca: frequencia === 'SEMANAL' ? diaSemana : null,
        p_dias_semana_cobranca: frequencia === 'SEMANAL' ? diasSemana : null,
        p_dia_mes_cobranca: frequencia === 'MENSAL' ? diaMes : null,
        p_dias_mes_cobranca: frequencia === 'FLEXIVEL' ? diasFlexiveis : null,
        p_data_primeira_parcela: (mudouFrequencia || mudouValores) ? dataPrimeiraParcela : null,
      });

      if (error) throw error;

      const resultado = Array.isArray(data) ? data[0] : data;

      if (resultado?.sucesso) {
        setSucesso(resultado.mensagem);
        setEditando(false);
        onSucesso?.();
        setTimeout(() => {
          setSucesso(null);
        }, 2000);
      } else {
        if (resultado?.requer_renegociacao) {
          setRequerRenegociacao(true);
          setParcelasAtrasadas(resultado.parcelas_atrasadas || 0);
        }
        setErro(resultado?.mensagem || 'Erro ao alterar empréstimo');
      }
    } catch (error: any) {
      console.error('Erro ao alterar empréstimo:', error);
      setErro(error.message || 'Erro ao alterar empréstimo');
    } finally {
      setSalvando(false);
    }
  };

  // Cancelar edição
  const handleCancelar = () => {
    setFrequencia(emprestimo.frequencia_pagamento);
    setDiasSemana(diasDoEmprestimo());
    setDiaMes(emprestimo.dia_mes_cobranca ?? null);
    setDiasFlexiveis(emprestimo.dias_mes_cobranca ?? []);
    setDataPrimeiraParcela('');
    setValorPrincipal(emprestimo.valor_principal);
    setTaxaJuros(emprestimo.taxa_juros);
    setNumeroParcelas(emprestimo.numero_parcelas);
    setEditando(false);
    setErro(null);
    setRequerRenegociacao(false);
  };

  // Toggle dia flexível
  const toggleDiaFlexivel = (dia: number) => {
    setDiasFlexiveis(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia) 
        : [...prev, dia].sort((a, b) => a - b)
    );
  };

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Edit3 className="w-4 h-4" />
          Configurações do Empréstimo
        </h4>
        {!editando && (
          <button
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs font-medium shadow-sm transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Editar
          </button>
        )}
      </div>

      {/* Mensagens de erro/sucesso */}
      {erro && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>{erro}</p>
              {requerRenegociacao && onRenegociar && (
                <button
                  onClick={() => onRenegociar(emprestimo.id)}
                  className="mt-2 px-3 py-1 bg-amber-500 text-white rounded text-xs font-medium hover:bg-amber-600 transition-colors"
                >
                  <RefreshCw className="w-3 h-3 inline mr-1" />
                  Iniciar Renegociação ({parcelasAtrasadas} parcela(s) em atraso)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {sucesso && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4" />
          {sucesso}
        </div>
      )}

      {/* Modo visualização */}
      {!editando && (
        <div className="space-y-3">
          {/* Valores */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-gray-50 p-2 rounded-lg">
              <p className="text-xs text-gray-500">Valor Principal</p>
              <p className="font-medium text-gray-900">{formatarMoeda(emprestimo.valor_principal)}</p>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg">
              <p className="text-xs text-gray-500">Taxa de Juros</p>
              <p className="font-medium text-gray-900">{emprestimo.taxa_juros}%</p>
            </div>
            <div className="bg-gray-50 p-2 rounded-lg">
              <p className="text-xs text-gray-500">Nº Parcelas</p>
              <p className="font-medium text-gray-900">{emprestimo.numero_parcelas}x</p>
            </div>
          </div>
          
          {/* Frequência */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
              {FREQUENCIAS.find(f => f.value === frequencia)?.icone}{' '}
              {FREQUENCIAS.find(f => f.value === frequencia)?.label}
            </span>
            {frequencia === 'SEMANAL' && diasSemana.length > 0 && (
              <span className="text-sm text-gray-500">
                ({diasSemana.length === 1
                  ? DIAS_SEMANA.find(d => d.value === diasSemana[0])?.completo
                  : diasSemana.map(d => DIAS_SEMANA.find(x => x.value === d)?.label).join(', ')})
              </span>
            )}
            {frequencia === 'MENSAL' && diaMes && (
              <span className="text-sm text-gray-500">
                (Dia {diaMes})
              </span>
            )}
            {frequencia === 'FLEXIVEL' && diasFlexiveis?.length > 0 && (
              <span className="text-sm text-gray-500">
                (Dias: {diasFlexiveis.join(', ')})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Modo edição */}
      {editando && (
        <div className="space-y-4 bg-gray-50 rounded-lg p-3 -mx-1">
          
          {/* SEÇÃO: Valores do Empréstimo */}
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <h5 className="text-xs font-semibold text-gray-600 mb-3 flex items-center gap-1">
              <Calculator className="w-3.5 h-3.5" />
              Valores do Empréstimo
            </h5>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Valor Principal */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Valor Principal
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <InputNumero
                    valor={valorPrincipal}
                    onChange={setValorPrincipal}
                    min={0}
                    step={0.01}
                    disabled={temPagamento}
                    title={temPagamento ? 'Já há pagamento neste empréstimo — o principal é o dinheiro que saiu do caixa. Use a renegociação.' : undefined}
                    className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              
              {/* Taxa de Juros */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Taxa de Juros
                </label>
                <div className="relative">
                  <Percent className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <InputNumero
                    valor={taxaJuros}
                    onChange={setTaxaJuros}
                    min={0}
                    max={100}
                    step={0.1}
                    /* A TAXA é editável mesmo com pagamento (13/11/2026): ela
                       não move dinheiro, só recalcula o total e redistribui o
                       saldo que falta. Quem trava é o PRINCIPAL, logo acima. */
                    className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              
              {/* Número de Parcelas */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Nº Parcelas
                </label>
                <div className="relative">
                  <Hash className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <InputNumero
                    valor={numeroParcelas}
                    onChange={setNumeroParcelas}
                    inteiro
                    min={minParcelas}
                    max={MAX_PARCELAS}
                    className="w-full pl-8 pr-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  {/* "com pagamento", não "paga(s)": o mínimo sai de `qtdFicam`,
                      que é o filtro do DELETE da função (`valor_pago > 0` OU ter
                      registro em `pagamentos_parcelas`), e parcela PARCIAL tem
                      pagamento sem estar paga. Dizer "paga" ao lado de um mínimo
                      que conta a PARCIAL faz a frase não fechar com o número que
                      está do lado dela. */}
                  {parcelasComPagamento > 0
                    ? `Mínimo ${minParcelas} (${parcelasComPagamento} com pagamento) • Máximo ${MAX_PARCELAS}`
                    : `Mínimo ${minParcelas} • Máximo ${MAX_PARCELAS}`}
                </p>
              </div>
            </div>
            
            {/* Preview dos cálculos */}
            {mudouValores && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-700 mb-1">Novos valores calculados:</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-blue-600">Juros:</span>{' '}
                    <span className="font-medium">{formatarMoeda(calculosNovos.juros)}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Total:</span>{' '}
                    <span className="font-medium">{formatarMoeda(calculosNovos.valorTotal)}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Parcela:</span>{' '}
                    <span className="font-medium">{formatarMoeda(calculosNovos.valorParcela)}</span>
                  </div>
                </div>

                {/* A decomposição, quando há pagamento. Sem ela, "Total 1.200"
                    ao lado de "Parcela 126,67" não fecha com 10 parcelas e
                    parece erro de conta — a diferença é que 4 parcelas não
                    serão recriadas. Mesma regra do crédito na quitação: ou a
                    conta aparece inteira e fecha, ou não aparece. */}
                {temPagamento && redistrib && (
                  <p className="mt-1.5 pt-1.5 border-t border-blue-200 text-[11px] text-blue-700">
                    {formatarMoeda(calculosNovos.valorTotal)} − {formatarMoeda(redistrib.jaPago)}{' '}
                    já recebido − {formatarMoeda(redistrib.saldoFicam)} que as{' '}
                    {redistrib.qtdFicam} parcela(s) com pagamento ainda devem ={' '}
                    <strong>{formatarMoeda(calculosNovos.saldoParaNovas)}</strong> a distribuir
                    em {calculosNovos.qtdNovas} parcela(s).
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SEÇÃO: Frequência */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Frequência de Pagamento</label>
            <div className="grid grid-cols-5 gap-1">
              {FREQUENCIAS.map((freq) => (
                <button
                  key={freq.value}
                  type="button"
                  onClick={() => setFrequencia(freq.value)}
                  className={`p-2 rounded-lg border text-center transition-all text-xs ${
                    frequencia === freq.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className="block text-lg mb-0.5">{freq.icone}</span>
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dia da semana (SEMANAL) */}
          {frequencia === 'SEMANAL' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Dias da Semana <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-7 gap-1">
                {DIAS_SEMANA.map((dia) => {
                  const domingoBloqueado = dia.value === 0 && !trabalhaDomingo;
                  return (
                    <button
                      key={dia.value}
                      type="button"
                      disabled={domingoBloqueado}
                      title={domingoBloqueado ? 'Esta rota não trabalha aos domingos' : dia.completo}
                      onClick={() => !domingoBloqueado && alternarDiaSemana(dia.value)}
                      className={`p-2 rounded text-center transition-all text-xs ${
                        domingoBloqueado
                          ? 'bg-gray-100 border border-gray-200 text-gray-300 cursor-not-allowed line-through'
                          : diasSemana.includes(dia.value)
                          ? 'bg-blue-500 text-white font-medium'
                          : 'bg-white border border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {dia.label}
                    </button>
                  );
                })}
              </div>
              {diasSemana.length > 1 && (
                <p className="mt-1 text-[11px] text-blue-600">
                  {diasSemana.length} dias por semana: o empréstimo termina mais cedo, com as mesmas parcelas.
                </p>
              )}
              {!trabalhaDomingo && (
                <p className="mt-1 text-[11px] text-gray-500">Esta rota não trabalha aos domingos.</p>
              )}
            </div>
          )}

          {/* Dia do mês (MENSAL) */}
          {frequencia === 'MENSAL' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Dia do Mês <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setDiaMes(dia)}
                    className={`p-1.5 rounded text-center transition-all text-xs ${
                      diaMes === dia
                        ? 'bg-blue-500 text-white font-medium'
                        : 'bg-white border border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dias flexíveis */}
          {frequencia === 'FLEXIVEL' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Dias do Mês (selecione múltiplos) <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDiaFlexivel(dia)}
                    className={`p-1.5 rounded text-center transition-all text-xs ${
                      diasFlexiveis.includes(dia)
                        ? 'bg-blue-500 text-white font-medium'
                        : 'bg-white border border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
              {diasFlexiveis.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Selecionados: {diasFlexiveis.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* DATA DA PRIMEIRA PARCELA (obrigatório se mudou frequência ou valores) */}
          {(mudouFrequencia || mudouValores) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-xs font-medium text-amber-800 mb-2">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Data da Primeira Parcela Pendente <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dataPrimeiraParcela}
                onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                min={dataMinima}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm bg-white"
                required
              />
              <p className="mt-1 text-xs text-amber-600">
                Esta data será usada como base para recalcular todas as parcelas pendentes.
                {dataLiquidacao && (
                  <> Mínimo permitido: {dataLiquidacao.split('-').reverse().join('/')} (data da liquidação aberta).</>
                )}
              </p>
            </div>
          )}

          {/* Por que o valor principal está travado — e, tão importante
              quanto, o que PODE ser feito. Sem esta linha o campo cinza vira
              dúvida: o usuário não sabe se é falta de permissão, erro da
              tela, ou regra. */}
          {temPagamento && (
            <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-2 text-gray-600 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Este empréstimo já recebeu pagamento, então o <strong>valor principal</strong>{' '}
                  não pode mudar — ele é o dinheiro que saiu do caixa. A{' '}
                  <strong>taxa de juros</strong> pode ser corrigida, assim como frequência,
                  dia de cobrança e número de parcelas: as parcelas já pagas ficam como
                  estão e o saldo que falta é redistribuído nas demais. Para mudar o
                  principal, use a renegociação.
                </p>
              </div>
            </div>
          )}

          {/* Aviso de recálculo (apenas mudança de config, sem mudar valores) */}
          {houveMudanca && !mudouFrequencia && !mudouValores && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2 text-blue-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>As configurações do empréstimo serão atualizadas.</p>
              </div>
            </div>
          )}

          {/* O motivo de o botão estar apagado, sempre que houver um.
              Status e liquidação aparecem mesmo sem mudança nenhuma — são
              estado do empréstimo, não da edição; o resto só depois que a
              pessoa mexeu em algo. */}
          {(statusBloqueado || liquidacaoAberta !== true || houveMudanca) &&
            motivoBloqueio() && (
              <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">{motivoBloqueio()}</p>
              </div>
            )}

          {/* Botões de ação */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleCancelar}
              disabled={salvando}
              className="px-3 py-1.5 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={salvando || !podeSalvar()}
              className="px-3 py-1.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}