// =====================================================
// TYPES DO MÓDULO DE CLIENTES - SISTEMA APPRUTEA
// =====================================================

// =====================================================
// ENUMS E TIPOS BASE
// =====================================================

export type StatusCliente = 'ATIVO' | 'INATIVO' | 'SUSPENSO';
export type StatusEmprestimo = 'ATIVO' | 'QUITADO' | 'CANCELADO' | 'VENCIDO' | 'RENEGOCIADO' | 'ADIANTADO' | 'INCOMPLETO';
export type StatusParcela = 'PENDENTE' | 'PAGO' | 'PARCIAL' | 'VENCIDO' | 'CANCELADO';
export type TipoEmprestimo = 'NOVO' | 'RENOVACAO' | 'RENEGOCIACAO';
export type FrequenciaPagamento = 'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'FLEXIVEL';
export type FormaPagamento = 'DINHEIRO' | 'PIX' | 'TRANSFERENCIA' | 'CARTAO';

// =====================================================
// INTERFACES PRINCIPAIS
// =====================================================

export interface Cliente {
  id: string;
  codigo_cliente: number;
  nome: string;
  documento?: string;
  telefone_celular?: string;
  telefone_fixo?: string;
  email?: string;
  endereco?: string;
  endereco_comercial?: string;
  status: StatusCliente;
  data_cadastro: string;
  observacoes?: string;
  foto_url?: string;
  latitude?: number;
  longitude?: number;
  segmento_id?: string;
  segmento_nome?: string;
  empresa_id: string;
  rotas_ids: string[];
  rotas_nomes?: string;
  permite_emprestimo_adicional: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClienteComTotais extends Cliente {
  qtd_emprestimos_ativos: number;
  qtd_emprestimos_total: number;
  valor_total_emprestimos: number;
  valor_total_pago: number;
  valor_saldo_devedor: number;
  parcelas_pendentes: number;
  parcelas_atrasadas: number;
}

export interface Emprestimo {
  id: string;
  cliente_id: string;
  rota_id: string;
  empresa_id: string;
  tipo_emprestimo: TipoEmprestimo;
  valor_principal: number;
  valor_total: number;
  valor_pago: number;
  valor_saldo: number;
  numero_parcelas: number;
  numero_parcelas_pagas: number;
  numero_parcelas_restantes: number;
  valor_parcela: number;
  taxa_juros: number;
  frequencia_pagamento: FrequenciaPagamento;
  data_emprestimo: string;
  data_primeiro_vencimento: string;
  status: StatusEmprestimo;
  observacoes?: string;
  rota_nome?: string;
  vendedor_nome?: string;
  created_at: string;
  // Calculados
  percentual_pago: number;
  proxima_parcela_vencimento?: string;
  dias_atraso: number;
}

export interface Parcela {
  id: string;
  emprestimo_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago: number;
  valor_saldo: number;
  valor_multa: number;
  data_vencimento: string;
  data_pagamento?: string;
  dias_atraso: number;
  status: StatusParcela;
  observacoes?: string;
  // Calculados
  valor_total_parcela: number;
  esta_atrasada: boolean;
}

export interface Segmento {
  id: string;
  grupo_pt: string;
  grupo_es: string;
  nome_pt: string;
  nome_es: string;
  ordem_grupo: number;
  ordem: number;
}

export interface RotaSimples {
  id: string;
  nome: string;
  codigo: string;
  cidade_nome?: string;
  qtd_clientes: number;
  status: string;
  vendedor_id?: string;
  vendedor_nome?: string;
}

// =====================================================
// INTERFACES DE CONTAGEM/RESUMO
// =====================================================

export interface ContagemClientes {
  total: number;
  ativos: number;
  inativos: number;
  suspensos: number;
  com_emprestimo_ativo: number;
  com_parcelas_atrasadas: number;
}

// =====================================================
// INTERFACES DE INPUT (FORMULÁRIOS)
// =====================================================

export interface FiltrosClientes {
  empresa_id: string;
  rota_id?: string;
  status?: StatusCliente;
  busca?: string;
  limite?: number;
  offset?: number;
}

export interface NovaVendaInput {
  // Dados do cliente (obrigatório se cliente novo)
  cliente_id?: string;
  cliente_nome?: string;
  cliente_documento?: string;
  cliente_telefone?: string;
  cliente_telefone_fixo?: string;
  cliente_email?: string;
  cliente_endereco?: string;
  cliente_endereco_comercial?: string;
  cliente_segmento_id?: string;
  cliente_foto_url?: string;
  cliente_observacoes?: string;
  // Dados do empréstimo
  valor_principal: number;
  numero_parcelas: number;
  taxa_juros: number;
  frequencia: FrequenciaPagamento;
  data_primeiro_vencimento: string;
  dia_semana_cobranca?: number;
  dia_mes_cobranca?: number;
  dias_mes_cobranca?: number[];
  iniciar_proximo_mes?: boolean;
  observacoes?: string;
  // Contexto
  empresa_id: string;
  rota_id: string;
  vendedor_id?: string;
  user_id: string;
  // GPS
  latitude?: number;
  longitude?: number;
  // Microseguro
  microseguro_valor?: number;
}

export interface RenovacaoInput {
  cliente_id: string;
  valor_principal: number;
  numero_parcelas: number;
  taxa_juros: number;
  frequencia: FrequenciaPagamento;
  data_primeiro_vencimento: string;
  dia_semana_cobranca?: number;
  dia_mes_cobranca?: number;
  dias_mes_cobranca?: number[];
  iniciar_proximo_mes?: boolean;
  observacoes?: string;
  empresa_id: string;
  rota_id: string;
  vendedor_id?: string;
  user_id: string;
  latitude?: number;
  longitude?: number;
  microseguro_valor?: number;
}

export interface PagamentoInput {
  parcela_id: string;
  valor_pagamento: number;
  valor_credito?: number;
  forma_pagamento: FormaPagamento;
  observacoes?: string;
  latitude?: number;
  longitude?: number;
  precisao_gps?: number;
  liquidacao_id?: string;
}

export interface AtualizarClienteInput {
  cliente_id: string;
  nome?: string;
  documento?: string;
  telefone_celular?: string;
  telefone_fixo?: string;
  email?: string;
  endereco?: string;
  endereco_comercial?: string;
  segmento_id?: string;
  foto_url?: string;
  observacoes?: string;
  status?: StatusCliente;
}

// =====================================================
// INTERFACES DE RESPOSTA
// =====================================================

export interface RespostaNovaVenda {
  success: boolean;
  cliente_id?: string;
  emprestimo_id?: string;
  error?: string;
}

export interface RespostaPagamento {
  success: boolean;
  parcela_id?: string;
  emprestimo_quitado?: boolean;
  error?: string;
}

// =====================================================
// INTERFACES AUXILIARES
// =====================================================

export interface ProximaParcela {
  parcela_id: string;
  emprestimo_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_saldo: number;
  valor_multa: number;
  data_vencimento: string;
  dias_atraso: number;
  cliente_nome: string;
  valor_total_devido: number;
}

// Configuração de frequência para cálculos
export const FREQUENCIA_CONFIG = {
  DIARIO: { label: 'Diário', dias: 1 },
  SEMANAL: { label: 'Semanal', dias: 7 },
  QUINZENAL: { label: 'Quinzenal', dias: 15 },
  MENSAL: { label: 'Mensal', dias: 30 },
  FLEXIVEL: { label: 'Flexível', dias: 0 },
} as const;

// Cores de status
export const STATUS_CLIENTE_COLORS = {
  ATIVO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo' },
  INATIVO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Inativo' },
  SUSPENSO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspenso' },
} as const;

export const STATUS_EMPRESTIMO_COLORS = {
  ATIVO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Ativo' },
  QUITADO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Quitado' },
  CANCELADO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Cancelado' },
  VENCIDO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Vencido' },
  RENEGOCIADO: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Renegociado' },
  ADIANTADO: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Adiantado' },
  INCOMPLETO: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Incompleto' },
} as const;

export const STATUS_PARCELA_COLORS = {
  PENDENTE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendente' },
  PAGO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Pago' },
  PARCIAL: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Parcial' },
  VENCIDO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Vencido' },
  CANCELADO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Cancelado' },
} as const;