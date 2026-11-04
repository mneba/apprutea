import { createClient } from '@/lib/supabase/client';

// =====================================================================
// PAINEL DE CONTROLE — empresas, rotas, acessos e versão do app
// =====================================================================
//
// Lê `fn_painel_controle` (sql/2026-11-04_painel_controle.sql), que devolve
// uma linha por rota — empresa sem rota vem com os campos de rota nulos. O
// agrupamento por empresa é feito aqui, uma vez, para a tela só desenhar.
//
// QUEM VÊ é decidido no banco, por `licenca_operadores`, e não por tipo de
// usuário: há SUPER_ADMIN que é dono de empresa. A função recusa quem não é
// operador; o menu pergunta antes por `fn_licenca_sou_operador`.

const supabase = createClient();

export type SituacaoRota = 'ATIVA' | 'PARADA' | 'NUNCA_ABRIU';

export interface RotaControle {
  rota_id: string;
  rota_nome: string;
  rota_criada_em: string | null;
  vendedor_nome: string | null;
  primeira_liquidacao: string | null;
  ultima_liquidacao: string | null;
  dia_aberto: string | null;
  clientes_ativos: number;
  hoje_rota: string | null;
  app_ultimo_acesso: string | null;
  app_versao: string | null;
  app_versao_desde: string | null;
  app_plataforma: string | null;
  situacao: SituacaoRota;
  dias_sem_liquidacao: number | null;
}

export interface EmpresaControle {
  empresa_id: string;
  empresa_nome: string;
  cidade: string | null;
  pais: string | null;
  dono_user_id: string | null;
  dono_nome: string | null;
  dono_email: string | null;
  dono_ultimo_acesso: string | null;
  usuarios_web: number;
  usuarios_web_ultimo_acesso: string | null;
  rotas: RotaControle[];
  /** Derivados das rotas, para a lista e os filtros. */
  rotas_ativas: number;
  rotas_paradas: number;
  rotas_nunca_abriram: number;
  clientes_ativos: number;
  app_ultimo_acesso: string | null;
}

interface LinhaPainel extends Omit<RotaControle, 'rota_id' | 'rota_nome' | 'clientes_ativos' | 'situacao'> {
  empresa_id: string;
  empresa_nome: string;
  cidade: string | null;
  pais: string | null;
  dono_user_id: string | null;
  dono_nome: string | null;
  dono_email: string | null;
  dono_ultimo_acesso: string | null;
  usuarios_web: number | null;
  usuarios_web_ultimo_acesso: string | null;
  rota_id: string | null;
  rota_nome: string | null;
  clientes_ativos: number | null;
  situacao: SituacaoRota | null;
}

const maisRecente = (a: string | null, b: string | null) => {
  if (!a) return b;
  if (!b) return a;
  return new Date(a) > new Date(b) ? a : b;
};

export const painelControleService = {
  async souOperador(): Promise<boolean> {
    const { data, error } = await supabase.rpc('fn_licenca_sou_operador');
    if (error) {
      console.error('❌ fn_licenca_sou_operador:', error.message);
      return false;
    }
    return data === true;
  },

  async carregar(): Promise<EmpresaControle[]> {
    const { data, error } = await supabase.rpc('fn_painel_controle');
    if (error) throw new Error(error.message);

    const mapa = new Map<string, EmpresaControle>();
    for (const l of (data ?? []) as LinhaPainel[]) {
      let emp = mapa.get(l.empresa_id);
      if (!emp) {
        emp = {
          empresa_id: l.empresa_id,
          empresa_nome: l.empresa_nome,
          cidade: l.cidade,
          pais: l.pais,
          dono_user_id: l.dono_user_id,
          dono_nome: l.dono_nome?.trim() || null,
          dono_email: l.dono_email,
          dono_ultimo_acesso: l.dono_ultimo_acesso,
          usuarios_web: l.usuarios_web ?? 0,
          usuarios_web_ultimo_acesso: l.usuarios_web_ultimo_acesso,
          rotas: [],
          rotas_ativas: 0,
          rotas_paradas: 0,
          rotas_nunca_abriram: 0,
          clientes_ativos: 0,
          app_ultimo_acesso: null,
        };
        mapa.set(l.empresa_id, emp);
      }
      if (!l.rota_id || !l.situacao) continue;

      emp.rotas.push({
        rota_id: l.rota_id,
        rota_nome: l.rota_nome ?? '',
        rota_criada_em: l.rota_criada_em,
        vendedor_nome: l.vendedor_nome?.trim() || null,
        primeira_liquidacao: l.primeira_liquidacao,
        ultima_liquidacao: l.ultima_liquidacao,
        dia_aberto: l.dia_aberto,
        clientes_ativos: l.clientes_ativos ?? 0,
        hoje_rota: l.hoje_rota,
        app_ultimo_acesso: l.app_ultimo_acesso,
        app_versao: l.app_versao,
        app_versao_desde: l.app_versao_desde,
        app_plataforma: l.app_plataforma,
        situacao: l.situacao,
        dias_sem_liquidacao: l.dias_sem_liquidacao,
      });
      if (l.situacao === 'ATIVA') emp.rotas_ativas++;
      else if (l.situacao === 'PARADA') emp.rotas_paradas++;
      else emp.rotas_nunca_abriram++;
      emp.clientes_ativos += l.clientes_ativos ?? 0;
      emp.app_ultimo_acesso = maisRecente(emp.app_ultimo_acesso, l.app_ultimo_acesso);
    }
    return Array.from(mapa.values());
  },
};

/**
 * Compara versões "1.1.92" por número, não por texto: em texto "1.1.100"
 * ficaria antes de "1.1.92".
 */
export function compararVersao(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
