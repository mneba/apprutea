// =====================================================
// TYPES DO MÓDULO DE LIQUIDAÇÃO DIÁRIA - SISTEMA APPRUTEA
// =====================================================

// =====================================================
// ENUMS E TIPOS BASE
// =====================================================

export type StatusLiquidacao = 'ABERTO' | 'FECHADO' | 'APROVADO' | 'REABERTO';
export type StatusPagamentoDia = 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'PARCIAL';

// =====================================================
// INTERFACE PRINCIPAL - LIQUIDAÇÃO DIÁRIA
// =====================================================

export interface LiquidacaoDiaria {
  id: string;
  vendedor_id: string;
  rota_id: string;
  empresa_id: string;
  
  // Datas e horários
  data_abertura: string;
  data_fechamento?: string;
  
  // Status
  status: StatusLiquidacao;
  
  // Caixa
  caixa_inicial: number;
  caixa_final: number;
  
  // Carteira
  carteira_inicial: number;
  carteira_final: number;
  
  // Recaudo
  valor_recebido_dia: number;
  valor_recebido_dinheiro: number;
  valor_recebido_transferencia: number;
  valor_esperado_dia: number;
  percentual_recebimento: number;
  
  // Empréstimos
  total_emprestado_dia: number;
  qtd_emprestimos_dia: number;
  
  // Clientes
  clientes_novos: number;
  clientes_renovados: number;
  clientes_renegociados: number;
  qtd_clientes_atendidos: number;
  
  // Pagamentos
  pagamentos_pagos: number;
  pagamentos_nao_pagos: number;
  
  // Despesas
  total_despesas_dia: number;
  qtd_despesas_dia: number;
  
  // Microseguro
  total_microseguro_dia: number;
  qtd_microseguros_dia: number;
  
  // GPS
  latitude_abertura?: number;
  longitude_abertura?: number;
  precisao_gps_abertura?: number;
  latitude_fechamento?: number;
  longitude_fechamento?: number;
  
  // Observações
  observacoes?: string;
  
  // Auditoria
  aberto_por_user_id?: string;
  fechado_por_user_id?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================
// DADOS COMPLEMENTARES
// =====================================================

export interface VendedorLiquidacao {
  id: string;
  nome: string;
  codigo_vendedor: string;
  telefone?: string;
  email?: string;
  foto_url?: string;
  status: string;
}

export interface RotaLiquidacao {
  id: string;
  nome: string;
  empresa_id: string;
}

export interface ContaRota {
  id: string;
  rota_id: string;
  tipo_conta: string;
  saldo_atual: number;
  saldo_inicial: number;
}

// =====================================================
// CLIENTE DO DIA (via View)
// =====================================================

export interface ClienteDoDia {
  cliente_id: string;
  cliente_nome: string;
  cliente_documento?: string;
  cliente_telefone?: string;
  emprestimo_id: string;
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago: number;
  valor_saldo: number;
  data_vencimento: string;
  status_dia: StatusPagamentoDia;
  ordem_visita_dia?: number;
  rota_id: string;
  forma_pagamento?: string;
}

// =====================================================
// MICROSEGURO DO DIA
// =====================================================

export interface MicroseguroDoDia {
  id: string;
  valor: number;
  emprestimo_id?: string;
  cliente_nome: string;
  data_venda: string;
}

// =====================================================
// RESUMO DA LIQUIDAÇÃO (para cards)
// =====================================================

export interface ResumoLiquidacao {
  // Caixa
  caixa_inicial: number;
  caixa_atual: number;
  caixa_variacao: number;
  
  // Carteira
  carteira_inicial: number;
  carteira_atual: number;
  carteira_crescimento: number;
  
  // Recaudo
  recaudo_total: number;
  recaudo_dinheiro: number;
  recaudo_transferencia: number;
  
  // Pagamentos
  pagamentos_pagos: number;
  pagamentos_nao_pagos: number;
  efetividade: number;
  
  // Meta
  meta_dia: number;
  valor_atual: number;
  percentual_meta: number;
  
  // Operações
  vendas_total: number;
  receitas_total: number;
  retiradas_total: number;
  despesas_total: number;
  emprestimos_total: number;
  
  // Microseguro
  microseguro_receitas: number;
  microseguro_retiradas: number;
  microseguro_saldo: number;
}

// =====================================================
// INPUTS DAS FUNCTIONS
// =====================================================

export interface AbrirLiquidacaoInput {
  vendedor_id: string;
  rota_id: string;
  caixa_inicial: number;
  user_id: string;
  latitude?: number;
  longitude?: number;
  precisao_gps?: number;
}

export interface FecharLiquidacaoInput {
  liquidacao_id: string;
  user_id: string;
  observacoes?: string;
  latitude?: number;
  longitude?: number;
}

export interface ReabrirLiquidacaoInput {
  liquidacao_id: string;
  user_id: string;
  motivo: string;
}

// =====================================================
// RESPOSTAS DAS FUNCTIONS
// =====================================================

export interface RespostaAbrirLiquidacao {
  sucesso: boolean;
  mensagem: string;
  liquidacao_id?: string;
  data_abertura?: string;
}

export interface RespostaFecharLiquidacao {
  sucesso: boolean;
  mensagem: string;
  caixa_final?: number;
  carteira_final?: number;
  valor_recebido_dia?: number;
  valor_esperado_dia?: number;
  percentual_atingido?: number;
  diferenca_caixa?: number;
  clientes_novos?: number;
  clientes_renovados?: number;
  clientes_renegociados?: number;
  pagamentos_pagos?: number;
  total_despesas_dia?: number;
  total_emprestado_dia?: number;
}

// =====================================================
// FILTROS
// =====================================================

export interface FiltrosClientesDia {
  status?: StatusPagamentoDia;
  forma_pagamento?: 'DINHEIRO' | 'TRANSFERENCIA';
  tipo?: 'NOVO' | 'RENOVADO' | 'CANCELADO';
  busca?: string;
}

export interface FiltrosHistoricoLiquidacoes {
  data_inicio?: string;
  data_fim?: string;
  status?: StatusLiquidacao;
  vendedor_id?: string;
  rota_id?: string;
}

// =====================================================
// ESTATÍSTICAS
// =====================================================

export interface EstatisticasClientesDia {
  total: number;
  sincronizados: number;
  novos: number;
  renovados: number;
  cancelados: number;
  pagos_dinheiro: number;
  pagos_transferencia: number;
}

// =====================================================
// CORES DE STATUS
// =====================================================

export const STATUS_LIQUIDACAO_COLORS = {
  ABERTO: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Aberto' },
  FECHADO: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Fechado' },
  APROVADO: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Aprovado' },
  REABERTO: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Reaberto' },
} as const;

export const STATUS_PAGAMENTO_DIA_COLORS = {
  PAGO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Pago' },
  PENDENTE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendente' },
  VENCIDO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Vencido' },
  PARCIAL: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Parcial' },
} as const;