// =====================================================
// SERVICE DO MÓDULO DE CLIENTES - SISTEMA APPRUTEA
// Integrado com Functions do Supabase
// =====================================================

import { createClient } from '@/lib/supabase/client';
import type {
  ClienteComTotais,
  Cliente,
  Emprestimo,
  Parcela,
  Segmento,
  RotaSimples,
  ContagemClientes,
  FiltrosClientes,
  NovaVendaInput,
  RenovacaoInput,
  PagamentoInput,
  AtualizarClienteInput,
  RespostaNovaVenda,
  RespostaPagamento,
  ProximaParcela,
} from '@/types/clientes';

// =====================================================
// SERVICE PRINCIPAL
// =====================================================

export const clientesService = {
  // ==================================================
  // BUSCAR CLIENTES (LISTAGEM)
  // ==================================================
  async buscarClientes(filtros: FiltrosClientes): Promise<ClienteComTotais[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_buscar_clientes', {
      p_empresa_id: filtros.empresa_id,
      p_rota_id: filtros.rota_id || null,
      p_status: filtros.status || null,
      p_busca: filtros.busca || null,
      p_limite: filtros.limite || 50,
      p_offset: filtros.offset || 0,
    });
    
    if (error) {
      console.error('Erro ao buscar clientes:', error);
      return [];
    }
    
    return (data || []).map((c: any) => ({
      ...c,
      rotas_ids: c.rotas_ids || [],
    }));
  },

  // ==================================================
  // BUSCAR DETALHES DO CLIENTE
  // ==================================================
  async buscarClienteDetalhes(clienteId: string): Promise<Cliente | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_buscar_cliente_detalhes', {
      p_cliente_id: clienteId,
    });
    
    if (error) {
      console.error('Erro ao buscar detalhes do cliente:', error);
      return null;
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    if (!resultado) return null;
    
    return {
      ...resultado,
      rotas_ids: resultado.rotas_ids || [],
    };
  },

  // ==================================================
  // BUSCAR EMPRÉSTIMOS DO CLIENTE (Query Direta)
  // ==================================================
  async buscarEmprestimosCliente(
    clienteId: string, 
    apenasAtivos: boolean = false
  ): Promise<Emprestimo[]> {
    const supabase = createClient();
    
    let query = supabase
      .from('emprestimos')
      .select(`
        *,
        rotas:rota_id (nome),
        vendedores:vendedor_id (nome)
      `)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });
    
    if (apenasAtivos) {
      query = query.eq('status', 'ATIVO');
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar empréstimos:', error);
      return [];
    }
    
    return (data || []).map((e: any) => ({
      ...e,
      rota_nome: e.rotas?.nome,
      vendedor_nome: e.vendedores?.nome,
      percentual_pago: e.valor_total > 0 ? Math.round((e.valor_pago / e.valor_total) * 100) : 0,
    }));
  },

  // ==================================================
  // BUSCAR ÚLTIMO EMPRÉSTIMO DO CLIENTE
  // ==================================================
  async buscarUltimoEmprestimo(clienteId: string): Promise<Emprestimo | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('emprestimos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) {
      console.error('Erro ao buscar último empréstimo:', error);
      return null;
    }
    
    return data;
  },

  // ==================================================
  // BUSCAR PARCELAS DO EMPRÉSTIMO (Query Direta)
  // ==================================================
  async buscarParcelasEmprestimo(emprestimoId: string): Promise<Parcela[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('emprestimo_parcelas')
      .select('*')
      .eq('emprestimo_id', emprestimoId)
      .order('numero_parcela', { ascending: true });
    
    if (error) {
      console.error('Erro ao buscar parcelas:', error);
      return [];
    }
    
    return (data || []).map((p: any) => ({
      ...p,
      valor_total_parcela: p.valor_parcela + (p.valor_multa || 0),
      esta_atrasada: new Date(p.data_vencimento) < new Date() && ['PENDENTE', 'PARCIAL'].includes(p.status),
    }));
  },

  // ==================================================
  // CONTAR PARCELAS PAGAS
  // ==================================================
  async contarParcelasPagas(emprestimoId: string): Promise<number> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('emprestimo_parcelas')
      .select('status')
      .eq('emprestimo_id', emprestimoId);
    
    if (error) {
      console.error('Erro ao contar parcelas:', error);
      return 0;
    }
    
    return (data || []).filter((p: any) => p.status?.toUpperCase() === 'PAGO').length;
  },

  // ==================================================
  // BUSCAR PRÓXIMA PARCELA A PAGAR (RPC Existente)
  // ==================================================
  async buscarProximaParcela(emprestimoId: string): Promise<ProximaParcela | null> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_buscar_proxima_parcela_a_pagar', {
      p_emprestimo_id: emprestimoId,
    });
    
    if (error) {
      console.error('Erro ao buscar próxima parcela:', error);
      return null;
    }
    
    // Retorna o primeiro resultado se for array
    const resultado = Array.isArray(data) ? data[0] : data;
    return resultado || null;
  },

  // ==================================================
  // CONSULTAR PARCELA PARA PAGAMENTO (RPC Existente)
  // ==================================================
  async consultarParcelaPagamento(parcelaId: string): Promise<any> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_consultar_parcela_para_pagamento', {
      p_parcela_id: parcelaId,
    });
    
    if (error) {
      console.error('Erro ao consultar parcela:', error);
      return null;
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    return resultado || null;
  },

  // ==================================================
  // BUSCAR SEGMENTOS
  // ==================================================
  async buscarSegmentos(): Promise<Segmento[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_buscar_segmentos');
    
    if (error) {
      console.error('Erro ao buscar segmentos:', error);
      return [];
    }
    
    return data || [];
  },

  // ==================================================
  // BUSCAR ROTAS DA EMPRESA
  // ==================================================
  async buscarRotasEmpresa(empresaId: string): Promise<RotaSimples[]> {
    const supabase = createClient();
    
    // Buscar rotas da empresa
    const { data: rotasData, error: rotasError } = await supabase
      .from('rotas')
      .select(`
        id,
        nome,
        codigo,
        status,
        quantidade_clientes,
        cidades:cidade_id (nome)
      `)
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVO')
      .order('nome');
    
    if (rotasError) {
      console.error('Erro ao buscar rotas:', rotasError);
      return [];
    }

    if (!rotasData || rotasData.length === 0) {
      return [];
    }

    // Buscar vendedores ativos que atendem essas rotas
    // O vendedor tem rotas_ids como array JSONB
    const { data: vendedoresData, error: vendedoresError } = await supabase
      .from('vendedores')
      .select('id, nome, rotas_ids')
      .eq('status', 'ATIVO');

    // Criar mapa de rota -> vendedor
    const rotaVendedorMap = new Map<string, { id: string; nome: string }>();
    
    if (vendedoresData) {
      for (const vendedor of vendedoresData) {
        const rotasIds = vendedor.rotas_ids || [];
        for (const rotaId of rotasIds) {
          // Só mapeia se ainda não tem vendedor (pega o primeiro)
          if (!rotaVendedorMap.has(rotaId)) {
            rotaVendedorMap.set(rotaId, { id: vendedor.id, nome: vendedor.nome });
          }
        }
      }
    }
    
    return (rotasData || []).map((r: any) => {
      const vendedor = rotaVendedorMap.get(r.id);
      return {
        id: r.id,
        nome: r.nome,
        codigo: r.codigo || '',
        cidade_nome: r.cidades?.nome,
        qtd_clientes: r.quantidade_clientes || 0,
        status: r.status,
        vendedor_id: vendedor?.id,
        vendedor_nome: vendedor?.nome,
      };
    });
  },

  // ==================================================
  // CONTAR CLIENTES
  // ==================================================
  async contarClientes(
    empresaId: string, 
    rotaId?: string
  ): Promise<ContagemClientes> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_contar_clientes', {
      p_empresa_id: empresaId,
      p_rota_id: rotaId || null,
    });
    
    if (error) {
      console.error('Erro ao contar clientes:', error);
      return {
        total: 0,
        ativos: 0,
        inativos: 0,
        suspensos: 0,
        com_emprestimo_ativo: 0,
        com_parcelas_atrasadas: 0,
      };
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    return resultado || {
      total: 0,
      ativos: 0,
      inativos: 0,
      suspensos: 0,
      com_emprestimo_ativo: 0,
      com_parcelas_atrasadas: 0,
    };
  },

  // ==================================================
  // NOVA VENDA COMPLETA (CLIENTE + EMPRÉSTIMO)
  // ==================================================
  async novaVendaCompleta(input: NovaVendaInput): Promise<RespostaNovaVenda> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_nova_venda_completa', {
      p_cliente_id: input.cliente_id || null,
      p_cliente_nome: input.cliente_nome || null,
      p_cliente_documento: input.cliente_documento || null,
      p_cliente_telefone: input.cliente_telefone || null,
      p_cliente_telefone_fixo: input.cliente_telefone_fixo || null,
      p_cliente_email: input.cliente_email || null,
      p_cliente_endereco: input.cliente_endereco || null,
      p_cliente_endereco_comercial: input.cliente_endereco_comercial || null,
      p_cliente_segmento_id: input.cliente_segmento_id || null,
      p_cliente_foto_url: input.cliente_foto_url || null,
      p_cliente_observacoes: input.cliente_observacoes || null,
      p_valor_principal: input.valor_principal,
      p_numero_parcelas: input.numero_parcelas,
      p_taxa_juros: input.taxa_juros,
      p_frequencia: input.frequencia,
      p_data_primeiro_vencimento: input.data_primeiro_vencimento,
      p_dia_semana_cobranca: input.dia_semana_cobranca || null,
      p_dia_mes_cobranca: input.dia_mes_cobranca || null,
      p_dias_mes_cobranca: input.dias_mes_cobranca || null,
      p_iniciar_proximo_mes: input.iniciar_proximo_mes || false,
      p_observacoes: input.observacoes || null,
      p_empresa_id: input.empresa_id,
      p_rota_id: input.rota_id,
      p_vendedor_id: input.vendedor_id || null,
      p_user_id: input.user_id,
      p_latitude: input.latitude || null,
      p_longitude: input.longitude || null,
      p_microseguro_valor: input.microseguro_valor || null,
    });
    
    if (error) {
      console.error('Erro na nova venda:', error);
      return { success: false, error: error.message };
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    
    if (!resultado) {
      return { success: false, error: 'Resposta vazia do servidor' };
    }
    
    // A função retorna 'sucesso' (português)
    return {
      success: resultado.sucesso === true,
      cliente_id: resultado.cliente_id,
      emprestimo_id: resultado.emprestimo_id,
      error: resultado.mensagem || resultado.error,
    };
  },

  // ==================================================
  // RENOVAR EMPRÉSTIMO
  // ==================================================
  async renovarEmprestimo(input: RenovacaoInput): Promise<RespostaNovaVenda> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_renovar_emprestimo', {
      p_cliente_id: input.cliente_id,
      p_valor_principal: input.valor_principal,
      p_numero_parcelas: input.numero_parcelas,
      p_taxa_juros: input.taxa_juros,
      p_frequencia: input.frequencia,
      p_data_primeiro_vencimento: input.data_primeiro_vencimento,
      p_empresa_id: input.empresa_id,
      p_rota_id: input.rota_id,
      p_vendedor_id: input.vendedor_id || null,
      p_user_id: input.user_id,
      p_dia_semana_cobranca: input.dia_semana_cobranca || null,
      p_dia_mes_cobranca: input.dia_mes_cobranca || null,
      p_dias_mes_cobranca: input.dias_mes_cobranca || null,
      p_iniciar_proximo_mes: input.iniciar_proximo_mes || false,
      p_observacoes: input.observacoes || null,
      p_latitude: input.latitude || null,
      p_longitude: input.longitude || null,
      p_microseguro_valor: input.microseguro_valor || null,
    });
    
    if (error) {
      console.error('Erro na renovação:', error);
      return { success: false, error: error.message };
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    
    // A função retorna 'sucesso' (português)
    return {
      success: resultado?.sucesso === true,
      cliente_id: resultado?.cliente_id,
      emprestimo_id: resultado?.emprestimo_id,
      error: resultado?.mensagem || resultado?.error,
    };
  },

  // ==================================================
  // VENDA ADICIONAL (SEGUNDO EMPRÉSTIMO)
  // ==================================================
  async vendaAdicional(input: RenovacaoInput): Promise<RespostaNovaVenda> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_nova_venda_adicional', {
      p_cliente_id: input.cliente_id,
      p_valor_principal: input.valor_principal,
      p_numero_parcelas: input.numero_parcelas,
      p_taxa_juros: input.taxa_juros,
      p_frequencia: input.frequencia,
      p_data_primeiro_vencimento: input.data_primeiro_vencimento,
      p_empresa_id: input.empresa_id,
      p_rota_id: input.rota_id,
      p_vendedor_id: input.vendedor_id || null,
      p_user_id: input.user_id,
      p_dia_semana_cobranca: input.dia_semana_cobranca || null,
      p_dia_mes_cobranca: input.dia_mes_cobranca || null,
      p_dias_mes_cobranca: input.dias_mes_cobranca || null,
      p_iniciar_proximo_mes: input.iniciar_proximo_mes || false,
      p_observacoes: input.observacoes || null,
      p_latitude: input.latitude || null,
      p_longitude: input.longitude || null,
      p_microseguro_valor: input.microseguro_valor || null,
    });
    
    if (error) {
      console.error('Erro na venda adicional:', error);
      return { success: false, error: error.message };
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    
    // A função retorna 'sucesso' (português)
    return {
      success: resultado?.sucesso === true,
      cliente_id: resultado?.cliente_id,
      emprestimo_id: resultado?.emprestimo_id,
      error: resultado?.mensagem || resultado?.error,
    };
  },

  // ==================================================
  // REGISTRAR PAGAMENTO
  // ==================================================
  async registrarPagamento(input: PagamentoInput): Promise<RespostaPagamento> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_registrar_pagamento', {
      p_parcela_id: input.parcela_id,
      p_valor_pagamento: input.valor_pagamento,
      p_valor_credito: input.valor_credito || 0,
      p_forma_pagamento: input.forma_pagamento,
      p_observacoes: input.observacoes || null,
      p_latitude: input.latitude || null,
      p_longitude: input.longitude || null,
      p_precisao_gps: input.precisao_gps || null,
      p_liquidacao_id: input.liquidacao_id || null,
    });
    
    if (error) {
      console.error('Erro no pagamento:', error);
      return { success: false, error: error.message };
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    
    return {
      success: resultado?.success !== false,
      parcela_id: resultado?.parcela_id,
      emprestimo_quitado: resultado?.emprestimo_quitado,
      error: resultado?.error,
    };
  },

  // ==================================================
  // ATUALIZAR CLIENTE
  // ==================================================
  async atualizarCliente(input: AtualizarClienteInput): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    
    const { data, error } = await supabase.rpc('fn_atualizar_cliente', {
      p_cliente_id: input.cliente_id,
      p_nome: input.nome || null,
      p_documento: input.documento || null,
      p_telefone_celular: input.telefone_celular || null,
      p_telefone_fixo: input.telefone_fixo || null,
      p_email: input.email || null,
      p_endereco: input.endereco || null,
      p_endereco_comercial: input.endereco_comercial || null,
      p_segmento_id: input.segmento_id || null,
      p_foto_url: input.foto_url || null,
      p_observacoes: input.observacoes || null,
      p_status: input.status || null,
    });
    
    if (error) {
      console.error('Erro ao atualizar cliente:', error);
      return { success: false, error: error.message };
    }
    
    const resultado = Array.isArray(data) ? data[0] : data;
    
    return {
      success: resultado?.success !== false,
      error: resultado?.error,
    };
  },

  // ==================================================
  // HELPERS - CÁLCULOS DE EMPRÉSTIMO
  // ==================================================
  calcularEmprestimo(valorPrincipal: number, taxaJuros: number, numeroParcelas: number) {
    const valorJuros = valorPrincipal * (taxaJuros / 100);
    const valorTotal = valorPrincipal + valorJuros;
    const valorParcela = valorTotal / numeroParcelas;
    
    return {
      valor_principal: valorPrincipal,
      valor_juros: Math.round(valorJuros * 100) / 100,
      valor_total: Math.round(valorTotal * 100) / 100,
      valor_parcela: Math.round(valorParcela * 100) / 100,
      taxa_juros: taxaJuros,
      numero_parcelas: numeroParcelas,
    };
  },

  // Calcular data do primeiro vencimento baseado na frequência
  calcularPrimeiroVencimento(
    frequencia: string, 
    diasAPartirDeHoje: number = 1
  ): string {
    const data = new Date();
    data.setDate(data.getDate() + diasAPartirDeHoje);
    return data.toISOString().split('T')[0];
  },
};

// =====================================================
// HOOKS AUXILIARES
// =====================================================

export const clientesKeys = {
  all: ['clientes'] as const,
  lista: (empresaId: string, filtros?: Partial<FiltrosClientes>) => 
    [...clientesKeys.all, 'lista', empresaId, filtros] as const,
  detalhes: (clienteId: string) => 
    [...clientesKeys.all, 'detalhes', clienteId] as const,
  emprestimos: (clienteId: string) => 
    [...clientesKeys.all, 'emprestimos', clienteId] as const,
  parcelas: (emprestimoId: string) => 
    [...clientesKeys.all, 'parcelas', emprestimoId] as const,
  contagem: (empresaId: string, rotaId?: string) => 
    [...clientesKeys.all, 'contagem', empresaId, rotaId] as const,
  segmentos: () => [...clientesKeys.all, 'segmentos'] as const,
  rotas: (empresaId: string) => [...clientesKeys.all, 'rotas', empresaId] as const,
};