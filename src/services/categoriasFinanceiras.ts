import { createClient } from '@/lib/supabase/client';
import type { CategoriaFinanceira, CategoriaFinanceiraInput, FiltrosCategorias } from '@/types/categoriasFinanceiras';

const supabase = createClient();

export const categoriasFinanceirasService = {
  // ============================================
  // LISTAR CATEGORIAS
  // ============================================

  async listar(filtros?: FiltrosCategorias): Promise<CategoriaFinanceira[]> {
    let query = supabase
      .from('categorias_financeiras')
      .select('*')
      .order('ordem_exibicao', { ascending: true })
      .order('nome_pt', { ascending: true });

    if (filtros?.tipo_movimento) {
      query = query.eq('tipo_movimento', filtros.tipo_movimento);
    }

    if (filtros?.aplicavel_empresa !== undefined) {
      query = query.eq('aplicavel_empresa', filtros.aplicavel_empresa);
    }

    if (filtros?.aplicavel_rota !== undefined) {
      query = query.eq('aplicavel_rota', filtros.aplicavel_rota);
    }

    if (filtros?.aplicavel_microseguro !== undefined) {
      query = query.eq('aplicavel_microseguro', filtros.aplicavel_microseguro);
    }

    if (filtros?.ativo !== undefined) {
      query = query.eq('ativo', filtros.ativo);
    }

    if (filtros?.busca) {
      query = query.or(`nome_pt.ilike.%${filtros.busca}%,nome_es.ilike.%${filtros.busca}%,codigo.ilike.%${filtros.busca}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao listar categorias:', error);
      throw error;
    }

    return data || [];
  },

  // ============================================
  // BUSCAR POR ID
  // ============================================

  async buscarPorId(id: string): Promise<CategoriaFinanceira | null> {
    const { data, error } = await supabase
      .from('categorias_financeiras')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar categoria:', error);
      return null;
    }

    return data;
  },

  // ============================================
  // CRIAR CATEGORIA
  // ============================================

  async criar(dados: CategoriaFinanceiraInput): Promise<CategoriaFinanceira> {
    const { data, error } = await supabase
      .from('categorias_financeiras')
      .insert({
        codigo: dados.codigo.toUpperCase().trim(),
        nome_pt: dados.nome_pt.trim(),
        nome_es: dados.nome_es.trim(),
        tipo_movimento: dados.tipo_movimento,
        aplicavel_empresa: dados.aplicavel_empresa ?? true,
        aplicavel_rota: dados.aplicavel_rota ?? true,
        aplicavel_microseguro: dados.aplicavel_microseguro ?? false,
        ativo: dados.ativo ?? true,
        ordem_exibicao: dados.ordem_exibicao ?? 0,
        cor_hex: dados.cor_hex || null,
        icone: dados.icone || null,
        descricao: dados.descricao || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar categoria:', error);
      if (error.code === '23505') {
        throw new Error('Já existe uma categoria com este código');
      }
      throw error;
    }

    return data;
  },

  // ============================================
  // ATUALIZAR CATEGORIA
  // ============================================

  async atualizar(id: string, dados: Partial<CategoriaFinanceiraInput>): Promise<CategoriaFinanceira> {
    const updateData: any = {};

    if (dados.codigo !== undefined) updateData.codigo = dados.codigo.toUpperCase().trim();
    if (dados.nome_pt !== undefined) updateData.nome_pt = dados.nome_pt.trim();
    if (dados.nome_es !== undefined) updateData.nome_es = dados.nome_es.trim();
    if (dados.tipo_movimento !== undefined) updateData.tipo_movimento = dados.tipo_movimento;
    if (dados.aplicavel_empresa !== undefined) updateData.aplicavel_empresa = dados.aplicavel_empresa;
    if (dados.aplicavel_rota !== undefined) updateData.aplicavel_rota = dados.aplicavel_rota;
    if (dados.aplicavel_microseguro !== undefined) updateData.aplicavel_microseguro = dados.aplicavel_microseguro;
    if (dados.ativo !== undefined) updateData.ativo = dados.ativo;
    if (dados.ordem_exibicao !== undefined) updateData.ordem_exibicao = dados.ordem_exibicao;
    if (dados.cor_hex !== undefined) updateData.cor_hex = dados.cor_hex || null;
    if (dados.icone !== undefined) updateData.icone = dados.icone || null;
    if (dados.descricao !== undefined) updateData.descricao = dados.descricao || null;

    const { data, error } = await supabase
      .from('categorias_financeiras')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar categoria:', error);
      if (error.code === '23505') {
        throw new Error('Já existe uma categoria com este código');
      }
      throw error;
    }

    return data;
  },

  // ============================================
  // EXCLUIR CATEGORIA
  // ============================================

  async excluir(id: string): Promise<void> {
    // Verificar se a categoria está em uso
    const { count, error: countError } = await supabase
      .from('financeiro')
      .select('id', { count: 'exact', head: true })
      .eq('categoria_id', id);

    if (countError) {
      console.error('Erro ao verificar uso da categoria:', countError);
    }

    if (count && count > 0) {
      throw new Error(`Não é possível excluir: categoria em uso em ${count} movimentação(ões)`);
    }

    const { error } = await supabase
      .from('categorias_financeiras')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir categoria:', error);
      throw error;
    }
  },

  // ============================================
  // ALTERNAR STATUS ATIVO
  // ============================================

  async alternarAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase
      .from('categorias_financeiras')
      .update({ ativo })
      .eq('id', id);

    if (error) {
      console.error('Erro ao alternar status:', error);
      throw error;
    }
  },

  // ============================================
  // REORDENAR CATEGORIAS
  // ============================================

  async reordenar(ordens: { id: string; ordem_exibicao: number }[]): Promise<void> {
    for (const item of ordens) {
      const { error } = await supabase
        .from('categorias_financeiras')
        .update({ ordem_exibicao: item.ordem_exibicao })
        .eq('id', item.id);

      if (error) {
        console.error('Erro ao reordenar categoria:', error);
        throw error;
      }
    }
  },
};