// =====================================================================
// SERVIÇO DA ÁREA DE RELATÓRIOS
// =====================================================================
//
// Duas chamadas, duas RPCs. Nenhum cálculo aqui: a agregação inteira mora no
// Postgres (ver sql/2026-10-01_fn_liquidacoes_periodo.sql e
// sql/2026-10-01_fn_estrutura_visivel.sql).
//
// Isso não é preguiça — é a regra do projeto. Caixa e carteira somam entre
// rotas mas não entre dias; a ganancia é rateio proporcional sobre o abatido;
// o percentual é recalculado e nunca promediado. Refazer qualquer uma dessas
// contas aqui criaria uma segunda verdade, que é exatamente o que custou a
// este projeto quatro correções em frentes diferentes.

import { createClient } from '@/lib/supabase/client';
import type { EstruturaVisivel, LiquidacoesPeriodo } from '@/types/relatorios';

const supabase = createClient();

const VAZIA: EstruturaVisivel = { sucesso: false, paises: [] };

export const relatoriosService = {
  /**
   * A árvore país › estado › cidade › empresa › rota que o usuário pode ver.
   * Já recortada pelo perfil — a tela não decide quem vê o quê.
   */
  async buscarEstrutura(): Promise<EstruturaVisivel> {
    const { data, error } = await supabase.rpc('fn_estrutura_visivel');

    if (error) {
      console.error('Erro ao buscar estrutura visível:', error);
      return { ...VAZIA, mensagem: error.message };
    }

    const r = (data ?? VAZIA) as EstruturaVisivel;
    return { ...r, paises: r.paises ?? [] };
  },

  /**
   * Consolidado, série diária e quebra por rota de um intervalo.
   *
   * `detalhe` liga a lista por empréstimo, que num mês de país inteiro são
   * milhares de linhas — por isso só é pedida quando o usuário abre o modal
   * da ganancia.
   */
  async buscarLiquidacoesPeriodo(
    rotaIds: string[],
    de: string,
    ate: string,
    detalhe = false
  ): Promise<LiquidacoesPeriodo | null> {
    const { data, error } = await supabase.rpc('fn_liquidacoes_periodo', {
      p_rotas: rotaIds,
      p_de: de,
      p_ate: ate,
      p_detalhe: detalhe,
    });

    if (error) {
      console.error('Erro ao buscar liquidações do período:', error);
      return null;
    }

    const r = data as LiquidacoesPeriodo | null;
    if (!r) return null;

    // A função devolve `[]` nas listas, mas um payload truncado não pode
    // derrubar a tela inteira.
    return {
      ...r,
      por_dia: r.por_dia ?? [],
      por_rota: r.por_rota ?? [],
      por_emprestimo: r.por_emprestimo ?? [],
    };
  },
};
