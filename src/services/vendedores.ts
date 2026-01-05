import { supabase } from '@/lib/supabase';
import type { Vendedor, VendedorConfiguracao, VendedorRestricao, VendedorRecibo } from '@/types/vendedores';

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
      .update({
        ...dados,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendedorId);

    if (error) {
      console.error('Erro ao atualizar vendedor:', error);
      throw error;
    }
  },

  async excluirVendedor(vendedorId: string): Promise<void> {
    const { error } = await supabase
      .from('vendedores')
      .update({
        status: 'INATIVO',
        estado_acesso: 'INATIVO',
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendedorId);

    if (error) {
      console.error('Erro ao excluir vendedor:', error);
      throw error;
    }
  },

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

  async gerarCodigoAcesso(vendedorId: string): Promise<string> {
    let codigo: string = '';
    let existe = true;
    let tentativas = 0;

    while (existe && tentativas < 10) {
      codigo = Math.floor(10000 + Math.random() * 90000).toString();
      const { data } = await supabase
        .from('vendedores')
        .select('id')
        .eq('codigo_acesso', codigo)
        .maybeSingle();
      existe = !!data;
      tentativas++;
    }

    if (existe) {
      throw new Error('Não foi possível gerar um código único');
    }

    const { error } = await supabase
      .from('vendedores')
      .update({
        codigo_acesso: codigo,
        estado_acesso: 'ATIVO',
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendedorId);

    if (error) {
      console.error('Erro ao gerar código de acesso:', error);
      throw error;
    }

    return codigo;
  },

  // ============================================
  // CONFIGURAÇÕES DO VENDEDOR
  // TODO: Ajustar nome da tabela conforme estrutura do banco
  // ============================================

  async buscarConfiguracoes(vendedorId: string): Promise<VendedorConfiguracao | null> {
    const { data, error } = await supabase
      .from('vendedor_configuracoes') // TODO: ajustar nome da tabela
      .select('*')
      .eq('vendedor_id', vendedorId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar configurações:', error);
      return null;
    }

    return data;
  },

  async salvarConfiguracoes(vendedorId: string, configuracoes: VendedorConfiguracao): Promise<void> {
    const { error } = await supabase
      .from('vendedor_configuracoes') // TODO: ajustar nome da tabela
      .upsert({
        vendedor_id: vendedorId,
        ...configuracoes,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'vendedor_id',
      });

    if (error) {
      console.error('Erro ao salvar configurações:', error);
      throw error;
    }
  },

  // ============================================
  // RESTRIÇÕES DO VENDEDOR
  // TODO: Ajustar nome da tabela conforme estrutura do banco
  // ============================================

  async buscarRestricoes(vendedorId: string): Promise<VendedorRestricao | null> {
    const { data, error } = await supabase
      .from('vendedor_restricoes') // TODO: ajustar nome da tabela
      .select('*')
      .eq('vendedor_id', vendedorId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar restrições:', error);
      return null;
    }

    return data;
  },

  async salvarRestricoes(vendedorId: string, restricoes: VendedorRestricao): Promise<void> {
    const { error } = await supabase
      .from('vendedor_restricoes') // TODO: ajustar nome da tabela
      .upsert({
        vendedor_id: vendedorId,
        ...restricoes,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'vendedor_id',
      });

    if (error) {
      console.error('Erro ao salvar restrições:', error);
      throw error;
    }
  },

  // ============================================
  // RECIBOS DO VENDEDOR
  // TODO: Ajustar nome da tabela conforme estrutura do banco
  // ============================================

  async buscarRecibos(vendedorId: string): Promise<VendedorRecibo | null> {
    const { data, error } = await supabase
      .from('vendedor_recibos') // TODO: ajustar nome da tabela
      .select('*')
      .eq('vendedor_id', vendedorId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar recibos:', error);
      return null;
    }

    return data;
  },

  async salvarRecibos(vendedorId: string, recibos: VendedorRecibo): Promise<void> {
    const { error } = await supabase
      .from('vendedor_recibos') // TODO: ajustar nome da tabela
      .upsert({
        vendedor_id: vendedorId,
        ...recibos,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'vendedor_id',
      });

    if (error) {
      console.error('Erro ao salvar recibos:', error);
      throw error;
    }
  },
};
