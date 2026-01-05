// ============================================
// TIPOS DO MÓDULO DE VENDEDORES
// TODO: Ajustar conforme estrutura real do banco
// ============================================

// Vendedor principal (baseado na tabela existente)
export interface Vendedor {
  id: string;
  nome: string;
  apellidos?: string;
  codigo_vendedor: string;
  telefone?: string;
  documento?: string;
  email?: string;
  status: 'ATIVO' | 'INATIVO';
  empresa_id?: string;
  hierarquia_id?: string;
  user_id?: string;
  data_vencimento?: string;
  valor_venda_maxima?: number;
  saldo_inicial?: number;
  codigo_acesso?: string;
  estado_acesso?: 'ATIVO' | 'INATIVO';
  foto_url?: string;
  created_at?: string;
  updated_at?: string;
}

// Configurações operacionais (13 opções - baseado nas telas)
// TODO: Ajustar nomes dos campos conforme tabela do banco
export interface VendedorConfiguracao {
  id?: string;
  vendedor_id?: string;
  ativar_gps: boolean;
  ativar_sem_pagamentos: boolean;
  ativar_adiar_parcelas: boolean;
  ativar_auditoria_movel: boolean;
  abertura_caixa_manual: boolean;
  validar_endereco: boolean;
  carregar_imagens_wifi: boolean;
  atualizar_cel_renovacao: boolean;
  informacao_resumida: boolean;
  imprimir_recibos: boolean;
  so_frequencia_diaria: boolean;
  inativar_info_cliente: boolean;
  permitir_exclusao: boolean;
  created_at?: string;
  updated_at?: string;
}

// Restrições e validações (6 campos - baseado nas telas)
// TODO: Ajustar nomes dos campos conforme tabela do banco
export interface VendedorRestricao {
  id?: string;
  vendedor_id?: string;
  valor_maximo_vendas: number;
  valor_maximo_gastos: number;
  valor_maximo_receitas: number;
  max_parcelas_dia: number;
  limite_parcelas: number;
  whatsapp_aprovacoes: string;
  created_at?: string;
  updated_at?: string;
}

// Configurações de recibos (5 campos - baseado nas telas)
// TODO: Ajustar nomes dos campos conforme tabela do banco
export interface VendedorRecibo {
  id?: string;
  vendedor_id?: string;
  logo_url: string;
  tipo_recaudo: string;
  percentual_recaudo: number;
  percentual_vendas: number;
  valor_pensao: number;
  created_at?: string;
  updated_at?: string;
}
