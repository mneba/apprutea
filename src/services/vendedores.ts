import { createClient } from '@/lib/supabase/client';
import type { 
  Vendedor, 
  ConfiguracaoVendedor, 
  RestricaoVendedor, 
  ConfiguracaoRecibo 
} from '@/types/vendedores';

const supabase = createClient();

export const vendedoresService = {
  // ============================================
  // CRUD DE VENDEDORES
  // ============================================

  async listarVendedores(empresaId: string): Promise<Vendedor[]> {
    const { data, error } = await supabase
      .from('vendedores')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome');

    if (error) {
      console.error('Erro ao listar vendedores:', error);
      throw error;
    }

    return data || [];
  },

  async buscarVendedor(vendedorId: string): Promise<Vendedor | null> {
    const { data, error } = await supabase
      .from('vendedores')
      .select('*')
      .eq('id', vendedorId)
      .single();

    if (error) {
      console.error('Erro ao buscar vendedor:', error);
      return null;
    }

    return data;
  },

  async criarVendedor(dados: Partial<Vendedor>): Promise<Vendedor> {
    // O trigger tr_gerar_codigo_acesso gera automaticamente o codigo_acesso
    // Os triggers tr_criar_configuracoes_padrao e tr_criar_restricoes_padrao
    // criam os registros nas tabelas auxiliares
    const { data, error } = await supabase
      .from('vendedores')
      .insert(dados)
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar vendedor:', error);
      throw error;
    }

    return data;
  },

  async atualizarVendedor(vendedorId: string, dados: Partial<Vendedor>): Promise<void> {
    const { error } = await supabase
      .from('vendedores')
      .update(dados)
      .eq('id', vendedorId);

    if (error) {
      console.error('Erro ao atualizar vendedor:', error);
      throw error;
    }
  },

  async inativarVendedor(vendedorId: string): Promise<void> {
    const { error } = await supabase
      .from('vendedores')
      .update({
        status: 'INATIVO',
        estado_acesso: 'INATIVO',
      })
      .eq('id', vendedorId);

    if (error) {
      console.error('Erro ao inativar vendedor:', error);
      throw error;
    }
  },

  // Gerar novo código de vendedor (sequencial V000001)
  async gerarCodigoVendedor(): Promise<string> {
    const { data } = await supabase
      .from('vendedores')
      .select('codigo_vendedor')
      .like('codigo_vendedor', 'V%')
      .order('created_at', { ascending: false })
      .limit(1);

    let proximoNumero = 1;
    if (data && data.length > 0) {
      const ultimoCodigo = data[0].codigo_vendedor;
      const numero = parseInt(ultimoCodigo.replace(/\D/g, ''), 10);
      if (!isNaN(numero)) {
        proximoNumero = numero + 1;
      }
    }

    return `V${proximoNumero.toString().padStart(6, '0')}`;
  },

  // ============================================
  // CONFIGURAÇÕES DO VENDEDOR
  // Tabela: configuracoes_vendedor
  // ============================================

  async buscarConfiguracoes(vendedorId: string): Promise<ConfiguracaoVendedor | null> {
    const { data, error } = await supabase
      .from('configuracoes_vendedor')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar configurações:', error);
      return null;
    }

    return data;
  },

  async salvarConfiguracoes(vendedorId: string, configuracoes: Partial<ConfiguracaoVendedor>): Promise<void> {
    const { error } = await supabase
      .from('configuracoes_vendedor')
      .update(configuracoes)
      .eq('vendedor_id', vendedorId);

    if (error) {
      console.error('Erro ao salvar configurações:', error);
      throw error;
    }
  },

  // ============================================
  // RESTRIÇÕES DO VENDEDOR
  // Tabela: restricoes_vendedor
  // ============================================

  async buscarRestricoes(vendedorId: string): Promise<RestricaoVendedor | null> {
    const { data, error } = await supabase
      .from('restricoes_vendedor')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar restrições:', error);
      return null;
    }

    return data;
  },

  async salvarRestricoes(vendedorId: string, restricoes: Partial<RestricaoVendedor>): Promise<void> {
    const { error } = await supabase
      .from('restricoes_vendedor')
      .update(restricoes)
      .eq('vendedor_id', vendedorId);

    if (error) {
      console.error('Erro ao salvar restrições:', error);
      throw error;
    }
  },

  // ============================================
  // CONFIGURAÇÕES DE RECIBOS
  // Tabela: configuracoes_recibos
  // ============================================

  async buscarRecibos(vendedorId: string): Promise<ConfiguracaoRecibo | null> {
    const { data, error } = await supabase
      .from('configuracoes_recibos')
      .select('*')
      .eq('vendedor_id', vendedorId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar recibos:', error);
      return null;
    }

    return data;
  },

  async salvarRecibos(vendedorId: string, recibos: Partial<ConfiguracaoRecibo>): Promise<void> {
    // Verificar se já existe registro para este vendedor
    const existente = await this.buscarRecibos(vendedorId);
    
    if (existente) {
      // Atualizar
      const { error } = await supabase
        .from('configuracoes_recibos')
        .update({
          ...recibos,
          vendedor_id: vendedorId,
          empresa_id: null, // Garantir que é por vendedor
        })
        .eq('vendedor_id', vendedorId);

      if (error) {
        console.error('Erro ao atualizar recibos:', error);
        throw error;
      }
    } else {
      // Criar novo
      const { error } = await supabase
        .from('configuracoes_recibos')
        .insert({
          ...recibos,
          vendedor_id: vendedorId,
          empresa_id: null,
          ativo: true,
        });

      if (error) {
        console.error('Erro ao criar recibos:', error);
        throw error;
      }
    }
  },
};
