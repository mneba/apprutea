'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type AcaoModulo = 'todos' | 'guardar' | 'buscar' | 'eliminar';

// Cache em memória por sessão pra evitar queries repetidas
// Chave: `${userId}:${codigoModulo}:${acao}`
const cachePermissoes = new Map<string, { valor: boolean; expiraEm: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutos

function chaveCache(userId: string, codigo: string, acao: AcaoModulo): string {
  return `${userId}:${codigo}:${acao}`;
}

/**
 * Hook para verificar se o usuário corrente tem permissão para uma ação em um módulo.
 *
 * @example
 * const { podeAcessar, loading } = usePermissaoModulo('GESTAO_CLIENTES', 'eliminar');
 *
 * @param codigoModulo - Código do módulo no banco (ex: 'GESTAO_CLIENTES')
 * @param acao - Ação desejada: 'todos' | 'guardar' | 'buscar' | 'eliminar'
 * @param userId - (opcional) Se não passar, pega do auth corrente
 */
export function usePermissaoModulo(
  codigoModulo: string,
  acao: AcaoModulo,
  userId?: string
): { podeAcessar: boolean; loading: boolean } {
  const [podeAcessar, setPodeAcessar] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      try {
        setLoading(true);
        const supabase = createClient();

        // Pegar userId atual se não foi passado
        let idUsuario = userId;
        if (!idUsuario) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            if (!cancelado) {
              setPodeAcessar(false);
              setLoading(false);
            }
            return;
          }
          idUsuario = user.id;
        }

        // Checar cache
        const chave = chaveCache(idUsuario, codigoModulo, acao);
        const cacheada = cachePermissoes.get(chave);
        if (cacheada && cacheada.expiraEm > Date.now()) {
          if (!cancelado) {
            setPodeAcessar(cacheada.valor);
            setLoading(false);
          }
          return;
        }

        // Chamar RPC
        const { data, error } = await supabase.rpc('fn_usuario_pode_modulo', {
          p_user_id: idUsuario,
          p_codigo_modulo: codigoModulo,
          p_acao: acao,
        });

        if (error) {
          console.error('Erro ao verificar permissão:', error);
          if (!cancelado) {
            setPodeAcessar(false);
            setLoading(false);
          }
          return;
        }

        const pode = data === true;

        // Guardar no cache
        cachePermissoes.set(chave, {
          valor: pode,
          expiraEm: Date.now() + TTL_MS,
        });

        if (!cancelado) {
          setPodeAcessar(pode);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro inesperado em usePermissaoModulo:', err);
        if (!cancelado) {
          setPodeAcessar(false);
          setLoading(false);
        }
      }
    }

    verificar();

    return () => {
      cancelado = true;
    };
  }, [codigoModulo, acao, userId]);

  return { podeAcessar, loading };
}

/**
 * Helper imperativo (sem hook). Útil para uso fora de componentes React.
 * Mesmo cache do hook.
 */
export async function verificarPermissaoModulo(
  userId: string,
  codigoModulo: string,
  acao: AcaoModulo
): Promise<boolean> {
  const chave = chaveCache(userId, codigoModulo, acao);
  const cacheada = cachePermissoes.get(chave);
  if (cacheada && cacheada.expiraEm > Date.now()) {
    return cacheada.valor;
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_usuario_pode_modulo', {
    p_user_id: userId,
    p_codigo_modulo: codigoModulo,
    p_acao: acao,
  });

  if (error) {
    console.error('Erro ao verificar permissão:', error);
    return false;
  }

  const pode = data === true;
  cachePermissoes.set(chave, {
    valor: pode,
    expiraEm: Date.now() + TTL_MS,
  });

  return pode;
}

/**
 * Limpa o cache de permissões.
 * Use após mudanças em user_permissoes (ex: ao sair do modal de gerenciar usuário).
 */
export function limparCachePermissoes() {
  cachePermissoes.clear();
}