// =====================================================
// SERVICE DO MÓDULO DE LIQUIDAÇÃO DIÁRIA - SISTEMA APPRUTEA
// Integrado com Functions do Supabase
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type {
  LiquidacaoDiaria,
  VendedorLiquidacao,
  RotaLiquidacao,
  ContaRota,
  ClienteDoDia,
  MicroseguroDoDia,
  AbrirLiquidacaoInput,
  FecharLiquidacaoInput,
  ReabrirLiquidacaoInput,
  RespostaAbrirLiquidacao,
  RespostaFecharLiquidacao,
  FiltrosClientesDia,
  FiltrosHistoricoLiquidacoes,
  EstatisticasClientesDia,
} from '@/types/liquidacao';

// =====================================================
// SERVICE PRINCIPAL
// =====================================================

export const liquidacaoService = {
  // ==================================================
  // BUSCAR VENDEDOR LOGADO
  // ==================================================
  async buscarVendedorPorUserId(userId: string): Promise<VendedorLiquidacao | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('vendedores')
      .select('id, nome, codigo_vendedor, telefone, email, foto_url, status')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Erro ao buscar vendedor:', error);
      return null;
    }
    
    return data;
  },

  // ==================================================
  // BUSCAR ROTA DO VENDEDOR
  // ==================================================
  async buscarRotaVendedor(vendedorId: string): Promise<RotaLiquidacao | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('rotas')
      .select('id, nome, codigo, empresa_id')
      .eq('vendedor_id', vendedorId)
      .eq('status', 'ATIVA')
      .single();
    
    if (error) {
      console.error('Erro ao buscar rota do vendedor:', error);
      return null;
    }
    
    return {
      id: data.id,
      nome: data.nome,
      codigo: data.codigo,
      empresa_id: data.empresa_id,
      cidade_nome: undefined,
    };
  },

  // ==================================================
  // BUSCAR ROTA POR ID (para admin/monitor)
  // ==================================================
  async buscarRotaPorId(rotaId: string): Promise<RotaLiquidacao | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('rotas')
      .select('id, nome, codigo, empresa_id')
      .eq('id', rotaId)
      .single();
    
    if (error) {
      console.error('Erro ao buscar rota por ID:', error);
      return null;
    }
    
    return {
      id: data.id,
      nome: data.nome,
      codigo: data.codigo,
      empresa_id: data.empresa_id,
      cidade_nome: undefined,
    };
  },

  // ==================================================
  // BUSCAR VENDEDOR DA ROTA (para admin/monitor)
  // ==================================================
  async buscarVendedorDaRota(rotaId: string): Promise<VendedorLiquidacao | null> {
    const supabase = createClient();
    
    // Primeiro buscar o vendedor_id da rota
    const { data: rotaData, error: rotaError } = await supabase
      .from('rotas')
      .select('vendedor_id')
      .eq('id', rotaId)
      .single();
    
    if (rotaError || !rotaData?.vendedor_id) {
      console.log('Rota sem vendedor vinculado');
      return null;
    }
    
    // Buscar dados do vendedor
    const { data, error } = await supabase
      .from('vendedores')
      .select('id, nome, codigo_vendedor, telefone, email, foto_url, status')
      .eq('id', rotaData.vendedor_id)
      .single();
    
    if (error) {
      console.error('Erro ao buscar vendedor da rota:', error);
      return null;
    }
    
    return data;
  },

  // ==================================================
  // BUSCAR SALDO DA CONTA DA ROTA
  // ==================================================
  async buscarSaldoContaRota(rotaId: string): Promise<ContaRota | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('contas')
      .select('id, rota_id, tipo_conta, saldo_atual, saldo_inicial')
      .eq('rota_id', rotaId)
      .eq('tipo_conta', 'ROTA')
      .eq('status', 'ATIVA')
      .single();
    
    if (error) {
      console.error('Erro ao buscar saldo da conta:', error);
      return null;
    }
    
    return data;
  },

  // ==================================================
  // BUSCAR LIQUIDAÇÃO ABERTA
  // ==================================================
  async buscarLiquidacaoAberta(rotaId: string): Promise<LiquidacaoDiaria | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('liquidacoes_diarias')
      .select('*')
      .eq('rota_id', rotaId)
      .in('status', ['ABERTO', 'REABERTO'])
      .order('data_abertura', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Erro ao buscar liquidação aberta:', error);
      return null;
    }
    
    return data;
  },

  // ==================================================
  // BUSCAR LIQUIDAÇÃO POR ID
  // ==================================================
  async buscarLiquidacaoPorId(liquidacaoId: string): Promise<LiquidacaoDiaria | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('liquidacoes_diarias')
      .select('*')
      .eq('id', liquidacaoId)
      .single();
    
    if (error) {
      console.error('Erro ao buscar liquidação:', error);
      return null;
    }
    
    return data;
  },

  // ==================================================
  // LISTAR HISTÓRICO DE LIQUIDAÇÕES
  // ==================================================
  async listarHistoricoLiquidacoes(
    rotaId: string,
    filtros?: FiltrosHistoricoLiquidacoes
  ): Promise<LiquidacaoDiaria[]> {
    const supabase = createClient();
    
    let query = supabase
      .from('liquidacoes_diarias')
      .select('*')
      .eq('rota_id', rotaId)
      .order('data_abertura', { ascending: false });
    
    if (filtros?.status) {
      query = query.eq('status', filtros.status);
    }
    
    if (filtros?.data_inicio) {
      query = query.gte('data_abertura', filtros.data_inicio);
    }
    
    if (filtros?.data_fim) {
      query = query.lte('data_abertura', filtros.data_fim + 'T23:59:59');
    }
    
    const { data, error } = await query.limit(100);
    
    if (error) {
      console.error('Erro ao listar liquidações:', error);
      return [];
    }
    
    return data || [];
  },

  // ==================================================
  // ABRIR LIQUIDAÇÃO DIÁRIA
  // ==================================================
  async abrirLiquidacao(input: AbrirLiquidacaoInput): Promise<RespostaAbrirLiquidacao> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_abrir_liquidacao_diaria', {
      p_vendedor_id: input.vendedor_id,
      p_rota_id: input.rota_id,
      p_caixa_inicial: input.caixa_inicial,
      p_user_id: input.user_id,
      p_latitude: input.latitude || null,
      p_longitude: input.longitude || null,
      p_precisao_gps: input.precisao_gps || null,
    });
    
    if (error) {
      console.error('Erro ao abrir liquidação:', error);
      return {
        sucesso: false,
        mensagem: error.message || 'Erro ao abrir liquidação',
      };
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    
    return {
      sucesso: resultado?.sucesso ?? false,
      mensagem: resultado?.mensagem || 'Liquidação processada',
      liquidacao_id: resultado?.liquidacao_id,
      data_abertura: resultado?.data_abertura,
    };
  },

  // ==================================================
  // FECHAR LIQUIDAÇÃO DIÁRIA
  // ==================================================
  async fecharLiquidacao(input: FecharLiquidacaoInput): Promise<RespostaFecharLiquidacao> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_fechar_liquidacao_diaria', {
      p_liquidacao_id: input.liquidacao_id,
      p_user_id: input.user_id,
      p_observacoes: input.observacoes || null,
    });
    
    if (error) {
      console.error('Erro ao fechar liquidação:', error);
      return {
        sucesso: false,
        mensagem: error.message || 'Erro ao fechar liquidação',
      };
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    
    return {
      sucesso: resultado?.sucesso ?? false,
      mensagem: resultado?.mensagem || 'Liquidação processada',
      caixa_final: resultado?.caixa_final,
      carteira_final: resultado?.carteira_final,
      valor_recebido_dia: resultado?.valor_recebido_dia,
      valor_esperado_dia: resultado?.valor_esperado_dia,
      percentual_atingido: resultado?.percentual_atingido,
      diferenca_caixa: resultado?.diferenca_caixa,
      clientes_novos: resultado?.clientes_novos,
      clientes_renovados: resultado?.clientes_renovados,
      clientes_renegociados: resultado?.clientes_renegociados,
      pagamentos_pagos: resultado?.pagamentos_pagos,
      total_despesas_dia: resultado?.total_despesas_dia,
      total_emprestado_dia: resultado?.total_emprestado_dia,
    };
  },

  // ==================================================
  // REABRIR LIQUIDAÇÃO DIÁRIA
  // ==================================================
  async reabrirLiquidacao(input: ReabrirLiquidacaoInput): Promise<{ sucesso: boolean; mensagem: string }> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_reabrir_liquidacao_diaria', {
      p_liquidacao_id: input.liquidacao_id,
      p_user_id: input.user_id,
      p_motivo: input.motivo,
    });
    
    if (error) {
      console.error('Erro ao reabrir liquidação:', error);
      return {
        sucesso: false,
        mensagem: error.message || 'Erro ao reabrir liquidação',
      };
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    
    return {
      sucesso: resultado?.sucesso ?? false,
      mensagem: resultado?.mensagem || 'Liquidação processada',
    };
  },

  // ==================================================
  // BUSCAR CLIENTES DO DIA
  // ==================================================
  async buscarClientesDoDia(
    rotaId: string,
    dataVencimento: string,
    filtros?: FiltrosClientesDia
  ): Promise<ClienteDoDia[]> {
    const supabase = createClient();
    
    let query = supabase
      .from('vw_clientes_rota_dia')
      .select('*')
      .eq('rota_id', rotaId)
      .eq('data_vencimento', dataVencimento)
      .order('ordem_visita_dia', { ascending: true, nullsFirst: false });
    
    if (filtros?.status) {
      query = query.eq('status_dia', filtros.status);
    }
    
    if (filtros?.forma_pagamento) {
      query = query.eq('forma_pagamento', filtros.forma_pagamento);
    }
    
    if (filtros?.busca) {
      query = query.ilike('cliente_nome', `%${filtros.busca}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar clientes do dia:', error);
      return [];
    }
    
    return data || [];
  },

  // ==================================================
  // CALCULAR ESTATÍSTICAS DOS CLIENTES DO DIA
  // ==================================================
  calcularEstatisticasClientesDia(clientes: ClienteDoDia[]): EstatisticasClientesDia {
    return {
      total: clientes.length,
      sincronizados: clientes.filter(c => c.valor_pago > 0 || c.status_dia === 'PAGO').length,
      novos: 0, // Seria calculado de outra forma
      renovados: 0,
      cancelados: 0,
      pagos_dinheiro: clientes.filter(c => c.forma_pagamento === 'DINHEIRO' && c.status_dia === 'PAGO').length,
      pagos_transferencia: clientes.filter(c => c.forma_pagamento === 'TRANSFERENCIA' && c.status_dia === 'PAGO').length,
    };
  },

  // ==================================================
  // BUSCAR MICROSEGUROS DO DIA
  // ==================================================
  async buscarMicrosegurosDoDia(liquidacaoId: string): Promise<MicroseguroDoDia[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('microseguro_vendas')
      .select(`
        id,
        valor,
        emprestimo_id,
        data_venda,
        clientes!inner (nome)
      `)
      .eq('liquidacao_id', liquidacaoId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar microseguros:', error);
      return [];
    }
    
    return (data || []).map((m: any) => ({
      id: m.id,
      valor: m.valor,
      emprestimo_id: m.emprestimo_id,
      cliente_nome: m.clientes?.nome || 'N/A',
      data_venda: m.data_venda,
    }));
  },

  // ==================================================
  // BUSCAR MOVIMENTAÇÕES DO DIA (Receitas/Despesas)
  // ==================================================
  async buscarMovimentacoesDoDia(liquidacaoId: string): Promise<{
    receitas: number;
    despesas: number;
    retiradas: number;
  }> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('financeiro')
      .select('tipo, categoria, valor')
      .eq('liquidacao_id', liquidacaoId);
    
    if (error) {
      console.error('Erro ao buscar movimentações:', error);
      return { receitas: 0, despesas: 0, retiradas: 0 };
    }
    
    const movimentacoes = data || [];
    
    // Calcular totais por tipo
    const receitas = movimentacoes
      .filter(m => m.tipo === 'RECEBER' && m.categoria !== 'COBRANCA_CUOTAS' && m.categoria !== 'VENDA_MICROSEGURO')
      .reduce((acc, m) => acc + Number(m.valor), 0);
    
    const despesas = movimentacoes
      .filter(m => m.tipo === 'PAGAR' && m.categoria !== 'RETIRADA')
      .reduce((acc, m) => acc + Number(m.valor), 0);
    
    const retiradas = movimentacoes
      .filter(m => m.categoria === 'RETIRADA')
      .reduce((acc, m) => acc + Number(m.valor), 0);
    
    return { receitas, despesas, retiradas };
  },

  // ==================================================
  // BUSCAR EMPRÉSTIMOS DO DIA
  // ==================================================
  async buscarEmprestimosDoDia(liquidacaoId: string): Promise<{
    total: number;
    quantidade: number;
    novos: number;
    renovacoes: number;
  }> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('emprestimos')
      .select('id, valor_principal, tipo_emprestimo')
      .eq('liquidacao_id', liquidacaoId);
    
    if (error) {
      console.error('Erro ao buscar empréstimos do dia:', error);
      return { total: 0, quantidade: 0, novos: 0, renovacoes: 0 };
    }
    
    const emprestimos = data || [];
    
    return {
      total: emprestimos.reduce((acc, e) => acc + Number(e.valor_principal), 0),
      quantidade: emprestimos.length,
      novos: emprestimos.filter(e => e.tipo_emprestimo === 'NOVO').length,
      renovacoes: emprestimos.filter(e => e.tipo_emprestimo === 'RENOVACAO').length,
    };
  },

  // ==================================================
  // BUSCAR META DA ROTA
  // ==================================================
  async buscarMetaRota(rotaId: string): Promise<number> {
    const supabase = createClient();
    
    // Buscar meta configurada na rota ou calcular baseado em parcelas do dia
    const { data, error } = await supabase
      .from('rotas')
      .select('meta_diaria')
      .eq('id', rotaId)
      .single();
    
    if (error || !data?.meta_diaria) {
      // Se não tem meta configurada, calcula baseado nas parcelas pendentes
      return 0;
    }
    
    return Number(data.meta_diaria) || 0;
  },

  // ==================================================
  // CALCULAR VALOR ESPERADO DO DIA
  // ==================================================
  async calcularValorEsperadoDia(rotaId: string, data: string): Promise<number> {
    const supabase = createClient();
    
    const { data: parcelas, error } = await supabase
      .from('vw_clientes_rota_dia')
      .select('valor_parcela')
      .eq('rota_id', rotaId)
      .eq('data_vencimento', data);
    
    if (error) {
      console.error('Erro ao calcular valor esperado:', error);
      return 0;
    }
    
    return (parcelas || []).reduce((acc, p) => acc + Number(p.valor_parcela), 0);
  },

  // ==================================================
  // HELPERS
  // ==================================================
  
  formatarDataHora(dataISO: string): string {
    if (!dataISO) return '-';
    return new Date(dataISO).toLocaleString('pt-BR');
  },

  formatarData(dataISO: string): string {
    if (!dataISO) return '-';
    return new Date(dataISO + 'T00:00:00').toLocaleDateString('pt-BR');
  },

  formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor || 0);
  },

  calcularPercentual(atual: number, meta: number): number {
    if (!meta || meta === 0) return 0;
    return Math.round((atual / meta) * 100);
  },

  getDataHoje(): string {
    return new Date().toISOString().split('T')[0];
  },
};

// =====================================================
// HOOKS DE CACHE (se usar React Query)
// =====================================================

export const liquidacaoKeys = {
  all: ['liquidacao'] as const,
  aberta: (rotaId: string) => [...liquidacaoKeys.all, 'aberta', rotaId] as const,
  historico: (rotaId: string) => [...liquidacaoKeys.all, 'historico', rotaId] as const,
  clientesDia: (rotaId: string, data: string) => [...liquidacaoKeys.all, 'clientes', rotaId, data] as const,
  detalhe: (id: string) => [...liquidacaoKeys.all, 'detalhe', id] as const,
};