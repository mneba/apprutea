import { createClient } from '@/lib/supabase/client';
import type { UserProfile, ModuloSistema, UserPermissao } from '@/types/database';

const supabase = createClient();

export const usuariosService = {
  // Listar todos os usuários
  async listarUsuarios(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Buscar usuário por ID
  async buscarUsuario(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data;
  },

  // Atualizar tipo de usuário
  async atualizarTipoUsuario(userId: string, tipoUsuario: string): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ tipo_usuario: tipoUsuario })
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Atualizar status do usuário
  async atualizarStatus(userId: string, status: string, observacoes?: string): Promise<void> {
    const user = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        status,
        observacoes_aprovacao: observacoes,
        aprovado_por: status === 'APROVADO' ? user.data.user?.id : null,
        data_aprovacao: status === 'APROVADO' ? new Date().toISOString() : null,
      })
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Salvar código de acesso
  async salvarCodigoAcesso(userId: string, codigo: string): Promise<void> {
    const user = await supabase.auth.getUser();

    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        token_acesso: codigo,
        token_gerado_por: user.data.user?.id,
        token_gerado_em: new Date().toISOString(),
        token_validado: false, // Reset validação ao gerar novo código
      })
      .eq('user_id', userId);

    if (error) throw error;
  },

  // Listar módulos do sistema
  async listarModulos(): Promise<ModuloSistema[]> {
    const { data, error } = await supabase
      .from('modulos_sistema')
      .select('*')
      .eq('ativo', true)
      .order('categoria')
      .order('ordem_exibicao');

    if (error) throw error;
    return data || [];
  },

  // Listar permissões de um usuário
  async listarPermissoesUsuario(userId: string): Promise<UserPermissao[]> {
    const { data, error } = await supabase
      .from('user_permissoes')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data || [];
  },

  // Salvar permissões do usuário
  async salvarPermissoes(userId: string, permissoes: Partial<UserPermissao>[]): Promise<void> {
    const user = await supabase.auth.getUser();
    const concedidoPor = user.data.user?.id;

    // Para cada permissão, fazer upsert
    for (const permissao of permissoes) {
      if (!permissao.modulo_id) continue;

      // Verificar se alguma permissão está marcada
      const temPermissao = permissao.pode_todos || permissao.pode_guardar || 
                          permissao.pode_buscar || permissao.pode_eliminar;

      if (temPermissao) {
        // Upsert (inserir ou atualizar)
        const { error } = await supabase
          .from('user_permissoes')
          .upsert({
            user_id: userId,
            modulo_id: permissao.modulo_id,
            pode_todos: permissao.pode_todos || false,
            pode_guardar: permissao.pode_guardar || false,
            pode_buscar: permissao.pode_buscar || false,
            pode_eliminar: permissao.pode_eliminar || false,
            concedido_por: concedidoPor,
            data_concessao: new Date().toISOString(),
          }, {
            onConflict: 'user_id,modulo_id',
          });

        if (error) throw error;
      } else {
        // Se não tem nenhuma permissão, deletar o registro (se existir)
        await supabase
          .from('user_permissoes')
          .delete()
          .eq('user_id', userId)
          .eq('modulo_id', permissao.modulo_id);
      }
    }
  },

  // Verificar permissão específica
  async verificarPermissao(userId: string, moduloCodigo: string, tipoPermissao: string): Promise<boolean> {
    // Primeiro buscar o módulo pelo código
    const { data: modulo } = await supabase
      .from('modulos_sistema')
      .select('id')
      .eq('codigo', moduloCodigo)
      .single();

    if (!modulo) return false;

    // Buscar permissão do usuário
    const { data: permissao } = await supabase
      .from('user_permissoes')
      .select('*')
      .eq('user_id', userId)
      .eq('modulo_id', modulo.id)
      .single();

    if (!permissao) return false;

    // Verificar tipo de permissão
    switch (tipoPermissao) {
      case 'todos':
        return permissao.pode_todos;
      case 'guardar':
        return permissao.pode_todos || permissao.pode_guardar;
      case 'buscar':
        return permissao.pode_todos || permissao.pode_buscar;
      case 'eliminar':
        return permissao.pode_todos || permissao.pode_eliminar;
      default:
        return false;
    }
  },

  // Excluir usuário
  async excluirUsuario(userId: string): Promise<void> {
    // Primeiro deletar permissões
    await supabase
      .from('user_permissoes')
      .delete()
      .eq('user_id', userId);

    // Depois deletar perfil
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;

    // Nota: O usuário em auth.users será deletado pelo CASCADE da FK
  },
};
