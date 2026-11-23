'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { definirFusoExibicao } from '@/utils/dateFormat';
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

  // Id do usuário cujo perfil/permissões já estão carregados.
  // O Supabase emite TOKEN_REFRESHED (e às vezes SIGNED_IN) toda vez que a aba
  // volta ao foco. Sem este controle, cada alt-tab refazia loadUser() e trocava
  // a identidade de `profile`, o que disparava de novo os useEffect das páginas
  // que dependem dele — era isso que "atualizava a tela inteira".
  const usuarioCarregadoRef = useRef<string | null>(null);

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
      usuarioCarregadoRef.current = user?.id ?? null;

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
          // Localização e permissões não dependem uma da outra: vão JUNTAS
          // (22/11/2026). Em fila, somavam até 9 idas ao banco antes de a tela
          // saber a empresa — relato do Julio de 12/10, "Selecione uma
          // Empresa" por ~3 s a cada F5.
          const carregarPermissoes = async () => {
            // SUPER_ADMIN tem tudo, não precisa buscar
            if (profileData.tipo_usuario === 'SUPER_ADMIN') return;
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
          };

          await Promise.all([loadLocalizacaoSalva(profileData), carregarPermissoes()]);
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
    const empresasIds: string[] = profileData.empresas_ids || [];
    const rotasIds: string[] = profileData.rotas_ids || [];
    const empresaIdInicial = profileData.ultima_empresa_id ||
      (empresasIds.length > 0 ? empresasIds[0] : null);

    // Auto-selecionar única rota se rotas_ids tem exatamente 1 e ultima_rota_id está vazio
    const rotaIdInicial = profileData.ultima_rota_id ||
      (rotasIds.length === 1 ? rotasIds[0] : null);

    const locBruta: LocalizacaoAtual = {
      hierarquia_id: profileData.ultima_hierarquia_id || null,
      hierarquia: null,
      cidade_id: profileData.ultima_cidade_id || null,
      cidade: null,
      empresa_id: empresaIdInicial,
      empresa: null,
      rota_id: rotaIdInicial,
      rota: null,
    };

    // Validar antes de carregar os dados relacionados
    const locValidada = validarLocalizacao(profileData, locBruta);

    // Se a empresa mudou por causa da validação, salvar no banco. Não precisa
    // esperar: ninguém lê de volta o que se grava aqui.
    if (locValidada.empresa_id !== locBruta.empresa_id || locValidada.rota_id !== locBruta.rota_id) {
      log('Localizacao ajustada pela validação, salvando no banco');
      supabase
        .from('user_profiles')
        .update({
          ultima_empresa_id: locValidada.empresa_id,
          ultima_rota_id: locValidada.rota_id,
        })
        .eq('user_id', profileData.user_id)
        .then(() => {}, (e: any) => console.error('Erro ao salvar localização:', e));
    }

    const newLocalizacao = { ...locValidada };

    // As quatro leituras são independentes: vão JUNTAS (22/11/2026). Antes
    // eram até seis em fila.
    const porId = async (tabela: string, id: string | null) => {
      if (!id) return null;
      const { data } = await supabase.from(tabela).select('*').eq('id', id).single();
      return data;
    };
    const [hierarquia, cidade, empresa, rota] = await Promise.all([
      porId('hierarquias', locValidada.hierarquia_id),
      porId('cidades', locValidada.cidade_id),
      porId('empresas', locValidada.empresa_id),
      porId('rotas', locValidada.rota_id),
    ]);
    newLocalizacao.hierarquia = hierarquia;
    newLocalizacao.cidade = cidade;
    newLocalizacao.empresa = empresa;
    newLocalizacao.rota = rota;

    // Auto-popular hierarquia e cidade a partir da empresa se estiverem vazias
    // (só estes dependem da empresa, e vão juntos entre si).
    const precisaHier = !!(empresa && !locValidada.hierarquia_id && empresa.hierarquia_id);
    const precisaCidade = !!(empresa && !locValidada.cidade_id && empresa.cidade_id);
    if (precisaHier || precisaCidade) {
      const [h, c] = await Promise.all([
        precisaHier ? porId('hierarquias', empresa.hierarquia_id) : Promise.resolve(null),
        precisaCidade ? porId('cidades', empresa.cidade_id) : Promise.resolve(null),
      ]);
      if (precisaHier) { newLocalizacao.hierarquia_id = empresa.hierarquia_id; newLocalizacao.hierarquia = h; }
      if (precisaCidade) { newLocalizacao.cidade_id = empresa.cidade_id; newLocalizacao.cidade = c; }
    }

    // O fuso da rota vem ANTES do estado: o primeiro render já formata
    // datas no fuso certo (ver utils/dateFormat.ts).
    definirFusoExibicao((newLocalizacao.empresa as any)?.timezone);
    setLocalizacaoState(newLocalizacao);
  };

  const setLocalizacao = async (loc: Partial<LocalizacaoAtual>) => {
    const newLocalizacao = { ...localizacao, ...loc };
    definirFusoExibicao((newLocalizacao.empresa as any)?.timezone);
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
          usuarioCarregadoRef.current = null;
          setUser(null);
          setProfile(null);
          setPermissoes({});
          return;
        }

        const novoUserId = session?.user?.id;
        if (!novoUserId) return;

        // Mesmo usuário (refresh de token ao voltar o foco para a aba):
        // nada mudou, então não recarrega perfil, permissões nem localização.
        if (usuarioCarregadoRef.current === novoUserId) {
          log('Evento de auth ignorado (mesmo usuário):', event);
          return;
        }

        // Usuário diferente = login de verdade ou troca de conta.
        log('Usuário mudou, recarregando contexto:', event);
        setUser(session.user);
        loadUser();
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