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
  /**
   * Quem opera a rota. Nulo é caso real — rota sem vendedor vinculado existe,
   * e é o motivo de alguém não conseguir entrar no app.
   */
  vendedor_nome: string | null;
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
  /**
   * A BASE, não o movimento. `clientes_pagos` acima conta atendimentos e soma
   * entre dias; estes dois contam pessoas nas rotas do escopo.
   */
  clientes_ativos: number;
  clientes_suspensos: number;
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

// ── Listagem da cobrança ───────────────────────────────────────────────
//
// O detalhe atrás do total cobrado. Pagamentos e não pagos na mesma lista,
// como no sistema legado — separá-los esconderia o que não entrou.

export interface LinhaCobranca {
  registro_id: string;
  /** `NAO_PAGO` vem de `nao_pagos_liquidacao` e entra zerado em todo valor. */
  origem: 'PAGAMENTO' | 'NAO_PAGO';
  emprestimo_id: string | null;
  /** Instante real do lançamento. */
  quando: string;
  /** Dia da liquidação em que entrou. */
  data_operacional: string;
  cliente_nome: string | null;
  cliente_documento: string | null;
  rota_nome: string | null;
  numero_parcela: number | null;
  numero_parcelas: number | null;
  tipo_operacao: string;
  forma_pagamento: string | null;
  /** O que entrou no caixa: o pago menos o crédito gasto. */
  dinheiro: number;
  credito_usado: number;
  credito_gerado: number;
  /** O juro embutido neste lançamento. Somado, bate com a ganancia. */
  lucro: number;
  saldo_depois: number;
  /** Só em não pago: por que o cliente não pagou. */
  observacao: string | null;
}

export interface TotaisCobranca {
  dinheiro: number;
  credito: number;
  lucro: number;
  registros: number;
  nao_pagos: number;
}

export interface CobrancaPeriodo {
  sucesso: boolean;
  mensagem?: string;
  de: string;
  ate: string;
  total_registros: number;
  limite: number;
  offset: number;
  /** Do filtro inteiro, não da página visível. */
  totais: TotaisCobranca | null;
  linhas: LinhaCobranca[];
}

export interface FiltrosCobranca {
  busca?: string;
  tipo?: string;
  forma?: string;
  limite?: number;
  offset?: number;
}

// ── Listagem das vendas ────────────────────────────────────────────────

export interface LinhaVenda {
  emprestimo_id: string;
  quando: string;
  data_operacional: string;
  cliente_nome: string | null;
  cliente_documento: string | null;
  rota_nome: string | null;
  tipo_emprestimo: string;
  frequencia: string;
  status: string;
  valor_principal: number;
  valor_total: number;
  juros: number;
  taxa_juros: number | null;
  numero_parcelas: number;
  valor_parcela: number;
  saldo: number;
  /** Principal do empréstimo de origem. Zero quando é o primeiro do cliente. */
  valor_anterior: number;
  /**
   * A renovação contra o empréstimo anterior. Comparada sobre o PRINCIPAL: o
   * total embute juro, e mudar a taxa faria renovação de mesmo valor parecer
   * maior.
   */
  classificacao: 'MAIOR' | 'IGUAL' | 'MENOR' | 'PRIMEIRO';
}

export interface TotaisVendas {
  principal: number;
  total: number;
  juros: number;
  registros: number;
  /** A leitura de carteira: cresceu, ficou parada ou encolheu. */
  maior: number;
  igual: number;
  menor: number;
  primeiro: number;
}

export interface VendasPeriodo {
  sucesso: boolean;
  mensagem?: string;
  de: string;
  ate: string;
  total_registros: number;
  limite: number;
  offset: number;
  totais: TotaisVendas | null;
  linhas: LinhaVenda[];
}

export interface FiltrosVendas {
  busca?: string;
  tipo?: string;
  classe?: string;
  limite?: number;
  offset?: number;
}

// ─── Entradas e saídas ─────────────────────────────────────────────────────
//
// O relatório de fluxo de caixa. Pedido do cliente em 07/10/2026: além de
// cobrado e emprestado, ver despesas, caixas, carteira, aportes, retiradas e
// "qualquer movimentação de dinheiro".
//
// É esse "qualquer" que explica `por_categoria` ser uma lista aberta em vez de
// campos fixos: a RPC agrupa pelo que existir em `financeiro`, então categoria
// criada amanhã aparece sozinha.

export interface MovimentoCategoria {
  tipo: 'RECEBER' | 'PAGAR' | 'AJUSTE' | string;
  categoria: string;
  qtd: number;
  total: number;
}

export interface DiaEntradaSaida {
  data: string;
  caixa_inicial: number;
  caixa_final: number;
  carteira_final: number;
  entradas: number;
  saidas: number;
  cobrado: number;
  emprestado: number;
  despesas: number;
}

export interface ConsolidadoEntradaSaida {
  dias: number;
  /** Caixa e carteira são SALDO: vêm das pontas do período, não somados. */
  caixa_inicial: number;
  caixa_final: number;
  carteira_inicial: number;
  carteira_final: number;
  entradas: number;
  saidas: number;
  ajustes: number;
  cobrado: number;
  emprestado: number;
  /** Saída que não é empréstimo — o dinheiro emprestado virou carteira. */
  despesas: number;
  resultado: number;
}

export interface EntradasSaidasPeriodo {
  sucesso: boolean;
  mensagem?: string;
  de: string;
  ate: string;
  rotas: number;
  consolidado: ConsolidadoEntradaSaida | null;
  por_categoria: MovimentoCategoria[];
  por_dia: DiaEntradaSaida[];
}

// ─── Atrasos ───────────────────────────────────────────────────────────────
//
// FOTO numa data, não período: atraso é estado, não fluxo.
//
// `dias_atraso` vem em DIAS DE COBRANÇA — domingo sem expediente e feriado da
// rota não contam. É a mesma regra de diasCobranca.ts no app, implementada uma
// segunda vez no Postgres porque relatório de servidor não chama código do
// aparelho. Se uma mudar, a outra muda junto.

export interface LinhaAtraso {
  emprestimo_id: string;
  cliente_nome: string;
  cliente_documento: string | null;
  telefone: string | null;
  rota_nome: string;
  frequencia: string;
  tipo_emprestimo: string;
  data_emprestimo: string | null;
  vencimento_antigo: string;
  dias_atraso: number;
  parcelas_vencidas: number;
  valor_vencido: number;
  saldo: number;
  ultimo_pagamento: string | null;
}

export interface FaixaAtraso {
  faixa: string;
  clientes: number;
  valor: number;
}

export interface TotaisAtrasos {
  clientes: number;
  emprestimos: number;
  valor_vencido: number;
  saldo_total: number;
  parcelas_vencidas: number;
  media_dias: number;
  pior_caso: number;
}

export interface AtrasosRelatorio {
  sucesso: boolean;
  mensagem?: string;
  data: string;
  total_registros: number;
  limite: number;
  offset: number;
  totais: TotaisAtrasos | null;
  faixas: FaixaAtraso[];
  linhas: LinhaAtraso[];
}

export interface FiltrosAtrasos {
  minDias?: number;
  busca?: string;
  limite?: number;
  offset?: number;
}
