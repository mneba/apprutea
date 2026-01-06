// =====================================================
// SERVICE DO MÓDULO FINANCEIRO - SISTEMA BELLA KIDS
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type {
  Conta,
  ContaComDetalhes,
  CategoriaFinanceira,
  MovimentoFinanceiro,
  SaldosContas,
  ResumoMovimentacoes,
  DadosGrafico,
  NovaMovimentacaoInput,
  TransferenciaInput,
  AjusteSaldoInput,
  FiltrosExtrato,
  PeriodoFiltro,
} from '@/types/financeiro';

// =====================================================
// HELPERS DE DATA
// =====================================================

function getDatasPeriodo(periodo: PeriodoFiltro): { inicio: string; fim: string } {
  const hoje = new Date();
  const fim = hoje.toISOString().split('T')[0];
  
  let inicio: Date;
  
  switch (periodo) {
    case 'hoje':
      inicio = hoje;
      break;
    case 'ontem':
      inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - 1);
      return {
        inicio: inicio.toISOString().split('T')[0],
        fim: inicio.toISOString().split('T')[0],
      };
    case '7dias':
      inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - 6);
      break;
    case '15dias':
      inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - 14);
      break;
    case '30dias':
      inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - 29);
      break;
    case 'mes_fechado':
      // Primeiro dia do mês anterior
      inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      // Último dia do mês anterior
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return {
        inicio: inicio.toISOString().split('T')[0],
        fim: fimMes.toISOString().split('T')[0],
      };
    default:
      inicio = hoje;
  }
  
  return {
    inicio: inicio.toISOString().split('T')[0],
    fim,
  };
}

// =====================================================
// SERVICE PRINCIPAL
// =====================================================

export const financeiroService = {
  // ==================================================
  // BUSCAR SALDOS DAS CONTAS
  // ==================================================
  async buscarSaldosContas(empresaId: string): Promise<SaldosContas> {
    const supabase = createClient();
    
    const { data: contas, error } = await supabase
      .from('contas')
      .select(`
        id,
        tipo_conta,
        numero,
        nome,
        saldo_atual,
        empresa_id,
        rota_id,
        microseguro_id,
        status,
        created_at,
        updated_at,
        empresas:empresa_id (nome),
        rotas:rota_id (nome),
        microseguros:microseguro_id (nome)
      `)
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVA')
      .order('tipo_conta');
    
    if (error) {
      console.error('Erro ao buscar saldos:', error);
      return {
        total_consolidado: 0,
        saldo_empresa: 0,
        saldo_rotas: 0,
        saldo_microseguros: 0,
        contas: [],
      };
    }
    
    const contasFormatadas: ContaComDetalhes[] = (contas || []).map((c: any) => ({
      ...c,
      empresa_nome: c.empresas?.nome,
      rota_nome: c.rotas?.nome,
      microseguro_nome: c.microseguros?.nome,
    }));
    
    const saldo_empresa = contasFormatadas
      .filter(c => c.tipo_conta === 'EMPRESA')
      .reduce((acc, c) => acc + (c.saldo_atual || 0), 0);
    
    const saldo_rotas = contasFormatadas
      .filter(c => c.tipo_conta === 'ROTA')
      .reduce((acc, c) => acc + (c.saldo_atual || 0), 0);
    
    const saldo_microseguros = contasFormatadas
      .filter(c => c.tipo_conta === 'MICROSEGURO')
      .reduce((acc, c) => acc + (c.saldo_atual || 0), 0);
    
    return {
      total_consolidado: saldo_empresa + saldo_rotas + saldo_microseguros,
      saldo_empresa,
      saldo_rotas,
      saldo_microseguros,
      contas: contasFormatadas,
    };
  },

  // ==================================================
  // BUSCAR CONTAS PARA DROPDOWN
  // ==================================================
  async buscarContas(empresaId: string): Promise<ContaComDetalhes[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('contas')
      .select(`
        id,
        tipo_conta,
        numero,
        nome,
        saldo_atual,
        empresa_id,
        rota_id,
        microseguro_id,
        status,
        created_at,
        updated_at,
        empresas:empresa_id (nome),
        rotas:rota_id (nome),
        microseguros:microseguro_id (nome)
      `)
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVA')
      .order('tipo_conta')
      .order('nome');
    
    if (error) {
      console.error('Erro ao buscar contas:', error);
      return [];
    }
    
    return (data || []).map((c: any) => ({
      ...c,
      empresa_nome: c.empresas?.nome,
      rota_nome: c.rotas?.nome,
      microseguro_nome: c.microseguros?.nome,
    }));
  },

  // ==================================================
  // BUSCAR RESUMO DE MOVIMENTAÇÕES POR PERÍODO
  // ==================================================
  async buscarResumoMovimentacoes(
    empresaId: string,
    periodo: PeriodoFiltro
  ): Promise<ResumoMovimentacoes> {
    const supabase = createClient();
    const { inicio, fim } = getDatasPeriodo(periodo);
    
    // Buscar todas as contas da empresa
    const { data: contas } = await supabase
      .from('contas')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVA');
    
    const contaIds = (contas || []).map(c => c.id);
    
    if (contaIds.length === 0) {
      return {
        total_entradas: 0,
        total_saidas: 0,
        saldo_periodo: 0,
        qtd_entradas: 0,
        qtd_saidas: 0,
        qtd_total: 0,
      };
    }
    
    // Buscar movimentos do período
    const { data: movimentos, error } = await supabase
      .from('financeiro')
      .select('tipo, valor, status')
      .or(`conta_destino_id.in.(${contaIds.join(',')}),conta_origem_id.in.(${contaIds.join(',')})`)
      .gte('data_lancamento', inicio)
      .lte('data_lancamento', fim)
      .neq('status', 'CANCELADO')
      .neq('status', 'ANULADO');
    
    if (error) {
      console.error('Erro ao buscar resumo:', error);
      return {
        total_entradas: 0,
        total_saidas: 0,
        saldo_periodo: 0,
        qtd_entradas: 0,
        qtd_saidas: 0,
        qtd_total: 0,
      };
    }
    
    const entradas = (movimentos || []).filter(m => m.tipo === 'RECEBER');
    const saidas = (movimentos || []).filter(m => m.tipo === 'PAGAR');
    
    const total_entradas = entradas.reduce((acc, m) => acc + (m.valor || 0), 0);
    const total_saidas = saidas.reduce((acc, m) => acc + (m.valor || 0), 0);
    
    return {
      total_entradas,
      total_saidas,
      saldo_periodo: total_entradas - total_saidas,
      qtd_entradas: entradas.length,
      qtd_saidas: saidas.length,
      qtd_total: (movimentos || []).length,
    };
  },

  // ==================================================
  // BUSCAR DADOS PARA GRÁFICO
  // ==================================================
  async buscarDadosGrafico(
    empresaId: string,
    periodo: PeriodoFiltro
  ): Promise<DadosGrafico[]> {
    const supabase = createClient();
    const { inicio, fim } = getDatasPeriodo(periodo);
    
    // Buscar todas as contas da empresa
    const { data: contas } = await supabase
      .from('contas')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVA');
    
    const contaIds = (contas || []).map(c => c.id);
    
    if (contaIds.length === 0) return [];
    
    // Buscar movimentos agrupados por data
    const { data: movimentos, error } = await supabase
      .from('financeiro')
      .select('tipo, valor, data_lancamento')
      .or(`conta_destino_id.in.(${contaIds.join(',')}),conta_origem_id.in.(${contaIds.join(',')})`)
      .gte('data_lancamento', inicio)
      .lte('data_lancamento', fim)
      .neq('status', 'CANCELADO')
      .neq('status', 'ANULADO')
      .order('data_lancamento');
    
    if (error) {
      console.error('Erro ao buscar dados do gráfico:', error);
      return [];
    }
    
    // Agrupar por data
    const agrupado: Record<string, { entradas: number; saidas: number }> = {};
    
    (movimentos || []).forEach(m => {
      const data = m.data_lancamento;
      if (!agrupado[data]) {
        agrupado[data] = { entradas: 0, saidas: 0 };
      }
      if (m.tipo === 'RECEBER') {
        agrupado[data].entradas += m.valor || 0;
      } else if (m.tipo === 'PAGAR') {
        agrupado[data].saidas += m.valor || 0;
      }
    });
    
    return Object.entries(agrupado).map(([data, valores]) => ({
      data,
      entradas: valores.entradas,
      saidas: valores.saidas,
    }));
  },

  // ==================================================
  // BUSCAR EXTRATO DETALHADO
  // ==================================================
  async buscarExtrato(
    empresaId: string,
    filtros: FiltrosExtrato
  ): Promise<MovimentoFinanceiro[]> {
    const supabase = createClient();
    const { inicio, fim } = getDatasPeriodo(filtros.periodo);
    
    let query = supabase
      .from('financeiro')
      .select('*')
      .gte('data_lancamento', inicio)
      .lte('data_lancamento', fim)
      .order('data_lancamento', { ascending: false })
      .order('created_at', { ascending: false });
    
    // Filtrar por conta específica ou todas da empresa
    if (filtros.conta_id) {
      query = query.or(`conta_destino_id.eq.${filtros.conta_id},conta_origem_id.eq.${filtros.conta_id}`);
    } else {
      // Buscar IDs de todas as contas da empresa
      const { data: contas } = await supabase
        .from('contas')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('status', 'ATIVA');
      
      const contaIds = (contas || []).map(c => c.id);
      if (contaIds.length > 0) {
        query = query.or(`conta_destino_id.in.(${contaIds.join(',')}),conta_origem_id.in.(${contaIds.join(',')})`);
      }
    }
    
    // Filtros adicionais
    if (filtros.categoria) {
      query = query.eq('categoria', filtros.categoria);
    }
    if (filtros.tipo) {
      query = query.eq('tipo', filtros.tipo);
    }
    if (filtros.status) {
      query = query.eq('status', filtros.status);
    }
    
    const { data, error } = await query.limit(100);
    
    if (error) {
      console.error('Erro ao buscar extrato:', error);
      return [];
    }
    
    return data || [];
  },

  // ==================================================
  // BUSCAR CATEGORIAS FINANCEIRAS
  // ==================================================
  async buscarCategorias(tipoConta?: string): Promise<CategoriaFinanceira[]> {
    const supabase = createClient();
    
    let query = supabase
      .from('categorias_financeiras')
      .select('*')
      .eq('ativo', true)
      .order('ordem_exibicao')
      .order('nome_pt');
    
    // Filtrar por aplicabilidade
    if (tipoConta === 'EMPRESA') {
      query = query.eq('aplicavel_empresa', true);
    } else if (tipoConta === 'ROTA') {
      query = query.eq('aplicavel_rota', true);
    } else if (tipoConta === 'MICROSEGURO') {
      query = query.eq('aplicavel_microseguro', true);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar categorias:', error);
      return [];
    }
    
    return data || [];
  },

  // ==================================================
  // CRIAR NOVA MOVIMENTAÇÃO
  // ==================================================
  async criarMovimentacao(input: NovaMovimentacaoInput, createdBy?: string): Promise<{ success: boolean; error?: string; id?: string }> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('financeiro')
      .insert({
        tipo: input.tipo,
        categoria: input.categoria,
        descricao: input.descricao,
        valor: input.valor,
        conta_destino_id: input.conta_destino_id,
        data_lancamento: input.data_lancamento || new Date().toISOString().split('T')[0],
        data_vencimento: input.data_vencimento,
        data_pagamento: input.tipo === 'RECEBER' ? new Date().toISOString().split('T')[0] : null,
        status: 'PAGO',
        forma_pagamento: input.forma_pagamento,
        observacoes: input.observacoes,
        created_by: createdBy,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Erro ao criar movimentação:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, id: data.id };
  },

  // ==================================================
  // CRIAR TRANSFERÊNCIA ENTRE CONTAS
  // ==================================================
  async criarTransferencia(input: TransferenciaInput, createdBy?: string): Promise<{ success: boolean; error?: string; id?: string }> {
    const supabase = createClient();
    
    // Usar a function do Supabase para transferência
    const { data, error } = await supabase.rpc('transferir_entre_contas', {
      p_conta_origem_id: input.conta_origem_id,
      p_conta_destino_id: input.conta_destino_id,
      p_valor: input.valor,
      p_descricao: input.descricao || 'Transferência entre contas',
      p_observacoes: input.observacoes,
      p_created_by: createdBy,
    });
    
    if (error) {
      console.error('Erro ao criar transferência:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, id: data };
  },

  // ==================================================
  // CRIAR AJUSTE DE SALDO
  // ==================================================
  async criarAjusteSaldo(input: AjusteSaldoInput, createdBy?: string): Promise<{ success: boolean; error?: string; id?: string }> {
    const supabase = createClient();
    
    const tipo = input.valor > 0 ? 'RECEBER' : 'PAGAR';
    
    const { data, error } = await supabase
      .from('financeiro')
      .insert({
        tipo: 'AJUSTE',
        categoria: 'AJUSTE_SALDO',
        descricao: `Ajuste de saldo: ${input.motivo}`,
        valor: Math.abs(input.valor),
        conta_destino_id: input.conta_id,
        data_lancamento: new Date().toISOString().split('T')[0],
        data_pagamento: new Date().toISOString().split('T')[0],
        status: 'PAGO',
        observacoes: input.observacoes,
        created_by: createdBy,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Erro ao criar ajuste:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, id: data.id };
  },
};
