'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile, Hierarquia, Empresa, Rota } from '@/types/database';

interface LocalizacaoAtual {
  hierarquia_id: string | null;
  hierarquia?: Hierarquia | null;
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
  localizacao: LocalizacaoAtual;
  setLocalizacao: (loc: Partial<LocalizacaoAtual>) => void;
  refreshProfile: () => Promise<void>;
}

// Debug helper
const DEBUG = true;
const log = (...args: any[]) => DEBUG && console.log('🔐 UserContext:', ...args);

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [localizacao, setLocalizacaoState] = useState<LocalizacaoAtual>({
    hierarquia_id: null,
    hierarquia: null,
    empresa_id: null,
    empresa: null,
    rota_id: null,
    rota: null,
  });

  const supabase = createClient();

  const isSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';

  // Carregar usuário e perfil
  const loadUser = async () => {
    log('Iniciando carregamento do usuário...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      log('Auth user:', user?.id);
      setUser(user);

      if (user) {
        // Buscar perfil completo
        const { data: profileData, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        log('Profile carregado:', profileData?.nome, 'Tipo:', profileData?.tipo_usuario);
        if (error) log('Erro ao carregar profile:', error);
        
        setProfile(profileData);

        // Carregar localização salva (apenas se não for SUPER_ADMIN sem localização definida)
        if (profileData) {
          await loadLocalizacaoSalva(profileData);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar usuário:', err);
    } finally {
      log('Loading finalizado');
      setLoading(false);
    }
  };

  // Carregar localização salva do perfil
  const loadLocalizacaoSalva = async (profileData: UserProfile) => {
    const newLocalizacao: LocalizacaoAtual = {
      hierarquia_id: profileData.ultima_cidade_id || null,
      hierarquia: null,
      empresa_id: profileData.ultima_empresa_id || null,
      empresa: null,
      rota_id: profileData.ultima_rota_id || null,
      rota: null,
    };

    // Buscar dados da hierarquia
    if (profileData.ultima_cidade_id) {
      const { data: hierarquia } = await supabase
        .from('hierarquias')
        .select('*')
        .eq('id', profileData.ultima_cidade_id)
        .single();
      newLocalizacao.hierarquia = hierarquia;
    }

    // Buscar dados da empresa
    if (profileData.ultima_empresa_id) {
      const { data: empresa } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', profileData.ultima_empresa_id)
        .single();
      newLocalizacao.empresa = empresa;
    }

    // Buscar dados da rota
    if (profileData.ultima_rota_id) {
      const { data: rota } = await supabase
        .from('rotas')
        .select('*')
        .eq('id', profileData.ultima_rota_id)
        .single();
      newLocalizacao.rota = rota;
    }

    setLocalizacaoState(newLocalizacao);
  };

  // Atualizar localização e salvar no perfil
  const setLocalizacao = async (loc: Partial<LocalizacaoAtual>) => {
    const newLocalizacao = { ...localizacao, ...loc };
    setLocalizacaoState(newLocalizacao);

    // Salvar no perfil do usuário
    if (user && profile) {
      await supabase
        .from('user_profiles')
        .update({
          ultima_cidade_id: newLocalizacao.hierarquia_id,
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

    // Listener de mudanças de auth
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
