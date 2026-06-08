// ============================================================
// TYPES - CATEGORIAS FINANCEIRAS
// ============================================================

export type TipoMovimento = 'RECEBER' | 'PAGAR' | 'AMBOS';

export interface CategoriaFinanceira {
  id: string;
  codigo: string;
  nome_pt: string;
  nome_es: string;
  tipo_movimento: TipoMovimento;
  aplicavel_empresa: boolean;
  aplicavel_rota: boolean;
  aplicavel_microseguro: boolean;
  ativo: boolean;
  ordem_exibicao: number;
  cor_hex: string | null;
  icone: string | null;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoriaFinanceiraInput {
  codigo: string;
  nome_pt: string;
  nome_es: string;
  tipo_movimento: TipoMovimento;
  aplicavel_empresa?: boolean;
  aplicavel_rota?: boolean;
  aplicavel_microseguro?: boolean;
  ativo?: boolean;
  ordem_exibicao?: number;
  cor_hex?: string | null;
  icone?: string | null;
  descricao?: string | null;
}

export interface FiltrosCategorias {
  tipo_movimento?: TipoMovimento;
  aplicavel_empresa?: boolean;
  aplicavel_rota?: boolean;
  aplicavel_microseguro?: boolean;
  ativo?: boolean;
  busca?: string;
}