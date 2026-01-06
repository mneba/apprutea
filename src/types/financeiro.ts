// =====================================================
// TIPOS DO MÓDULO FINANCEIRO - SISTEMA BELLA KIDS
// =====================================================

// Tipos de conta disponíveis
export type TipoConta = 'EMPRESA' | 'ROTA' | 'MICROSEGURO';

// Tipos de movimento financeiro
export type TipoMovimento = 'RECEBER' | 'PAGAR' | 'TRANSFERENCIA' | 'AJUSTE';

// Status do movimento
export type StatusMovimento = 'PENDENTE' | 'PAGO' | 'CANCELADO' | 'VENCIDO' | 'ANULADO';

// Períodos de filtro
export type PeriodoFiltro = 'hoje' | 'ontem' | '7dias' | '15dias' | '30dias' | 'mes_fechado';

// =====================================================
// INTERFACES DE CONTAS
// =====================================================

export interface Conta {
  id: string;
  tipo_conta: TipoConta;
  numero: string;
  nome: string;
  saldo_atual: number;
  empresa_id: string;
  rota_id?: string;
  microseguro_id?: string;
  status: 'ATIVA' | 'INATIVA' | 'BLOQUEADA';
  created_at: string;
  updated_at: string;
}

export interface ContaComDetalhes extends Conta {
  empresa_nome?: string;
  rota_nome?: string;
  microseguro_nome?: string;
}

// =====================================================
// INTERFACES DE CATEGORIAS
// =====================================================

export interface CategoriaFinanceira {
  id: string;
  codigo: string;
  nome_pt: string;
  nome_es: string;
  tipo_movimento: 'RECEBER' | 'PAGAR' | 'AMBOS';
  aplicavel_empresa: boolean;
  aplicavel_rota: boolean;
  aplicavel_microseguro: boolean;
  ativo: boolean;
  ordem_exibicao: number;
  cor_hex?: string;
  icone?: string;
  descricao?: string;
}

// =====================================================
// INTERFACES DE MOVIMENTAÇÃO FINANCEIRA
// =====================================================

export interface MovimentoFinanceiro {
  id: string;
  tipo: TipoMovimento;
  categoria: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  data_vencimento?: string;
  data_pagamento?: string;
  cliente_nome?: string;
  rota_nome?: string;
  vendedor_nome?: string;
  empresa_nome?: string;
  ref_emprestimo_id?: string;
  ref_parcela_id?: string;
  ref_cliente_id?: string;
  ref_rota_id?: string;
  ref_vendedor_id?: string;
  ref_empresa_id?: string;
  status: StatusMovimento;
  forma_pagamento?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  conta_origem_id?: string;
  conta_destino_id?: string;
  usuario_id?: string;
  liquidacao_id?: string;
  vendedor_id?: string;
  latitude?: number;
  longitude?: number;
  data_hora_gps?: string;
  precisao_gps?: number;
}

export interface MovimentoComConta extends MovimentoFinanceiro {
  conta_origem?: ContaComDetalhes;
  conta_destino?: ContaComDetalhes;
}

// =====================================================
// INTERFACES DE RESUMO E INDICADORES
// =====================================================

export interface SaldosContas {
  total_consolidado: number;
  saldo_empresa: number;
  saldo_rotas: number;
  saldo_microseguros: number;
  contas: ContaComDetalhes[];
}

export interface ResumoMovimentacoes {
  total_entradas: number;
  total_saidas: number;
  saldo_periodo: number;
  qtd_entradas: number;
  qtd_saidas: number;
  qtd_total: number;
}

export interface DadosGrafico {
  data: string;
  entradas: number;
  saidas: number;
}

// =====================================================
// INTERFACES PARA FORMULÁRIOS
// =====================================================

export interface NovaMovimentacaoInput {
  tipo: 'RECEBER' | 'PAGAR';
  categoria: string;
  descricao: string;
  valor: number;
  conta_destino_id: string;
  data_lancamento?: string;
  data_vencimento?: string;
  observacoes?: string;
  forma_pagamento?: string;
}

export interface TransferenciaInput {
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  descricao?: string;
  observacoes?: string;
}

export interface AjusteSaldoInput {
  conta_id: string;
  valor: number; // Positivo ou negativo
  motivo: string;
  observacoes?: string;
}

// =====================================================
// INTERFACES PARA FILTROS
// =====================================================

export interface FiltrosExtrato {
  conta_id?: string;
  periodo: PeriodoFiltro;
  categoria?: string;
  tipo?: TipoMovimento;
  status?: StatusMovimento;
}

// =====================================================
// INTERFACES PARA RESPONSES
// =====================================================

export interface FinanceiroResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}
