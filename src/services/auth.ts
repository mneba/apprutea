import { createClient } from '@/lib/supabase/client';
import type { Hierarquia, UserProfile, RegistroEtapa2 } from '@/types/database';

const supabase = createClient();

export const authService = {
  // Registrar usuário (Etapa 1 - auth.users)
  async registrarUsuario(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;

    // signUp não garante sessão ativa — fazer login explícito
    if (data.user && !data.session) {
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (loginError) throw loginError;
      return { ...data, session: loginData.session };
    }

    return data;
  },

  // Completar perfil (Etapa 2 - user_profiles)
  // Localização (hierarquia/cidade) NÃO é mais coletada no cadastro.
  // Admin define acesso depois via ModalGerenciarUsuario.
  async completarPerfil(userId: string, dados: RegistroEtapa2) {
    // Criar perfil do usuário sem localização
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: userId,
        nome: dados.nome,
        telefone: dados.telefone,
        empresa_pretendida: dados.empresa_pretendida,
        status: 'PENDENTE',
        tipo_usuario: 'USUARIO_PADRAO',
        empresas_ids: dados.empresa_id ? [dados.empresa_id] : [],
        hierarquias_ids: [],
        cidades_ids: [],
        rotas_ids: [],
      })
      .select()
      .single();

    if (profileError) throw profileError;

    // Determinar destinatários da notificação:
    // - Se veio de convite (empresa_id definida): admin titular da empresa
    // - Caso contrário: todos os SUPER_ADMINs
    let destinatarios: { user_id: string }[] = [];

    if (dados.empresa_id) {
      // Buscar admin titular da empresa
      const { data: adminTitular } = await supabase
        .from('user_profiles')
        .select('user_id')
        .filter('admin_empresa_ids', 'cs', JSON.stringify([dados.empresa_id]))
        .eq('status', 'APROVADO')
        .limit(1);

      if (adminTitular && adminTitular.length > 0) {
        destinatarios = adminTitular;
      } else {
        // Fallback para SUPER_ADMIN se não houver admin titular
        const { data: superAdmins } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('tipo_usuario', 'SUPER_ADMIN')
          .eq('status', 'APROVADO');
        destinatarios = superAdmins || [];
      }
    } else {
      // Sem empresa — notificar SUPER_ADMINs
      const { data: superAdmins } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('tipo_usuario', 'SUPER_ADMIN')
        .eq('status', 'APROVADO');
      destinatarios = superAdmins || [];
    }

    if (destinatarios.length > 0) {
      const mensagens = destinatarios.map((admin) => ({
        usuario_origem_id: userId,
        usuario_destino_id: admin.user_id,
        mensagem: `🆕 Nova solicitação de acesso!\n\n👤 Nome: ${dados.nome}\n📱 Telefone: ${dados.telefone}\n🏢 Empresa: ${dados.empresa_pretendida}\n\n⏳ Aguardando aprovação e geração de código de acesso.`,
        lido: false,
      }));

      await supabase.from('mensagens_sistema').insert(mensagens);
    }

    return profile;
  },

  // Login com email e senha
  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Verificar se usuário tem perfil
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    return { user: data.user, profile };
  },

  // Validar código de acesso
  async validarCodigo(userId: string, codigo: string) {
    // Buscar perfil do usuário
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    // Verificar se o código está correto
    if (profile.token_acesso !== codigo) {
      throw new Error('Código de acesso inválido');
    }

    // Atualizar token_validado para true
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        token_validado: true,
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    return true;
  },

  // Verificar status do usuário
  async verificarStatus(userId: string) {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('status, token_acesso, token_validado, nome, tipo_usuario')
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return profile;
  },

  // Buscar usuário atual
  async getUsuarioAtual() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  // Logout
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};

export const hierarquiaService = {
  // Listar países únicos
  async listarPaises() {
    const { data, error } = await supabase
      .from('hierarquias')
      .select('pais')
      .order('pais');

    if (error) throw error;

    // Retornar países únicos
    const paisesUnicos = [...new Set(data.map((h) => h.pais))];
    return paisesUnicos;
  },

  // Listar cidades por país
  async listarCidadesPorPais(pais: string) {
    const { data, error } = await supabase
      .from('hierarquias')
      .select('id, estado, pais')
      .eq('pais', pais)
      .order('estado');

    if (error) throw error;
    return data as Hierarquia[];
  },

  // Listar todas as hierarquias
  async listarTodas() {
    const { data, error } = await supabase
      .from('hierarquias')
      .select('*')
      .order('pais')
      .order('estado');

    if (error) throw error;
    return data as Hierarquia[];
  },
};