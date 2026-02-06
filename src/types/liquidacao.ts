// =====================================================
// TYPES DO MÓDULO DE LIQUIDAÇÃO DIÁRIA - SISTEMA APPRUTEA
// Alinhado com tabelas reais do Supabase
// =====================================================

// =====================================================
// ENUMS E TIPOS BASE
// =====================================================

export type StatusLiquidacao = 'ABERTO' | 'FECHADO' | 'APROVADO' | 'REABERTO';
export type StatusDia = 'PAGO' | 'PARCIAL' | 'EM_ATRASO' | 'PENDENTE';

// =====================================================
// INTERFACE PRINCIPAL - LIQUIDAÇÃO DIÁRIA
// Campos exatamente como na tabela liquidacoes_diarias
// =====================================================

export interface LiquidacaoDiaria {
  id: string;
  vendedor_id: string;
  rota_id: string;
  empresa_id: string;
  
  // Datas e horários
  data_abertura: string;
  data_fechamento?: string | null;
  
  // Status
  status: StatusLiquidacao;
  
  // Aprovação
  aprovado_por?: string | null;
  data_aprovacao?: string | null;
  
  // Caixa
  caixa_inicial: number;
  caixa_final: number;
  
  // Carteira
  carteira_inicial: number;
  carteira_final: number;
  
  // Recaudo
  valor_esperado_dia: number;
  valor_recebido_dia: number;
  percentual_recebimento: number;
  
  // Recaudo por tipo de pagamento
  valor_dinheiro: number;
  valor_transferencia: number;
  
  // Clientes
  clientes_iniciais: number;
  clientes_novos: number;
  clientes_renovados: number;
  clientes_renegociados: number;
  clientes_cancelados: number;
  
  // Pagamentos
  pagamentos_pagos: number;
  pagamentos_nao_pagos: number;
  
  // Empréstimos
  total_emprestado_dia: number;
  total_juros_dia: number;  // ✅ NOVO: Juros dos empréstimos do dia
  qtd_emprestimos_dia: number;
  
  // Despesas
  total_despesas_dia: number;
  qtd_despesas_dia: number;
  
  // Microseguro
  total_microseguro_dia: number;
  qtd_microseguros_dia: number;
  
  // Observações
  observacoes?: string | null;
  
  // Auditoria
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
  telefone?: string | null;
  email?: string | null;
  foto_url?: string | null;
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
// CLIENTE DO DIA (via vw_clientes_rota_dia)
// =====================================================

export interface ClienteDoDia {
  // Dados do Cliente
  cliente_id: string;
  consecutivo: string;
  nome: string;
  telefone_celular?: string | null;
  endereco?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  permite_emprestimo_adicional: boolean;
  
  // Dados do Empréstimo
  emprestimo_id: string;
  saldo_emprestimo: number;
  valor_principal: number;
  numero_parcelas: number;
  status_emprestimo: string;
  rota_id: string;
  
  // Dados da Parcela
  parcela_id: string;
  numero_parcela: number;
  valor_parcela: number;
  valor_pago_parcela: number;
  saldo_parcela: number;
  status_parcela: string;
  data_vencimento: string;
  ordem_visita_dia?: number | null;
  liquidacao_id?: string | null;
  
  // Dados de Atraso
  tem_parcelas_vencidas: boolean;
  total_parcelas_vencidas: number;
  valor_total_vencido: number;
  
  // Status Calculado
  status_dia: StatusDia;
}

// =====================================================
// MICROSEGURO DO DIA
// =====================================================

export interface MicroseguroDoDia {
  id: string;
  valor: number;
  emprestimo_id: string;
  cliente_nome: string;
  data_venda: string;
}

// =====================================================
// INPUTS PARA OPERAÇÕES
// =====================================================

export interface AbrirLiquidacaoInput {
  vendedor_id: string;
  rota_id: string;
  caixa_inicial: number;
  user_id: string;
  latitude?: number | null;
  longitude?: number | null;
  precisao_gps?: number | null;
}

export interface FecharLiquidacaoInput {
  liquidacao_id: string;
  user_id: string;
  observacoes?: string | null;
}

export interface ReabrirLiquidacaoInput {
  liquidacao_id: string;
  user_id: string;
  motivo: string;
}

// =====================================================
// RESPOSTAS DAS OPERAÇÕES
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
  status?: StatusDia;
  forma_pagamento?: 'DINHEIRO' | 'TRANSFERENCIA';
  busca?: string;
}

export interface FiltrosHistoricoLiquidacoes {
  status?: StatusLiquidacao;
  data_inicio?: string;
  data_fim?: string;
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

export interface ResumoFinanceiroDia {
  caixa_inicial: number;
  caixa_final: number;
  total_recebido: number;
  total_emprestado: number;
  total_despesas: number;
  total_microseguro: number;
  diferenca: number;
}