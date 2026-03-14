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
        // Buscar rotas da empresa com quantidade_clientes
        const { data: rotasEmpresa } = await supabase
          .from('rotas')
          .select('id, quantidade_clientes')
          .eq('empresa_id', empresa.id)
          .eq('status', 'ATIVA');

        const totalRotas = rotasEmpresa?.length || 0;
        
        // Somar quantidade_clientes de todas as rotas
        const totalClientes = rotasEmpresa?.reduce((acc, rota) => acc + (rota.quantidade_clientes || 0), 0) || 0;

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
          total_rotas: totalRotas,
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

    // Buscar rotas da empresa com quantidade_clientes
    const { data: rotasEmpresa } = await supabase
      .from('rotas')
      .select('id, quantidade_clientes')
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVA');

    const totalRotas = rotasEmpresa?.length || 0;
    
    // Somar quantidade_clientes de todas as rotas
    const totalClientes = rotasEmpresa?.reduce((acc, rota) => acc + (rota.quantidade_clientes || 0), 0) || 0;

    // Contar empréstimos
    const { count: totalEmprestimos } = await supabase
      .from('emprestimos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('status', 'ATIVO');

    return {
      ...data,
      total_rotas: totalRotas,
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
    hierarquia_id?: string;
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
  // HIERARQUIAS
  // ============================================

  async listarHierarquias(): Promise<{ id: string; pais: string; estado: string }[]> {
    const { data, error } = await supabase
      .from('hierarquias')
      .select('id, pais, estado')
      .order('pais')
      .order('estado');

    if (error) {
      console.error('Erro ao listar hierarquias:', error);
      return [];
    }

    return data || [];
  },

  async buscarHierarquiaEmpresa(empresaId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('empresas')
      .select('hierarquia_id')
      .eq('id', empresaId)
      .single();

    if (error) {
      console.error('Erro ao buscar hierarquia da empresa:', error);
      return null;
    }

    return data?.hierarquia_id || null;
  },

  // ============================================
  // ROTAS
  // ============================================

  async listarRotasPorEmpresa(empresaId: string): Promise<RotaResumo[]> {
    // Buscar rotas com vendedor e quantidade_clientes
    const { data: rotas, error } = await supabase
      .from('rotas')
      .select(`
        id,
        nome,
        descricao,
        status,
        vendedor_id,
        quantidade_clientes,
        trabalha_domingo,
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

    // Para cada rota, buscar contagem de empréstimos
    const rotasComResumo: RotaResumo[] = await Promise.all(
      rotas.map(async (rota: any) => {
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
          total_clientes: rota.quantidade_clientes || 0,
          total_emprestimos: totalEmprestimos || 0,
          trabalha_domingo: rota.trabalha_domingo ?? false,
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
    trabalha_domingo?: boolean;
  }): Promise<RotaResumo> {
    const { data, error } = await supabase
      .from('rotas')
      .insert({
        nome: dados.nome,
        descricao: dados.descricao,
        vendedor_id: dados.vendedor_id,
        trabalha_domingo: dados.trabalha_domingo ?? false,
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
      trabalha_domingo: data.trabalha_domingo ?? false,
    };
  },

  async atualizarRota(rotaId: string, dados: {
    nome?: string;
    descricao?: string;
    vendedor_id?: string | null;
    status?: string;
    trabalha_domingo?: boolean;
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

  // ============================================
  // DESLOCAMENTO DE PARCELAS
  // ============================================

  /**
   * Move parcelas de uma rota específica com vencimento no domingo para segunda-feira (+1 dia).
   * Afeta apenas parcelas com status PENDENTE, VENCIDO ou PARCIAL com vencimento >= hoje.
   */
  async deslocarParcelasDomingoPorRota(rotaId: string): Promise<{ sucesso: boolean; mensagem: string }> {
    const { data, error } = await supabase
      .rpc('fn_deslocar_parcelas_domingo_por_rota', {
        p_rota_id: rotaId,
      });

    if (error) {
      console.error('Erro ao deslocar parcelas de domingo:', error);
      return {
        sucesso: false,
        mensagem: error.message,
      };
    }

    return {
      sucesso: true,
      mensagem: data || 'Parcelas deslocadas com sucesso',
    };
  },

  /**
   * Busca o valor atual de trabalha_domingo de uma rota
   */
  async buscarTrabalhaDomingoRota(rotaId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('rotas')
      .select('trabalha_domingo')
      .eq('id', rotaId)
      .single();

    if (error) {
      console.error('Erro ao buscar trabalha_domingo:', error);
      return false;
    }

    return data?.trabalha_domingo ?? false;
  },

  // ============================================
  // CLIENTES DA ROTA (ORDENAÇÃO)
  // ============================================

  /**
   * Lista clientes de uma rota com ordem de visita
   * Se não houver ordens salvas na tabela ordem_rota_cliente, cria automaticamente
   */
  async listarClientesRota(rotaId: string): Promise<{
    id: string;
    cliente_id: string;
    nome: string;
    endereco: string;
    ordem: number;
  }[]> {
    // 1. Buscar clientes que têm empréstimos ativos na rota
    const { data: emprestimos, error: errEmprestimos } = await supabase
      .from('emprestimos')
      .select(`
        cliente_id,
        clientes (
          id,
          nome,
          endereco
        )
      `)
      .eq('rota_id', rotaId)
      .eq('status', 'ATIVO');

    if (errEmprestimos) {
      console.error('Erro ao buscar empréstimos da rota:', errEmprestimos);
      throw errEmprestimos;
    }

    // 2. Extrair clientes únicos
    const clientesUnicos = new Map<string, { id: string; nome: string; endereco: string }>();
    emprestimos?.forEach((emp: any) => {
      if (emp.clientes && !clientesUnicos.has(emp.cliente_id)) {
        clientesUnicos.set(emp.cliente_id, {
          id: emp.cliente_id,
          nome: emp.clientes.nome || '',
          endereco: emp.clientes.endereco || '',
        });
      }
    });

    // 3. Buscar ordens existentes na tabela ordem_rota_cliente
    const { data: ordens, error: errOrdens } = await supabase
      .from('ordem_rota_cliente')
      .select('id, cliente_id, ordem')
      .eq('rota_id', rotaId);

    if (errOrdens) {
      console.error('Erro ao buscar ordens:', errOrdens);
    }

    const ordensMap = new Map<string, { id: string; ordem: number }>();
    ordens?.forEach((o) => {
      ordensMap.set(o.cliente_id, { id: o.id, ordem: o.ordem });
    });

    // 4. Identificar clientes sem ordem salva
    const clientesSemOrdem: string[] = [];
    clientesUnicos.forEach((_, clienteId) => {
      if (!ordensMap.has(clienteId)) {
        clientesSemOrdem.push(clienteId);
      }
    });

    // 5. Se há clientes sem ordem, criar registros AUTOMATICAMENTE
    if (clientesSemOrdem.length > 0) {
      // Descobrir a maior ordem existente
      let maiorOrdem = 0;
      ordensMap.forEach((o) => {
        if (o.ordem > maiorOrdem) maiorOrdem = o.ordem;
      });

      // Criar registros para os novos clientes (no final da lista)
      const novosRegistros = clientesSemOrdem.map((clienteId, index) => ({
        rota_id: rotaId,
        cliente_id: clienteId,
        ordem: maiorOrdem + index + 1,
      }));

      const { data: novosInseridos, error: errInsert } = await supabase
        .from('ordem_rota_cliente')
        .insert(novosRegistros)
        .select('id, cliente_id, ordem');

      if (errInsert) {
        console.error('Erro ao criar ordens iniciais:', errInsert);
        // Não falha, continua com ordens visuais
      } else {
        // Atualizar o mapa com os novos registros criados
        novosInseridos?.forEach((o) => {
          ordensMap.set(o.cliente_id, { id: o.id, ordem: o.ordem });
        });
        console.log(`Criados ${novosInseridos?.length || 0} registros de ordem para novos clientes`);
      }
    }

    // 6. Montar lista final
    const resultado: {
      id: string;
      cliente_id: string;
      nome: string;
      endereco: string;
      ordem: number;
    }[] = [];

    clientesUnicos.forEach((cliente, clienteId) => {
      const ordemInfo = ordensMap.get(clienteId);
      resultado.push({
        id: ordemInfo?.id || '',
        cliente_id: clienteId,
        nome: cliente.nome,
        endereco: cliente.endereco,
        ordem: ordemInfo?.ordem || 999,
      });
    });

    // 7. Ordenar por ordem
    resultado.sort((a, b) => a.ordem - b.ordem);

    // 8. Reatribuir ordens sequenciais (para garantir 1, 2, 3... sem gaps)
    resultado.forEach((cliente, index) => {
      cliente.ordem = index + 1;
    });

    return resultado;
  },

  /**
   * Salva a ordem dos clientes de uma rota
   * Usa UPSERT para inserir ou atualizar TODOS os clientes
   */
  async salvarOrdemClientesRota(
    rotaId: string,
    clientes: { cliente_id: string; ordem: number }[]
  ): Promise<void> {
    const registros = clientes.map((c) => ({
      rota_id: rotaId,
      cliente_id: c.cliente_id,
      ordem: c.ordem,
    }));

    const { error } = await supabase
      .from('ordem_rota_cliente')
      .upsert(registros, {
        onConflict: 'rota_id,cliente_id',
      });

    if (error) {
      console.error('Erro ao salvar ordem:', error);
      throw error;
    }
  },
};