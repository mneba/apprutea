// =====================================================
// SERVICE DO MÓDULO FINANCEIRO - SISTEMA BELLA KIDS
// Integrado com Functions do Supabase
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type {
  PeriodoFiltro,
  SaldosContas,
  ResumoMovimentacoes,
  DadosGrafico,
  MovimentoFinanceiro,
  CategoriaFinanceira,
  ContaComDetalhes,
  NovaMovimentacaoInput,
  TransferenciaInput,
  AjusteSaldoInput,
  FiltrosExtrato,
} from '@/types/financeiro';

// =====================================================
// SERVICE PRINCIPAL
// =====================================================

export const financeiroService = {
  // ==================================================
  // BUSCAR SALDOS DAS CONTAS (Dashboard)
  // ==================================================
  async buscarSaldosContas(empresaId: string): Promise<SaldosContas> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_buscar_saldos_contas', {
      p_empresa_id: empresaId,
    });
    
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
    
    return {
      total_consolidado: data?.total_consolidado || 0,
      saldo_empresa: data?.saldo_empresa || 0,
      saldo_rotas: data?.saldo_rotas || 0,
      saldo_microseguros: data?.saldo_microseguros || 0,
      contas: data?.contas || [],
    };
  },

  // ==================================================
  // BUSCAR RESUMO DE MOVIMENTAÇÕES POR PERÍODO
  // ==================================================
  async buscarResumoMovimentacoes(
    empresaId: string,
    periodo?: string,
    dataInicio?: string,
    dataFim?: string
  ): Promise<ResumoMovimentacoes> {
    const supabase = createClient();
    
    // Converter para periodo se for datas customizadas
    let periodoParam = periodo || 'hoje';
    
    // Se tiver datas customizadas, calcular qual período usar
    // (temporário até atualizar as functions no Supabase)
    if (dataInicio && dataFim && !periodo) {
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const diffDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias <= 1) {
        periodoParam = inicio.toDateString() === hoje.toDateString() ? 'hoje' : 'ontem';
      } else if (diffDias <= 7) {
        periodoParam = '7dias';
      } else if (diffDias <= 15) {
        periodoParam = '15dias';
      } else {
        periodoParam = '30dias';
      }
    }
    
    const { data, error } = await supabase.rpc('fn_buscar_resumo_movimentacoes', {
      p_empresa_id: empresaId,
      p_periodo: periodoParam,
    });
    
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
    
    // A function retorna um array com um único registro
    const resultado = Array.isArray(data) ? data[0] : data;
    
    return {
      total_entradas: resultado?.total_entradas || 0,
      total_saidas: resultado?.total_saidas || 0,
      saldo_periodo: resultado?.saldo_periodo || 0,
      qtd_entradas: resultado?.qtd_entradas || 0,
      qtd_saidas: resultado?.qtd_saidas || 0,
      qtd_total: resultado?.qtd_total || 0,
    };
  },

  // ==================================================
  // BUSCAR DADOS PARA GRÁFICO
  // ==================================================
  async buscarDadosGrafico(
    empresaId: string,
    periodo?: string,
    dataInicio?: string,
    dataFim?: string
  ): Promise<DadosGrafico[]> {
    const supabase = createClient();
    
    // Converter para periodo se for datas customizadas
    let periodoParam = periodo || '7dias';
    
    if (dataInicio && dataFim && !periodo) {
      const inicio = new Date(dataInicio);
      const fim = new Date(dataFim);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const diffDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias <= 1) {
        periodoParam = inicio.toDateString() === hoje.toDateString() ? 'hoje' : 'ontem';
      } else if (diffDias <= 7) {
        periodoParam = '7dias';
      } else if (diffDias <= 15) {
        periodoParam = '15dias';
      } else {
        periodoParam = '30dias';
      }
    }
    
    const { data, error } = await supabase.rpc('fn_buscar_dados_grafico', {
      p_empresa_id: empresaId,
      p_periodo: periodoParam,
    });
    
    if (error) {
      console.error('Erro ao buscar dados do gráfico:', error);
      return [];
    }
    
    return data || [];
  },

  // ==================================================
  // BUSCAR EXTRATO DETALHADO
  // ==================================================
  async buscarExtrato(
    empresaId: string,
    filtros: FiltrosExtrato & { data_inicio?: string; data_fim?: string }
  ): Promise<MovimentoFinanceiro[]> {
    const supabase = createClient();
    
    // Converter para periodo se for datas customizadas
    let periodoParam = filtros.periodo || 'hoje';
    
    if (filtros.data_inicio && filtros.data_fim && !filtros.periodo) {
      const inicio = new Date(filtros.data_inicio);
      const fim = new Date(filtros.data_fim);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const diffDias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias <= 1) {
        periodoParam = inicio.toDateString() === hoje.toDateString() ? 'hoje' : 'ontem';
      } else if (diffDias <= 7) {
        periodoParam = '7dias';
      } else if (diffDias <= 15) {
        periodoParam = '15dias';
      } else {
        periodoParam = '30dias';
      }
    }
    
    const { data, error } = await supabase.rpc('fn_buscar_extrato_financeiro', {
      p_empresa_id: empresaId,
      p_periodo: periodoParam,
      p_conta_id: filtros.conta_id || null,
      p_categoria: filtros.categoria || null,
      p_tipo: filtros.tipo || null,
      p_limite: 100,
    });
    
    if (error) {
      console.error('Erro ao buscar extrato:', error);
      return [];
    }
    
    return data || [];
  },

  // ==================================================
  // BUSCAR CONTAS PARA DROPDOWN
  // ==================================================
  async buscarContas(empresaId: string): Promise<ContaComDetalhes[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_buscar_contas_dropdown', {
      p_empresa_id: empresaId,
    });
    
    if (error) {
      console.error('Erro ao buscar contas:', error);
      return [];
    }
    
    return data || [];
  },

  // ==================================================
  // BUSCAR CATEGORIAS FINANCEIRAS
  // ==================================================
  async buscarCategorias(
    tipoConta?: string,
    tipoMovimento?: string
  ): Promise<CategoriaFinanceira[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_buscar_categorias_financeiras', {
      p_tipo_conta: tipoConta || null,
      p_tipo_movimento: tipoMovimento || null,
    });
    
    if (error) {
      console.error('Erro ao buscar categorias:', error);
      return [];
    }
    
    return data || [];
  },

  // ==================================================
  // CRIAR NOVA MOVIMENTAÇÃO
  // ==================================================
  async criarMovimentacao(
    input: NovaMovimentacaoInput,
    usuarioId?: string,
    createdBy?: string
  ): Promise<{ success: boolean; error?: string; id?: string }> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_criar_movimentacao', {
      p_tipo: input.tipo,
      p_conta_id: input.conta_destino_id,
      p_categoria: input.categoria,
      p_descricao: input.descricao,
      p_valor: input.valor,
      p_forma_pagamento: input.forma_pagamento || 'DINHEIRO',
      p_observacoes: input.observacoes || null,
      p_usuario_id: usuarioId || null,
      p_created_by: createdBy || null,
    });
    
    if (error) {
      console.error('Erro ao criar movimentação:', error);
      return { success: false, error: error.message };
    }
    
    if (!data?.success) {
      return { success: false, error: data?.error || 'Erro desconhecido' };
    }
    
    return { success: true, id: data.id };
  },

  // ==================================================
  // CRIAR TRANSFERÊNCIA ENTRE CONTAS
  // ==================================================
  async criarTransferencia(
    input: TransferenciaInput,
    usuarioId?: string,
    createdBy?: string
  ): Promise<{ success: boolean; error?: string; id?: string }> {
    const supabase = createClient();
    
    // Usar a function existente transferir_entre_contas
    const { data, error } = await supabase.rpc('transferir_entre_contas', {
      p_conta_origem_id: input.conta_origem_id,
      p_conta_destino_id: input.conta_destino_id,
      p_valor: input.valor,
      p_descricao: input.descricao || 'Transferência entre contas',
      p_observacoes: input.observacoes || null,
      p_usuario_id: usuarioId || null,
      p_created_by: createdBy || null,
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
  async criarAjusteSaldo(
    input: { conta_id: string; saldo_final: number; motivo: string; observacoes?: string },
    usuarioId?: string,
    createdBy?: string
  ): Promise<{ success: boolean; error?: string; id?: string; saldo_novo?: number }> {
    const supabase = createClient();
    
    // Primeiro, buscar o saldo atual da conta
    const { data: contaData, error: contaError } = await supabase
      .from('contas')
      .select('saldo_atual')
      .eq('id', input.conta_id)
      .single();
    
    if (contaError || !contaData) {
      console.error('Erro ao buscar conta:', contaError);
      return { success: false, error: 'Conta não encontrada' };
    }
    
    const saldoAtual = contaData.saldo_atual || 0;
    const valorAjuste = input.saldo_final - saldoAtual;
    
    if (valorAjuste === 0) {
      return { success: false, error: 'O saldo final é igual ao saldo atual. Nenhum ajuste necessário.' };
    }
    
    const observacoesCompletas = `Saldo anterior: R$ ${saldoAtual.toFixed(2)} → Saldo final: R$ ${input.saldo_final.toFixed(2)}. ${input.observacoes || ''}`.trim();
    
    // Tentar com ajustar_saldo_conta
    const { data, error } = await supabase.rpc('ajustar_saldo_conta', {
      p_conta_id: input.conta_id,
      p_valor_ajuste: valorAjuste,
      p_motivo: input.motivo,
      p_observacoes: observacoesCompletas,
      p_usuario_id: usuarioId || null,
      p_created_by: createdBy || null,
    });
    
    if (error) {
      console.error('Erro ao criar ajuste:', error);
      return { success: false, error: error.message };
    }
    
    return { 
      success: true, 
      id: data,
      saldo_novo: input.saldo_final,
    };
  },
};

// =====================================================
// HOOKS AUXILIARES (opcional - para uso com React Query)
// =====================================================

export const financeiroKeys = {
  all: ['financeiro'] as const,
  saldos: (empresaId: string) => [...financeiroKeys.all, 'saldos', empresaId] as const,
  resumo: (empresaId: string, periodo: string) => [...financeiroKeys.all, 'resumo', empresaId, periodo] as const,
  grafico: (empresaId: string, periodo: string) => [...financeiroKeys.all, 'grafico', empresaId, periodo] as const,
  extrato: (empresaId: string, filtros: FiltrosExtrato) => [...financeiroKeys.all, 'extrato', empresaId, filtros] as const,
  contas: (empresaId: string) => [...financeiroKeys.all, 'contas', empresaId] as const,
  categorias: (tipoConta?: string, tipoMovimento?: string) => [...financeiroKeys.all, 'categorias', tipoConta, tipoMovimento] as const,
};