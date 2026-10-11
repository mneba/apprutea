'use client';

// =====================================================================
// RELATÓRIO: LIQUIDAÇÃO POR PERÍODO
// =====================================================================
//
// Substitui as abas "Liquidacion" e "Resumen" do sistema legado — elas
// mostram o mesmo dado em granularidades diferentes.
//
// A ANATOMIA, decidida com o cliente em 08/10/2026 depois de três tentativas:
//
//   INDICADORES no topo, largura cheia. O cenário do período: quantos dias,
//     quantas rotas, quantos clientes, caixa e carteira nas duas pontas. É
//     contexto — não se clica.
//   TOTALIZADORES na lateral, 250px fixos. Cobrança, Venda, Lucro,
//     Microseguro e Movimentações. São eles que mandam na lista.
//   PALCO com a listagem do totalizador escolhido, sempre em largura cheia.
//
// A PÁGINA É TRAVADA e só a listagem rola, como a tela do Financeiro. Por
// isso cada camada flexível leva `min-h-0`: sem ele o filho cresce além do
// pai e a rolagem escapa para a página inteira.
//
// NADA ABRE POR CIMA. Até 08/10/2026 cada total abria um modal de tela cheia.
// Saiu por pedido do cliente: sobreposição esconde o que ficou atrás e obriga
// a fechar para comparar dois números.
//
// A LATERAL FICA À ESQUERDA porque aqui ela é CONTROLE — você escolhe o que
// ver. No Financeiro a coluna da direita é consequência (saldos, categorias),
// e por isso lá ela vem depois da lista.
//
// AS ROTAS SÃO PASTILHAS QUE LIGAM E DESLIGAM, e desligar refaz a consulta.
// É o jeito mais curto de comparar rotas sem gerar o relatório de novo. Cada
// pastilha carrega o próprio cobrado, para dar o peso antes de tirar.
//
// NÃO HÁ GRÁFICO DE COBRADO CONTRA EMPRESTADO. São fluxos diferentes, e
// barras lado a lado convidam a uma comparação que não significa nada.
//
// NÃO HÁ PERCENTUAL NO PERÍODO. Somar o esperado ao longo de semanas mistura
// coisas que não se comparam: a parcela que vencia no dia 3 e foi paga no dia
// 10 entra nos dois lados; a que vence no dia 30 entra só num. Numa rota real
// deu 107%, com dias de 231% e 419%. No dia a dia os dois campos ficam, porque
// ali significam o que o vendedor entende.
//
// Nenhuma conta acontece aqui: tudo vem de `fn_liquidacoes_periodo`, inclusive
// o que NÃO somar. Ver sql/2026-10-01_fn_liquidacoes_periodo.sql e os scripts
// de 2026-10-07 e 2026-10-08.

import {
  ArrowDownToLine, ArrowLeft, ArrowRightLeft, ArrowUpFromLine, Calendar,
  ChevronDown, Download, Globe, Loader2, MapPin, Shield, TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AjudaRelatorio, { type SecaoAjuda } from '@/components/relatorios/AjudaRelatorio';
import ArvoreEscopo from '@/components/relatorios/ArvoreEscopo';
import PainelCobranca from '@/components/relatorios/PainelCobranca';
import PainelLucro from '@/components/relatorios/PainelLucro';
import PainelMovimentacoes from '@/components/relatorios/PainelMovimentacoes';
import PainelVendas from '@/components/relatorios/PainelVendas';
import SeletorPeriodo from '@/components/relatorios/SeletorPeriodo';
import { Link } from '@/i18n/routing';
import { relatoriosService } from '@/services/relatorios';
import type { EstruturaVisivel, LiquidacoesPeriodo, RotaNo, RotaPeriodo } from '@/types/relatorios';
import { baixarCsv, numCsv } from '@/utils/csv';

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const int = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR');

/** `YYYY-MM-DD` → `DD/MM`. Sem `new Date`: evita o recuo de fuso. */
const diaCurto = (d: string) => {
  const [, m, dd] = d.substring(0, 10).split('-');
  return `${dd}/${m}`;
};

/**
 * O dia da semana de um `YYYY-MM-DD`.
 *
 * `Date.UTC` e `getUTCDay`, nunca `new Date(iso)` seguido de `getDay`: o parse
 * de string ISO dá meia-noite UTC e, na Colômbia (UTC−5), `getDay` devolve o
 * dia ANTERIOR — uma segunda viraria domingo e a coluna inteira mentiria.
 */
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const diaSemana = (d: string) => {
  const [a, m, dd] = d.substring(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dd)).getUTCDay();
};

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const primeiroDoMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

/** Todas as rotas da árvore, achatadas, para resolver nome e vendedor. */
const achatar = (e: EstruturaVisivel | null): RotaNo[] =>
  (e?.paises ?? []).flatMap((p) =>
    p.estados.flatMap((es) =>
      es.cidades.flatMap((c) => c.empresas.flatMap((em) => em.rotas))
    )
  );

/** Cor da barra de atingido, na mesma escala da tela de Liquidação Diária. */
const corPct = (p: number) =>
  p >= 100 ? 'bg-emerald-500' : p >= 70 ? 'bg-blue-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-500';

type Aba = 'dia' | 'cobranca' | 'venda' | 'lucro' | 'micro' | 'mov';

/**
 * A ajuda deste relatório.
 *
 * Não explica botão: explica o que o número significa, o que ele NÃO
 * significa, e as armadilhas que já custaram tempo. Quem souber isto lê o
 * relatório sozinho.
 */
const AJUDA: SecaoAjuda[] = [
  {
    titulo: 'O que este relatório responde',
    itens: [
      'Consolida as liquidações diárias de um intervalo, de uma rota ao país inteiro. Substitui as abas Liquidacion e Resumen do sistema antigo, que mostravam o mesmo dado em granularidades diferentes.',
      '**Quanto a rota cobrou, emprestou e lucrou** no período, com o caixa e a carteira nas duas pontas.',
    ],
  },
  {
    titulo: 'Como ler',
    itens: [
      '**Cobrança e venda não se comparam.** São fluxos diferentes: um é dinheiro que volta, o outro é dinheiro que sai. Cobrar mais que emprestar não é bom nem ruim por si — depende do tamanho da carteira.',
      '**Lucro é juro RECEBIDO, não a diferença entre os dois.** É a parte de juro dentro do que foi efetivamente abatido no período. Por isso a margem é sobre o cobrado.',
      '**Caixa e carteira são do último dia de cada rota, somados entre rotas.** Nunca somam entre dias — somar o caixa de segunda com o de terça daria um número que nunca existiu.',
      '**Clientes ativos é a BASE, clientes pagos é o MOVIMENTO.** O primeiro conta pessoas nas rotas; o segundo conta atendimentos, e soma entre dias — o mesmo cliente pago em dez dias conta dez.',
    ],
  },
  {
    titulo: 'Onde ele engana',
    itens: [
      '**Não existe percentual atingido no período, de propósito.** Somar o esperado ao longo de semanas mistura coisas que não se comparam: a parcela que vencia no dia 3 e foi paga no dia 10 entra nos dois lados. Numa rota real deu 107%, com dias de 231% e 419%. No dia a dia o percentual fica, porque ali significa o que o vendedor entende.',
      '**Aporte não é cobrança.** O capital que entra para a rota começar aparece em linha própria, nunca no cobrado. Até 09/10/2026 entrava — a Rosy chegou a mostrar 10.324,00 cobrados num dia em que cobrou 324,00.',
      '**Transferência não entra no resultado.** Ela sai de uma conta e entra em outra: o resultado do período é o mesmo com ou sem ela.',
      '**Dia com dinheiro e sem liquidação aparece marcado no fim do dia a dia.** Ele não conta como dia trabalhado, e é por isso que o total do período pode não fechar com a soma das linhas. Está escrito na tela justamente para não virar dúvida.',
      '**Microseguro é conta separada da rota.** A venda cai na conta dele e por isso não aparece em entradas; a retirada sai dela para a conta da rota.',
    ],
  },
  {
    titulo: 'Boas práticas',
    itens: [
      '**Compare meses fechados.** Mês corrente contra mês cheio sempre parece queda.',
      '**Desmarque rotas para isolar.** As pastilhas no topo tiram e devolvem rotas do cálculo sem gerar de novo — é o jeito mais curto de achar qual rota puxou o resultado.',
      '**O CSV traz colunas que a tela esconde.** Transferências, ajustes e microseguro vão sempre no arquivo, mesmo zerados, para empilhar dois períodos numa planilha sem o cabeçalho mudar.',
      '**Clique nos totalizadores.** Cada número É a lista somada — e a lista explica o número.',
    ],
  },
];


/** Um indicador da faixa do topo: rótulo miúdo em cima, valor embaixo. */
function Indicador({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 basis-[140px] px-3.5 py-2 border-r border-gray-100 last:border-r-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 truncate">
        {rotulo}
      </span>
      <span className="block text-[14.5px] font-semibold tabular-nums">{children}</span>
    </div>
  );
}

/**
 * Um totalizador da lateral. É a manchete do período e ao mesmo tempo o
 * controle do palco — por isso o valor fica grande mesmo numa coluna estreita.
 */
function Totalizador({
  icone: Icone, selo, nome, valor, par, sub, ativo, corValor, onClick,
}: {
  icone: React.ElementType;
  selo: string;
  nome: string;
  valor?: string;
  par?: [string, string];
  sub: string;
  ativo: boolean;
  corValor?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`w-full grid grid-cols-[28px_1fr] gap-x-2 items-center px-3 py-2 text-left border-b border-gray-100 last:border-b-0 ${
        ativo ? 'bg-blue-50 shadow-[inset_3px_0_0_#2563eb]' : 'hover:bg-gray-50'
      }`}
    >
      <span className={`w-7 h-7 rounded-md flex items-center justify-center ${selo}`}>
        <Icone className="w-3.5 h-3.5" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
        {nome}
      </span>
      {par ? (
        <span className="col-start-2 flex gap-2.5 items-baseline">
          <b className="text-[14px] font-bold text-emerald-700 tabular-nums">{par[0]}</b>
          <b className="text-[14px] font-bold text-amber-700 tabular-nums">{par[1]}</b>
        </span>
      ) : (
        <span className={`col-start-2 text-[17px] font-bold tabular-nums leading-tight ${corValor ?? 'text-gray-900'}`}>
          {valor}
        </span>
      )}
      <span className="col-start-2 text-[10.5px] text-gray-400 truncate">{sub}</span>
    </button>
  );
}

export default function LiquidacaoPeriodoPage() {
  const [estrutura, setEstrutura] = useState<EstruturaVisivel | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [de, setDe] = useState(primeiroDoMes());
  const [ate, setAte] = useState(hojeIso());

  const [dados, setDados] = useState<LiquidacoesPeriodo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('dia');
  const [escopoAberto, setEscopoAberto] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const caixaEscopo = useRef<HTMLDivElement>(null);

  // O recorte usado na última geração, não o marcado agora. Sem isso, mexer na
  // árvore trocaria o conteúdo da lista sem o relatório ter sido refeito.
  const [escopoGerado, setEscopoGerado] = useState<{ rotas: string[]; de: string; ate: string } | null>(null);

  /**
   * As rotas que estão ENTRANDO NA CONTA agora — subconjunto do que foi
   * gerado. Desligar uma pastilha tira da conta sem tirar do escopo, para a
   * lista de comparação ficar estável enquanto se compara.
   */
  const [rotasAtivas, setRotasAtivas] = useState<Set<string>>(new Set());

  /**
   * Os números POR ROTA da geração cheia, guardados.
   *
   * É o que permite a pastilha desligada continuar mostrando o seu cobrado: a
   * consulta do subconjunto só devolve as rotas ativas, e sem esta cópia a
   * pastilha desligada ficaria sem número justamente quando se quer comparar.
   */
  const [porRotaBase, setPorRotaBase] = useState<RotaPeriodo[]>([]);

  useEffect(() => {
    (async () => setEstrutura(await relatoriosService.buscarEstrutura()))();
  }, []);

  // O popover fecha ao clicar fora ou com Esc. Sem isso ele fica preso aberto
  // sobre a tela, e a árvore de 52 rotas é alta.
  useEffect(() => {
    if (!escopoAberto) return;
    const fora = (ev: MouseEvent) => {
      if (caixaEscopo.current && !caixaEscopo.current.contains(ev.target as Node)) {
        setEscopoAberto(false);
      }
    };
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setEscopoAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [escopoAberto]);

  const todasAsRotas = useMemo(() => achatar(estrutura), [estrutura]);

  // O rótulo do botão de escopo. Nome quando dá para nomear, contagem quando
  // são muitas — "23 rotas" diz mais que uma lista cortada no meio.
  const rotuloEscopo = useMemo(() => {
    if (selecionadas.size === 0) return 'Selecione o escopo';
    if (selecionadas.size === todasAsRotas.length) return 'Tudo';
    if (selecionadas.size === 1) {
      const r = todasAsRotas.find((x) => selecionadas.has(x.rota_id));
      return r?.nome ?? '1 rota';
    }
    const paisCheio = (estrutura?.paises ?? []).find((p) => {
      const ids = p.estados.flatMap((e) =>
        e.cidades.flatMap((c) => c.empresas.flatMap((em) => em.rotas.map((r) => r.rota_id)))
      );
      return ids.length === selecionadas.size && ids.every((i) => selecionadas.has(i));
    });
    return paisCheio ? paisCheio.pais : `${selecionadas.size} rotas`;
  }, [selecionadas, todasAsRotas, estrutura]);

  /** As rotas do recorte gerado, com nome e o cobrado de cada uma. */
  const rotasDoEscopo = useMemo(() => {
    if (!escopoGerado) return [];
    const nomes = new Map(todasAsRotas.map((r) => [r.rota_id, r]));
    const valores = new Map(porRotaBase.map((r) => [r.rota_id, r]));
    return escopoGerado.rotas
      .map((id) => ({
        id,
        nome: nomes.get(id)?.nome ?? valores.get(id)?.rota_nome ?? 'Rota',
        vendedor: nomes.get(id)?.vendedor_nome ?? null,
        cobrado: valores.get(id)?.recebido ?? 0,
      }))
      .sort((a, b) => b.cobrado - a.cobrado || a.nome.localeCompare(b.nome));
  }, [escopoGerado, todasAsRotas, porRotaBase]);

  /**
   * O array de rotas ativas, com referência estável.
   *
   * As listagens recebem isto em `rotaIds` e refazem a consulta quando ele
   * muda. Um array novo a cada render faria cada listagem consultar em laço —
   * por isso a chave de texto no meio.
   */
  const chaveAtivas = useMemo(
    () => Array.from(rotasAtivas).sort().join(','),
    [rotasAtivas]
  );
  const rotasAtivasArr = useMemo(
    () => (chaveAtivas ? chaveAtivas.split(',') : []),
    [chaveAtivas]
  );

  const podeGerar = selecionadas.size > 0 && !!de && !!ate && ate >= de && !carregando;

  /** Consulta o consolidado para um conjunto de rotas. */
  const consultar = useCallback(async (rotas: string[], dd: string, aa: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await relatoriosService.buscarLiquidacoesPeriodo(rotas, dd, aa);
      if (!r || !r.sucesso) {
        setErro(r?.mensagem || 'Não foi possível gerar o relatório.');
        setDados(null);
        return null;
      }
      setDados(r);
      return r;
    } finally {
      setCarregando(false);
    }
  }, []);

  const gerar = useCallback(async () => {
    if (selecionadas.size === 0) return;
    const rotas = Array.from(selecionadas);
    const r = await consultar(rotas, de, ate);
    if (!r) {
      setEscopoGerado(null);
      setPorRotaBase([]);
      setRotasAtivas(new Set());
      return;
    }
    setEscopoGerado({ rotas, de, ate });
    setRotasAtivas(new Set(rotas));
    // Guarda o por-rota da geração CHEIA: é a referência das pastilhas, e não
    // pode encolher quando o usuário desliga uma rota.
    setPorRotaBase(r.por_rota);
  }, [selecionadas, de, ate, consultar]);

  /** Liga ou desliga uma rota e refaz a conta. */
  const alternarRota = useCallback(async (id: string) => {
    if (!escopoGerado) return;
    const proximas = new Set(rotasAtivas);
    if (proximas.has(id)) proximas.delete(id); else proximas.add(id);
    setRotasAtivas(proximas);
    if (proximas.size === 0) { setDados(null); return; }
    await consultar(Array.from(proximas), escopoGerado.de, escopoGerado.ate);
  }, [escopoGerado, rotasAtivas, consultar]);

  const marcarTodas = useCallback(async (todas: boolean) => {
    if (!escopoGerado) return;
    const proximas = todas ? new Set(escopoGerado.rotas) : new Set<string>();
    setRotasAtivas(proximas);
    if (!todas) { setDados(null); return; }
    await consultar(escopoGerado.rotas, escopoGerado.de, escopoGerado.ate);
  }, [escopoGerado, consultar]);

  const c = dados?.consolidado ?? null;
  const margem = c && c.recebido > 0 ? (c.ganancia / c.recebido) * 100 : 0;

  /**
   * Transferência, ajuste, aporte e microseguro são raros: a maioria dos
   * períodos não tem nenhum. Coluna de zeros ocupa largura que as outras
   * precisam e some do olhar, por isso só aparecem quando há. No CSV vão
   * sempre — planilha com cabeçalho variável quebra quem empilha dois
   * períodos.
   */
  const temTransferencia = (dados?.por_dia ?? []).some((d) => d.transferencias !== 0);
  const temAjuste = (dados?.por_dia ?? []).some((d) => d.ajustes !== 0);
  const temAporte = (c?.aportes ?? 0) !== 0;
  const temMicro = (c?.microseguro_vendas ?? 0) !== 0 || (c?.microseguro_retiradas ?? 0) !== 0;

  /**
   * Dias com dinheiro e sem liquidação. Entram na tabela do dia a dia como
   * linha marcada, mas fora de `por_dia` — logo não contaminam
   * `dias_trabalhados` nem a média diária, que significam "dia em que a rota
   * trabalhou".
   */
  const semLiq = dados?.dias_sem_liquidacao ?? [];

  /** Colunas do dia a dia que só existem quando houve liquidação. */
  const COLUNAS_DA_LIQUIDACAO = 11;

  const exportarDias = () => {
    if (!dados) return;
    baixarCsv(
      `liquidacao_${escopoGerado?.de ?? de}_a_${escopoGerado?.ate ?? ate}`,
      [
        { cabecalho: 'Data', valor: (d) => d.data },
        { cabecalho: 'Rotas', valor: (d) => d.rotas },
        { cabecalho: 'Cobrado', valor: (d) => numCsv(d.recebido) },
        { cabecalho: 'Esperado do dia', valor: (d) => numCsv(d.esperado) },
        { cabecalho: 'Atingido %', valor: (d) => numCsv(d.percentual_recebimento) },
        { cabecalho: 'Emprestado', valor: (d) => numCsv(d.emprestado) },
        { cabecalho: 'Lucro', valor: (d) => numCsv(d.ganancia) },
        { cabecalho: 'Empréstimos', valor: (d) => d.qtd_emprestimos },
        { cabecalho: 'Pagos', valor: (d) => d.clientes_pagos },
        { cabecalho: 'Não pagos', valor: (d) => d.clientes_nao_pagos },
        { cabecalho: 'Caixa inicial', valor: (d) => numCsv(d.caixa_inicial) },
        { cabecalho: 'Caixa final', valor: (d) => numCsv(d.caixa_final) },
        { cabecalho: 'Carteira inicial', valor: (d) => numCsv(d.carteira_inicial) },
        { cabecalho: 'Carteira final', valor: (d) => numCsv(d.carteira) },
        { cabecalho: 'Entradas', valor: (d) => numCsv(d.entradas) },
        { cabecalho: 'Saídas', valor: (d) => numCsv(d.saidas) },
        { cabecalho: 'Transferências', valor: (d) => numCsv(d.transferencias) },
        { cabecalho: 'Ajustes', valor: (d) => numCsv(d.ajustes) },
        { cabecalho: 'Microseguro vendas', valor: (d) => numCsv(d.microseguro_vendas) },
        { cabecalho: 'Microseguro retiradas', valor: (d) => numCsv(d.microseguro_retiradas) },
        { cabecalho: 'Aporte', valor: (d) => numCsv(d.aportes) },
      ],
      dados.por_dia
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-2.5">

      {/* ── CABEÇALHO ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-start gap-2.5">
          <Link
            href="/relatorios"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 mt-1"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-[22px] font-bold text-gray-900 leading-tight">
                Liquidação por período
              </h1>
              <AjudaRelatorio
                titulo="Liquidação por período"
                secoes={AJUDA}
                aberta={ajudaAberta}
                onAbrir={() => setAjudaAberta(true)}
                onFechar={() => setAjudaAberta(false)}
              />
            </div>
            {/* "Exibindo:", como na tela do Financeiro. O popover da árvore
                escolhe o escopo; as pastilhas abaixo ligam e desligam. */}
            <div className="relative mt-0.5" ref={caixaEscopo}>
              <button
                onClick={() => setEscopoAberto((v) => !v)}
                aria-expanded={escopoAberto}
                className="flex items-center gap-1.5 text-[13.5px] font-medium text-blue-600 hover:text-blue-700 max-w-[320px]"
              >
                <Globe className="w-4 h-4 flex-shrink-0" />
                <span className="text-gray-500">Exibindo:</span>
                <span className="truncate">{rotuloEscopo}</span>
                {selecionadas.size > 0 && (
                  <span className="text-[11px] font-bold px-1.5 rounded-full bg-blue-50 tabular-nums">
                    {selecionadas.size}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </button>

              {escopoAberto && (
                <div className="absolute z-30 mt-1 w-[380px] max-w-[90vw] bg-white rounded-lg border border-gray-200 shadow-xl p-3">
                  {!estrutura ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Carregando estrutura…
                    </div>
                  ) : (
                    <ArvoreEscopo
                      estrutura={estrutura}
                      selecionadas={selecionadas}
                      onChange={setSelecionadas}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <SeletorPeriodo de={de} ate={ate} onChange={(d, a) => { setDe(d); setAte(a); }} compacto />
          <button
            onClick={gerar}
            disabled={!podeGerar}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-[13.5px] font-medium hover:bg-blue-700 disabled:bg-blue-200 disabled:cursor-not-allowed"
          >
            {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
            {carregando ? 'Gerando…' : 'Gerar'}
          </button>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex-shrink-0">
          {erro}
        </div>
      )}

      {!escopoGerado && !erro && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-2">
          <Calendar className="w-10 h-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            Escolha o escopo e o período, e clique em <b>Gerar</b>.
          </p>
        </div>
      )}

      {escopoGerado && (
        <>
          {/* ── ROTAS E INDICADORES ── */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
            {/* As pastilhas: escopo que liga e desliga. Desligada fica
                tracejada e com o número riscado — não some, para a lista de
                comparação ficar estável enquanto se compara. */}
            {rotasDoEscopo.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mr-0.5">
                  Rotas
                </span>
                {rotasDoEscopo.map((r) => {
                  const ligada = rotasAtivas.has(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => alternarRota(r.id)}
                      aria-pressed={ligada}
                      title={
                        (r.vendedor ? `${r.nome} (${r.vendedor})` : r.nome) +
                        (ligada ? ' — clique para tirar do cálculo' : ' — clique para trazer de volta')
                      }
                      className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border text-[12px] ${
                        ligada
                          ? 'bg-white border-gray-200 text-gray-900 hover:border-gray-400'
                          : 'bg-gray-50 border-dashed border-gray-300 text-gray-400'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ligada ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span className="truncate max-w-[180px]">{r.nome}</span>
                      <b className={`tabular-nums ${ligada ? '' : 'line-through opacity-70'}`}>
                        {fmt(r.cobrado)}
                      </b>
                    </button>
                  );
                })}
                <span className="ml-auto flex gap-1.5">
                  <button
                    onClick={() => marcarTodas(true)}
                    className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => marcarTodas(false)}
                    className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  >
                    Nenhuma
                  </button>
                </span>
              </div>
            )}

            <div className={`flex flex-wrap ${rotasDoEscopo.length > 1 ? 'border-t border-gray-100' : ''}`}>
              <Indicador rotulo="Período">
                {diaCurto(escopoGerado.de)} <span className="text-gray-400">a</span> {diaCurto(escopoGerado.ate)}
              </Indicador>
              <Indicador rotulo="Dias trabalhados">{c ? c.dias_trabalhados : '—'}</Indicador>
              <Indicador rotulo="Rotas">{c ? c.rotas_com_movimento : 0}</Indicador>
              <Indicador rotulo="Clientes">
                {c ? int(c.clientes_ativos) : 0}{' '}
                <small className="text-[11px] font-medium text-gray-400">
                  ativos · {c ? int(c.clientes_suspensos) : 0} susp.
                </small>
              </Indicador>
              <Indicador rotulo="Caixa">
                {fmt(c?.caixa_inicial)} <span className="text-gray-400">→</span> {fmt(c?.caixa_final)}
              </Indicador>
              <Indicador rotulo="Carteira">
                <span className="text-violet-700">
                  {fmt(c?.carteira_inicial)} <span className="text-gray-400">→</span> {fmt(c?.carteira)}
                </span>
              </Indicador>
            </div>
          </div>

          {/* ── LATERAL DE CONTROLE + PALCO ── */}
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-2.5">

            <div className="min-h-0 overflow-y-auto">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </span>
                  <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Totais</h2>
                </div>

                <Totalizador
                  icone={Calendar} selo="bg-emerald-50 text-emerald-600"
                  nome="Dia a dia"
                  valor={`${c ? c.dias_trabalhados : 0} dias`}
                  sub={`${rotasAtivas.size} rota(s) no cálculo`}
                  ativo={aba === 'dia'} onClick={() => setAba('dia')}
                />
                <Totalizador
                  icone={ArrowDownToLine} selo="bg-emerald-50 text-emerald-600"
                  nome="Cobrança" valor={fmt(c?.recebido)}
                  sub={`${int(c?.clientes_pagos)} atendidos · ${int(c?.clientes_nao_pagos)} não pagos`}
                  ativo={aba === 'cobranca'} onClick={() => setAba('cobranca')}
                />
                <Totalizador
                  icone={ArrowUpFromLine} selo="bg-blue-50 text-blue-600"
                  nome="Venda" valor={fmt(c?.emprestado)}
                  sub={`${int(c?.qtd_emprestimos)} empréstimos · ${int(c?.clientes_novos)} novos`}
                  ativo={aba === 'venda'} onClick={() => setAba('venda')}
                />
                <Totalizador
                  icone={TrendingUp} selo="bg-emerald-50 text-emerald-600"
                  nome="Lucro" valor={fmt(c?.ganancia)} corValor="text-emerald-700"
                  sub={`${margem.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% do cobrado`}
                  ativo={aba === 'lucro'} onClick={() => setAba('lucro')}
                />
                {/* Microseguro é CONTA SEPARADA da rota, não apêndice das
                    movimentações: a venda cai nela e a retirada sai dela para a
                    conta da rota. Por isso é totalizador par de Cobrança, e
                    com as duas cifras na linha. */}
                {temMicro && (
                  <Totalizador
                    icone={Shield} selo="bg-amber-50 text-amber-600"
                    nome="Microseguro"
                    par={[`+${fmt(c?.microseguro_vendas)}`, `−${fmt(c?.microseguro_retiradas)}`]}
                    sub="conta própria · vendas e retiradas"
                    ativo={aba === 'micro'} onClick={() => setAba('micro')}
                  />
                )}
                <Totalizador
                  icone={ArrowRightLeft} selo="bg-purple-50 text-purple-600"
                  nome="Movimentações"
                  valor={`${fmt((c?.entradas ?? 0) - (c?.saidas ?? 0))}`}
                  corValor={(c?.entradas ?? 0) - (c?.saidas ?? 0) < 0 ? 'text-red-700' : 'text-emerald-700'}
                  sub={
                    [
                      temTransferencia ? 'transferências' : null,
                      temAjuste ? 'ajustes' : null,
                      temAporte ? 'aporte' : null,
                    ].filter(Boolean).join(', ') || 'despesas e entradas'
                  }
                  ativo={aba === 'mov'} onClick={() => setAba('mov')}
                />
              </div>
            </div>

            {/* O PALCO. Uma listagem de cada vez, em largura cheia. */}
            <div className="min-h-0">
              {rotasAtivas.size === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col items-center justify-center text-center gap-2">
                  <MapPin className="w-9 h-9 text-gray-300" />
                  <p className="text-sm text-gray-500">Marque ao menos uma rota acima.</p>
                </div>
              ) : aba === 'dia' ? (
                <div className="bg-white rounded-lg border border-gray-200 h-full min-h-0 flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-gray-100 flex-shrink-0">
                    <span className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Calendar className="w-3.5 h-3.5" />
                    </span>
                    <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Dia a dia</h2>
                    <span className="text-[11.5px] text-gray-400">
                      {dados?.por_dia.length ?? 0} dias com liquidação
                    </span>
                    {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
                    <button
                      onClick={exportarDias}
                      disabled={!dados?.por_dia.length}
                      className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  </div>

                  <div className="flex-1 min-h-0 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-400 sticky top-0 z-[1]">
                        <tr>
                          <th className="text-left font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Data</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Cobrado</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Esperado</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Atingido</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Emprestado</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Lucro</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Pagos</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Não pagos</th>
                          {/* Caixa e carteira nas duas pontas do dia. O cliente
                              pediu em 07/10/2026: só o final estava aqui, e
                              saldo sem o de onde partiu não diz se o dia subiu
                              ou desceu. */}
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Caixa ini.</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Caixa fim</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Carteira ini.</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Carteira fim</th>
                          {temTransferencia && (
                            <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Transf.</th>
                          )}
                          {temAjuste && (
                            <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Ajustes</th>
                          )}
                          {temMicro && (
                            <>
                              <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Micro. vendas</th>
                              <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Micro. retir.</th>
                            </>
                          )}
                          {temAporte && (
                            <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Aporte</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(dados?.por_dia ?? []).map((d) => {
                          const dom = diaSemana(d.data) === 0;
                          return (
                            <tr key={d.data} className="hover:bg-gray-50">
                              {/* O dia da semana na frente do dia do mês: sem
                                  ele, ler uma queda de cobrança exige contar no
                                  calendário. Domingo em vermelho discreto — na
                                  maioria das rotas `trabalha_domingo` é falso, e
                                  o dia aparecer fraco já explica o número baixo
                                  sem precisar de nota. */}
                              <td className="px-3 py-1.5 whitespace-nowrap">
                                <span className={`text-[11px] font-semibold mr-1.5 ${dom ? 'text-rose-600' : 'text-gray-400'}`}>
                                  {SEMANA[diaSemana(d.data)]}
                                </span>
                                <span className={dom ? 'text-rose-700' : 'text-gray-900'}>
                                  {diaCurto(d.data)}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right font-semibold text-gray-900 tabular-nums">{fmt(d.recebido)}</td>
                              <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">{fmt(d.esperado)}</td>
                              <td className="px-3 py-1.5 text-right">
                                <span className="inline-flex items-center gap-2 justify-end">
                                  <span className="w-10 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                                    <span
                                      className={`block h-full ${corPct(d.percentual_recebimento)}`}
                                      style={{ width: `${Math.min(100, d.percentual_recebimento)}%` }}
                                    />
                                  </span>
                                  <span className="tabular-nums text-gray-500 text-[12px] w-12 text-right">
                                    {d.esperado > 0 ? `${d.percentual_recebimento.toFixed(0)}%` : '—'}
                                  </span>
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right text-gray-900 tabular-nums">{fmt(d.emprestado)}</td>
                              <td className="px-3 py-1.5 text-right text-emerald-700 tabular-nums">{fmt(d.ganancia)}</td>
                              <td className="px-3 py-1.5 text-right text-gray-500 tabular-nums">{int(d.clientes_pagos)}</td>
                              <td className={`px-3 py-1.5 text-right tabular-nums ${d.clientes_nao_pagos ? 'text-red-600' : 'text-gray-300'}`}>
                                {int(d.clientes_nao_pagos)}
                              </td>
                              <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">{fmt(d.caixa_inicial)}</td>
                              <td className="px-3 py-1.5 text-right text-gray-500 tabular-nums">{fmt(d.caixa_final)}</td>
                              <td className="px-3 py-1.5 text-right text-gray-400 tabular-nums">{fmt(d.carteira_inicial)}</td>
                              <td className="px-3 py-1.5 text-right text-violet-700 tabular-nums">{fmt(d.carteira)}</td>
                              {temTransferencia && (
                                <td className="px-3 py-1.5 text-right text-amber-700 tabular-nums">
                                  {d.transferencias ? fmt(d.transferencias) : '—'}
                                </td>
                              )}
                              {temAjuste && (
                                <td className="px-3 py-1.5 text-right text-blue-700 tabular-nums">
                                  {d.ajustes ? fmt(d.ajustes) : '—'}
                                </td>
                              )}
                              {temMicro && (
                                <>
                                  <td className="px-3 py-1.5 text-right text-emerald-700 tabular-nums">
                                    {d.microseguro_vendas ? fmt(d.microseguro_vendas) : '—'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-amber-800 tabular-nums">
                                    {d.microseguro_retiradas ? fmt(d.microseguro_retiradas) : '—'}
                                  </td>
                                </>
                              )}
                              {temAporte && (
                                <td className="px-3 py-1.5 text-right text-violet-700 tabular-nums">
                                  {d.aportes ? fmt(d.aportes) : '—'}
                                </td>
                              )}
                            </tr>
                          );
                        })}

                        {/* DIAS COM DINHEIRO E SEM LIQUIDAÇÃO.

                            Pedido de 08/10/2026, com a razão dele: "o usuário
                            vai esquecer, e vai questionar divergências que ele
                            mesmo causou e não se lembra". Sem estas linhas, o
                            total do período seria maior que a soma dos dias e
                            nada na tela explicaria por quê.

                            Ficam no fim e marcadas, não intercaladas: não são
                            dia de trabalho da rota, e as colunas da liquidação
                            não existem para elas — não houve cobrança, nem
                            caixa, nem carteira. */}
                        {semLiq.map((d) => (
                          <tr key={`sl-${d.data}`} className="bg-amber-50/60">
                            <td className="px-3 py-1.5 whitespace-nowrap">
                              <span className="text-[11px] font-semibold mr-1.5 text-gray-400">
                                {SEMANA[diaSemana(d.data)]}
                              </span>
                              <span className="text-gray-900">{diaCurto(d.data)}</span>
                              <span className="block text-[10px] font-bold uppercase text-amber-700">
                                sem liquidação
                              </span>
                            </td>
                            <td colSpan={COLUNAS_DA_LIQUIDACAO} className="px-3 py-1.5 text-[11.5px] text-amber-800">
                              Dinheiro lançado em dia sem liquidação aberta — não entra em nenhum
                              dia fechado, e por isso o total do período não fecha com a soma dos
                              dias acima.
                              <span className="ml-1 tabular-nums text-gray-600">
                                {d.entradas !== 0 && <> entradas <b>{fmt(d.entradas)}</b></>}
                                {d.saidas !== 0 && <> · saídas <b>{fmt(d.saidas)}</b></>}
                              </span>
                            </td>
                            {temTransferencia && (
                              <td className="px-3 py-1.5 text-right text-amber-700 tabular-nums">
                                {d.transferencias ? fmt(d.transferencias) : '—'}
                              </td>
                            )}
                            {temAjuste && (
                              <td className="px-3 py-1.5 text-right text-blue-700 tabular-nums">
                                {d.ajustes ? fmt(d.ajustes) : '—'}
                              </td>
                            )}
                            {temMicro && (
                              <>
                                <td className="px-3 py-1.5 text-right text-emerald-700 tabular-nums">
                                  {d.microseguro_vendas ? fmt(d.microseguro_vendas) : '—'}
                                </td>
                                <td className="px-3 py-1.5 text-right text-amber-800 tabular-nums">
                                  {d.microseguro_retiradas ? fmt(d.microseguro_retiradas) : '—'}
                                </td>
                              </>
                            )}
                            {temAporte && (
                              <td className="px-3 py-1.5 text-right text-violet-700 tabular-nums">
                                {d.aportes ? fmt(d.aportes) : '—'}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap px-3 py-1.5 border-t border-gray-200 bg-gray-50 text-[11.5px] text-gray-600 flex-shrink-0">
                    <span>{dados?.por_dia.length ?? 0} dia(s) com liquidação</span>
                    <span className="ml-auto flex items-center gap-3.5">
                      <span className="text-emerald-700 font-semibold tabular-nums">
                        cobrado {fmt(c?.recebido)}
                      </span>
                      <span className="text-red-600 font-semibold tabular-nums">
                        não pagos {int(c?.clientes_nao_pagos)}
                      </span>
                      <span className="text-gray-500 tabular-nums">
                        média {fmt(c?.media_diaria)} por dia trabalhado
                      </span>
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <PainelCobranca
                    aberto={aba === 'cobranca'}
                    rotaIds={rotasAtivasArr}
                    de={escopoGerado.de}
                    ate={escopoGerado.ate}
                  />
                  <PainelVendas
                    aberto={aba === 'venda'}
                    rotaIds={rotasAtivasArr}
                    de={escopoGerado.de}
                    ate={escopoGerado.ate}
                  />
                  <PainelLucro
                    aberto={aba === 'lucro'}
                    rotaIds={rotasAtivasArr}
                    de={escopoGerado.de}
                    ate={escopoGerado.ate}
                  />
                  {/* A mesma listagem serve as duas contas: a única diferença
                      entre elas é de qual conta o dinheiro saiu ou entrou. A
                      `key` separa os estados de filtro e página. */}
                  <PainelMovimentacoes
                    key="mov-rota"
                    aberto={aba === 'mov'}
                    rotaIds={rotasAtivasArr}
                    de={escopoGerado.de}
                    ate={escopoGerado.ate}
                    tipoConta="ROTA"
                  />
                  <PainelMovimentacoes
                    key="mov-micro"
                    aberto={aba === 'micro'}
                    rotaIds={rotasAtivasArr}
                    de={escopoGerado.de}
                    ate={escopoGerado.ate}
                    tipoConta="MICROSEGURO"
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
