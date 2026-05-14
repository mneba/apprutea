'use client';

import { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Share2,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { LiquidacaoDiaria } from '@/types/liquidacao';

// =====================================================
// TIPOS
// =====================================================

interface MovimentoFinanceiro {
  id: string;
  tipo: 'RECEBER' | 'PAGAR';
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
  clientes?: { nome: string; consecutivo?: string } | null;
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

function formatarMoeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

function formatarHora(data: string | null | undefined): string {
  if (!data) return '';
  return new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const [registros, setRegistros] = useState<MovimentoFinanceiro[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoParcela[]>([]);
  const [vendasDia, setVendasDia] = useState<EmprestimoDia[]>([]);
  const [renegociacoesDia, setRenegociacoesDia] = useState<EmprestimoDia[]>([]);
  const [resumoOp, setResumoOp] = useState<ResumoOperacional>({
    pagos: 0,
    naoPagos: 0,
    novos: 0,
    renovados: 0,
    renegociados: 0,
  });

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
        .select('clientes_pagos, clientes_nao_pagos, clientes_novos, clientes_renovados, clientes_renegociados')
        .eq('id', liquidacao.id)
        .single();

      if (liqExtra) {
        setResumoOp({
          pagos: (liqExtra as any).clientes_pagos || 0,
          naoPagos: (liqExtra as any).clientes_nao_pagos || 0,
          novos: (liqExtra as any).clientes_novos || 0,
          renovados: (liqExtra as any).clientes_renovados || 0,
          renegociados: (liqExtra as any).clientes_renegociados || 0,
        });
      }

      // 2. Movimentações financeiras (entradas/saídas)
      const { data: finData } = await supabase
        .from('financeiro')
        .select('id, tipo, categoria, descricao, valor, data_lancamento, created_at, forma_pagamento, cliente_nome, status')
        .eq('liquidacao_id', liquidacao.id)
        .eq('status', 'PAGO')
        .order('created_at', { ascending: true });

      setRegistros((finData || []) as MovimentoFinanceiro[]);

      // 3. Pagamentos de parcelas (cobranças do dia - fonte da verdade)
      const { data: pagsData, error: pagsErr } = await supabase
        .from('pagamentos_parcelas')
        .select(`
          id, numero_parcela, valor_pago_total, valor_pago_atual, valor_parcela,
          valor_credito_gerado, valor_credito_usado, forma_pagamento, created_at,
          cliente_id, parcela_id, emprestimo_id,
          clientes!pagamentos_parcelas_cliente_id_fkey(nome, consecutivo)
        `)
        .eq('liquidacao_id', liquidacao.id)
        .eq('estornado', false)
        .order('created_at', { ascending: true });

      if (pagsErr) {
        // Fallback sem join
        const { data: pagsSem } = await supabase
          .from('pagamentos_parcelas')
          .select('id, numero_parcela, valor_pago_total, valor_pago_atual, valor_parcela, valor_credito_gerado, valor_credito_usado, forma_pagamento, created_at, cliente_id, parcela_id, emprestimo_id')
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
        // Deduplicar por parcela_id (ou emprestimo+numero, ou cliente+numero)
        const mapaDedup = new Map<string, any>();
        for (const p of (pagsData || []) as any[]) {
          const key = p.parcela_id || `${p.emprestimo_id}-${p.numero_parcela}` || `${p.cliente_id}-${p.numero_parcela}`;
          const existing = mapaDedup.get(key);
          const totalAtual = parseFloat(p.valor_pago_total || 0);
          const totalExistente = existing ? parseFloat(existing.valor_pago_total || 0) : -1;
          if (!existing || totalAtual > totalExistente) {
            mapaDedup.set(key, p);
          }
        }
        const deduped = Array.from(mapaDedup.values()).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setPagamentos(deduped as PagamentoParcela[]);
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
    } catch (error) {
      console.error('Erro ao carregar extrato:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CÁLCULOS
  // ============================================================

  // Empréstimos/renovações que SAEM do caixa (renegociações não saem)
  const totalVendasEmprestimos = vendasDia.reduce(
    (s, e) => s + Number(e.valor_principal || 0),
    0
  );

  // Despesas (PAGAR exceto empréstimos, estornos, microseguro)
  const totalSaidasDespesas = registros
    .filter(
      (r) =>
        r.tipo === 'PAGAR' &&
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

  // Entradas separadas em 3 grupos
  const registrosEntradas = registros.filter(
    (r) => r.tipo === 'RECEBER' && r.status !== 'CANCELADO'
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

  const registrosSaidas = registros.filter(
    (r) =>
      r.tipo === 'PAGAR' &&
      r.status !== 'CANCELADO' &&
      r.categoria !== 'ESTORNO_PAGAMENTO' &&
      r.categoria !== 'EMPRESTIMO' &&
      !['RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO'].includes(r.categoria)
  );

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
  .sep { border: none; border-top: 1px dashed #D1D5DB; margin: 10px 0; }
  .sep2 { border: none; border-top: 2px solid #9CA3AF; margin: 12px 0; }
  .row { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 0; }
  .b { font-weight: 600; }
  .lg { font-size: 16px; font-weight: 700; }
  .verde { color: #059669; }
  .verm { color: #DC2626; }
  .roxo { color: #7C3AED; }
  .ambar { color: #D97706; }
  .cinza { color: #9CA3AF; }
  .secao { text-align: center; font-weight: 700; font-size: 13px; margin-top: 16px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .item { margin-top: 6px; padding: 8px 10px; background: #F9FAFB; border-radius: 6px; border-left: 3px solid #E5E7EB; }
  .item-row { display: flex; justify-content: space-between; align-items: baseline; }
  .item-cat { font-weight: 600; }
  .item-val { font-weight: 700; white-space: nowrap; padding-left: 8px; }
  .item-sub { color: #6B7280; font-size: 11px; margin-top: 2px; }
  .item-meta { color: #9CA3AF; font-size: 10px; margin-top: 2px; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-bottom: 4px; }
  .total-line { display: flex; justify-content: space-between; padding: 6px 10px; background: #F3F4F6; border-radius: 4px; margin-top: 8px; }
</style></head>
<body><div class="container">

  <h1>${rotaNome || 'Rota'}</h1>
  ${vendedorNome ? `<div class="sub">${vendedorNome}</div>` : ''}
  ${empresaNome ? `<div class="sub">${empresaNome}</div>` : ''}
  <div class="sub">${dataLiqStr}</div>
  <hr class="sep2">

  <div class="row"><span>Caixa inicial</span><span>${formatarMoeda(liquidacao.caixa_inicial)}</span></div>
  <div class="row"><span class="verde">(+) Cobrança do dia</span><span class="verde">${formatarMoeda(totalCobrancas)}</span></div>
  <div class="row"><span class="verde">(+) Receitas do dia</span><span class="verde">${formatarMoeda(totalOutrasReceitas)}</span></div>
  <div class="row"><span class="verm">(-) Despesas do dia</span><span class="verm">${formatarMoeda(totalSaidasDespesas)}</span></div>
  ${totalVendasEmprestimos > 0 ? `<div class="row"><span class="verm">(-) Empréstimos do dia</span><span class="verm">${formatarMoeda(totalVendasEmprestimos)}</span></div>` : ''}
  <hr class="sep2">
  <div class="row"><span class="lg">(=) Caixa final</span><span class="lg">${formatarMoeda(liquidacao.caixa_final)}</span></div>

  ${vendasDia.length > 0 ? `
  <div class="secao verm">Empréstimos do Dia</div>
  <hr class="sep">
  ${vendasDia.map((emp, idx) => {
    const clienteNome = emp.cliente?.nome || '—';
    const clienteCodigo = emp.cliente?.codigo_cliente ? `#${emp.cliente.codigo_cliente} ` : '';
    const isRenovacao = emp.tipo_emprestimo === 'RENOVACAO';
    const isAdicional = emp.tipo_emprestimo === 'ADICIONAL';
    const tipoLabel = isRenovacao ? '🔄 RENOVAÇÃO' : isAdicional ? '➕ ADICIONAL' : '🆕 NOVO';
    const tipoCor = isRenovacao ? '#D97706' : isAdicional ? '#7C3AED' : '#059669';
    const primeiroPgto = formatarDataParcela(emp.data_primeiro_vencimento);
    return `<div class="item">
      <span class="badge" style="color:${tipoCor};background:${tipoCor}20">${tipoLabel}</span>
      <div class="item-row">
        <span class="item-cat">${String(idx + 1).padStart(2, '0')} ${clienteCodigo}${clienteNome}</span>
        <span class="item-val verm">-${formatarMoeda(Number(emp.valor_principal))}</span>
      </div>
      <div class="item-sub">1° pgto: ${primeiroPgto} · ${emp.numero_parcelas}x ${formatarMoeda(Number(emp.valor_parcela))} · ${emp.taxa_juros}%</div>
      <div class="item-meta">${formatarHora(emp.created_at)}</div>
    </div>`;
  }).join('')}
  <div class="total-line"><span class="verm b">TOTAL EMPRÉSTIMOS</span><span class="verm b">-${formatarMoeda(totalVendasEmprestimos)}</span></div>
  ` : ''}

  ${renegociacoesDia.length > 0 ? `
  <div class="secao ambar">Renegociações</div>
  <hr class="sep">
  ${renegociacoesDia.map((emp, idx) => {
    const clienteNome = emp.cliente?.nome || '—';
    const primeiroPgto = formatarDataParcela(emp.data_primeiro_vencimento);
    return `<div class="item">
      <div class="item-row">
        <span class="item-cat">${String(idx + 1).padStart(2, '0')} ${clienteNome}</span>
        <span class="item-val ambar">${formatarMoeda(Number(emp.valor_principal))}</span>
      </div>
      <div class="item-sub">1° pgto: ${primeiroPgto} · ${emp.numero_parcelas}x ${formatarMoeda(Number(emp.valor_parcela))} · ${emp.taxa_juros}%</div>
      <div class="item-meta">${formatarHora(emp.created_at)}</div>
    </div>`;
  }).join('')}
  <div class="total-line"><span class="ambar b">TOTAL RENEGOCIAÇÕES</span><span class="ambar b">${formatarMoeda(renegociacoesDia.reduce((s, e) => s + Number(e.valor_principal || 0), 0))}</span></div>
  ` : ''}

  ${entradasMicroseguro.length > 0 ? `
  <div class="secao roxo">Microseguros</div>
  <hr class="sep">
  ${entradasMicroseguro.map((item, idx) => `
    <div class="item">
      <div class="item-row">
        <span class="item-cat">${String(idx + 1).padStart(2, '0')} ${item.cliente_nome || item.descricao || '—'}</span>
        <span class="item-val roxo">+${formatarMoeda(Number(item.valor))}</span>
      </div>
      <div class="item-meta">${formatarHora(item.created_at)}</div>
    </div>`).join('')}
  <div class="total-line"><span class="roxo b">TOTAL MICROSEGUROS</span><span class="roxo b">${formatarMoeda(totalMicroseguros)}</span></div>
  ` : ''}

  <div class="secao">Resumo Operacional</div>
  <div class="row"><span>Clientes pagos</span><span class="verde b">${resumoOp.pagos}</span></div>
  <div class="row"><span>Clientes não pagos</span><span class="verm b">${resumoOp.naoPagos}</span></div>
  <div class="row"><span>Clientes novos</span><span>${resumoOp.novos}</span></div>
  <div class="row"><span>Renovações</span><span>${resumoOp.renovados}</span></div>
  <div class="row"><span>Renegociações</span><span>${resumoOp.renegociados}</span></div>

  <div class="secao">Detalhes Entradas (${pagamentosDinheiro.length + entradasOutras.length})</div>
  ${pagamentosDinheiro.length === 0 && entradasOutras.length === 0 ? `<div class="sub cinza">Nenhuma entrada</div>` : `
    ${pagamentosDinheiro.length > 0 ? `
      <div class="sub cinza">── Cobranças de Parcelas (${pagamentosDinheiro.length}) ──</div>
      ${pagamentosDinheiro.map((p, idx) => {
        const nomeCliente = p.clientes?.nome || `Parcela ${p.numero_parcela}`;
        const excedente = Number(p.valor_credito_gerado || 0);
        const valorPagoAtual = Number(p.valor_pago_atual || p.valor_pago_total || 0);
        const creditoUsado = Number(p.valor_credito_usado || 0);
        const dinheiroRecebido = valorPagoAtual - creditoUsado;
        return `<div class="item">
          <div class="item-row">
            <span class="item-cat">${String(idx + 1).padStart(2, '0')} ${nomeCliente}</span>
            <span class="item-val verde">+${formatarMoeda(dinheiroRecebido)}</span>
          </div>
          ${excedente > 0 ? `<div class="item-sub">Parcela: ${formatarMoeda(Number(p.valor_parcela || 0))} · Excedente: ${formatarMoeda(excedente)}</div>` : ''}
          <div class="item-meta">${formatarHora(p.created_at)}${p.forma_pagamento ? ` · ${formatarFormaPagamento(p.forma_pagamento)}` : ''}</div>
        </div>`;
      }).join('')}
      <div class="total-line"><span class="verde b">TOTAL COBRANÇAS</span><span class="verde b">${formatarMoeda(totalCobrancas)}</span></div>
    ` : ''}
    ${entradasOutras.length > 0 ? `
      <div class="sub cinza" style="margin-top:12px">── Outras Receitas (${entradasOutras.length}) ──</div>
      ${entradasOutras.map((item, idx) => `
        <div class="item">
          <div class="item-row">
            <span class="item-cat">${String(idx + 1).padStart(2, '0')} ${formatarCategoria(item.categoria)}</span>
            <span class="item-val verde">+${formatarMoeda(Number(item.valor))}</span>
          </div>
          ${item.cliente_nome ? `<div class="item-sub">${item.cliente_nome}</div>` : ''}
          <div class="item-meta">${formatarHora(item.created_at)}${item.forma_pagamento ? ` · ${formatarFormaPagamento(item.forma_pagamento)}` : ''}</div>
        </div>`).join('')}
      <div class="total-line"><span class="verde b">TOTAL OUTRAS RECEITAS</span><span class="verde b">${formatarMoeda(totalOutrasReceitas)}</span></div>
    ` : ''}
  `}

  <div class="secao">Detalhes Saídas (${registrosSaidas.length})</div>
  ${registrosSaidas.length === 0 ? `<div class="sub cinza">Nenhuma saída</div>` :
    registrosSaidas.map((item, idx) => {
      const principal = item.cliente_nome || formatarCategoria(item.categoria);
      const sub = item.cliente_nome && item.descricao ? item.descricao : '';
      return `<div class="item">
        <div class="item-row">
          <span class="item-cat">${String(idx + 1).padStart(2, '0')} ${principal}</span>
          <span class="item-val verm">-${formatarMoeda(Number(item.valor))}</span>
        </div>
        ${sub ? `<div class="item-sub">${sub}</div>` : ''}
        <div class="item-meta">${formatarHora(item.created_at)}${item.forma_pagamento ? ` · ${formatarFormaPagamento(item.forma_pagamento)}` : ''}</div>
      </div>`;
    }).join('')}
  ${registrosSaidas.length > 0 ? `<div class="total-line"><span class="verm b">TOTAL SAÍDAS</span><span class="verm b">-${formatarMoeda(totalSaidasDespesas)}</span></div>` : ''}

  <hr class="sep2">
  <div class="row"><span class="lg">Saldo Final</span><span class="lg">${formatarMoeda(liquidacao.caixa_final)}</span></div>
  <hr class="sep2">
  <div class="sub cinza" style="margin-top:12px">*** FIM DO EXTRATO ***</div>

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

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Cabeçalho do extrato */}
              <div className="text-center pb-4 border-b border-dashed border-gray-300">
                <h3 className="text-xl font-bold text-gray-900">{rotaNome}</h3>
                {vendedorNome && <p className="text-sm text-gray-600 mt-1">{vendedorNome}</p>}
                {empresaNome && <p className="text-xs text-gray-500">{empresaNome}</p>}
                <p className="text-sm text-gray-500 mt-1">{dataLiqStr}</p>
              </div>

              {/* Resumo de caixa */}
              <div className="space-y-2">
                <Linha label="Caixa inicial" valor={formatarMoeda(liquidacao.caixa_inicial)} />
                <Linha label="(+) Cobrança do dia" valor={formatarMoeda(totalCobrancas)} cor="verde" />
                <Linha label="(+) Receitas do dia" valor={formatarMoeda(totalOutrasReceitas)} cor="verde" />
                <Linha label="(-) Despesas do dia" valor={formatarMoeda(totalSaidasDespesas)} cor="verm" />
                {totalVendasEmprestimos > 0 && (
                  <Linha label="(-) Empréstimos do dia" valor={formatarMoeda(totalVendasEmprestimos)} cor="verm" />
                )}
                <div className="border-t-2 border-gray-300 pt-3">
                  <Linha label="(=) Caixa final" valor={formatarMoeda(liquidacao.caixa_final)} bold large />
                </div>
              </div>

              {/* Empréstimos do dia */}
              {vendasDia.length > 0 && (
                <Secao titulo="Empréstimos do Dia" cor="text-red-600">
                  {vendasDia.map((emp, idx) => (
                    <CardEmprestimo key={emp.id} emp={emp} idx={idx} />
                  ))}
                  <div className="flex justify-between items-center px-3 py-2 bg-red-50 rounded mt-2">
                    <span className="text-sm font-semibold text-red-700">TOTAL EMPRÉSTIMOS</span>
                    <span className="text-sm font-bold text-red-700">-{formatarMoeda(totalVendasEmprestimos)}</span>
                  </div>
                </Secao>
              )}

              {/* Renegociações */}
              {renegociacoesDia.length > 0 && (
                <Secao titulo="Renegociações" cor="text-amber-600">
                  {renegociacoesDia.map((emp, idx) => (
                    <CardRenegociacao key={emp.id} emp={emp} idx={idx} />
                  ))}
                  <div className="flex justify-between items-center px-3 py-2 bg-amber-50 rounded mt-2">
                    <span className="text-sm font-semibold text-amber-700">TOTAL RENEGOCIAÇÕES</span>
                    <span className="text-sm font-bold text-amber-700">
                      {formatarMoeda(renegociacoesDia.reduce((s, e) => s + Number(e.valor_principal || 0), 0))}
                    </span>
                  </div>
                </Secao>
              )}

              {/* Microseguros */}
              {entradasMicroseguro.length > 0 && (
                <Secao titulo="Microseguros" cor="text-purple-600">
                  {entradasMicroseguro.map((item, idx) => (
                    <CardLinhaSimples
                      key={item.id}
                      idx={idx}
                      titulo={item.cliente_nome || item.descricao || '—'}
                      valor={`+${formatarMoeda(Number(item.valor))}`}
                      hora={formatarHora(item.created_at)}
                      corValor="text-purple-600"
                      bgColor="bg-purple-50"
                    />
                  ))}
                  <div className="flex justify-between items-center px-3 py-2 bg-purple-50 rounded mt-2">
                    <span className="text-sm font-semibold text-purple-700">TOTAL MICROSEGUROS</span>
                    <span className="text-sm font-bold text-purple-700">+{formatarMoeda(totalMicroseguros)}</span>
                  </div>
                </Secao>
              )}

              {/* Resumo operacional */}
              <Secao titulo="Resumo Operacional" cor="text-gray-700">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Linha label="Clientes pagos" valor={resumoOp.pagos} cor="verde" />
                  <Linha label="Clientes não pagos" valor={resumoOp.naoPagos} cor="verm" />
                  <Linha label="Clientes novos" valor={resumoOp.novos} />
                  <Linha label="Renovações" valor={resumoOp.renovados} />
                  <Linha label="Renegociações" valor={resumoOp.renegociados} />
                </div>
              </Secao>

              {/* Detalhes entradas */}
              <Secao
                titulo={`Detalhes Entradas (${pagamentosDinheiro.length + entradasOutras.length})`}
                cor="text-green-700"
              >
                {pagamentosDinheiro.length === 0 && entradasOutras.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">Nenhuma entrada</div>
                ) : (
                  <>
                    {pagamentosDinheiro.length > 0 && (
                      <>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 mt-2">
                          ── Cobranças de Parcelas ({pagamentosDinheiro.length}) ──
                        </div>
                        {pagamentosDinheiro.map((p, idx) => (
                          <CardCobranca key={p.id} p={p} idx={idx} />
                        ))}
                        <div className="flex justify-between items-center px-3 py-2 bg-green-50 rounded mt-2">
                          <span className="text-sm font-semibold text-green-700">TOTAL COBRANÇAS</span>
                          <span className="text-sm font-bold text-green-700">
                            +{formatarMoeda(totalCobrancas)}
                          </span>
                        </div>
                      </>
                    )}
                    {entradasOutras.length > 0 && (
                      <>
                        <div className="text-xs text-gray-500 uppercase tracking-wide mb-2 mt-4">
                          ── Outras Receitas ({entradasOutras.length}) ──
                        </div>
                        {entradasOutras.map((item, idx) => (
                          <CardLinhaSimples
                            key={item.id}
                            idx={idx}
                            titulo={formatarCategoria(item.categoria)}
                            subtitulo={item.cliente_nome || undefined}
                            valor={`+${formatarMoeda(Number(item.valor))}`}
                            hora={formatarHora(item.created_at)}
                            forma={formatarFormaPagamento(item.forma_pagamento)}
                            corValor="text-green-600"
                            bgColor="bg-green-50"
                          />
                        ))}
                        <div className="flex justify-between items-center px-3 py-2 bg-green-50 rounded mt-2">
                          <span className="text-sm font-semibold text-green-700">TOTAL OUTRAS RECEITAS</span>
                          <span className="text-sm font-bold text-green-700">
                            +{formatarMoeda(totalOutrasReceitas)}
                          </span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </Secao>

              {/* Detalhes saídas */}
              <Secao titulo={`Detalhes Saídas (${registrosSaidas.length})`} cor="text-red-700">
                {registrosSaidas.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-sm">Nenhuma saída</div>
                ) : (
                  <>
                    {registrosSaidas.map((item, idx) => (
                      <CardLinhaSimples
                        key={item.id}
                        idx={idx}
                        titulo={item.cliente_nome || formatarCategoria(item.categoria)}
                        subtitulo={item.cliente_nome && item.descricao ? item.descricao : undefined}
                        valor={`-${formatarMoeda(Number(item.valor))}`}
                        hora={formatarHora(item.created_at)}
                        forma={formatarFormaPagamento(item.forma_pagamento)}
                        corValor="text-red-600"
                        bgColor="bg-red-50"
                      />
                    ))}
                    <div className="flex justify-between items-center px-3 py-2 bg-red-50 rounded mt-2">
                      <span className="text-sm font-semibold text-red-700">TOTAL SAÍDAS</span>
                      <span className="text-sm font-bold text-red-700">-{formatarMoeda(totalSaidasDespesas)}</span>
                    </div>
                  </>
                )}
              </Secao>

              {/* Saldo final */}
              <div className="border-t-2 border-gray-300 pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Saldo Final</span>
                  <span>{formatarMoeda(liquidacao.caixa_final)}</span>
                </div>
              </div>

              <div className="text-center text-xs text-gray-400 pt-4 border-t border-dashed border-gray-300">
                *** FIM DO EXTRATO ***
              </div>
            </div>
          )}
        </div>
      </div>
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
  cor?: 'verde' | 'verm' | 'roxo' | 'ambar';
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
        {emp.taxa_juros}%
      </div>
      <div className="text-[10px] text-gray-400 mt-1">{formatarHora(emp.created_at)}</div>
    </div>
  );
}

function CardRenegociacao({ emp, idx }: { emp: EmprestimoDia; idx: number }) {
  const clienteNome = emp.cliente?.nome || '—';
  const primeiroPgto = formatarDataParcela(emp.data_primeiro_vencimento);

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
        {emp.taxa_juros}%
      </div>
      <div className="text-[10px] text-gray-400 mt-1">{formatarHora(emp.created_at)}</div>
    </div>
  );
}

function CardCobranca({ p, idx }: { p: PagamentoParcela; idx: number }) {
  const nomeCliente = p.clientes?.nome || `Parcela ${p.numero_parcela}`;
  const excedente = Number(p.valor_credito_gerado || 0);
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
      {excedente > 0 && (
        <div className="text-xs text-gray-600 mt-1">
          Parcela: {formatarMoeda(Number(p.valor_parcela || 0))} · Excedente: {formatarMoeda(excedente)}
        </div>
      )}
      <div className="text-[10px] text-gray-400 mt-1">
        {formatarHora(p.created_at)}
        {p.forma_pagamento && ` · ${formatarFormaPagamento(p.forma_pagamento)}`}
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