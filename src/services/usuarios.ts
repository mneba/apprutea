import { createClient } from '@/lib/supabase/client';
import type { UserProfile, ModuloSistema, UserPermissao, Hierarquia, Empresa, Rota } from '@/types/database';

const supabase = createClient();

export const usuariosService = {
  // ============================================
  // USUÁRIOS
  // ============================================

  // Listar usuários (SUPER_ADMIN vê todos, outros veem apenas da sua empresa)
  async listarUsuarios(filtros?: {
    empresaId?: string;
    isSuperAdmin?: boolean;
  }): Promise<UserProfile[]> {
    console.log('🔍 Service listarUsuarios:', filtros);
    
    let query = supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    // SUPER_ADMIN vê TODOS os usuários (não aplica filtro)
    // Outros usuários só veem os da sua empresa
    if (filtros?.isSuperAdmin !== true && filtros?.empresaId) {
      console.log('📌 Aplicando filtro por empresa:', filtros.empresaId);
      query = query.contains('empresas_ids', [filtros.empresaId]);
    } else {
      console.log('👑 SUPER_ADMIN ou sem filtro - mostrando todos');
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('❌ Erro ao listar usuários:', error);
      throw error;
    }
    
    console.log('✅ Usuários retornados:', data?.length);
    return data || [];
  },

  // Buscar usuário por ID com dados completos
  async buscarUsuarioCompleto(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        auth_user:user_id (
          email
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  // Atualizar dados do usuário
  async atualizarUsuario(userId: string, dados: Partial<UserProfile>): Promise<void> {
    const user = await supabase.auth.getUser();
    const adminId = user.data.user?.id;

    // Clonar dados para não modificar original
    const dadosParaSalvar: any = { ...dados };
    
    // Sempre enviar quem alterou e quando
    if (adminId) {
      // Para APROVADO - campos obrigatórios do trigger
      if (dadosParaSalvar.status === 'APROVADO') {
        dadosParaSalvar.aprovado_por = adminId;
        dadosParaSalvar.data_aprovacao = new Date().toISOString();
      }
      
      // Para REJEITADO - alguns triggers também exigem aprovado_por
      if (dadosParaSalvar.status === 'REJEITADO') {
        dadosParaSalvar.aprovado_por = adminId;
        dadosParaSalvar.data_aprovacao = new Date().toISOString();
        dadosParaSalvar.observacoes_aprovacao = dadosParaSalvar.observacoes_aprovacao || 'Rejeitado pelo administrador';
      }
      
      // Para PENDENTE - limpar campos de aprovação
      if (dadosParaSalvar.status === 'PENDENTE') {
        dadosParaSalvar.aprovado_por = null;
        dadosParaSalvar.data_aprovacao = null;
        dadosParaSalvar.observacoes_aprovacao = null;
      }
    }

    console.log('📤 Atualizando usuário:', userId, dadosParaSalvar);

    const { error } = await supabase
      .from('user_profiles')
      .update(dadosParaSalvar)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      throw error;
    }
    
    console.log('✅ Usuário atualizado com sucesso');
  },

  // Atualizar tipo de usuário
  async atualizarTipoUsuario(userId: string, tipoUsuario: string): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ tipo_usuario: tipoUsuario })
      .eq('user_id', userId);

    if (error) throw error;
  },

  // ============================================
  // TOKEN DE ACESSO - Usando RPC do Supabase
  // ============================================

  // Gerar código de acesso usando function existente do Supabase
  // Function: gerar_token_acesso(p_user_id uuid, p_admin_que_gera uuid)
  // Retorna: TABLE(sucesso boolean, token_gerado varchar, mensagem text)
  async gerarCodigoAcesso(userId: string): Promise<string> {
    const user = await supabase.auth.getUser();
    const adminQueGera = user.data.user?.id;

    if (!adminQueGera) {
      throw new Error('Usuário não autenticado');
    }

    console.log('🔑 Gerando código para:', userId, 'por:', adminQueGera);

    // Chamar RPC com os parâmetros corretos
    const { data, error } = await supabase.rpc('gerar_token_acesso', {
      p_user_id: userId,
      p_admin_que_gera: adminQueGera,
    });

    console.log('📤 Resposta RPC:', { data, error });

    if (error) {
      console.error('❌ Erro RPC:', error);
      throw new Error(error.message || 'Erro ao gerar token');
    }

    // A function retorna TABLE, pode vir como array ou objeto único
    if (data) {
      // Se for array, pegar primeiro elemento
      const resultado = Array.isArray(data) ? data[0] : data;
      
      console.log('📋 Resultado:', resultado);
      
      if (resultado?.sucesso) {
        return resultado.token_gerado;
      } else if (resultado?.token_gerado) {
        // Às vezes retorna direto o token sem campo sucesso
        return resultado.token_gerado;
      } else {
        throw new Error(resultado?.mensagem || 'Erro ao gerar token');
      }
    }

    throw new Error('Resposta vazia da function');
  },

  // Validar token de acesso usando function existente do Supabase
  // Function: fn_validar_token_acesso(p_user_id uuid, p_token varchar)
  // Retorna: jsonb
  async validarTokenAcesso(userId: string, token: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('fn_validar_token_acesso', {
      p_user_id: userId,
      p_token: token,
    });

    if (error) {
      console.error('Erro ao validar token:', error);
      throw error;
    }

    // Verificar resultado do jsonb retornado
    return data?.sucesso === true || data?.valido === true;
  },

  // ============================================
  // HIERARQUIA E EMPRESAS
  // ============================================

  // Listar hierarquias (países e estados)
  async listarHierarquias(): Promise<Hierarquia[]> {
    const { data, error } = await supabase
      .from('hierarquias')
      .select('*')
      .order('pais')
      .order('estado');

    if (error) throw error;
    return data || [];
  },

  // Listar empresas por hierarquia
  async listarEmpresasPorHierarquia(hierarquiaId: string): Promise<Empresa[]> {
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('hierarquia_id', hierarquiaId)
      .eq('status', 'ATIVA')
      .order('nome');

    if (error) throw error;
    return data || [];
  },

  // Listar todas as empresas ativas
  async listarEmpresas(): Promise<Empresa[]> {
    const { data, error } = await supabase
      .from('empresas')
      .select(`
        *,
        hierarquia:hierarquia_id (
          id,
          pais,
          estado
        )
      `)
      .eq('status', 'ATIVA')
      .order('nome');

    if (error) throw error;
    return data || [];
  },

  // Listar rotas de uma empresa
  async listarRotasPorEmpresa(empresaId: string): Promise<Rota[]> {
    // Buscar empresa para pegar rotas_ids
    const { data: empresa } = await supabase
      .from('empresas')
      .select('rotas_ids')
      .eq('id', empresaId)
      .single();

    if (!empresa?.rotas_ids || empresa.rotas_ids.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('rotas')
      .select('*')
      .in('id', empresa.rotas_ids)
      .eq('status', 'ATIVA')
      .order('nome');

    if (error) throw error;
    return data || [];
  },

  // Listar todas as rotas
  async listarRotas(): Promise<Rota[]> {
    const { data, error } = await supabase
      .from('rotas')
      .select('*')
      .eq('status', 'ATIVA')
      .order('nome');

    if (error) throw error;
    return data || [];
  },

  // ============================================
  // PERMISSÕES
  // ============================================

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

    for (const permissao of permissoes) {
      if (!permissao.modulo_id) continue;

      const temPermissao = permissao.pode_todos || permissao.pode_guardar ||
                          permissao.pode_buscar || permissao.pode_eliminar;

      if (temPermissao) {
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
        await supabase
          .from('user_permissoes')
          .delete()
          .eq('user_id', userId)
          .eq('modulo_id', permissao.modulo_id);
      }
    }
  },

  // ============================================
  // MENSAGENS DO SISTEMA
  // ============================================

  // Listar mensagens não lidas
  async listarMensagensNaoLidas(userId: string): Promise<any[]> {
    try {
      // Query simplificada sem join (o join estava causando erro PGRST200)
      const { data, error } = await supabase
        .from('mensagens_sistema')
        .select('*')
        .eq('usuario_destino_id', userId)
        .eq('lido', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Erro ao carregar mensagens:', error);
        // Retornar array vazio em vez de quebrar
        return [];
      }
      
      return data || [];
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
      return [];
    }
  },

  // Marcar mensagem como lida
  async marcarMensagemLida(mensagemId: string): Promise<void> {
    const { error } = await supabase
      .from('mensagens_sistema')
      .update({ lido: true })
      .eq('id', mensagemId);

    if (error) throw error;
  },

  // Marcar todas como lidas
  async marcarTodasLidas(userId: string): Promise<void> {
    const { error } = await supabase
      .from('mensagens_sistema')
      .update({ lido: true })
      .eq('usuario_destino_id', userId)
      .eq('lido', false);

    if (error) throw error;
  },


async listarLiberacoesUsuario(userId: string) {
  const { data, error } = await supabase.rpc('fn_listar_liberacoes_usuario', {
    p_user_id: userId
  });
  
  if (error) throw error;
  return data || [];
},

async salvarLiberacoesUsuario(userId: string, liberacoes: { tipo_solicitacao: string; pode_liberar: boolean }[]) {
  const { data, error } = await supabase.rpc('fn_salvar_liberacoes_usuario', {
    p_user_id: userId,
    p_liberacoes: liberacoes
  });
  
  if (error) throw error;
  return data;
},

async verificarPodeLiberarTipo(userId: string, tipoSolicitacao: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_usuario_pode_liberar', {
    p_user_id: userId,
    p_tipo_solicitacao: tipoSolicitacao
  });
  
  if (error) {
    console.error('Erro ao verificar permissão:', error);
    return false;
  }
  
  return data || false;
},

};