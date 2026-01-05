// ============================================
// TIPOS DO MÓDULO DE VENDEDORES
// Baseado nas tabelas reais do Supabase
// ============================================

// Vendedor principal (tabela: vendedores)
export interface Vendedor {
  id: string;
  nome: string;
  apellidos?: string;
  codigo_vendedor: string;
  telefone?: string;
  documento?: string;
  endereco?: string;
  email?: string;
  status: 'ATIVO' | 'INATIVO';
  data_admissao?: string;
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

// Configurações operacionais (tabela: configuracoes_vendedor)
// 13 campos boolean
export interface ConfiguracaoVendedor {
  id?: string;
  vendedor_id: string;
  ativar_gps: boolean;
  ativar_sem_pagamentos: boolean;
  ativar_adiar_parcelas: boolean;
  ativar_auditoria_movel: boolean;
  abertura_caixa_manual: boolean;
  validar_endereco: boolean;
  carregar_imagens_wifi: boolean;
  atualizar_movel_renovacao: boolean;
  informacao_resumida_movel: boolean;
  imprimir_compartilhar_recibo: boolean;
  somente_frequencia_diaria: boolean;
  inativar_info_cliente_renovar: boolean;
  permitir_exclusao_parcelas: boolean;
  created_at?: string;
  updated_at?: string;
}

// Restrições do vendedor (tabela: restricoes_vendedor)
// Campos com validação e valores
export interface RestricaoVendedor {
  id?: string;
  vendedor_id: string;
  
  // Validações de Vendas
  validar_valor_max_vendas: boolean;
  valor_max_vendas: number;
  
  // Validações de Gastos
  validar_valor_gastos: boolean;
  valor_max_gastos: number;
  
  // Validações de Entradas/Ingresos
  validar_valor_entradas: boolean;
  valor_max_entradas: number;
  
  // Validações de Renovações
  validar_valor_max_renovacoes: boolean;
  valor_max_renovacoes: number;
  renovacao_dia_seguinte_se_exceder: boolean;
  
  // Limites de Parcelas
  numero_max_parcelas_por_dia: number;
  numero_parcelas_limite: number;
  numero_max_parcelas_cancelar_venda: number;
  parcelas_permitidas_cancelar: number;
  
  // Validações de Clientes
  validar_clientes_outros_vendedores: boolean;
  
  // WhatsApp para Aprovações
  numero_whatsapp_aprovacoes: string;
  
  // Taxas de Juros Permitidas (JSONB array)
  taxas_juros_permitidas?: number[];
  
  created_at?: string;
  updated_at?: string;
}

// Configurações de Recibos (tabela: configuracoes_recibos)
// Pode ser por vendedor_id OU empresa_id
export interface ConfiguracaoRecibo {
  id?: string;
  vendedor_id?: string;
  empresa_id?: string;
  logo_url?: string;
  mensagem_personalizada?: string;
  aplicar_todos_vendedores: boolean;
  periodo_pago?: string; // DIARIO, SEMANAL, QUINZENAL, MENSAL
  percentual_recaudo: number;
  percentual_vendas: number;
  valor_pensao: number;
  valor_saude: number;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Constantes
export const DOMINIO_INTERNO = '@apprutea.internal';
