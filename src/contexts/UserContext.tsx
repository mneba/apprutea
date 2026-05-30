'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile, Hierarquia, Cidade, Empresa, Rota, UserPermissao } from '@/types/database';

interface LocalizacaoAtual {
  hierarquia_id: string | null;
  hierarquia?: Hierarquia | null;
  cidade_id: string | null;
  cidade?: Cidade | null;
  empresa_id: string | null;
  empresa?: Empresa | null;
  rota_id: string | null;
  rota?: Rota | null;
}

interface UserContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  permissoes: Record<string, UserPermissao>;
  temPermissao: (modulo: string) => boolean;
  localizacao: LocalizacaoAtual;
  setLocalizacao: (loc: Partial<LocalizacaoAtual>) => void;
  refreshProfile: () => Promise<void>;
}

const DEBUG = true;
const log = (...args: any[]) => DEBUG && console.log('🔐 UserContext:', ...args);

const UserContext = createContext<UserContextType | undefined>(undefined);

// =====================================================
// Valida se a localização salva ainda é permitida
// para o perfil atual. Se não for, ajusta para o
// primeiro item permitido ou null.
// =====================================================
function validarLocalizacao(
  profileData: UserProfile,
  loc: LocalizacaoAtual
): LocalizacaoAtual {
  // SUPER_ADMIN não tem restrições
  if (profileData.tipo_usuario === 'SUPER_ADMIN') return loc;

  const empresasPermitidas: string[] = profileData.empresas_ids || [];
  const rotasPermitidas: string[] = profileData.rotas_ids || [];

  let empresaIdValida = loc.empresa_id;
  let rotaIdValida = loc.rota_id;
  let mudou = false;

  // Empresa já não está mais nos acessos permitidos?
  if (empresaIdValida && !empresasPermitidas.includes(empresaIdValida)) {
    log('Empresa da localização não permitida, redefinindo para primeira disponível');
    empresaIdValida = empresasPermitidas[0] || null;
    rotaIdValida = null; // zerar rota também
    mudou = true;
  }

  // Rota já não está mais nos acessos permitidos?
  // (rotas_ids vazio = acesso a todas → não invalida)
  if (rotaIdValida && rotasPermitidas.length > 0 && !rotasPermitidas.includes(rotaIdValida)) {
    log('Rota da localização não permitida, limpando rota');
    rotaIdValida = null;
    mudou = true;
  }

  if (!mudou) return loc;

  return {
    ...loc,
    empresa_id: empresaIdValida,
    empresa: empresaIdValida !== loc.empresa_id ? null : loc.empresa,
    rota_id: rotaIdValida,
    rota: rotaIdValida !== loc.rota_id ? null : loc.rota,
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissoes, setPermissoes] = useState<Record<string, UserPermissao>>({});
  const [localizacao, setLocalizacaoState] = useState<LocalizacaoAtual>({
    hierarquia_id: null,
    hierarquia: null,
    cidade_id: null,
    cidade: null,
    empresa_id: null,
    empresa: null,
    rota_id: null,
    rota: null,
  });

  const supabase = createClient();
  const isSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';
  const isAdmin = profile?.tipo_usuario === 'ADMIN';

  // Verifica se usuário tem alguma permissão em um módulo pelo código
  // Só SUPER_ADMIN tem acesso irrestrito
  const temPermissao = (codigoModulo: string): boolean => {
    if (isSuperAdmin) return true;
    const p = permissoes[codigoModulo];
    if (!p) return false;
    return !!(p.pode_todos || p.pode_guardar || p.pode_buscar || p.pode_eliminar);
  };

  const loadUser = async () => {
    log('Iniciando carregamento do usuário...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      log('Auth user:', user?.id);
      setUser(user);

      if (user) {
        const { data: profileData, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        log('Profile carregado:', profileData?.nome, 'Tipo:', profileData?.tipo_usuario);
        if (error) log('Erro ao carregar profile:', error);

        setProfile(profileData);

        if (profileData) {
          await loadLocalizacaoSalva(profileData);

          // Carregar permissões (SUPER_ADMIN tem tudo, não precisa buscar)
          if (profileData.tipo_usuario !== 'SUPER_ADMIN') {
            const [{ data: permissoesData }, { data: modulosData }] = await Promise.all([
              supabase.from('user_permissoes').select('*').eq('user_id', user.id),
              supabase.from('modulos_sistema').select('id, codigo'),
            ]);

            // Montar mapa codigo → permissao
            const moduloMap: Record<string, string> = {};
            (modulosData || []).forEach((m: any) => { moduloMap[m.id] = m.codigo; });

            const map: Record<string, any> = {};
            (permissoesData || []).forEach((p: any) => {
              map[p.modulo_id] = p; // por UUID
              const codigo = moduloMap[p.modulo_id];
              if (codigo) map[codigo] = p; // por código
            });
            setPermissoes(map);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao carregar usuário:', err);
    } finally {
      log('Loading finalizado');
      setLoading(false);
    }
  };

  const loadLocalizacaoSalva = async (profileData: UserProfile) => {
    // Se não tem ultima_empresa_id mas tem empresas_ids, usar a primeira
    const empresaIdInicial = profileData.ultima_empresa_id ||
      (profileData.empresas_ids?.length > 0 ? profileData.empresas_ids[0] : null);

    const locBruta: LocalizacaoAtual = {
      hierarquia_id: profileData.ultima_hierarquia_id || null,
      hierarquia: null,
      cidade_id: profileData.ultima_cidade_id || null,
      cidade: null,
      empresa_id: empresaIdInicial,
      empresa: null,
      rota_id: profileData.ultima_rota_id || null,
      rota: null,
    };

    // Validar antes de carregar os dados relacionados
    const locValidada = validarLocalizacao(profileData, locBruta);

    // Se a empresa mudou por causa da validação, salvar no banco
    if (locValidada.empresa_id !== locBruta.empresa_id || locValidada.rota_id !== locBruta.rota_id) {
      log('Localizacao ajustada pela validação, salvando no banco');
      await supabase
        .from('user_profiles')
        .update({
          ultima_empresa_id: locValidada.empresa_id,
          ultima_rota_id: locValidada.rota_id,
        })
        .eq('user_id', profileData.user_id);
    }

    const newLocalizacao = { ...locValidada };

    // Carregar dados relacionados da localização validada
    if (locValidada.hierarquia_id) {
      const { data } = await supabase
        .from('hierarquias')
        .select('*')
        .eq('id', locValidada.hierarquia_id)
        .single();
      newLocalizacao.hierarquia = data;
    }

    if (locValidada.cidade_id) {
      const { data } = await supabase
        .from('cidades')
        .select('*')
        .eq('id', locValidada.cidade_id)
        .single();
      newLocalizacao.cidade = data;
    }

    if (locValidada.empresa_id) {
      const { data } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', locValidada.empresa_id)
        .single();
      newLocalizacao.empresa = data;
    }

    if (locValidada.rota_id) {
      const { data } = await supabase
        .from('rotas')
        .select('*')
        .eq('id', locValidada.rota_id)
        .single();
      newLocalizacao.rota = data;
    }

    setLocalizacaoState(newLocalizacao);
  };

  const setLocalizacao = async (loc: Partial<LocalizacaoAtual>) => {
    const newLocalizacao = { ...localizacao, ...loc };
    setLocalizacaoState(newLocalizacao);

    if (user && profile) {
      await supabase
        .from('user_profiles')
        .update({
          ultima_hierarquia_id: newLocalizacao.hierarquia_id,
          ultima_cidade_id: newLocalizacao.cidade_id,
          ultima_empresa_id: newLocalizacao.empresa_id,
          ultima_rota_id: newLocalizacao.rota_id,
        })
        .eq('user_id', user.id);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setProfile(profileData);
    }
  };

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        } else if (session?.user) {
          setUser(session.user);
          loadUser();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        loading,
        isSuperAdmin,
        permissoes,
        temPermissao,
        localizacao,
        setLocalizacao,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}