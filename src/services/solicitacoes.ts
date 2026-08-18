// =====================================================
// SERVICE: Solicitações de Autorização
// src/services/solicitacoes.ts
// =====================================================

import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// Labels amigáveis
export const TIPO_SOLICITACAO_LABELS: Record<string, string> = {
  'ABERTURA_RETROATIVA': 'Abertura Retroativa',
  'ABERTURA_DIAS_FALTANTES': 'Abertura Dias Faltantes',
  'VENDA_EXCEDE_LIMITE': 'Venda Excede Limite',
  'RENOVACAO_EXCEDE_LIMITE': 'Renovação Excede Limite',
  'RENOVACAO_EXCEDE_ANTERIOR': 'Renovação Excede Último Empréstimo',
  'DESPESA_EXCEDE_LIMITE': 'Despesa Excede Limite',
  'RECEITA_EXCEDE_LIMITE': 'Receita Excede Limite',
  'ESTORNO_PAGAMENTO': 'Estorno de Pagamento',
  'CANCELAR_EMPRESTIMO': 'Cancelar Empréstimo',
  'REABRIR_LIQUIDACAO': 'Reabrir Liquidação',
  'QUITAR_COM_DESCONTO': 'Quitar com Desconto',
  'CLIENTE_OUTRA_ROTA': 'Cliente de Outra Rota',
  'RENEGOCIACAO': 'Renegociação',
  'EMPRESTIMO_ADICIONAL': 'Empréstimo Adicional',
};

export const STATUS_SOLICITACAO_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  'PENDENTE': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pendente' },
  'APROVADO': { bg: 'bg-green-100', text: 'text-green-700', label: 'Aprovado' },
  'REJEITADO': { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejeitado' },
  'EXPIRADO': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Expirado' },
  'CANCELADO': { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelado' },
};

export interface Solicitacao {
  id: string;
  tipo_solicitacao: string;
  data_solicitada: string | null;
  motivo_solicitacao: string;
  status: string;
  created_at: string;
  expira_em: string;
  vendedor_id: string;
  vendedor_nome: string;
  vendedor_codigo: string;
  rota_id: string;
  rota_nome: string;
  empresa_id: string | null;
  empresa_nome: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  emprestimo_id: string | null;
  parcela_id: string | null;
  venda_pendente_id: string | null;
  valor_solicitado: number | null;
  valor_limite: number | null;
  resolvido_por: string | null;
  resolvido_por_nome: string | null;
  data_resolucao: string | null;
  motivo_resolucao: string | null;
  ja_visualizada: boolean;
  // Origem da empresa — vem pronta da RPC (JOIN com hierarquias/cidades)
  pais: string | null;
  estado: string | null;
  cidade_nome: string | null;
}

export interface MovimentacaoPendente {
  id: string;
  vendedor_id: string;
  rota_id: string;
  empresa_id: string | null;
  liquidacao_id: string;
  user_id: string | null;
  solicitacao_id: string | null;
  tipo: 'RECEITA' | 'DESPESA';
  categoria: string;
  descricao: string | null;
  valor: number;
  forma_pagamento: string | null;
  foto_url: string | null;
  justificativa: string;
  valor_limite: number | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  motivo_rejeicao: string | null;
  financeiro_id: string | null;
  created_at: string;
  updated_at: string;
  rota_nome?: string | null;
  vendedor_nome?: string | null;
}

export interface FiltrosSolicitacoes {
  status?: string | null;
  rota_id?: string | null;
  tipo?: string | null;
  limite?: number;
  offset?: number;
  // Filtros que antes rodavam no cliente e agora vão ao banco
  empresa_id?: string | null;
  cliente?: string | null;
  data_solicitada?: string | null;
  busca?: string | null;
  /** Conjunto de tipos aceitos (filtro por categoria e busca por rótulo) */
  tipos?: string[] | null;
}

export const solicitacoesService = {
  // Listar pendentes não vistas (para o sino)
  async listarPendentesNaoVistas(userId: string) {
    const { data, error } = await supabase.rpc('fn_listar_solicitacoes_pendentes_usuario', {
      p_user_id: userId,
      p_apenas_nao_vistas: true,
    });

    if (error) {
      console.error('Erro ao listar solicitações pendentes:', error);
      return [];
    }

    return data || [];
  },

  // Contar pendentes não vistas
  async contarPendentesNaoVistas(userId: string): Promise<number> {
    const { data, error } = await supabase.rpc('fn_contar_solicitacoes_pendentes_nao_vistas', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Erro ao contar solicitações:', error);
      return 0;
    }

    return data || 0;
  },

  // Marcar como vista
  async marcarComoVista(solicitacaoId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('fn_marcar_solicitacao_visualizada', {
      p_solicitacao_id: solicitacaoId,
      p_user_id: userId,
    });

    if (error) {
      console.error('Erro ao marcar solicitação como vista:', error);
      return false;
    }

    return true;
  },

  // Listar todas (para a Central)
  async listarTodas(userId: string, filtros: FiltrosSolicitacoes = {}): Promise<Solicitacao[]> {
    const { data, error } = await supabase.rpc('fn_listar_solicitacoes_central', {
      p_user_id: userId,
      p_status: filtros.status || null,
      p_rota_id: filtros.rota_id || null,
      p_tipo: filtros.tipo || null,
      p_limite: filtros.limite || 50,
      p_offset: filtros.offset || 0,
      p_empresa_id: filtros.empresa_id || null,
      p_cliente: filtros.cliente || null,
      p_data_solicitada: filtros.data_solicitada || null,
      p_busca: filtros.busca || null,
      p_tipos: filtros.tipos && filtros.tipos.length > 0 ? filtros.tipos : null,
    });

    if (error) {
      console.error('Erro ao listar solicitações:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Igual a `listarTodas`, mas percorre as páginas até esgotar o resultado.
   *
   * Por que existe: a Central de Liberações aplica quase todos os seus
   * filtros (categoria, cliente, data, empresa, busca) no cliente. Com uma
   * página só, esses filtros varriam um recorte truncado e devolviam
   * "nenhum resultado" para registros que existiam — sem nenhum aviso.
   *
   * `truncado` informa que o teto de segurança foi atingido, para a tela
   * poder avisar em vez de mentir. A correção definitiva é filtrar no banco:
   * a RPC hoje só aceita status, rota e tipo.
   */
  async listarTodasCompleto(
    userId: string,
    filtros: FiltrosSolicitacoes = {},
    opcoes?: { tamanhoPagina?: number; maxRegistros?: number }
  ): Promise<{ itens: Solicitacao[]; truncado: boolean }> {
    const tamanhoPagina = opcoes?.tamanhoPagina ?? 200;
    const maxRegistros = opcoes?.maxRegistros ?? 5000;

    const itens: Solicitacao[] = [];
    let offset = 0;

    while (itens.length < maxRegistros) {
      const pagina = await this.listarTodas(userId, {
        ...filtros,
        limite: tamanhoPagina,
        offset,
      });

      itens.push(...pagina);

      // Página incompleta = acabou o resultado
      if (pagina.length < tamanhoPagina) {
        return { itens, truncado: false };
      }
      offset += tamanhoPagina;
    }

    return { itens, truncado: true };
  },

  /**
   * Empresas que possuem ao menos uma solicitação visível ao usuário.
   * Fonte do dropdown de filtro: o cadastro inteiro polui e derivar da lista
   * carregada faria o dropdown encolher a cada filtro aplicado.
   */
  async listarEmpresasComSolicitacoes(userId: string): Promise<Array<{ id: string; nome: string; total: number }>> {
    const { data, error } = await supabase.rpc('fn_listar_empresas_com_solicitacoes', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Erro ao listar empresas com solicitações:', error);
      return [];
    }

    return (data || []).map((e: any) => ({
      id: e.empresa_id,
      nome: e.empresa_nome || '—',
      total: Number(e.total || 0),
    }));
  },

  /**
   * Contadores dos cards. Aplica os MESMOS filtros da listagem, exceto o
   * status: trocar de empresa tem de mudar os números, mas selecionar
   * "Pendentes" não pode zerar os outros dois cards.
   */
  async contarCentral(
    userId: string,
    filtros: Omit<FiltrosSolicitacoes, 'status' | 'limite' | 'offset'> = {}
  ): Promise<{ pendentes: number; aprovadas: number; rejeitadas: number; total: number }> {
    const { data, error } = await supabase.rpc('fn_contar_solicitacoes_central', {
      p_user_id: userId,
      p_rota_id: filtros.rota_id || null,
      p_tipo: filtros.tipo || null,
      p_empresa_id: filtros.empresa_id || null,
      p_cliente: filtros.cliente || null,
      p_data_solicitada: filtros.data_solicitada || null,
      p_busca: filtros.busca || null,
      p_tipos: filtros.tipos && filtros.tipos.length > 0 ? filtros.tipos : null,
    });

    if (error) {
      console.error('Erro ao contar solicitações:', error);
      return { pendentes: 0, aprovadas: 0, rejeitadas: 0, total: 0 };
    }

    const r = Array.isArray(data) ? data[0] : data;
    return {
      pendentes: Number(r?.pendentes || 0),
      aprovadas: Number(r?.aprovadas || 0),
      rejeitadas: Number(r?.rejeitadas || 0),
      total: Number(r?.total || 0),
    };
  },

  // Aprovar solicitação
  async aprovar(solicitacaoId: string, userId: string, motivo?: string): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc('fn_aprovar_solicitacao', {
      p_solicitacao_id: solicitacaoId,
      p_user_id: userId,
      p_motivo: motivo || null,
    });

    if (error) {
      console.error('Erro ao aprovar solicitação:', error);
      return { success: false, message: error.message };
    }

    const resultado = data?.[0];
    return {
      success: resultado?.sucesso || false,
      message: resultado?.mensagem || 'Erro desconhecido',
    };
  },

  // Aprovar autorização de cliente (RENEGOCIACAO ou EMPRESTIMO_ADICIONAL)
  // Atualiza a flag no cliente e o trigger cuida de atualizar a solicitação
  async aprovarAutorizacaoCliente(
    solicitacao: Solicitacao, 
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    if (!solicitacao.cliente_id) {
      return { success: false, message: 'Cliente não encontrado na solicitação' };
    }

    const colunaFlag = solicitacao.tipo_solicitacao === 'RENEGOCIACAO' 
      ? 'permite_renegociacao' 
      : 'permite_emprestimo_adicional';

    const { error } = await supabase
      .from('clientes')
      .update({ [colunaFlag]: true })
      .eq('id', solicitacao.cliente_id);

    if (error) {
      console.error('Erro ao aprovar autorização de cliente:', error);
      return { success: false, message: error.message };
    }

    // O trigger tr_cliente_flag_autorizacao cuida de atualizar a solicitação para APROVADO
    return { 
      success: true, 
      message: solicitacao.tipo_solicitacao === 'RENEGOCIACAO' 
        ? 'Renegociação autorizada com sucesso' 
        : 'Empréstimo adicional autorizado com sucesso' 
    };
  },

  // Aprovar solicitação de ESTORNO_PAGAMENTO
  // Executa o estorno de fato (fn_estornar_pagamento_web) e, só se der certo,
  // marca a solicitação como aprovada. Se o estorno falhar (ex.: fora de ordem,
  // parcela já estornada), NÃO aprova e devolve o motivo.
  async aprovarEstornoPagamento(
    solicitacao: Solicitacao,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    if (!solicitacao.parcela_id) {
      return { success: false, message: 'Solicitação não possui parcela vinculada para estornar' };
    }

    const motivo = solicitacao.motivo_solicitacao?.trim()
      ? `Estorno autorizado: ${solicitacao.motivo_solicitacao.trim()}`
      : 'Estorno autorizado pelo administrador';

    const { data: estData, error: estErr } = await supabase.rpc('fn_estornar_pagamento_web', {
      p_parcela_id: solicitacao.parcela_id,
      p_motivo: motivo,
      p_vendedor_id: solicitacao.vendedor_id || null,
      p_user_id: userId,
    });

    if (estErr) {
      console.error('Erro ao efetivar estorno:', estErr);
      return { success: false, message: estErr.message };
    }

    const estRes = Array.isArray(estData) ? estData[0] : estData;
    if (estRes && estRes.sucesso === false) {
      return { success: false, message: estRes.mensagem || 'Não foi possível efetivar o estorno' };
    }

    const { data: aprData, error: aprErr } = await supabase.rpc('fn_aprovar_solicitacao', {
      p_solicitacao_id: solicitacao.id,
      p_user_id: userId,
      p_motivo: 'Estorno efetivado',
    });

    if (aprErr) {
      console.error('Estorno efetivado, mas falhou ao marcar solicitação:', aprErr);
      return {
        success: true,
        message: 'Estorno efetivado. Atenção: a solicitação não pôde ser marcada como aprovada automaticamente.',
      };
    }

    const aprRes = aprData?.[0];
    return {
      success: aprRes?.sucesso ?? true,
      message: estRes?.mensagem || aprRes?.mensagem || 'Estorno efetivado e solicitação aprovada',
    };
  },

  // Rejeitar solicitação
  async rejeitar(solicitacaoId: string, userId: string, motivo: string): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc('fn_rejeitar_solicitacao', {
      p_solicitacao_id: solicitacaoId,
      p_user_id: userId,
      p_motivo: motivo,
    });

    if (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      return { success: false, message: error.message };
    }

    const resultado = data?.[0];
    return {
      success: resultado?.sucesso || false,
      message: resultado?.mensagem || 'Erro desconhecido',
    };
  },

  // Buscar detalhes de uma solicitação
  async buscarPorId(solicitacaoId: string): Promise<Solicitacao | null> {
    const { data, error } = await supabase
      .from('solicitacoes_autorizacao')
      .select(`
        *,
        vendedor:vendedores(nome, codigo_vendedor),
        rota:rotas(nome, empresa_id, empresa:empresas(nome)),
        cliente:clientes(nome),
        resolvedor:user_profiles!resolvido_por(nome)
      `)
      .eq('id', solicitacaoId)
      .single();

    if (error) {
      console.error('Erro ao buscar solicitação:', error);
      return null;
    }

    return {
      ...data,
      vendedor_nome: data.vendedor?.nome,
      vendedor_codigo: data.vendedor?.codigo_vendedor,
      rota_nome: data.rota?.nome,
      empresa_id: data.rota?.empresa_id ?? null,
      empresa_nome: data.rota?.empresa?.nome ?? null,
      cliente_nome: data.cliente?.nome,
      resolvido_por_nome: data.resolvedor?.nome,
    } as Solicitacao;
  },

  // ===================================================================
  // MOVIMENTAÇÕES PENDENTES (despesa/receita que excede limite)
  // ===================================================================

  // Busca os dados operacionais da movimentação pendente pela solicitação
  async buscarMovimentacaoPendente(solicitacaoId: string): Promise<MovimentacaoPendente | null> {
    const { data, error } = await supabase
      .from('movimentacoes_pendentes')
      .select(`
        *,
        rota:rotas(nome),
        vendedor:vendedores(nome)
      `)
      .eq('solicitacao_id', solicitacaoId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar movimentação pendente:', error);
      return null;
    }
    if (!data) return null;

    return {
      ...data,
      rota_nome: (data as any).rota?.nome ?? null,
      vendedor_nome: (data as any).vendedor?.nome ?? null,
    } as MovimentacaoPendente;
  },

  // Aprova a movimentação: cria o financeiro e atualiza a liquidação (regras na RPC)
  async aprovarMovimentacaoPendente(
    movimentacaoId: string,
    adminUserId: string
  ): Promise<{ success: boolean; message: string; financeiroId?: string | null }> {
    const { data, error } = await supabase.rpc('fn_aprovar_movimentacao_pendente', {
      p_movimentacao_id: movimentacaoId,
      p_admin_user_id: adminUserId,
    });
    if (error) {
      console.error('Erro ao aprovar movimentação pendente:', error);
      return { success: false, message: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      success: !!row?.sucesso,
      message: row?.mensagem ?? '',
      financeiroId: row?.financeiro_id_out ?? null,
    };
  },

  // Rejeita a movimentação (não mexe em financeiro/liquidação)
  async rejeitarMovimentacaoPendente(
    movimentacaoId: string,
    adminUserId: string,
    motivo: string
  ): Promise<{ success: boolean; message: string }> {
    const { data, error } = await supabase.rpc('fn_rejeitar_movimentacao_pendente', {
      p_movimentacao_id: movimentacaoId,
      p_admin_user_id: adminUserId,
      p_motivo: motivo,
    });
    if (error) {
      console.error('Erro ao rejeitar movimentação pendente:', error);
      return { success: false, message: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      success: !!row?.sucesso,
      message: row?.mensagem ?? '',
    };
  },
};