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
  'DESPESA_EXCEDE_LIMITE': 'Despesa Excede Limite',
  'RECEITA_EXCEDE_LIMITE': 'Receita Excede Limite',
  'ESTORNO_PAGAMENTO': 'Estorno de Pagamento',
  'CANCELAR_EMPRESTIMO': 'Cancelar Empréstimo',
  'REABRIR_LIQUIDACAO': 'Reabrir Liquidação',
  'QUITAR_COM_DESCONTO': 'Quitar com Desconto',
  'CLIENTE_OUTRA_ROTA': 'Cliente de Outra Rota',
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
  cliente_id: string | null;
  cliente_nome: string | null;
  emprestimo_id: string | null;
  valor_solicitado: number | null;
  valor_limite: number | null;
  resolvido_por: string | null;
  resolvido_por_nome: string | null;
  data_resolucao: string | null;
  motivo_resolucao: string | null;
  ja_visualizada: boolean;
}

export interface FiltrosSolicitacoes {
  status?: string | null;
  rota_id?: string | null;
  tipo?: string | null;
  limite?: number;
  offset?: number;
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
    });

    if (error) {
      console.error('Erro ao listar solicitações:', error);
      return [];
    }

    return data || [];
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
        rota:rotas(nome),
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
      cliente_nome: data.cliente?.nome,
      resolvido_por_nome: data.resolvedor?.nome,
    } as Solicitacao;
  },
};