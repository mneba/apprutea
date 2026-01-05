import { createClient } from '@/lib/supabase/client';
import type { EmpresaResumo, RotaResumo, ResumoGeral } from '@/types/organizacao';

const supabase = createClient();

export const organizacaoService = {
  // ============================================
  // RESUMO GERAL
  // ============================================

  async buscarResumoGeral(hierarquiaId?: string): Promise<ResumoGeral> {
    let totalEmpresas = 0;
    let totalRotas = 0;
    let totalClientes = 0;
    let totalEmprestimos = 0;

    // Total de empresas
    let queryEmpresas = supabase
      .from('empresas')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ATIVA');
    
    if (hierarquiaId) {
      queryEmpresas = queryEmpresas.eq('hierarquia_id', hierarquiaId);
    }
    
    const { count: countEmpresas } = await queryEmpresas;
    totalEmpresas = countEmpresas || 0;

    // Total de rotas ativas
    let queryRotas = supabase
      .from('rotas')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ATIVA');

    if (hierarquiaId) {
      // Buscar empresas da hierarquia primeiro
      const { data: empresasIds } = await supabase
        .from('empresas')
        .select('id')
        .eq('hierarquia_id', hierarquiaId);
      
      if (empresasIds && empresasIds.length > 0) {
        queryRotas = queryRotas.in('empresa_id', empresasIds.map(e => e.id));
      }
    }

    const { count: countRotas } = await queryRotas;
    totalRotas = countRotas || 0;

    // Total de clientes
    let queryClientes = supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ATIVO');

    const { count: countClientes } = await queryClientes;
    totalClientes = countClientes || 0;

    // Total de empréstimos ativos
    let queryEmprestimos = supabase
      .from('emprestimos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ATIVO');

    const { count: countEmprestimos } = await queryEmprestimos;
    totalEmprestimos = countEmprestimos || 0;

    return {
      total_empresas: totalEmpresas,
      total_rotas_ativas: totalRotas,
      total_clientes: totalClientes,
      total_emprestimos_ativos: totalEmprestimos,
    };
  },

  // ============================================
  // EMPRESAS
  // ============================================

  async listarEmpresasPorHierarquia(hierarquiaId: string): Promise<EmpresaResumo[]> {
    // Buscar empresas
    const { data: empresas, error } = await supabase
      .from('empresas')
      .select('id, nome')
      .eq('hierarquia_id', hierarquiaId)
      .eq('status', 'ATIVA')
      .order('nome');

    if (error) {
      console.error('Erro ao listar empresas:', error);
      throw error;
    }

    if (!empresas || empresas.length === 0) {
      return [];
    }

    // Para cada empresa, buscar contagens
    const empresasComResumo: EmpresaResumo[] = await Promise.all(
      empresas.map(async (empresa) => {
        // Contar rotas
        const { count: totalRotas } = await supabase
          .from('rotas')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresa.id)
          .eq('status', 'ATIVA');

        // Contar clientes
        const { count: totalClientes } = await supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresa.id)
          .eq('status', 'ATIVO');

        // Contar empréstimos
        const { count: totalEmprestimos } = await supabase
          .from('emprestimos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresa.id)
          .eq('status', 'ATIVO');

        return {
          id: empresa.id,
          nome: empresa.nome,
          total_rotas: totalRotas || 0,
          total_clientes: totalClientes || 0,
          total_emprestimos: totalEmprestimos || 0,
        };
      })
    );

    return empresasComResumo;
  },

  // ============================================
  // ROTAS
  // ============================================

  async listarRotasPorEmpresa(empresaId: string): Promise<RotaResumo[]> {
    // Buscar rotas com vendedor
    const { data: rotas, error } = await supabase
      .from('rotas')
      .select(`
        id,
        nome,
        status,
        vendedor_id,
        vendedores (
          id,
          nome
        )
      `)
      .eq('empresa_id', empresaId)
      .order('nome');

    if (error) {
      console.error('Erro ao listar rotas:', error);
      throw error;
    }

    if (!rotas || rotas.length === 0) {
      return [];
    }

    // Para cada rota, buscar contagens
    const rotasComResumo: RotaResumo[] = await Promise.all(
      rotas.map(async (rota: any) => {
        // Contar clientes na rota
        const { count: totalClientes } = await supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .eq('rota_id', rota.id)
          .eq('status', 'ATIVO');

        // Contar empréstimos na rota
        const { count: totalEmprestimos } = await supabase
          .from('emprestimos')
          .select('id', { count: 'exact', head: true })
          .eq('rota_id', rota.id)
          .eq('status', 'ATIVO');

        return {
          id: rota.id,
          nome: rota.nome,
          status: rota.status,
          vendedor_id: rota.vendedor_id,
          vendedor_nome: rota.vendedores?.nome || undefined,
          total_clientes: totalClientes || 0,
          total_emprestimos: totalEmprestimos || 0,
        };
      })
    );

    return rotasComResumo;
  },

  // ============================================
  // CRIAR ROTA
  // ============================================

  async criarRota(empresaId: string, nome: string): Promise<RotaResumo> {
    const { data, error } = await supabase
      .from('rotas')
      .insert({
        nome,
        empresa_id: empresaId,
        status: 'ATIVA',
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar rota:', error);
      throw error;
    }

    return {
      id: data.id,
      nome: data.nome,
      status: data.status,
      vendedor_id: undefined,
      vendedor_nome: undefined,
      total_clientes: 0,
      total_emprestimos: 0,
    };
  },
};
