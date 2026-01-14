import { createClient } from '@/lib/supabase/client';
import type { EmpresaResumo, RotaResumo, ResumoGeral, VendedorDisponivel, Socio } from '@/types/organizacao';

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

    // Total de clientes (tabela clientes não tem empresa_id, contar todos ativos)
    const { count: countClientes } = await supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ATIVO');

    totalClientes = countClientes || 0;

    // Total de empréstimos ativos
    let queryEmprestimos = supabase
      .from('emprestimos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ATIVO');

    if (hierarquiaId) {
      const { data: empresasIds } = await supabase
        .from('empresas')
        .select('id')
        .eq('hierarquia_id', hierarquiaId);
      
      if (empresasIds && empresasIds.length > 0) {
        queryEmprestimos = queryEmprestimos.in('empresa_id', empresasIds.map(e => e.id));
      }
    }

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
      .select('id, nome, cnpj, telefone, email, endereco')
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
        // Contar rotas da empresa
        const { count: totalRotas } = await supabase
          .from('rotas')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresa.id)
          .eq('status', 'ATIVA');

        // Buscar IDs das rotas da empresa para contar clientes
        const { data: rotasEmpresa } = await supabase
          .from('rotas')
          .select('id')
          .eq('empresa_id', empresa.id)
          .eq('status', 'ATIVA');

        const rotasIds = rotasEmpresa?.map(r => r.id) || [];

        // Contar clientes que têm alguma das rotas no array rotas_ids
        let totalClientes = 0;
        if (rotasIds.length > 0) {
          // Usar overlaps para verificar se rotas_ids contém algum dos IDs
          const { count } = await supabase
            .from('clientes')
            .select('id', { count: 'exact', head: true })
            .overlaps('rotas_ids', rotasIds)
            .eq('status', 'ATIVO');
          totalClientes = count || 0;
        }

        // Contar empréstimos da empresa
        const { count: totalEmprestimos } = await supabase
          .from('emprestimos')
          .select('id', { count: 'exact', head: true })
          .eq('empresa_id', empresa.id)
          .eq('status', 'ATIVO');

        return {
          id: empresa.id,
          nome: empresa.nome,
          cnpj: empresa.cnpj,
          telefone: empresa.telefone,
          email: empresa.email,
          endereco: empresa.endereco,
          total_rotas: totalRotas || 0,
          total_clientes: totalClientes,
          total_emprestimos: totalEmprestimos || 0,
        };
      })
    );

    return empresasComResumo;
  },

  async buscarEmpresa(empresaId: string): Promise<EmpresaResumo | null> {
    const { data, error } = await supabase
      .from('empresas')
      .select('id, nome, cnpj, telefone, email, endereco')
      .eq('id', empresaId)
      .single();

    if (error) {
      console.error('Erro ao buscar empresa:', error);
      return null;
    }

    // Contar rotas
    const { count: totalRotas } = await supabase
      .from('rotas')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVA');

    // Buscar IDs das rotas da empresa para contar clientes
    const { data: rotasEmpresa } = await supabase
      .from('rotas')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVA');

    const rotasIds = rotasEmpresa?.map(r => r.id) || [];

    // Contar clientes que têm alguma das rotas no array rotas_ids
    let totalClientes = 0;
    if (rotasIds.length > 0) {
      const { count } = await supabase
        .from('clientes')
        .select('id', { count: 'exact', head: true })
        .overlaps('rotas_ids', rotasIds)
        .eq('status', 'ATIVO');
      totalClientes = count || 0;
    }

    // Contar empréstimos
    const { count: totalEmprestimos } = await supabase
      .from('emprestimos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVO');

    return {
      ...data,
      total_rotas: totalRotas || 0,
      total_clientes: totalClientes,
      total_emprestimos: totalEmprestimos || 0,
    };
  },

  async criarEmpresa(dados: {
    nome: string;
    hierarquia_id: string;
    cnpj?: string;
    telefone?: string;
    email?: string;
    endereco?: string;
  }): Promise<EmpresaResumo> {
    const { data, error } = await supabase
      .from('empresas')
      .insert({
        ...dados,
        status: 'ATIVA',
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar empresa:', error);
      throw error;
    }

    return {
      id: data.id,
      nome: data.nome,
      cnpj: data.cnpj,
      telefone: data.telefone,
      email: data.email,
      endereco: data.endereco,
      total_rotas: 0,
      total_clientes: 0,
      total_emprestimos: 0,
    };
  },

  async atualizarEmpresa(empresaId: string, dados: {
    nome?: string;
    cnpj?: string;
    telefone?: string;
    email?: string;
    endereco?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('empresas')
      .update(dados)
      .eq('id', empresaId);

    if (error) {
      console.error('Erro ao atualizar empresa:', error);
      throw error;
    }
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
        descricao,
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
        // Contar clientes na rota usando contains no array JSONB rotas_ids
        const { count: totalClientes } = await supabase
          .from('clientes')
          .select('id', { count: 'exact', head: true })
          .contains('rotas_ids', [rota.id])
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
          descricao: rota.descricao,
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

  // Buscar vendedores disponíveis (mesma empresa, sem rota atribuída)
  async buscarVendedoresDisponiveis(empresaId: string): Promise<VendedorDisponivel[]> {
    // Buscar IDs de vendedores que já têm rotas
    const { data: rotasComVendedor } = await supabase
      .from('rotas')
      .select('vendedor_id')
      .eq('empresa_id', empresaId)
      .not('vendedor_id', 'is', null);

    const vendedoresComRota = rotasComVendedor?.map(r => r.vendedor_id).filter(Boolean) || [];

    // Buscar vendedores da empresa que não têm rota
    let query = supabase
      .from('vendedores')
      .select('id, nome, codigo_vendedor')
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVO')
      .order('nome');

    if (vendedoresComRota.length > 0) {
      query = query.not('id', 'in', `(${vendedoresComRota.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar vendedores disponíveis:', error);
      return [];
    }

    return data || [];
  },

  async criarRota(empresaId: string, dados: {
    nome: string;
    descricao?: string;
    vendedor_id?: string;
  }): Promise<RotaResumo> {
    const { data, error } = await supabase
      .from('rotas')
      .insert({
        ...dados,
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
      descricao: data.descricao,
      status: data.status,
      vendedor_id: data.vendedor_id,
      vendedor_nome: undefined,
      total_clientes: 0,
      total_emprestimos: 0,
    };
  },

  async atualizarRota(rotaId: string, dados: {
    nome?: string;
    descricao?: string;
    vendedor_id?: string | null;
    status?: string;
  }): Promise<void> {
    const { error } = await supabase
      .from('rotas')
      .update(dados)
      .eq('id', rotaId);

    if (error) {
      console.error('Erro ao atualizar rota:', error);
      throw error;
    }
  },

  // ============================================
  // SÓCIOS
  // ============================================

  async listarSocios(empresaId: string): Promise<Socio[]> {
    const { data, error } = await supabase
      .from('socios')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVO')
      .order('nome');

    if (error) {
      console.error('Erro ao listar sócios:', error);
      return [];
    }

    return data || [];
  },

  async salvarSocio(socio: Socio): Promise<Socio> {
    if (socio.id) {
      // Atualizar
      const { data, error } = await supabase
        .from('socios')
        .update({
          nome: socio.nome,
          documento: socio.documento,
          telefone: socio.telefone,
          email: socio.email,
          endereco: socio.endereco,
          percentual_participacao: socio.percentual_participacao,
          user_id: socio.user_id,
        })
        .eq('id', socio.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Criar
      const { data, error } = await supabase
        .from('socios')
        .insert({
          empresa_id: socio.empresa_id,
          nome: socio.nome,
          documento: socio.documento,
          telefone: socio.telefone,
          email: socio.email,
          endereco: socio.endereco,
          percentual_participacao: socio.percentual_participacao,
          user_id: socio.user_id,
          status: 'ATIVO',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  },

  async removerSocio(socioId: string): Promise<void> {
    const { error } = await supabase
      .from('socios')
      .update({ status: 'INATIVO' })
      .eq('id', socioId);

    if (error) throw error;
  },

  // Buscar usuários da empresa para selecionar como sócio
  async buscarUsuariosEmpresa(empresaId: string): Promise<{ id: string; nome: string; email: string }[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, nome')
      .contains('empresas_ids', [empresaId])
      .eq('status', 'APROVADO')
      .order('nome');

    if (error) {
      console.error('Erro ao buscar usuários da empresa:', error);
      return [];
    }

    return (data || []).map(u => ({
      id: u.user_id,
      nome: u.nome,
      email: '',
    }));
  },
};