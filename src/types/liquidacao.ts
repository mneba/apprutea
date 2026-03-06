// =====================================================
// TYPES DO MÓDULO DE LIQUIDAÇÃO DIÁRIA
// ATUALIZADO: Inclui campos de reabertura
// =====================================================

// Interface principal da liquidação diária
export interface LiquidacaoDiaria {
  id: string;
  rota_id: string;
  vendedor_id: string;
  data_abertura: string;
  data_fechamento?: string;
  status: 'ABERTO' | 'FECHADO' | 'APROVADO' | 'REABERTO';
  
  // Valores de caixa
  caixa_inicial: number;
  caixa_final: number;
  carteira_inicial: number;
  carteira_final: number;
  
  // Valores do dia
  valor_esperado_dia: number;
  valor_recebido_dia: number;
  valor_dinheiro: number;
  valor_transferencia: number;
  
  // Contadores de clientes
  clientes_iniciais: number;
  clientes_novos: number;
  clientes_renovados: number;
  clientes_renegociados: number;
  clientes_cancelados: number;
  
  // Contadores de pagamentos
  pagamentos_pagos: number;
  pagamentos_nao_pagos: number;
  
  // Empréstimos do dia
  total_emprestado_dia: number;
  qtd_emprestimos_dia: number;
  total_juros_dia?: number;
  
  // Despesas do dia
  total_despesas_dia: number;
  qtd_despesas_dia: number;
  
  // Microseguro
  total_microseguro_dia: number;
  qtd_microseguros_dia: number;
  
  // Observações
  observacoes?: string;
  
  // Campos de reabertura - NOVOS
  reaberto_por?: string;
  reaberto_por_nome?: string;
  data_reabertura?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

// Interface do vendedor para liquidação
export interface VendedorLiquidacao {
  id: string;
  nome: string;
  codigo_vendedor?: string;
  telefone?: string;
  email?: string;
  foto_url?: string;
  status: string;
}

// Interface da rota para liquidação
export interface RotaLiquidacao {
  id: string;
  nome: string;
  empresa_id: string;
}

// Interface da conta da rota
export interface ContaRota {
  id: string;
  rota_id: string;
  tipo_conta: string;
  saldo_atual: number;
  saldo_inicial?: number;
}

// Interface do cliente do dia (da view vw_clientes_rota_dia)
export interface ClienteDoDia {
  parcela_id: string;
  cliente_id: string;
  emprestimo_id: string;
  rota_id: string;
  
  // Dados do cliente
  nome: string;
  consecutivo: string;
  telefone_celular?: string;
  endereco?: string;
  
  // Dados da parcela
  numero_parcela: number;
  numero_parcelas: number;
  valor_parcela: number;
  valor_pago_parcela: number;
  data_vencimento: string;
  status_dia: 'PENDENTE' | 'PAGO' | 'PARCIAL' | 'EM_ATRASO';
  
  // Dados do empréstimo
  valor_principal: number;
  saldo_emprestimo: number;
  
  // Flags
  tem_parcelas_vencidas: boolean;
  total_parcelas_vencidas: number;
  valor_total_vencido: number;
  permite_emprestimo_adicional?: boolean;
  
  // Ordem de visita
  ordem_visita_dia?: number;
}

// Interface do microseguro do dia
export interface MicroseguroDoDia {
  id: string;
  valor: number;
  emprestimo_id: string;
  cliente_nome: string;
  data_venda: string;
}

// Input para abrir liquidação
export interface AbrirLiquidacaoInput {
  vendedor_id: string;
  rota_id: string;
  caixa_inicial: number;
  user_id: string;
  latitude?: number;
  longitude?: number;
  precisao_gps?: number;
}

// Input para fechar liquidação
export interface FecharLiquidacaoInput {
  liquidacao_id: string;
  user_id: string;
  observacoes?: string;
}

// Input para reabrir liquidação
export interface ReabrirLiquidacaoInput {
  liquidacao_id: string;
  user_id: string;
  motivo: string;
}

// Resposta da abertura de liquidação
export interface RespostaAbrirLiquidacao {
  sucesso: boolean;
  mensagem: string;
  liquidacao_id?: string;
  data_abertura?: string;
}

// Resposta do fechamento de liquidação
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

// Filtros para clientes do dia
export interface FiltrosClientesDia {
  status?: 'PENDENTE' | 'PAGO' | 'PARCIAL' | 'EM_ATRASO';
  busca?: string;
}

// Filtros para histórico de liquidações
export interface FiltrosHistoricoLiquidacoes {
  status?: string;
  data_inicio?: string;
  data_fim?: string;
}

// Estatísticas dos clientes do dia
export interface EstatisticasClientesDia {
  total: number;
  sincronizados: number;
  novos: number;
  renovados: number;
  cancelados: number;
  pagos_dinheiro: number;
  pagos_transferencia: number;
}