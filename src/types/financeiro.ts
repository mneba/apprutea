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

/**
 * O nome a MOSTRAR de uma conta.
 *
 * ⚠ NÃO use `conta.nome` na tela. Ele é uma CÓPIA de `rotas.nome`, gravada
 * por `criar_conta_rota_e_microseguro` no INSERT e — até 07/11/2026 — nunca
 * atualizada quando a rota era renomeada. 57 das 152 contas de rota estavam
 * com o nome congelado, e o modal de Nova Entrada da PrimeCred oferecia
 * "Conta Rota Apolo - Santa, Seir y Julio" para a rota `1.1 ANGELICA`.
 *
 * Havia uma rota `15.2 Apolo` DE VERDADE em outra empresa, com conta de nome
 * quase igual: escolher a rota errada no lançamento era erro possível e
 * silencioso.
 *
 * `sql/2026-11-07_nome_da_conta_segue_a_rota.sql` reparou o dado e instalou
 * o gatilho que mantém a cópia. Esta função é a segunda linha de defesa, de
 * propósito: lendo o nome vivo, a tela de dinheiro fica certa mesmo se
 * aquele gatilho cair um dia.
 *
 * `fn_buscar_contas_dropdown` já devolvia `rota_nome` e `microseguro_nome` —
 * a resposta certa estava no payload e a interface a ignorava.
 */
export function nomeDaConta(c: ContaComDetalhes): string {
  // ⚠ Os DOIS tipos derivam de `rota_nome`, que é o único nome vivo aqui.
  // `microseguro_nome` NÃO serve: `microseguros.nome` é uma terceira cópia
  // de `rotas.nome`, gravada como `'Microseguro ' || rota.nome` no mesmo
  // INSERT e congelada pelo mesmo motivo — 28 dos 76 estavam desatualizados
  // em 07/11/2026. Cair nela seria trocar uma cópia velha por outra.
  if (c.tipo_conta === 'ROTA') return c.rota_nome || c.nome;
  if (c.tipo_conta === 'MICROSEGURO') {
    return c.rota_nome ? `Microseguro ${c.rota_nome}` : (c.microseguro_nome || c.nome);
  }
  return c.nome; // EMPRESA: o nome é próprio, não é cópia de nada.
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
  conta_origem_nome?: string;
  conta_origem_tipo?: string;
  conta_destino_id?: string;
  conta_destino_nome?: string;
  conta_destino_tipo?: string;
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
// INTERFACES DE DETALHE POR ROTA/MICROSEGURO
// =====================================================

export interface RotaDetalhe {
  rota_id: string;
  rota_nome: string;
  saldo: number;
}

export interface MicroseguroDetalhe {
  microseguro_id: string;
  microseguro_nome: string;
  rota_nome?: string;
  saldo: number;
}

// =====================================================
// INTERFACES DE RESUMO E INDICADORES
// =====================================================

export interface SaldosContas {
  modo: 'empresa' | 'rota';
  empresa_id?: string;
  rota_id?: string;
  total_consolidado: number;
  saldo_empresa: number;
  saldo_rotas: number;
  saldo_microseguros: number;
  contas: ContaComDetalhes[];
  rotas_detalhe: RotaDetalhe[];
  microseguros_detalhe: MicroseguroDetalhe[];
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
  data_formatada?: string;
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
  periodo?: PeriodoFiltro | string;
  categoria?: string;
  tipo?: TipoMovimento;
  status?: StatusMovimento;
  data_inicio?: string;
  data_fim?: string;
}

// =====================================================
// INTERFACES PARA RESPONSES
// =====================================================

export interface FinanceiroResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}