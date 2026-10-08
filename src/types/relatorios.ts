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
  carteira_inicial: number;
  carteira: number;
  /**
   * Movimentação que NÃO é empréstimo nem cobrança de parcela — despesa,
   * aporte, retirada, microseguro. Esses dois têm linha própria no relatório;
   * contá-los aqui mostraria o mesmo dinheiro duas vezes.
   */
  entradas: number;
  saidas: number;
  /**
   * Fora de `entradas` e `saidas` de propósito. Transferência é dinheiro
   * trocando de bolso — o trigger subtrai da origem e soma no destino — e
   * somar nas duas pontas inflaria as duas. Ajuste traz o próprio sinal.
   */
  transferencias: number;
  ajustes: number;
  /**
   * A conta do microseguro é outra conta, com card próprio. A venda cai nela
   * e a retirada sai dela para a conta da rota — então a venda fica fora de
   * `entradas` por construção, não por regra escrita à mão.
   */
  microseguro_vendas: number;
  microseguro_retiradas: number;
  /**
   * Lastro de implantação: ~100.000,00 injetados para importar os
   * empréstimos de uma rota nova e depois retirados. Positivo entrou,
   * negativo voltou — o sinal diz a direção.
   *
   * Fora de `entradas` e de `ajustes` porque não é operação da rota, e era
   * o que fazia a Barcelona mostrar −117.219,77 de "ajustes" num caixa de
   * 1.289,23. A classificação acontece numa linha só, dentro da RPC: a CTE
   * marca a categoria `APORTE_FINANCEIRO` como grupo próprio na leitura, e
   * toda soma que filtra por tipo deixa de contá-la sem ser tocada.
   */
  aportes: number;
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
  caixa_inicial: number;
  caixa_final: number;
  carteira_inicial: number;
  carteira: number;
  entradas: number;
  saidas: number;
  transferencias: number;
  ajustes: number;
  microseguro_vendas: number;
  microseguro_retiradas: number;
  aportes: number;
}

/**
 * Dia com dinheiro e SEM liquidação.
 *
 * Vem separado de `por_dia` de propósito: entrar lá dentro mudaria
 * `dias_trabalhados` e a média diária, que significam "dia em que a rota
 * trabalhou". Separado, a linha aparece na tela com a marca e a diferença
 * entre o total e a soma dos dias fica escrita em vez de deduzida — que foi o
 * pedido: o usuário esquece, e depois questiona divergência que ele mesmo
 * causou.
 */
export interface DiaSemLiquidacao {
  data: string;
  entradas: number;
  saidas: number;
  transferencias: number;
  ajustes: number;
  microseguro_vendas: number;
  microseguro_retiradas: number;
  aportes: number;
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
  dias_sem_liquidacao: DiaSemLiquidacao[];
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

// ─── Movimentações ──────────────────────────────────────────────
//
// Todo dinheiro que entrou ou saiu e que NÃO é empréstimo nem cobrança de
// parcela — despesa, aporte, retirada, microseguro, o que houver. Esses dois
// têm painel próprio no mesmo relatório; contá-los aqui mostraria o mesmo
// dinheiro duas vezes na mesma tela.
//
// `por_categoria` é lista aberta: a RPC agrupa pelo que existir em
// `financeiro`, sem nomes fixos. Categoria criada amanhã aparece sozinha.
//
// O RECORTE É "O QUE MOVE O SALDO DA CONTA", e quem decide isso é o trigger
// `atualizar_saldo_contas`, não uma lista daqui. Consequências:
// `TRANSFERENCIA` e `AJUSTE` entram com QUALQUER status, porque o trigger
// mexe no saldo sem exigir `PAGO`; e `AJUSTE_ABERTURA` fica fora, porque tem
// `RETURN NEW` explicito antes do UPDATE — é conciliação do caixa declarado
// na abertura, não movimento. Ver
// sql/2026-10-08_transferencias_e_ajustes_nas_movimentacoes.sql.

export interface MovimentoCategoria {
  tipo: 'RECEBER' | 'PAGAR' | 'AJUSTE' | string;
  categoria: string;
  qtd: number;
  total: number;
}

export interface LinhaMovimentacao {
  financeiro_id: string;
  /** Da liquidação quando há; senão `data_lancamento`, a única que existe. */
  data_operacional: string;
  data_lancamento: string | null;
  /** Falso é o caso que o usuário não lembra de ter feito. */
  tem_liquidacao: boolean;
  quando: string;
  rota_nome: string;
  conta_nome: string;
  /** A outra ponta da transferência. Nulo nos outros tipos. */
  contraparte: string | null;
  /**
   * Os quatro de `financeiro.tipo`, e a transferência desdobrada em
   * `TRANSF_SAIU` e `TRANSF_ENTROU` — uma linha por ponta que está no escopo,
   * porque as duas contas realmente se moveram.
   */
  tipo: string;
  categoria: string;
  descricao: string | null;
  cliente_nome: string | null;
  forma_pagamento: string | null;
  /**
   * Vem para a tela porque `TRANSFERENCIA` e `AJUSTE` movem saldo com
   * qualquer status — quem confere precisa ver um não-`PAGO` que mexeu no
   * caixa.
   */
  status: string;
  /** `AJUSTE` guarda o sinal; os outros são positivos e o tipo diz a direção. */
  valor: number;
}

export interface TotaisMovimentacoes {
  entradas: number;
  saidas: number;
  /** Líquido: entrou menos saiu. Zero quando a transferência foi interna. */
  transferencias: number;
  transf_entrou: number;
  transf_saiu: number;
  ajustes: number;
  aportes: number;
  registros: number;
  /** Lançamento que não passou por liquidação nenhuma. */
  sem_liquidacao: number;
  sem_liquidacao_valor: number;
}

export interface MovimentacoesPeriodo {
  sucesso: boolean;
  mensagem?: string;
  de: string;
  ate: string;
  tipo_conta?: 'ROTA' | 'MICROSEGURO';
  total_registros: number;
  limite: number;
  offset: number;
  totais: TotaisMovimentacoes | null;
  por_categoria: MovimentoCategoria[];
  linhas: LinhaMovimentacao[];
}

export interface FiltrosMovimentacoes {
  busca?: string;
  tipo?: string;
  categoria?: string;
  limite?: number;
  offset?: number;
  /** `ROTA` para o card de movimentações, `MICROSEGURO` para o do microseguro. */
  tipoConta?: 'ROTA' | 'MICROSEGURO';
}
