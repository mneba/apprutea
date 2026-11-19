'use client';

import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Share2,
  Loader2,
  ArrowDown,
  ArrowUp,
  Minus,
  Plus,
  ShieldCheck,
  Repeat,
  Lock,
  LockOpen,
  ChevronDown,
  ChevronUp,
  Search,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { LiquidacaoDiaria } from '@/types/liquidacao';
import { useTrabalhaCredito } from '@/hooks/useTrabalhaCredito';

// =====================================================
// TIPOS
// =====================================================

interface MovimentoFinanceiro {
  id: string;
  tipo: 'RECEBER' | 'PAGAR' | 'AJUSTE' | 'TRANSFERENCIA';
  categoria: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  created_at: string;
  forma_pagamento: string | null;
  cliente_nome: string | null;
  status: string;
}

interface PagamentoParcela {
  id: string;
  numero_parcela: number;
  valor_pago_total: number;
  valor_pago_atual: number;
  valor_parcela: number;
  valor_credito_gerado: number;
  valor_credito_usado: number;
  forma_pagamento: string | null;
  created_at: string;
  cliente_id: string;
  parcela_id: string | null;
  emprestimo_id: string | null;
  /** O ATO do vendedor. Uma operacao pode cobrir varias parcelas. */
  operacao_id: string | null;
  tipo_operacao: string | null;
  clientes?: { nome: string; consecutivo?: string } | null;
}

/** O que sobrou de crédito e o que o crédito fechou, por empréstimo. */
interface CreditoLiquido {
  /** Excedente que o cliente de fato guardou: gerado menos consumido no dia. */
  excedente: number;
  /** Parcelas fechadas por linhas CREDITO, que nao aparecem na lista. */
  parcelasQuitadas: number;
  /** Crédito dessas linhas. Sem isto o extrato fecha parcelas sem dinheiro à vista. */
  creditoOculto: number;
}

/**
 * Fragmento que declara o crédito aplicado pelo empréstimo, uma vez só.
 *
 * Mesmo texto do aplicativo (`fraseCredito` em `LiquidacaoDetalhes.tsx`). O
 * extrato do web e o do app são lidos pela mesma pessoa, muitas vezes lado a
 * lado — palavra diferente para o mesmo número é o que o Julio chamou de
 * "divergência na interpretação dos valores".
 */
function fraseCredito(liq: CreditoLiquido, mostrarCredito = true): string {
  const qtd = liq.parcelasQuitadas;
  if (liq.creditoOculto > 0 && mostrarCredito) {
    const un = qtd === 1 ? 'parcela' : 'parcelas';
    return ` · crédito aplicado: ${formatarMoeda(liq.creditoOculto)}${qtd > 0 ? ` (${qtd} ${un})` : ''}`;
  }
  if (qtd > 0) {
    return ` · quitou +${qtd} parcelas`;
  }
  return '';
}

/**
 * "5 parcelas (11 a 15)" — ou os numeros soltos, quando nao sao seguidos.
 *
 * Mesmo texto do aplicativo (`fraseParcelas` em `LiquidacaoDetalhes.tsx`),
 * pelo mesmo motivo de `fraseCredito`: os dois extratos sao lidos lado a
 * lado.
 */
function fraseParcelas(nums: number[]): string {
  const un = nums.length === 1 ? 'parcela' : 'parcelas';
  const seguidos = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  const quais =
    seguidos && nums.length > 1 ? `${nums[0]} a ${nums[nums.length - 1]}` : nums.join(', ');
  return `${nums.length} ${un} (${quais})`;
}

/** Um ATO do vendedor, com as parcelas que ele cobriu. */
interface Recebimento {
  key: string;
  linhas: PagamentoParcela[];
  /** O que entrou no caixa na operacao: a soma das linhas que ela substitui. */
  dinheiro: number;
  nomeCliente: string;
  parcelas: number[];
  quitacao: boolean;
  /** Mantem a linha por parcela: operacao com credito, ou de uma parcela so. */
  detalhar: boolean;
}

/** Uma linha da lista: o grupo colapsado, ou uma parcela dele. */
interface ItemCobranca {
  grupo?: Recebimento;
  p?: PagamentoParcela;
  rec: Recebimento;
}

interface EmprestimoDia {
  id: string;
  valor_principal: number;
  valor_total: number;
  valor_parcela: number;
  numero_parcelas: number;
  taxa_juros: number;
  frequencia_pagamento: string | null;
  data_primeiro_vencimento: string | null;
  tipo_emprestimo: 'NOVO' | 'RENOVACAO' | 'RENEGOCIACAO' | 'ADICIONAL' | string;
  created_at: string;
  cliente?: { nome: string; codigo_cliente?: number | string } | null;
}

interface ResumoOperacional {
  pagos: number;
  naoPagos: number;
  novos: number;
  renovados: number;
  renegociados: number;
}

// =====================================================
// HELPERS
// =====================================================

// O símbolo é SEMPRE "$", com 2 casas: o sistema não sabe em que país está
// (CLAUDE.md, "E o símbolo é SEMPRE `$`"). Era `R$` aqui até 19/11/2026.
function formatarMoeda(valor: number | null | undefined): string {
  return '$ ' + new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor || 0);
}

function formatarHora(data: string | null | undefined): string {
  if (!data) return '';
  return new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Data e hora de um timestamp do banco.
 *
 * O `Z` é acrescentado quando falta porque coluna `timestamp without time
 * zone` chega sem fuso e é UTC — sem isso o navegador a leria como hora
 * local, e o selo mostraria o fechamento cinco horas fora na Colômbia.
 */
function formatarDataHora(data: string | null | undefined): string {
  if (!data) return '';
  const utc = data.endsWith('Z') || data.includes('+') ? data : data + 'Z';
  const dt = new Date(utc);
  if (isNaN(dt.getTime())) return '';
  return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatarDataLiquidacaoBR(dataIso: string | null | undefined): string {
  if (!dataIso) return '';
  const dataStr = dataIso.split('T')[0];
  const [y, m, d] = dataStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatarDataParcela(dataIso: string | null | undefined): string {
  if (!dataIso) return '—';
  const dataStr = dataIso.split('T')[0];
  return new Date(dataStr + 'T12:00:00').toLocaleDateString('pt-BR');
}

function formatarCategoria(categoria: string): string {
  const mapa: Record<string, string> = {
    'COBRANCA_CUOTAS': 'Cobrança de Parcela',
    'COBRANCA_PARCELAS': 'Cobrança de Parcela',
    'EMPRESTIMO': 'Empréstimo',
    'VENDA_MICROSEGURO': 'Venda de Microseguro',
    'MICROSEGURO': 'Microseguro',
    'APORTE': 'Aporte de Capital',
    'AJUSTE_CAIXA': 'Ajuste de Caixa',
    'AJUSTE_CAJA': 'Ajuste de Caixa',
    'GASOLINA': 'Gasolina',
    'MANUTENCAO': 'Manutenção',
    'ALIMENTACAO': 'Alimentação',
    'TRANSPORTE': 'Transporte',
    'ESTORNO_PAGAMENTO': 'Estorno de Pagamento',
    'MULTA': 'Multa',
    'OUTROS': 'Outros',
    'RETIRADA': 'Retirada',
    'DESPESA': 'Despesa',
    'RECARGAS': 'Recargas',
  };
  return mapa[categoria] || categoria;
}

function formatarFormaPagamento(forma: string | null): string {
  if (!forma) return '';
  const mapa: Record<string, string> = {
    'DINHEIRO': 'Dinheiro',
    'TRANSFERENCIA': 'Transferência',
    'PIX': 'PIX',
    'CARTAO': 'Cartão',
    'CREDITO': 'Crédito',
  };
  return mapa[forma] || forma;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

/**
 * Uma linha da auditoria do dia (`fn_auditoria_liquidacao`).
 *
 * EXTRATO NÃO É LOG, e por isso só uma parte disto entra aqui: o bloco da
 * reabertura — quem, quando, por quê — e o que veio DEPOIS dela. A linha do
 * tempo inteira (cada pagamento como evento) repetiria, em forma de ação, o
 * que o extrato já mostra como dinheiro. Ela pertence à tela de auditoria.
 */
interface EventoAuditoria {
  momento: string;
  tipo: string;
  usuario: string | null;
  descricao: string | null;
  valor: number | null;
  impacto_caixa: number | null;
  motivo: string | null;
  depois_da_reabertura: boolean;
}

interface ModalExtratoLiquidacaoProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacao: LiquidacaoDiaria | null;
  rotaNome: string;
  vendedorNome?: string;
  empresaNome?: string;
}

export function ModalExtratoLiquidacao({
  isOpen,
  onClose,
  liquidacao,
  rotaNome,
  vendedorNome,
  empresaNome,
}: ModalExtratoLiquidacaoProps) {
  const [loading, setLoading] = useState(false);
  const [gerando, setGerando] = useState(false);
  // Rota sem crédito à vista: as frases de crédito saem. O dinheiro de cada
  // linha já é líquido dele, então os totais não mudam.
  const mostrarCredito = useTrabalhaCredito({ rotaId: liquidacao?.rota_id });
  const [registros, setRegistros] = useState<MovimentoFinanceiro[]>([]);
  const [auditoria, setAuditoria] = useState<EventoAuditoria[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoParcela[]>([]);
  const [vendasDia, setVendasDia] = useState<EmprestimoDia[]>([]);
  const [renegociacoesDia, setRenegociacoesDia] = useState<EmprestimoDia[]>([]);
  // Blocos do extrato (mockup B): fechados ao abrir, cada um abre ao clique.
  const [blocosAbertos, setBlocosAbertos] = useState<Set<string>>(new Set());
  const [buscaCob, setBuscaCob] = useState('');
  const [resumoOp, setResumoOp] = useState<ResumoOperacional>({
    pagos: 0,
    naoPagos: 0,
    novos: 0,
    renovados: 0,
    renegociados: 0,
  });
  // Selo de fechamento. `quando` é `data_fechamento`; `por` é o nome de quem
  // fechou, resolvido por `fn_nome_usuario` — que procura em `vendedores` e
  // depois em `user_profiles`, cobrindo tanto o vendedor no app quanto o admin
  // por aqui. Mesma fonte do selo do celular.
  const [fechamento, setFechamento] = useState<{ quando: string; por: string | null } | null>(null);

  useEffect(() => {
    if (isOpen && liquidacao) {
      carregarExtrato();
    }
  }, [isOpen, liquidacao]);

  const carregarExtrato = async () => {
    if (!liquidacao) return;

    setLoading(true);
    try {
      const supabase = createClient();

      // 1. Dados extras da liquidação (resumo operacional)
      const { data: liqExtra } = await supabase
        .from('liquidacoes_diarias')
        // `clientes_pagos` e `clientes_nao_pagos` saíram da lista: não são mais
        // lidos (ver abaixo), e deixá-los aqui faria a próxima pessoa supor que
        // a tela depende deles.
        .select('clientes_novos, clientes_renovados, clientes_renegociados, status, data_fechamento, fechado_por')
        .eq('id', liquidacao.id)
        .single();

      if (liqExtra) {
        // PAGOS E NÃO PAGOS SÃO DERIVADOS, não lidos de
        // `clientes_pagos` / `clientes_nao_pagos`.
        //
        // Por que derivar em vez de medir se o campo está certo: medir
        // responderia "hoje bate"; derivar remove a pergunta. `clientes_pagos`
        // fica em 0 nos dias de importação, e o sistema inteiro já conta esses
        // dois números a partir dos pagamentos vivos — a tela de liquidação, o
        // calendário e o app do vendedor. Deixar o extrato na outra fonte é o
        // formato de erro que este projeto já pagou várias vezes: dois números
        // que precisam ser mantidos iguais em vez de serem o mesmo.
        //
        // "Não pagos" contempla TODOS os que aparecem no dia — os que vencem
        // nele e os que só estão na lista por parcela vencida (regra do
        // Mauricio, 21/10/2026).
        const [listaRes, pagosRes] = await Promise.all([
          supabase.rpc('fn_clientes_da_liquidacao', { p_liquidacao_id: liquidacao.id }),
          supabase.from('pagamentos_parcelas').select('cliente_id')
            .eq('liquidacao_id', liquidacao.id).eq('estornado', false),
        ]);

        // Distintos por CLIENTE: a RPC devolve uma linha por PARCELA — 84
        // linhas para 24 clientes na Barcelona 10/10.
        const universo = new Set<string>(
          ((listaRes.data || []) as any[]).map((r) => r.cliente_id).filter(Boolean)
        );
        const pagaram = new Set<string>(
          ((pagosRes.data || []) as any[]).map((r) => r.cliente_id).filter(Boolean)
        );
        // União: quem pagou conta mesmo sem estar na lista (empréstimo criado
        // e pago no mesmo dia), senão os não pagos ficariam negativos.
        pagaram.forEach((id) => universo.add(id));

        setResumoOp({
          pagos: pagaram.size,
          naoPagos: Math.max(0, universo.size - pagaram.size),
          novos: (liqExtra as any).clientes_novos || 0,
          renovados: (liqExtra as any).clientes_renovados || 0,
          renegociados: (liqExtra as any).clientes_renegociados || 0,
        });

        // Só há selo se a liquidação foi de fato fechada. Uma REABERTA perde o
        // selo de propósito: o extrato deixou de representar um dia encerrado,
        // que é justamente o que o selo afirma. Quem quiser a história da
        // reabertura a tem na seção própria, mais abaixo.
        const fechadaEm = (liqExtra as any).data_fechamento as string | null;
        const statusLiq = String((liqExtra as any).status || '').toUpperCase();
        if (fechadaEm && statusLiq === 'FECHADO') {
          setFechamento({ quando: fechadaEm, por: null });
          const quem = (liqExtra as any).fechado_por;
          if (quem) {
            // O nome é um extra: se a busca falhar, o selo aparece mesmo assim
            // com a data e a hora, que é o essencial.
            const { data: nome, error: errNome } = await supabase.rpc('fn_nome_usuario', {
              p_user_id: quem,
            });
            if (!errNome && typeof nome === 'string' && nome.trim()) {
              setFechamento({ quando: fechadaEm, por: nome.trim() });
            }
          }
        } else {
          setFechamento(null);
        }
      } else {
        setFechamento(null);
      }

      // 2. Movimentações financeiras (entradas/saídas)
      // Inclui ANULADOS para mostrar na lista com estilo diferente
      const { data: finData } = await supabase
        .from('financeiro')
        .select('id, tipo, categoria, descricao, valor, data_lancamento, created_at, forma_pagamento, cliente_nome, status')
        .eq('liquidacao_id', liquidacao.id)
        .in('status', ['PAGO', 'ANULADO'])
        .order('created_at', { ascending: true });

      setRegistros((finData || []) as MovimentoFinanceiro[]);

      // 3. Pagamentos de parcelas (cobranças do dia - fonte da verdade)
      const { data: pagsData, error: pagsErr } = await supabase
        .from('pagamentos_parcelas')
        .select(`
          id, numero_parcela, valor_pago_total, valor_pago_atual, valor_parcela,
          valor_credito_gerado, valor_credito_usado, forma_pagamento, created_at,
          cliente_id, parcela_id, emprestimo_id, operacao_id, tipo_operacao,
          clientes!pagamentos_parcelas_cliente_id_fkey(nome, consecutivo)
        `)
        .eq('liquidacao_id', liquidacao.id)
        .eq('estornado', false)
        .order('created_at', { ascending: true });

      if (pagsErr) {
        // Fallback sem join
        const { data: pagsSem } = await supabase
          .from('pagamentos_parcelas')
          .select('id, numero_parcela, valor_pago_total, valor_pago_atual, valor_parcela, valor_credito_gerado, valor_credito_usado, forma_pagamento, created_at, cliente_id, parcela_id, emprestimo_id, operacao_id, tipo_operacao')
          .eq('liquidacao_id', liquidacao.id)
          .eq('estornado', false)
          .order('created_at', { ascending: true });

        const ids = [...new Set((pagsSem || []).map((p: any) => p.cliente_id).filter(Boolean))];
        if (ids.length > 0) {
          const { data: clisData } = await supabase
            .from('clientes')
            .select('id, nome')
            .in('id', ids);
          const nomeMap = new Map((clisData || []).map((c: any) => [c.id, c.nome]));
          setPagamentos(
            (pagsSem || []).map((p: any) => ({
              ...p,
              clientes: { nome: nomeMap.get(p.cliente_id) || '' },
            }))
          );
        } else {
          setPagamentos((pagsSem || []) as PagamentoParcela[]);
        }
      } else {
        /**
         * SEM DEDUPLICAÇÃO, e isto é regra de negócio.
         *
         * Cada linha é um RECEBIMENTO, e a mesma parcela PODE receber dois no
         * mesmo dia: pagamento parcial de manhã e o resto à tarde é cobrança
         * normal, não erro de registro.
         *
         * Havia aqui um dedup por `parcela_id` que guardava só o de maior
         * `valor_pago_total` e descartava o outro. Ele nunca apareceu como
         * erro porque o dinheiro descartado não sumia da tela: saía de
         * "Cobrança do dia" e reaparecia logo abaixo como "Diferença não
         * explicada" — a linha que existe justamente para denunciar dinheiro
         * movido fora do dia. Ela estava denunciando o próprio cálculo.
         *
         * Relatado pelo Julio em 26/10/2026 na 4.1 nayivis vnz: 20,00 de
         * diferença que ele não conseguia achar no Financeiro. Estavam lá, os
         * DOIS pagamentos da parcela 15/24 — era o extrato que mostrava um.
         *
         * MEDIDO no mesmo dia, e é o que decide remover em vez de ajustar:
         *   · 14 casos, 316,64, em 9 rotas, desde 10/09/2026;
         *   · nos 14, os dois pagamentos têm `operacao_id` DIFERENTE, ou seja
         *     são dois atos do vendedor;
         *   · linha de fato repetida — mesmo `operacao_id` na mesma parcela —
         *     são ZERO em 19.698 pagamentos.
         * O dedup defendia de algo que nunca aconteceu e destruía o que
         * acontece.
         */
        const ordenados = [...((pagsData || []) as any[])].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setPagamentos(ordenados as PagamentoParcela[]);
      }

      // 4. Empréstimos do dia (separa vendas de renegociações)
      const { data: empsData } = await supabase
        .from('emprestimos')
        .select(`
          id, valor_principal, valor_total, valor_parcela, numero_parcelas,
          taxa_juros, frequencia_pagamento, data_primeiro_vencimento,
          tipo_emprestimo, created_at,
          cliente:cliente_id(nome, codigo_cliente)
        `)
        .eq('liquidacao_id', liquidacao.id)
        .neq('status', 'CANCELADO')
        .order('created_at', { ascending: true });

      const emps = (empsData || []) as any[];
      setVendasDia(
        emps.filter((e: any) => e.tipo_emprestimo !== 'RENEGOCIACAO') as EmprestimoDia[]
      );
      setRenegociacoesDia(
        emps.filter((e: any) => e.tipo_emprestimo === 'RENEGOCIACAO') as EmprestimoDia[]
      );

      // A auditoria só é buscada se o dia foi reaberto. Num dia normal — que é
      // a esmagadora maioria — nem a chamada acontece.
      if (liquidacao.data_reabertura) {
        const { data: audit } = await supabase.rpc('fn_auditoria_liquidacao', {
          p_liquidacao_id: liquidacao.id,
        });
        setAuditoria((audit || []) as EventoAuditoria[]);
      } else {
        setAuditoria([]);
      }
    } catch (error) {
      console.error('Erro ao carregar extrato:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CÁLCULOS
  // ============================================================

  // As reaberturas do dia, e o que veio depois delas.
  //
  // O FECHAMENTO_POS_REABERTURA sai da lista de alterações: ele é o
  // encerramento do episódio, não uma alteração. Fica no bloco de cima, como
  // parte da narrativa "reaberto às 09:16, fechado de novo às 09:22".
  const reaberturas = auditoria.filter(
    (a) => a.tipo === 'REABERTURA' || a.tipo === 'FECHAMENTO_POS_REABERTURA'
  );
  const alteracoesPosReabertura = auditoria.filter(
    (a) => a.depois_da_reabertura && a.tipo !== 'FECHAMENTO_POS_REABERTURA'
  );

  // Empréstimos/renovações que SAEM do caixa (renegociações não saem)
  const totalVendasEmprestimos = vendasDia.reduce(
    (s, e) => s + Number(e.valor_principal || 0),
    0
  );

  // Despesas (PAGAR exceto empréstimos, estornos, microseguro) - exclui ANULADOS
  const totalSaidasDespesas = registros
    .filter(
      (r) =>
        r.tipo === 'PAGAR' &&
        r.status !== 'ANULADO' &&
        r.categoria !== 'ESTORNO_PAGAMENTO' &&
        r.categoria !== 'EMPRESTIMO' &&
        !['RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO'].includes(r.categoria)
    )
    .reduce((s, r) => s + Number(r.valor), 0);

  // Pagamentos que entraram dinheiro de fato (exclui pagamentos só com crédito)
  const pagamentosDinheiro = pagamentos.filter((p) => p.forma_pagamento !== 'CREDITO');
  const totalCobrancas = pagamentosDinheiro.reduce((s, p) => {
    const valorPagoAtual = Number(p.valor_pago_atual || p.valor_pago_total || 0);
    const creditoUsado = Number(p.valor_credito_usado || 0);
    return s + (valorPagoAtual - creditoUsado);
  }, 0);

  // ══════════════════════════════════════════════════════════════════
  // O CRÉDITO DO DIA, POR EMPRÉSTIMO
  // ══════════════════════════════════════════════════════════════════
  //
  // Pedido do Julio em 23/09 e repetido em 21/10/2026: o extrato do web
  // tem de dizer o mesmo que o do aplicativo, sobretudo nos movimentos
  // com crédito. Esta seção é a regra do mobile
  // (`LiquidacaoDetalhes.tsx`) trazida para cá — mesma conta, mesmas
  // palavras, para as duas telas nao poderem discordar.
  //
  // ⚠ O WEB MOSTRAVA `valor_credito_gerado` CRU, E ISSO MENTE.
  // Um pagamento de 576,00 numa parcela de 72,00 gera 504,00 de
  // excedente que a auto-quitação consome no MESMO instante, fechando
  // 7 parcelas. O extrato dizia "Crédito gerado: 504,00" como se o
  // cliente tivesse ficado com o valor, e nao mencionava as parcelas.
  // O que sobrou de verdade é `gerado - consumido`.
  const creditoDoDiaPorEmprestimo = new Map<
    string,
    { consumido: number; oculto: number; parcelas: number }
  >();
  for (const pg of pagamentos) {
    const eid = pg.emprestimo_id;
    if (!eid) continue;
    const a = creditoDoDiaPorEmprestimo.get(eid) || { consumido: 0, oculto: 0, parcelas: 0 };
    const usado = Number(pg.valor_credito_usado || 0);
    a.consumido += usado;
    // `oculto`: crédito consumido por linhas CREDITO, que nao aparecem na
    // lista (o filtro de `pagamentosDinheiro` as remove, e com razão — nao
    // são caixa). Sem anunciá-lo o extrato fecha 8 parcelas mostrando o
    // dinheiro de 6, e o operador nao tem de onde tirar a diferença. Foi a
    // reclamação da Paloma Unhas em 12/09/2026: 360,00 em dinheiro mais
    // 120,00 de crédito quitaram o empréstimo, e os 120,00 nao apareciam
    // em lugar nenhum.
    if (pg.forma_pagamento === 'CREDITO') {
      a.parcelas += 1;
      a.oculto += usado;
    }
    creditoDoDiaPorEmprestimo.set(eid, a);
  }

  // Última linha VISÍVEL de cada empréstimo. O resumo do crédito é do
  // empréstimo, nao do pagamento: repetido em todas as linhas ele
  // multiplica o que houve — seis linhas dizendo "quitou +2 parcelas"
  // viram doze.
  const ultimaLinhaDoEmprestimo = new Map<string, string>();
  for (const pg of pagamentosDinheiro) {
    if (pg.emprestimo_id) ultimaLinhaDoEmprestimo.set(pg.emprestimo_id, pg.id);
  }

  /** Excedente que REALMENTE sobrou, e o resumo do crédito do empréstimo. */
  const creditoLiquido = (pg: PagamentoParcela) => {
    const gerado = Number(pg.valor_credito_gerado || 0);
    const doDia = pg.emprestimo_id
      ? creditoDoDiaPorEmprestimo.get(pg.emprestimo_id)
      : undefined;
    const d = doDia || { consumido: 0, oculto: 0, parcelas: 0 };
    const ehUltima = !!pg.emprestimo_id && ultimaLinhaDoEmprestimo.get(pg.emprestimo_id) === pg.id;
    return {
      excedente: Math.max(0, gerado - d.consumido),
      parcelasQuitadas: ehUltima ? d.parcelas : 0,
      creditoOculto: ehUltima ? d.oculto : 0,
    };
  };

  // ══════════════════════════════════════════════════════════════════
  // O EXTRATO LISTA RECEBIMENTOS, NÃO PARCELAS
  // ══════════════════════════════════════════════════════════════════
  //
  // `pagamentos_parcelas` tem uma linha por PARCELA. Uma quitação de 5
  // parcelas de 61,33 virava cinco linhas de 61,33 — e nenhuma delas é um
  // valor que passou pela mão de alguém. O que passou foi UM dinheiro de
  // 306,65.
  //
  // Relatado pelo Julio em 07/11/2026: o extrato é o que se confere contra
  // caixa e banco, e ali o valor da operação não existia em lugar nenhum.
  //
  // `operacao_id` é o ato do vendedor — 1 para 1 com o lançamento em
  // `financeiro` —, preenchido em 100% dos pagamentos desde 2024.
  //
  // MEDIDO em 07/11/2026, sobre as 18.591 operações com liquidação:
  //   · 1.237 cobrem mais de uma parcela, e geram 7.530 linhas;
  //   · a 5.1 Sebastian em 17/10 mostrava 135 linhas para 48 recebimentos;
  //   · uma operação NUNCA atravessa cliente, empréstimo nem liquidação —
  //     ZERO exceções em 19.849. É isto que torna o agrupamento seguro.
  //
  // ⚠ O TOTAL NÃO MUDA. O dinheiro se distribui por linha, então a soma do
  // grupo é a soma das linhas que ele substitui, e `totalCobrancas` continua
  // saindo de `pagamentosDinheiro`. É mudança de apresentação: o extrato
  // fecha no mesmo número de antes.
  //
  // ⚠ E O DIA COMUM NÃO MUDA DE APARÊNCIA: 17.354 das 18.591 operações têm
  // uma parcela só e seguem renderizadas exatamente como hoje.
  //
  // ⚠ A MESMA REGRA VIVE NO APP (`LiquidacaoDetalhes.tsx`). Se um dos dois
  // agrupasse e o outro não, o vendedor passaria a conferir dois extratos
  // diferentes do mesmo dia — que é pior que o defeito original.
  const recebimentos: Recebimento[] = (() => {
    const porOp = new Map<string, PagamentoParcela[]>();
    for (const pg of pagamentosDinheiro) {
      // Sem `operacao_id` a linha vira o seu próprio recebimento: é o
      // comportamento de antes, e nada desaparece da tela.
      const k = pg.operacao_id || pg.id;
      const arr = porOp.get(k);
      if (arr) arr.push(pg);
      else porOp.set(k, [pg]);
    }
    // A ordem é a de `pagamentosDinheiro`, que já vem por `created_at`: o
    // Map preserva a ordem de inserção.
    return [...porOp.entries()].map(([key, linhas]) => {
      const dinheiro = linhas.reduce(
        (acc, pg) =>
          acc +
          Number(pg.valor_pago_atual || pg.valor_pago_total || 0) -
          Number(pg.valor_credito_usado || 0),
        0
      );

      // ⚠ CRÉDITO SEGUE DETALHADO, a pedido do Julio — e é também o único
      // caso em que a soma seria ambígua: 378 operações têm duas formas de
      // pagamento, e são exatamente a mistura dinheiro + crédito.
      //
      // A pergunta é feita pelo GRUPO *e* pelo empréstimo no dia. Pelo grupo
      // não basta: as linhas de forma CREDITO estão fora de
      // `pagamentosDinheiro` (e com razão — não são caixa), então um grupo
      // pode parecer limpo e ainda assim ter crédito aplicado nele, que é a
      // nota que `fraseCredito` acrescenta à última linha visível do
      // empréstimo. Colapsar esse grupo engoliria a nota.
      const eid = linhas[0].emprestimo_id;
      const doDia = (eid ? creditoDoDiaPorEmprestimo.get(eid) : undefined) || {
        consumido: 0,
        oculto: 0,
        parcelas: 0,
      };
      const temCredito =
        doDia.consumido > 0 ||
        doDia.oculto > 0 ||
        linhas.some((pg) => Number(pg.valor_credito_gerado || 0) > 0);

      return {
        key,
        linhas,
        dinheiro,
        nomeCliente: linhas[0].clientes?.nome || `Parcela ${linhas[0].numero_parcela}`,
        parcelas: linhas.map((pg) => Number(pg.numero_parcela || 0)).sort((x, y) => x - y),
        quitacao: linhas.some((pg) => pg.tipo_operacao === 'QUITACAO'),
        // Uma parcela só já É um recebimento: nada a agrupar, e a linha de
        // hoje diz mais (mostra o valor da parcela).
        detalhar: temCredito || linhas.length === 1,
      };
    });
  })();

  /**
   * A lista que a tela percorre, numerada de 1 a N.
   *
   * Grupo colapsado entra como UM item; grupo detalhado entra como as suas
   * linhas, cada uma renderizada como antes. Assim o caso com crédito não
   * muda nada, que é o que o Julio pediu.
   */
  const itensCobranca: ItemCobranca[] = recebimentos.flatMap((rec): ItemCobranca[] =>
    rec.detalhar ? rec.linhas.map((pg) => ({ p: pg, rec })) : [{ grupo: rec, rec }]
  );

  // Entradas separadas em 3 grupos (exclui ANULADOS do cálculo)
  const registrosEntradas = registros.filter(
    (r) => r.tipo === 'RECEBER' && r.status !== 'CANCELADO' && r.status !== 'ANULADO'
  );
  const entradasMicroseguro = registrosEntradas.filter((r) =>
    ['VENDA_MICROSEGURO', 'MICROSEGURO'].includes(r.categoria)
  );
  const entradasOutras = registrosEntradas.filter(
    (r) =>
      !['COBRANCA_PARCELAS', 'COBRANCA_CUOTAS', 'VENDA_MICROSEGURO', 'MICROSEGURO'].includes(
        r.categoria
      )
  );

  const totalMicroseguros = entradasMicroseguro.reduce((s, r) => s + Number(r.valor), 0);
  const totalOutrasReceitas = entradasOutras.reduce((s, r) => s + Number(r.valor), 0);

  // Ajustes de saldo do dia (AJUSTE, exceto AJUSTE_ABERTURA) — valor já sinalizado.
  // Total líquido: soma direta (negativos reduzem, positivos aumentam).
  const registrosAjustes = registros.filter(
    (r) =>
      (r.tipo as string) === 'AJUSTE' &&
      r.status !== 'CANCELADO' &&
      r.status !== 'ANULADO' &&
      r.categoria !== 'AJUSTE_ABERTURA'
  );
  const totalAjustes = registrosAjustes.reduce((s, r) => s + Number(r.valor), 0);
  const temAjustes = registrosAjustes.length > 0;

  /**
   * A diferença que as linhas não explicam.
   *
   * `caixa_final` é o saldo REAL da conta da rota, lido por
   * `fn_fechar_liquidacao_diaria`. As linhas acima são os movimentos do dia.
   * Quando os dois discordam, há dinheiro que se moveu fora deste dia —
   * tipicamente uma correção retroativa, que altera a conta hoje e pertence a
   * um dia antigo.
   *
   * O fechamento SEMPRE soube disso e gravava em `observacoes`. Ninguém lia.
   * Em outubro de 2026 um vendedor passou quatro dias convencido de que tinha
   * perdido 101,00 porque o extrato não fechava e nada na tela dizia por quê.
   *
   * Mostrar a linha não conserta a divergência — ela é legítima. Conserta o
   * sigaínico: quem lê passa a ver que o sistema sabe, em vez de descobrir
   * subtraindo na mão.
   */
  const caixaFinalGravado = Number(liquidacao?.caixa_final || 0);
  const somaDasLinhas =
    Number(liquidacao?.caixa_inicial || 0) +
    totalCobrancas +
    totalOutrasReceitas +
    totalAjustes -
    totalSaidasDespesas -
    totalVendasEmprestimos;
  const diferencaNaoExplicada = caixaFinalGravado - somaDasLinhas;
  const temDiferenca = !!liquidacao && Math.abs(diferencaNaoExplicada) > 0.01;

  // Lista de saídas para exibição (inclui ANULADOS para mostrar riscados)
  const registrosSaidas = registros.filter(
    (r) =>
      r.tipo === 'PAGAR' &&
      r.status !== 'CANCELADO' &&
      r.categoria !== 'ESTORNO_PAGAMENTO' &&
      r.categoria !== 'EMPRESTIMO' &&
      !['RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO'].includes(r.categoria)
  );

  // ══════════════════════════════════════════════════════════════════
  // O EXTRATO REDESENHADO (19/11/2026) — espelho do app
  // ══════════════════════════════════════════════════════════════════
  //
  // A conta primeiro e o detalhe em blocos (mockup B, aprovado pelo
  // Mauricio). Mesma estrutura de `LiquidacaoDetalhes.tsx` — mudou lá, muda
  // aqui, nas DUAS renderizações (tela e PDF). Uma linha por RECEBIMENTO;
  // empréstimo sem dado de contrato; sem resumo operacional; sem clientes
  // que faltam. ⚠ Os totais não mudam: saem das contas de cima.
  const diaAberto = ['ABERTO', 'REABERTO'].includes(String(liquidacao?.status || '').toUpperCase());
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

  type LinhaCob = {
    key: string; nome: string; criado: string; sub: string; valor: number;
    quitacao: boolean; usado: number; gerado: number; nota: string; soCredito: number;
  };
  const linhasCobranca: LinhaCob[] = (() => {
    const subParcelas = (nums: number[]) => (nums.length === 1 ? `parcela ${nums[0]}` : fraseParcelas(nums));
    const out: LinhaCob[] = recebimentos.map((rec) => ({
      key: rec.key,
      nome: rec.nomeCliente,
      criado: rec.linhas[rec.linhas.length - 1].created_at,
      sub: subParcelas(rec.parcelas),
      valor: rec.dinheiro,
      quitacao: rec.quitacao,
      usado: rec.linhas.reduce((s, pg) => s + Number(pg.valor_credito_usado || 0), 0),
      gerado: rec.linhas.reduce((s, pg) => s + creditoLiquido(pg).excedente, 0),
      nota: rec.linhas.map((pg) => fraseCredito(creditoLiquido(pg), mostrarCredito)).join('').replace(/^ · /, ''),
      soCredito: 0,
    }));
    // Recebimento SÓ de crédito, de empréstimo sem linha em dinheiro no dia:
    // sem isto ele sumia. Aparece com 0,00 e fora da cobrança.
    const comLinha = new Set(pagamentosDinheiro.map((pg) => pg.emprestimo_id).filter(Boolean));
    const soCred = new Map<string, PagamentoParcela[]>();
    for (const pg of pagamentos) {
      if (pg.forma_pagamento !== 'CREDITO' || comLinha.has(pg.emprestimo_id)) continue;
      const k = pg.operacao_id || pg.id;
      const arr = soCred.get(k);
      if (arr) arr.push(pg);
      else soCred.set(k, [pg]);
    }
    for (const [k, ls] of soCred) {
      const nums = ls.map((pg) => Number(pg.numero_parcela || 0)).sort((x, y) => x - y);
      out.push({
        key: 'c' + k,
        nome: ls[0].clientes?.nome || '—',
        criado: ls[ls.length - 1].created_at,
        sub: subParcelas(nums),
        valor: 0,
        quitacao: ls.some((pg) => pg.tipo_operacao === 'QUITACAO'),
        usado: 0, gerado: 0, nota: '',
        soCredito: ls.reduce((s, pg) => s + Number(pg.valor_credito_usado || pg.valor_pago_atual || 0), 0),
      });
    }
    return out.sort((a, b) => (a.criado < b.criado ? -1 : a.criado > b.criado ? 1 : 0));
  })();
  const qtdParcelasCob = recebimentos.reduce((s, r) => s + r.parcelas.length, 0);
  const notaSoCredito = (v: number) =>
    mostrarCredito ? `pago só com crédito: ${formatarMoeda(v)}` : `adiantamento aplicado: ${formatarMoeda(v)}`;

  const tipoEmp = (e: EmprestimoDia) =>
    e.tipo_emprestimo === 'RENOVACAO'
      ? { rot: 'RENOVOU', cor: '#92400E', fundo: '#FEF3C7' }
      : e.tipo_emprestimo === 'ADICIONAL'
      ? { rot: 'ADICIONAL', cor: '#1E40AF', fundo: '#DBEAFE' }
      : { rot: 'NOVO', cor: '#065F46', fundo: '#D1FAE5' };
  const nRenov = vendasDia.filter((e) => e.tipo_emprestimo === 'RENOVACAO').length;
  const nAdic = vendasDia.filter((e) => e.tipo_emprestimo === 'ADICIONAL').length;
  const nNovos = vendasDia.length - nRenov - nAdic;
  const resumoEmprestimos = vendasDia.length === 0 ? 'nenhum' : [
    nNovos ? plural(nNovos, 'novo', 'novos') : '',
    nRenov ? plural(nRenov, 'renovação', 'renovações') : '',
    nAdic ? plural(nAdic, 'adicional', 'adicionais') : '',
  ].filter(Boolean).join(' · ');
  const totalRenegociado = renegociacoesDia.reduce((s, e) => s + Number(e.valor_principal || 0), 0);

  const despesasVivas = registrosSaidas.filter((r) => r.status !== 'ANULADO');
  const nAnuladas = registrosSaidas.length - despesasVivas.length;
  const resumoDespesas = registrosSaidas.length === 0 ? 'nenhuma' : [
    plural(despesasVivas.length, 'lançamento', 'lançamentos'),
    nAnuladas ? plural(nAnuladas, 'anulado', 'anulados') : '',
  ].filter(Boolean).join(' · ');
  const nomeLanc = (r: MovimentoFinanceiro) => r.descricao || r.cliente_nome || formatarCategoria(r.categoria);

  // A conta que FECHA, nas duas pontas (tela e PDF).
  type LinhaConta = { rot: string; txt: string; cor: string };
  const sinal = (v: number) => `${v >= 0 ? '+' : ''}${formatarMoeda(v)}`;
  const caixaInicialDia = Number(liquidacao?.caixa_inicial || 0);
  const linhasConta: LinhaConta[] = [
    { rot: 'Abriu com', txt: formatarMoeda(caixaInicialDia), cor: '#111827' },
    { rot: 'Cobrou', txt: `+${formatarMoeda(totalCobrancas)}`, cor: '#047857' },
  ];
  if (totalOutrasReceitas > 0) linhasConta.push({ rot: 'Outras receitas', txt: `+${formatarMoeda(totalOutrasReceitas)}`, cor: '#047857' });
  if (totalVendasEmprestimos > 0) linhasConta.push({ rot: 'Emprestou', txt: `-${formatarMoeda(totalVendasEmprestimos)}`, cor: '#B91C1C' });
  if (totalSaidasDespesas > 0) linhasConta.push({ rot: 'Gastou', txt: `-${formatarMoeda(totalSaidasDespesas)}`, cor: '#B91C1C' });
  if (temAjustes) linhasConta.push({ rot: 'Ajustes de saldo', txt: sinal(totalAjustes), cor: '#1D4ED8' });
  if (temDiferenca) linhasConta.push({ rot: 'Diferença não explicada', txt: sinal(diferencaNaoExplicada), cor: '#B91C1C' });
  const rotTopo = diaAberto ? 'Saldo do caixa agora' : 'Saldo do caixa no fim do dia';
  const rotFim = diaAberto ? 'Caixa agora' : 'Fechou com';
  const avisoDiferenca = 'Dinheiro que mexeu na conta fora deste dia — em geral uma correção de um dia anterior.';

  const alternarBloco = (id: string) =>
    setBlocosAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const normalizar = (t: string) =>
    (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const buscaNorm = normalizar(buscaCob);
  const linhasCobVisiveis = buscaNorm
    ? linhasCobranca.filter((l) => normalizar(l.nome).includes(buscaNorm))
    : linhasCobranca;

  // ============================================================
  // GERAR HTML PARA IMPRESSÃO / PDF
  // ============================================================

  const handleCompartilharPDF = () => {
    if (!liquidacao) return;
    setGerando(true);
    try {
      const dataLiqStr =
        formatarDataLiquidacaoBR((liquidacao as any).data_liquidacao) ||
        formatarDataLiquidacaoBR(liquidacao.data_abertura);

      // O PDF segue a TELA (mockup B): a conta primeiro, depois os blocos,
      // abertos. Mesmas listas da tela — e a mesma estrutura do app.
      const esc = (s: unknown) =>
        String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const secao = (titulo: string, resumo: string, total: string, cor: string) => `
  <div class="sec">
    <div class="sec-row"><span class="sec-t" style="color:${cor}">${titulo}</span></div>
    ${resumo ? `<div class="sec-res">${esc(resumo)}</div>` : ''}
  </div>`;
      const mov = (
        nome: string,
        valor: string,
        sub: string,
        opc: { cor?: string; cls?: string; badge?: string; badgeCor?: string; badgeFundo?: string; extra?: string } = {}
      ) => `
  <div class="mov${opc.cls || ''}">
    <div class="mov-row"><span class="mov-cat">${esc(nome)}</span><span class="mov-val" style="color:${opc.cor || '#111827'}">${valor}</span></div>
    <div class="mov-sub">${opc.badge ? `<span class="badge" style="color:${opc.badgeCor};background:${opc.badgeFundo}">${opc.badge}</span> ` : ''}${esc(sub)}</div>${opc.extra || ''}
  </div>`;

      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Extrato ${dataLiqStr}</title>
<style>
  @page { margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; font-size: 13px; color: #1F2937; padding: 16px; }
  .container { max-width: 600px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; text-align: center; }
  .sub { text-align: center; color: #6B7280; font-size: 12px; margin-bottom: 2px; }
  .selo { text-align: center; margin: 10px auto 0; padding: 7px 12px; border: 1px dashed #D1D5DB; border-radius: 6px; background: #F9FAFB; max-width: 300px; }
  .selo-t { font-size: 11px; font-weight: 700; color: #374151; letter-spacing: 0.5px; }
  .selo div:not(.selo-t) { font-size: 11px; color: #6B7280; margin-top: 2px; }
  .conta { margin-top: 14px; padding: 14px 16px; border: 1px solid #E5E7EB; border-radius: 10px; }
  .topo-rot { font-size: 12px; color: #4B5563; }
  .topo-val { font-size: 26px; font-weight: 700; margin: 2px 0 8px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 3px 0; }
  .row .r { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .fim { border-top: 1px solid #E5E7EB; margin-top: 4px; padding-top: 6px; font-weight: 700; font-size: 14px; }
  .aviso { font-size: 11px; color: #991B1B; margin-top: 6px; }
  .b { font-weight: 700; }
  .sec { margin-top: 18px; padding-bottom: 6px; border-bottom: 2px solid #E5E7EB; }
  .sec-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .sec-t { font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
  .sec-res { font-size: 11px; color: #6B7280; margin-top: 2px; }
  .mov { padding: 7px 4px; border-bottom: 1px solid #F3F4F6; }
  .mov.quit { background: #F5F3FF; border-radius: 6px; padding: 7px 8px; }
  .mov.risc .mov-cat, .mov.risc .mov-val { color: #9CA3AF !important; text-decoration: line-through; }
  .mov-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .mov-cat { font-weight: 500; }
  .mov-val { font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .mov-sub { color: #6B7280; font-size: 11px; margin-top: 2px; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }
  .cred { margin-top: 4px; padding: 4px 8px; background: #FFFBEB; border-radius: 6px; font-size: 11px; color: #78350F; }
  .cred .row { padding: 1px 0; }
  .vazio { text-align: center; color: #9CA3AF; font-size: 12px; padding: 8px 0; }
  .saldo { display: flex; justify-content: space-between; margin-top: 18px; padding-top: 10px; border-top: 2px solid #9CA3AF; font-size: 16px; font-weight: 700; }
</style></head>
<body><div class="container">

  <h1>${esc(rotaNome || 'Rota')}</h1>
  ${vendedorNome ? `<div class="sub">${esc(vendedorNome)}</div>` : ''}
  ${empresaNome ? `<div class="sub">${esc(empresaNome)}</div>` : ''}
  <div class="sub">${dataLiqStr}</div>
  ${fechamento ? `<div class="selo">
    <div class="selo-t">🔒 SISTEMA FECHADO</div>
    <div>${formatarDataHora(fechamento.quando)}</div>
    ${fechamento.por ? `<div>por ${esc(fechamento.por)}</div>` : ''}
  </div>` : ''}

  <div class="conta">
    <div class="topo-rot">${rotTopo}</div>
    <div class="topo-val" style="color:${caixaFinalGravado < 0 ? '#B91C1C' : '#111827'}">${formatarMoeda(caixaFinalGravado)}</div>
    ${linhasConta.map((l, i) => `<div class="row"><span style="color:${i === 0 ? '#4B5563' : l.cor}">${l.rot}</span><span class="r" style="color:${l.cor}">${l.txt}</span></div>`).join('')}
    <div class="row fim"><span>${rotFim}</span><span class="r">${formatarMoeda(caixaFinalGravado)}</span></div>
    ${temDiferenca ? `<div class="aviso">${avisoDiferenca}</div>` : ''}
  </div>

  ${secao('Cobranças',
    linhasCobranca.length === 0 ? 'nenhuma' : `${plural(linhasCobranca.length, 'recebimento', 'recebimentos')} · ${plural(qtdParcelasCob, 'parcela', 'parcelas')}`,
    formatarMoeda(totalCobrancas), '#047857')}
  ${linhasCobranca.map((l) => {
    const cred = mostrarCredito && (l.usado > 0 || l.gerado > 0)
      ? `<div class="cred">${l.usado > 0
          ? `<div class="row"><span>Abateu das parcelas</span><span class="r">${formatarMoeda(l.valor + l.usado)}</span></div>
             <div class="row"><span>Usou de crédito</span><span class="r">-${formatarMoeda(l.usado)}</span></div>`
          : ''}${l.gerado > 0
          ? `<div class="row"><span>Crédito gerado</span><span class="r">+${formatarMoeda(l.gerado)}</span></div>`
          : ''}</div>`
      : '';
    const notas = [l.soCredito > 0 ? notaSoCredito(l.soCredito) : '', l.nota].filter(Boolean)
      .map((n) => `<div class="mov-sub">${esc(n)}</div>`).join('');
    return mov(l.nome, formatarMoeda(l.valor), `${formatarHora(l.criado)} · ${l.sub}`, {
      cor: l.soCredito > 0 ? '#9CA3AF' : l.quitacao ? '#6D28D9' : '#111827',
      cls: l.quitacao ? ' quit' : '',
      badge: l.quitacao ? 'QUITOU' : '',
      badgeCor: '#5B21B6',
      badgeFundo: '#EDE9FE',
      extra: cred + notas,
    });
  }).join('')}

  ${entradasOutras.length > 0 ? `
  ${secao('Outras receitas', plural(entradasOutras.length, 'lançamento', 'lançamentos'), `+${formatarMoeda(totalOutrasReceitas)}`, '#047857')}
  ${entradasOutras.map((r) => mov(nomeLanc(r), `+${formatarMoeda(Number(r.valor))}`, `${formatarHora(r.created_at)} · ${formatarCategoria(r.categoria)}`, { cor: '#047857' })).join('')}
  ` : ''}

  ${secao('Empréstimos', resumoEmprestimos, `-${formatarMoeda(totalVendasEmprestimos)}`, '#B91C1C')}
  ${vendasDia.map((e) => {
    const tp = tipoEmp(e);
    return mov(e.cliente?.nome || '—', `-${formatarMoeda(Number(e.valor_principal || 0))}`, formatarHora(e.created_at), {
      cor: '#B91C1C', badge: tp.rot, badgeCor: tp.cor, badgeFundo: tp.fundo,
    });
  }).join('')}

  ${renegociacoesDia.length > 0 ? `
  ${secao('Renegociações', `${plural(renegociacoesDia.length, 'renegociação', 'renegociações')} · não sai do caixa`, formatarMoeda(totalRenegociado), '#B45309')}
  ${renegociacoesDia.map((e) => mov(e.cliente?.nome || '—', formatarMoeda(Number(e.valor_principal || 0)), formatarHora(e.created_at), { cor: '#B45309' })).join('')}
  ` : ''}

  ${secao('Despesas', resumoDespesas, `-${formatarMoeda(totalSaidasDespesas)}`, '#B91C1C')}
  ${registrosSaidas.map((r) => {
    const anulado = r.status === 'ANULADO';
    return mov(nomeLanc(r), `-${formatarMoeda(Number(r.valor))}`,
      `${formatarHora(r.created_at)} · ${anulado ? 'ANULADO' : formatarCategoria(r.categoria)}`,
      { cor: '#B91C1C', cls: anulado ? ' risc' : '' });
  }).join('')}

  ${entradasMicroseguro.length > 0 ? `
  ${secao('Microsseguro', `${plural(entradasMicroseguro.length, 'venda', 'vendas')} · caixa próprio`, `+${formatarMoeda(totalMicroseguros)}`, '#6D28D9')}
  ${entradasMicroseguro.map((r) => mov(r.cliente_nome || r.descricao || '—', `+${formatarMoeda(Number(r.valor))}`, formatarHora(r.created_at), { cor: '#6D28D9' })).join('')}
  ` : ''}

  ${reaberturas.length > 0 ? `
  ${secao('Dia reaberto', plural(alteracoesPosReabertura.length, 'alteração depois', 'alterações depois'), '', '#1D4ED8')}
  ${reaberturas.map((ev) => mov(
    ev.tipo === 'REABERTURA' ? 'Reaberta' : 'Fechada novamente',
    formatarHora(ev.momento),
    `${ev.usuario || '—'}${ev.motivo ? ` · Motivo: ${ev.motivo}` : ''}`
  )).join('')}
  <div class="sec-res b" style="margin-top:8px">Após a reabertura</div>
  ${alteracoesPosReabertura.length === 0
    ? `<div class="vazio">Nenhuma alteração registrada.</div>`
    : alteracoesPosReabertura.map((ev) => mov(
        ev.descricao || ev.tipo,
        ev.impacto_caixa === null ? '—' : formatarMoeda(ev.impacto_caixa),
        `${formatarHora(ev.momento)} · ${ev.usuario || '—'}`
      )).join('')}
  ` : ''}

  <div class="saldo"><span>Saldo final</span><span>${formatarMoeda(caixaFinalGravado)}</span></div>
  <div class="sub" style="margin-top:12px;color:#9CA3AF">*** FIM DO EXTRATO ***</div>

</div></body></html>`;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF');
    } finally {
      setGerando(false);
    }
  };

  if (!isOpen || !liquidacao) return null;

  const dataLiqStr =
    formatarDataLiquidacaoBR((liquidacao as any).data_liquidacao) ||
    formatarDataLiquidacaoBR(liquidacao.data_abertura);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Extrato do Dia</h2>
              <p className="text-sm text-gray-500">{dataLiqStr}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCompartilharPDF}
              disabled={loading || gerando}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {gerando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo — a conta primeiro, o detalhe em blocos (mockup B) */}
        <div className="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900">{rotaNome}</h3>
                <p className="text-sm text-gray-600">
                  {[vendedorNome, empresaNome, dataLiqStr].filter(Boolean).join(' · ')}
                </p>
              </div>

              {/* A CONTA */}
              <div className="bg-white rounded-xl p-4 sm:p-5">
                <p className="text-xs text-gray-600">{rotTopo}</p>
                <p className={`text-3xl font-bold tabular-nums ${caixaFinalGravado < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                  {formatarMoeda(caixaFinalGravado)}
                </p>
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
                  {linhasConta.map((l, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0" style={{ color: i === 0 ? '#4B5563' : l.cor }}>{l.rot}</span>
                      <span className="tabular-nums font-medium whitespace-nowrap" style={{ color: l.cor }}>{l.txt}</span>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3 pt-2 border-t border-gray-200 text-sm font-bold text-gray-900">
                    <span>{rotFim}</span>
                    <span className="tabular-nums whitespace-nowrap">{formatarMoeda(caixaFinalGravado)}</span>
                  </div>
                </div>
                {temDiferenca && <p className="mt-2 text-xs text-red-900">{avisoDiferenca}</p>}
              </div>

              {fechamento && (
                <div className="flex items-center gap-2 rounded-lg bg-gray-200 px-3 py-2 text-xs text-gray-700">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Sistema fechado · {formatarDataHora(fechamento.quando)}
                    {fechamento.por ? ` · ${fechamento.por}` : ''}
                  </span>
                </div>
              )}

              {/* COBRANÇAS — uma linha por recebimento */}
              <BlocoExtrato
                aberto={blocosAbertos.has('cob')}
                onToggle={() => alternarBloco('cob')}
                Icone={ArrowDown}
                cor="#047857"
                fundo="#D1FAE5"
                titulo="Cobranças"
                resumo={linhasCobranca.length === 0 ? 'nenhuma'
                  : `${plural(linhasCobranca.length, 'recebimento', 'recebimentos')} · ${plural(qtdParcelasCob, 'parcela', 'parcelas')}`}
                valor={formatarMoeda(totalCobrancas)}
                vazio={linhasCobranca.length === 0}
              >
                {linhasCobranca.length > 8 && (
                  <div className="relative my-2">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <label htmlFor="extrato-busca" className="sr-only">Procurar cliente</label>
                    <input
                      id="extrato-busca"
                      type="search"
                      value={buscaCob}
                      onChange={(e) => setBuscaCob(e.target.value)}
                      placeholder="Procurar cliente"
                      className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm"
                    />
                  </div>
                )}
                {linhasCobVisiveis.map((l) => (
                  <div key={l.key} className={`py-2 px-1 border-b border-gray-100 last:border-0 ${l.quitacao ? 'bg-violet-50 rounded-lg px-2' : ''}`}>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{l.nome}</p>
                        <p className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
                          {l.quitacao && (
                            <span className="text-[10px] font-bold px-1.5 rounded bg-violet-100 text-violet-800">QUITOU</span>
                          )}
                          <span>{formatarHora(l.criado)} · {l.sub}</span>
                        </p>
                      </div>
                      <span className={`text-sm tabular-nums whitespace-nowrap ${l.soCredito > 0 ? 'text-gray-400' : l.quitacao ? 'text-violet-700 font-bold' : 'text-gray-900 font-medium'}`}>
                        {formatarMoeda(l.valor)}
                      </span>
                    </div>
                    {l.soCredito > 0 && <p className="text-xs text-gray-500 mt-0.5">{notaSoCredito(l.soCredito)}</p>}
                    {mostrarCredito && (l.usado > 0 || l.gerado > 0) && (
                      <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 space-y-0.5">
                        {l.usado > 0 && (
                          <>
                            <div className="flex justify-between gap-3"><span>Abateu das parcelas</span><span className="tabular-nums">{formatarMoeda(l.valor + l.usado)}</span></div>
                            <div className="flex justify-between gap-3"><span>Usou de crédito</span><span className="tabular-nums">-{formatarMoeda(l.usado)}</span></div>
                          </>
                        )}
                        {l.gerado > 0 && (
                          <div className="flex justify-between gap-3"><span>Crédito gerado</span><span className="tabular-nums">+{formatarMoeda(l.gerado)}</span></div>
                        )}
                      </div>
                    )}
                    {!!l.nota && <p className="text-xs text-gray-500 mt-0.5">{l.nota}</p>}
                  </div>
                ))}
                {linhasCobVisiveis.length === 0 && (
                  <p className="text-center text-sm text-gray-500 py-3">Nenhum cliente com esse nome</p>
                )}
              </BlocoExtrato>

              {entradasOutras.length > 0 && (
                <BlocoExtrato
                  aberto={blocosAbertos.has('rec')}
                  onToggle={() => alternarBloco('rec')}
                  Icone={Plus}
                  cor="#047857"
                  fundo="#D1FAE5"
                  titulo="Outras receitas"
                  resumo={plural(entradasOutras.length, 'lançamento', 'lançamentos')}
                  valor={formatarMoeda(totalOutrasReceitas)}
                >
                  {entradasOutras.map((r) => (
                    <LinhaBloco key={r.id} nome={nomeLanc(r)} sub={`${formatarHora(r.created_at)} · ${formatarCategoria(r.categoria)}`}
                      valor={`+${formatarMoeda(Number(r.valor))}`} cor="#047857" />
                  ))}
                </BlocoExtrato>
              )}

              {/* EMPRÉSTIMOS — quem, quanto saiu, novo ou renovação */}
              <BlocoExtrato
                aberto={blocosAbertos.has('emp')}
                onToggle={() => alternarBloco('emp')}
                Icone={ArrowUp}
                cor="#B91C1C"
                fundo="#FEE2E2"
                titulo="Empréstimos"
                resumo={resumoEmprestimos}
                valor={formatarMoeda(totalVendasEmprestimos)}
                vazio={vendasDia.length === 0}
              >
                {vendasDia.map((e) => {
                  const tp = tipoEmp(e);
                  return (
                    <LinhaBloco key={e.id} nome={e.cliente?.nome || '—'} sub={formatarHora(e.created_at)}
                      valor={`-${formatarMoeda(Number(e.valor_principal || 0))}`} cor="#B91C1C"
                      badge={{ rot: tp.rot, cor: tp.cor, fundo: tp.fundo }} />
                  );
                })}
              </BlocoExtrato>

              {renegociacoesDia.length > 0 && (
                <BlocoExtrato
                  aberto={blocosAbertos.has('reneg')}
                  onToggle={() => alternarBloco('reneg')}
                  Icone={Repeat}
                  cor="#B45309"
                  fundo="#FEF3C7"
                  titulo="Renegociações"
                  resumo={`${plural(renegociacoesDia.length, 'renegociação', 'renegociações')} · não sai do caixa`}
                  valor={formatarMoeda(totalRenegociado)}
                >
                  {renegociacoesDia.map((e) => (
                    <LinhaBloco key={e.id} nome={e.cliente?.nome || '—'} sub={formatarHora(e.created_at)}
                      valor={formatarMoeda(Number(e.valor_principal || 0))} cor="#B45309" />
                  ))}
                </BlocoExtrato>
              )}

              {/* DESPESAS — anulada fica, riscada e fora do total */}
              <BlocoExtrato
                aberto={blocosAbertos.has('desp')}
                onToggle={() => alternarBloco('desp')}
                Icone={Minus}
                cor="#B91C1C"
                fundo="#FEE2E2"
                titulo="Despesas"
                resumo={resumoDespesas}
                valor={formatarMoeda(totalSaidasDespesas)}
                vazio={registrosSaidas.length === 0}
              >
                {registrosSaidas.map((r) => {
                  const anulado = r.status === 'ANULADO';
                  return (
                    <LinhaBloco key={r.id} nome={nomeLanc(r)}
                      sub={`${formatarHora(r.created_at)} · ${anulado ? 'ANULADO' : formatarCategoria(r.categoria)}`}
                      valor={`-${formatarMoeda(Number(r.valor))}`} cor="#B91C1C" riscado={anulado} />
                  );
                })}
              </BlocoExtrato>

              {entradasMicroseguro.length > 0 && (
                <BlocoExtrato
                  aberto={blocosAbertos.has('micro')}
                  onToggle={() => alternarBloco('micro')}
                  Icone={ShieldCheck}
                  cor="#6D28D9"
                  fundo="#EDE9FE"
                  titulo="Microsseguro"
                  resumo={`${plural(entradasMicroseguro.length, 'venda', 'vendas')} · caixa próprio`}
                  valor={formatarMoeda(totalMicroseguros)}
                >
                  {entradasMicroseguro.map((r) => (
                    <LinhaBloco key={r.id} nome={r.cliente_nome || r.descricao || '—'} sub={formatarHora(r.created_at)}
                      valor={`+${formatarMoeda(Number(r.valor))}`} cor="#6D28D9" />
                  ))}
                </BlocoExtrato>
              )}

              {/* DIA REABERTO — o MOTIVO aparece aqui e NÃO no extrato do
                  vendedor: quem recebe o comprovante no celular não tem o
                  que fazer com ele. */}
              {reaberturas.length > 0 && (
                <BlocoExtrato
                  aberto={blocosAbertos.has('reab')}
                  onToggle={() => alternarBloco('reab')}
                  Icone={LockOpen}
                  cor="#1D4ED8"
                  fundo="#DBEAFE"
                  titulo="Dia reaberto"
                  resumo={plural(alteracoesPosReabertura.length, 'alteração depois', 'alterações depois')}
                >
                  {reaberturas.map((ev, i) => (
                    <LinhaBloco key={`reab-${i}`} nome={ev.tipo === 'REABERTURA' ? 'Reaberta' : 'Fechada novamente'}
                      sub={`${ev.usuario || '—'}${ev.motivo ? ` · Motivo: ${ev.motivo}` : ''}`}
                      valor={formatarHora(ev.momento)} cor="#4B5563" />
                  ))}
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mt-2 mb-1">Após a reabertura</p>
                  {alteracoesPosReabertura.length === 0 ? (
                    // Dizer "nenhuma" é informação: um dia reaberto e fechado
                    // sem mexer em nada é o que um auditor quer ver confirmado.
                    <p className="text-xs text-gray-500 py-1">Nenhuma alteração registrada.</p>
                  ) : (
                    alteracoesPosReabertura.map((ev, i) => (
                      // Impacto nulo é "não derivável", não zero. Ver o
                      // COMMENT de fn_auditoria_liquidacao.
                      <LinhaBloco key={`alt-${i}`} nome={ev.descricao || ev.tipo}
                        sub={`${formatarHora(ev.momento)} · ${ev.usuario || '—'}`}
                        valor={ev.impacto_caixa === null ? '—' : formatarMoeda(ev.impacto_caixa)}
                        cor={(ev.impacto_caixa || 0) < 0 ? '#B91C1C' : '#047857'} />
                    ))
                  )}
                </BlocoExtrato>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// EXTRATO REDESENHADO (19/11/2026) — bloco e linha
// =====================================================

function BlocoExtrato({
  aberto,
  onToggle,
  Icone,
  cor,
  fundo,
  titulo,
  resumo,
  valor,
  vazio,
  children,
}: {
  aberto: boolean;
  onToggle: () => void;
  Icone: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  cor: string;
  fundo: string;
  titulo: string;
  resumo: string;
  valor?: string;
  vazio?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        disabled={vazio}
        aria-expanded={aberto}
        className="w-full flex items-center gap-3 px-4 py-3 text-left enabled:hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
      >
        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: fundo }}>
          <Icone className="w-4 h-4" style={{ color: cor }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-900">{titulo}</span>
          <span className="block text-xs text-gray-600">{resumo}</span>
        </span>
        {valor != null && (
          <span className="text-sm font-bold tabular-nums whitespace-nowrap" style={{ color: cor }}>{valor}</span>
        )}
        {!vazio && (aberto ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />)}
      </button>
      {aberto && !vazio && <div className="border-t border-gray-200 px-4 py-1">{children}</div>}
    </div>
  );
}

function LinhaBloco({
  nome,
  sub,
  valor,
  cor,
  riscado,
  badge,
}: {
  nome: string;
  sub: string;
  valor: string;
  cor: string;
  riscado?: boolean;
  badge?: { rot: string; cor: string; fundo: string };
}) {
  return (
    <div className="py-2 border-b border-gray-100 last:border-0 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-sm truncate ${riscado ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{nome}</p>
        <p className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
          {badge && (
            <span className="text-[10px] font-bold px-1.5 rounded" style={{ color: badge.cor, backgroundColor: badge.fundo }}>
              {badge.rot}
            </span>
          )}
          <span>{sub}</span>
        </p>
      </div>
      <span
        className={`text-sm font-medium tabular-nums whitespace-nowrap ${riscado ? 'line-through' : ''}`}
        style={{ color: riscado ? '#9CA3AF' : cor }}
      >
        {valor}
      </span>
    </div>
  );
}

// =====================================================
// COMPONENTES AUXILIARES (apenas para o web)
// =====================================================

function Linha({
  label,
  valor,
  cor,
  bold,
  large,
}: {
  label: string;
  valor: string | number;
  cor?: 'verde' | 'verm' | 'roxo' | 'ambar' | 'azul';
  bold?: boolean;
  large?: boolean;
}) {
  const corClass =
    cor === 'verde'
      ? 'text-green-600'
      : cor === 'verm'
      ? 'text-red-600'
      : cor === 'roxo'
      ? 'text-purple-600'
      : cor === 'ambar'
      ? 'text-amber-600'
      : cor === 'azul'
      ? 'text-blue-600'
      : 'text-gray-900';
  const sizeClass = large ? 'text-lg' : 'text-sm';
  const weightClass = bold ? 'font-bold' : 'font-medium';
  return (
    <div className="flex justify-between items-baseline py-1">
      <span className={`${sizeClass} ${corClass}`}>{label}</span>
      <span className={`${sizeClass} ${corClass} ${weightClass}`}>{valor}</span>
    </div>
  );
}

function Secao({ titulo, cor, children }: { titulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-center py-2 border-t border-b border-dashed border-gray-300">
        <h3 className={`text-sm font-bold uppercase tracking-wider ${cor}`}>{titulo}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CardEmprestimo({ emp, idx }: { emp: EmprestimoDia; idx: number }) {
  const clienteNome = emp.cliente?.nome || '—';
  const clienteCodigo = emp.cliente?.codigo_cliente ? `#${emp.cliente.codigo_cliente} ` : '';
  const isRenovacao = emp.tipo_emprestimo === 'RENOVACAO';
  const isAdicional = emp.tipo_emprestimo === 'ADICIONAL';
  const tipoLabel = isRenovacao ? '🔄 RENOVAÇÃO' : isAdicional ? '➕ ADICIONAL' : '🆕 NOVO';
  const badgeCor = isRenovacao
    ? 'text-amber-700 bg-amber-100'
    : isAdicional
    ? 'text-purple-700 bg-purple-100'
    : 'text-green-700 bg-green-100';
  const primeiroPgto = formatarDataParcela(emp.data_primeiro_vencimento);
  const juros = Number(emp.valor_total || 0) - Number(emp.valor_principal || 0);

  return (
    <div className="p-3 bg-red-50 rounded-lg border-l-4 border-red-400">
      <div className="mb-1">
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${badgeCor}`}>
          {tipoLabel}
        </span>
      </div>
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-gray-900">
          {String(idx + 1).padStart(2, '0')} {clienteCodigo}{clienteNome}
        </span>
        <span className="text-sm font-bold text-red-600 whitespace-nowrap pl-2">
          -{formatarMoeda(Number(emp.valor_principal))}
        </span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        1° pgto: {primeiroPgto} · {emp.numero_parcelas}x {formatarMoeda(Number(emp.valor_parcela))} ·{' '}
        juros {formatarMoeda(juros)} ({emp.taxa_juros}%)
      </div>
      <div className="text-[10px] text-gray-400 mt-1">{formatarHora(emp.created_at)}</div>
    </div>
  );
}

function CardRenegociacao({ emp, idx }: { emp: EmprestimoDia; idx: number }) {
  const clienteNome = emp.cliente?.nome || '—';
  const primeiroPgto = formatarDataParcela(emp.data_primeiro_vencimento);
  const juros = Number(emp.valor_total || 0) - Number(emp.valor_principal || 0);

  return (
    <div className="p-3 bg-amber-50 rounded-lg border-l-4 border-amber-400">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-gray-900">
          {String(idx + 1).padStart(2, '0')} {clienteNome}
        </span>
        <span className="text-sm font-bold text-amber-600 whitespace-nowrap pl-2">
          {formatarMoeda(Number(emp.valor_principal))}
        </span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        1° pgto: {primeiroPgto} · {emp.numero_parcelas}x {formatarMoeda(Number(emp.valor_parcela))} ·{' '}
        juros {formatarMoeda(juros)} ({emp.taxa_juros}%)
      </div>
      <div className="text-[10px] text-gray-400 mt-1">{formatarHora(emp.created_at)}</div>
    </div>
  );
}

// `liq` vem de fora porque o resumo do crédito é do EMPRÉSTIMO, nao desta
// linha: só quem vê a liquidação inteira sabe quanto do excedente foi
// consumido no mesmo dia e qual é a última linha de cada empréstimo.
function CardCobranca({
  p,
  idx,
  liq,
  mostrarCredito = true,
}: {
  p: PagamentoParcela;
  idx: number;
  liq: CreditoLiquido;
  mostrarCredito?: boolean;
}) {
  const nomeCliente = p.clientes?.nome || `Parcela ${p.numero_parcela}`;
  const valorPagoAtual = Number(p.valor_pago_atual || p.valor_pago_total || 0);
  const creditoUsado = Number(p.valor_credito_usado || 0);
  const dinheiroRecebido = valorPagoAtual - creditoUsado;

  return (
    <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-400">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-gray-900">
          {String(idx + 1).padStart(2, '0')} {nomeCliente}
        </span>
        <span className="text-sm font-bold text-green-600 whitespace-nowrap pl-2">
          +{formatarMoeda(dinheiroRecebido)}
        </span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        Parcela {p.numero_parcela}: {formatarMoeda(Number(p.valor_parcela || 0))}
        {creditoUsado > 0 && mostrarCredito && ` · ${formatarMoeda(creditoUsado)} com crédito`}
        {fraseCredito(liq, mostrarCredito)}
        {liq.excedente > 0 && mostrarCredito && ` · Crédito gerado: ${formatarMoeda(liq.excedente)}`}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">
        {formatarHora(p.created_at)}
        {p.forma_pagamento && ` · ${formatarFormaPagamento(p.forma_pagamento)}`}
      </div>
    </div>
  );
}

/**
 * UM RECEBIMENTO QUE COBRIU VARIAS PARCELAS.
 *
 * O valor da OPERACAO em cima — que e o que se confere contra o caixa e o
 * banco — e a quantidade de parcelas embaixo. Pedido do Julio em
 * 07/11/2026: "mostrar primeiro o valor realmente recebido na operacao e
 * abaixo apenas informar que corresponde a 5 parcelas".
 */
function CardRecebimento({ rec, idx }: { rec: Recebimento; idx: number }) {
  const base = rec.linhas[0];
  // Quitacao tem cor propria: e ela que explica todo salto de numero do dia.
  const corValor = rec.quitacao ? 'text-purple-600' : 'text-green-600';
  const borda = rec.quitacao ? 'border-purple-400' : 'border-green-400';

  return (
    <div className={`p-3 bg-green-50 rounded-lg border-l-4 ${borda}`}>
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-gray-900">
          {String(idx + 1).padStart(2, '0')} {rec.nomeCliente}
        </span>
        <span className={`text-sm font-bold ${corValor} whitespace-nowrap pl-2`}>
          +{formatarMoeda(rec.dinheiro)}
        </span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        {fraseParcelas(rec.parcelas)}
        {rec.quitacao && ' · quitação'}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">
        {formatarHora(base.created_at)}
        {base.forma_pagamento && ` · ${formatarFormaPagamento(base.forma_pagamento)}`}
      </div>
    </div>
  );
}

function CardLinhaSimples({
  idx,
  titulo,
  subtitulo,
  valor,
  hora,
  forma,
  corValor,
  bgColor,
}: {
  idx: number;
  titulo: string;
  subtitulo?: string;
  valor: string;
  hora: string;
  forma?: string;
  corValor: string;
  bgColor: string;
}) {
  return (
    <div className={`p-3 ${bgColor} rounded-lg border-l-4 border-gray-300`}>
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-gray-900">
          {String(idx + 1).padStart(2, '0')} {titulo}
        </span>
        <span className={`text-sm font-bold whitespace-nowrap pl-2 ${corValor}`}>{valor}</span>
      </div>
      {subtitulo && <div className="text-xs text-gray-600 mt-1">{subtitulo}</div>}
      <div className="text-[10px] text-gray-400 mt-1">
        {hora}
        {forma && ` · ${forma}`}
      </div>
    </div>
  );
}