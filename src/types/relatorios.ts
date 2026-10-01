// =====================================================================
// TIPOS DA ÁREA DE RELATÓRIOS
// =====================================================================
//
// Espelham o `jsonb` devolvido por `fn_estrutura_visivel` e
// `fn_liquidacoes_periodo` (ver sql/2026-10-01_*.sql). Qualquer campo novo
// nasce lá primeiro — a montagem é toda do banco, de propósito, para a regra
// não passar a existir em dois lugares.

// ── Árvore de escopo ───────────────────────────────────────────────────

export interface RotaNo {
  rota_id: string;
  nome: string;
}

export interface EmpresaNo {
  empresa_id: string;
  nome: string;
  rotas: RotaNo[];
}

export interface CidadeNo {
  /** Nulo é caso real: `empresas.cidade_id` é opcional. */
  cidade_id: string | null;
  nome: string;
  empresas: EmpresaNo[];
}

export interface EstadoNo {
  hierarquia_id: string;
  estado: string;
  cidades: CidadeNo[];
}

/**
 * O país não é um registro: `hierarquias` guarda país e estado na mesma linha.
 * Este nível é sintetizado pela função — e é o que faltava no seletor global.
 */
export interface PaisNo {
  pais: string;
  estados: EstadoNo[];
}

export interface EstruturaVisivel {
  sucesso: boolean;
  mensagem?: string;
  tipo_usuario?: string;
  ve_tudo?: boolean;
  rotas_visiveis?: number;
  paises: PaisNo[];
}

// ── Liquidações por período ────────────────────────────────────────────

export interface ConsolidadoPeriodo {
  dias_trabalhados: number;
  rotas_com_movimento: number;
  recebido: number;
  /** Recebido ÷ dias trabalhados. Não é por dia de calendário. */
  media_diaria: number;
  emprestado: number;
  /** Juro CONTRATADO nos empréstimos criados no período. */
  juros_vendidos: number;
  /** Juro REALIZADO: a parte de juro dentro do que foi efetivamente abatido. */
  ganancia: number;
  qtd_emprestimos: number;
  clientes_pagos: number;
  clientes_nao_pagos: number;
  clientes_novos: number;
  clientes_renovados: number;
  clientes_renegociados: number;
  /** Primeiro e último dia DE CADA ROTA, somados. Nunca soma entre dias. */
  caixa_inicial: number;
  caixa_final: number;
  carteira: number;
}

export interface DiaPeriodo {
  data: string;
  rotas: number;
  recebido: number;
  /**
   * `esperado` e o percentual só existem por dia. No período eles misturam
   * coisas que não se comparam — ver o cabeçalho da RPC.
   */
  esperado: number;
  percentual_recebimento: number;
  emprestado: number;
  juros_vendidos: number;
  ganancia: number;
  qtd_emprestimos: number;
  clientes_pagos: number;
  clientes_nao_pagos: number;
  caixa_final: number;
  carteira: number;
}

export interface RotaPeriodo {
  rota_id: string;
  rota_nome: string | null;
  dias: number;
  recebido: number;
  emprestado: number;
  juros_vendidos: number;
  ganancia: number;
  qtd_emprestimos: number;
}

export interface EmprestimoGanancia {
  emprestimo_id: string;
  cliente_nome: string | null;
  status: string;
  data_emprestimo: string | null;
  valor_total: number;
  total_pago: number;
  saldo: number;
  /** Juro cheio do empréstimo, independente do intervalo. */
  ganancia_total: number;
  /** Quanto desse juro caiu dentro do intervalo pedido. */
  ganancia_periodo: number;
}

export interface LiquidacoesPeriodo {
  sucesso: boolean;
  mensagem?: string;
  de: string;
  ate: string;
  rotas_no_escopo: number;
  consolidado: ConsolidadoPeriodo | null;
  por_dia: DiaPeriodo[];
  por_rota: RotaPeriodo[];
  /** Só vem preenchido quando a chamada pede detalhe. */
  por_emprestimo: EmprestimoGanancia[];
}
