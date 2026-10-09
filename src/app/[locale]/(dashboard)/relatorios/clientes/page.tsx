'use client';

// =====================================================================
// RELATÓRIO: CLIENTES
// =====================================================================
//
// Substitui os DEZ relatórios de clientes do sistema legado — ativos,
// inativos, sem renovar, atrasados, que pagaram, crédito acima de X, por
// interesse, vencidos ou por vencer, históricos e cancelados.
//
// UMA TELA, NÃO DEZ. Os dez diferem só no predicado, e aqui são PRESETS da
// mesma `fn_clientes`. Dez telas seriam dez lugares para manter em sincronia
// — e o usuário nunca conseguiria pedir "atrasados com crédito acima de
// mil", que é o tipo de pergunta que ele faz. Aqui consegue: escolhe
// Atrasados e digita o valor mínimo.
//
// É FOTO NUMA DATA, NÃO PERÍODO. Atraso, carteira em aberto e "sem renovar"
// são ESTADO: "quantos atrasados houve em setembro" não tem resposta única,
// porque o mesmo cliente esteve atrasado em dias diferentes por valores
// diferentes. Por isso o cabeçalho tem UMA data, e não um intervalo. O
// intervalo só aparece no preset "Que pagaram", que é o único de fluxo.
//
// A ANATOMIA é a mesma da liquidação por período, e de propósito: indicadores
// no topo em largura cheia, presets na lateral de 250px, listagem no palco. A
// página é travada e só a listagem rola.
//
// O ATRASO É EM DIAS DE COBRANÇA, contado no Postgres por
// sql/2026-10-09_fn_clientes.sql, que espelha
// apprutea_android/src/utils/diasCobranca.ts. Esta tela não recalcula nada —
// se recalculasse, seria a terceira implementação da mesma regra.

import {
  AlertTriangle, ArrowLeft, Ban, CalendarClock, ChevronDown, Clock, Download,
  Globe, HandCoins, History, Loader2, MapPin, MessageSquare, Percent, Printer,
  TrendingUp, UserMinus, UserX, Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ArvoreEscopo from '@/components/relatorios/ArvoreEscopo';
import { Paginacao } from '@/components/relatorios/ListaRelatorio';
import { Link } from '@/i18n/routing';
import { relatoriosService } from '@/services/relatorios';
import type {
  ClientesRelatorio, EstruturaVisivel, FiltrosClientes, LinhaCliente, RotaNo,
} from '@/types/relatorios';
import { baixarCsv, numCsv } from '@/utils/csv';

// Cinquenta, não cem: com cem quase toda lista cabia numa página só e a
// paginação parecia quebrada. Também é o que cabe numa folha impressa.
const POR_PAGINA = 50;

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const int = (n: number | null | undefined) => (n ?? 0).toLocaleString('pt-BR');

/** `YYYY-MM-DD` → `DD/MM`. Sem `new Date`: evita o recuo de fuso. */
const diaCurto = (d: string | null) => {
  if (!d) return '—';
  const [, m, dd] = d.substring(0, 10).split('-');
  return `${dd}/${m}`;
};

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const primeiroDoMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const achatar = (e: EstruturaVisivel | null): RotaNo[] =>
  (e?.paises ?? []).flatMap((p) =>
    p.estados.flatMap((es) =>
      es.cidades.flatMap((c) => c.empresas.flatMap((em) => em.rotas))
    )
  );

/**
 * A cor do atraso, nos MESMOS limites da escala do app
 * (apprutea_android/src/utils/diasCobranca.ts, eixo de cobranças perdidas).
 * Se uma mudar, a outra muda junto — senão o vendedor vê um cliente vermelho
 * no aparelho e âmbar no relatório, e a discussão é sobre quem está certo.
 */
const corAtraso = (d: number) =>
  d === 0 ? 'text-gray-300'
    : d <= 3 ? 'text-amber-600'
      : d <= 7 ? 'text-orange-600'
        : 'text-red-600';

// ── OS PRESETS ─────────────────────────────────────────────────────────
//
// Cada um é uma combinação nomeada de filtros. `parametro` diz qual campo
// editável aparece no cabeçalho da listagem — nenhum prazo fica preso no
// código.

type Parametro = 'dias_sem_contato' | 'dias_por_vencer' | 'periodo' | 'principal' | 'taxa' | null;

interface Preset {
  id: string;
  nome: string;
  sub: string;
  icone: React.ElementType;
  selo: string;
  parametro: Parametro;
  filtros: (p: Params) => FiltrosClientes;
}

interface Params {
  diasSemContato: number;
  diasPorVencer: number;
  de: string;
  ate: string;
  principalMin: number;
  taxaMin: number;
  taxaMax: number;
}

const PRESETS: Preset[] = [
  {
    id: 'ativos', nome: 'Ativos', sub: 'com empréstimo em aberto',
    icone: Users, selo: 'bg-emerald-50 text-emerald-600', parametro: null,
    filtros: () => ({ situacao: 'COM_ABERTO' }),
  },
  {
    id: 'atrasados', nome: 'Atrasados', sub: 'em dias de cobrança',
    icone: AlertTriangle, selo: 'bg-red-50 text-red-600', parametro: null,
    filtros: () => ({ situacao: 'COM_ABERTO', atrasoMin: 1 }),
  },
  {
    id: 'vencidos', nome: 'Vencidos', sub: 'passou do fim e ainda deve',
    icone: Clock, selo: 'bg-red-50 text-red-600', parametro: null,
    filtros: () => ({ situacao: 'COM_ABERTO', venceAteDias: -1 }),
  },
  {
    id: 'porVencer', nome: 'Por vencer', sub: 'a fila de renovação',
    icone: CalendarClock, selo: 'bg-blue-50 text-blue-600', parametro: 'dias_por_vencer',
    filtros: (p) => ({ situacao: 'COM_ABERTO', venceDeDias: 0, venceAteDias: p.diasPorVencer }),
  },
  {
    id: 'inativos', nome: 'Inativos', sub: 'sem nada em aberto',
    icone: UserX, selo: 'bg-gray-100 text-gray-500', parametro: null,
    filtros: () => ({ situacao: 'SEM_ABERTO', ordenar: 'PAGAMENTO' }),
  },
  {
    id: 'semRenovar', nome: 'Sem renovar', sub: 'parou de voltar',
    icone: UserMinus, selo: 'bg-amber-50 text-amber-600', parametro: 'dias_sem_contato',
    filtros: (p) => ({ situacao: 'SEM_ABERTO', semContatoDias: p.diasSemContato, ordenar: 'PAGAMENTO' }),
  },
  {
    id: 'pagaram', nome: 'Que pagaram', sub: 'no intervalo, parcial inclusive',
    icone: HandCoins, selo: 'bg-emerald-50 text-emerald-600', parametro: 'periodo',
    filtros: (p) => ({ situacao: 'TODOS', pagouDe: p.de, pagouAte: p.ate, ordenar: 'SALDO' }),
  },
  {
    id: 'credito', nome: 'Crédito acima de', sub: 'pelo principal contratado',
    icone: TrendingUp, selo: 'bg-violet-50 text-violet-600', parametro: 'principal',
    filtros: (p) => ({ situacao: 'COM_ABERTO', principalMin: p.principalMin, ordenar: 'SALDO' }),
  },
  {
    id: 'juros', nome: 'Por interesse', sub: 'faixa de taxa',
    icone: Percent, selo: 'bg-violet-50 text-violet-600', parametro: 'taxa',
    filtros: (p) => ({ situacao: 'COM_ABERTO', taxaMin: p.taxaMin, taxaMax: p.taxaMax, ordenar: 'SALDO' }),
  },
  {
    id: 'cancelados', nome: 'Cancelados', sub: 'tem empréstimo cancelado',
    icone: Ban, selo: 'bg-gray-100 text-gray-500', parametro: null,
    filtros: () => ({ situacao: 'CANCELADO', ordenar: 'NOME' }),
  },
  {
    id: 'historico', nome: 'Histórico', sub: 'todos, em aberto ou não',
    icone: History, selo: 'bg-gray-100 text-gray-500', parametro: null,
    filtros: () => ({ situacao: 'TODOS', ordenar: 'SALDO' }),
  },
];

/**
 * A frequência em rótulo curto. Vai ao lado do atraso, pedido de 09/10/2026:
 * três dias de atraso num diário e num mensal são problemas de tamanhos
 * diferentes, e ler isso exigia atravessar a tabela até a coluna do
 * principal.
 */
const FREQ: Record<string, string> = {
  DIARIO: 'Diário',
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
  FLEXIVEL: 'Flexível',
};

const campo =
  'border border-gray-200 rounded-md px-2 py-1 text-[11.5px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function RelatorioClientesPage() {
  const [estrutura, setEstrutura] = useState<EstruturaVisivel | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [data, setData] = useState(hojeIso());

  const [dados, setDados] = useState<ClientesRelatorio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [preset, setPreset] = useState('ativos');
  const [pagina, setPagina] = useState(0);
  const [busca, setBusca] = useState('');
  const [escopoAberto, setEscopoAberto] = useState(false);
  const caixaEscopo = useRef<HTMLDivElement>(null);

  /**
   * Os clientes marcados. Serve à impressão: o admin marca quem interessa e
   * manda só aqueles para o vendedor. Sem marcação, imprime a página inteira.
   *
   * É um `Set` de id e não um campo na linha porque a lista é refeita a cada
   * consulta — guardar a marcação no dado a perderia a cada página.
   */
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  /** Os prazos e valores dos presets. Editáveis: nada fica preso no código. */
  const [params, setParams] = useState<Params>({
    diasSemContato: 30,
    diasPorVencer: 15,
    de: primeiroDoMes(),
    ate: hojeIso(),
    principalMin: 1000,
    taxaMin: 0,
    taxaMax: 100,
  });

  const [escopoGerado, setEscopoGerado] =
    useState<{ rotas: string[]; data: string } | null>(null);
  const [rotasAtivas, setRotasAtivas] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => setEstrutura(await relatoriosService.buscarEstrutura()))();
  }, []);

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

  const rotuloEscopo = useMemo(() => {
    if (selecionadas.size === 0) return 'Selecione o escopo';
    if (selecionadas.size === todasAsRotas.length) return 'Tudo';
    if (selecionadas.size === 1) {
      const r = todasAsRotas.find((x) => selecionadas.has(x.rota_id));
      return r?.nome ?? '1 rota';
    }
    return `${selecionadas.size} rotas`;
  }, [selecionadas, todasAsRotas]);

  const rotasDoEscopo = useMemo(() => {
    if (!escopoGerado) return [];
    const nomes = new Map(todasAsRotas.map((r) => [r.rota_id, r]));
    return escopoGerado.rotas
      .map((id) => ({ id, nome: nomes.get(id)?.nome ?? 'Rota' }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [escopoGerado, todasAsRotas]);

  /** Referência estável: array novo a cada render faria a consulta em laço. */
  const chaveAtivas = useMemo(() => Array.from(rotasAtivas).sort().join(','), [rotasAtivas]);
  const rotasAtivasArr = useMemo(
    () => (chaveAtivas ? chaveAtivas.split(',') : []),
    [chaveAtivas]
  );

  const presetAtual = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];
  const podeGerar = selecionadas.size > 0 && !!data && !carregando;

  const consultar = useCallback(async (
    rotas: string[], dia: string, filtros: FiltrosClientes, pag: number
  ) => {
    if (rotas.length === 0) { setDados(null); return; }
    setCarregando(true);
    setErro(null);
    try {
      const r = await relatoriosService.buscarClientes(rotas, dia, {
        ...filtros, busca, limite: POR_PAGINA, offset: pag * POR_PAGINA,
      });
      if (!r || !r.sucesso) {
        setErro(r?.mensagem || 'Não foi possível gerar o relatório.');
        setDados(null);
      } else {
        setDados(r);
      }
    } finally {
      setCarregando(false);
    }
  }, [busca]);

  const gerar = useCallback(async () => {
    if (selecionadas.size === 0) return;
    const rotas = Array.from(selecionadas);
    setEscopoGerado({ rotas, data });
    setRotasAtivas(new Set(rotas));
    setPagina(0);
    await consultar(rotas, data, presetAtual.filtros(params), 0);
  }, [selecionadas, data, presetAtual, params, consultar]);

  /**
   * Trocar preset, página, parâmetro ou escopo refaz a consulta. O `escopoGerado`
   * no guarda impede que mexer na árvore, antes de gerar, dispare consulta.
   */
  useEffect(() => {
    if (!escopoGerado) return;
    const t = setTimeout(
      () => consultar(rotasAtivasArr, escopoGerado.data, presetAtual.filtros(params), pagina),
      busca ? 400 : 0
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopoGerado, rotasAtivasArr, preset, pagina, params, busca]);

  useEffect(() => { setPagina(0); }, [preset, busca, params]);

  // Trocar de preset, página ou escopo esvazia a marcação. Marcação que
  // sobrevive a uma lista diferente imprime gente que o usuário nem viu.
  useEffect(() => { setMarcados(new Set()); }, [preset, pagina, chaveAtivas, busca]);

  const alternarRota = (id: string) => {
    const proximas = new Set(rotasAtivas);
    if (proximas.has(id)) proximas.delete(id); else proximas.add(id);
    setRotasAtivas(proximas);
    setPagina(0);
  };

  const t = dados?.totais ?? null;
  const linhas = dados?.linhas ?? [];

  /** Marcados, se houver marcação; senão a página inteira. */
  const paraImprimir = marcados.size > 0
    ? linhas.filter((l) => marcados.has(l.cliente_id))
    : linhas;

  const todosMarcados = linhas.length > 0 && linhas.every((l) => marcados.has(l.cliente_id));

  const alternarMarca = (id: string) => {
    const p = new Set(marcados);
    if (p.has(id)) p.delete(id); else p.add(id);
    setMarcados(p);
  };

  const alternarTodos = () => {
    setMarcados(todosMarcados ? new Set() : new Set(linhas.map((l) => l.cliente_id)));
  };

  const exportar = () => {
    if (!linhas.length) return;
    baixarCsv<LinhaCliente>(
      `clientes_${presetAtual.id}_${escopoGerado?.data ?? data}`,
      [
        { cabecalho: 'Cliente', valor: (l) => l.cliente_nome },
        { cabecalho: 'Documento', valor: (l) => l.cliente_documento },
        { cabecalho: 'Telefone', valor: (l) => l.telefone },
        { cabecalho: 'Rota', valor: (l) => l.rota_nome },
        { cabecalho: 'Status', valor: (l) => l.cliente_status },
        { cabecalho: 'Empréstimos abertos', valor: (l) => l.emprestimos_abertos },
        { cabecalho: 'Empréstimos no total', valor: (l) => l.emprestimos_total },
        { cabecalho: 'Saldo', valor: (l) => numCsv(l.saldo) },
        { cabecalho: 'Vencido', valor: (l) => numCsv(l.valor_vencido) },
        { cabecalho: 'Parcelas vencidas', valor: (l) => l.parcelas_vencidas },
        { cabecalho: 'Dias de atraso', valor: (l) => l.dias_atraso },
        { cabecalho: 'Último pagamento', valor: (l) => l.ultimo_pagamento },
        { cabecalho: 'Dias sem pagar', valor: (l) => l.dias_sem_pagar },
        { cabecalho: 'Termina em', valor: (l) => l.termina_em },
        { cabecalho: 'Dias para terminar', valor: (l) => l.dias_para_terminar },
        { cabecalho: 'Principal', valor: (l) => numCsv(l.principal_atual) },
        { cabecalho: 'Taxa', valor: (l) => numCsv(l.taxa_atual ?? 0) },
        { cabecalho: 'Frequência', valor: (l) => l.frequencia },
        { cabecalho: 'Pago no intervalo', valor: (l) => numCsv(l.pago_no_intervalo) },
      ],
      linhas
    );
  };

  const Ind = ({ rotulo, children }: { rotulo: string; children: React.ReactNode }) => (
    <div className="flex-1 min-w-0 basis-[130px] px-3.5 py-2 border-r border-gray-100 last:border-r-0">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 truncate">
        {rotulo}
      </span>
      <span className="block text-[14.5px] font-semibold tabular-nums">{children}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-2.5">

      <div className="flex items-start justify-between gap-3 flex-wrap flex-shrink-0">
        <div className="flex items-start gap-2.5">
          <Link href="/relatorios" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 mt-1" aria-label="Voltar">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Clientes</h1>
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
                    <ArvoreEscopo estrutura={estrutura} selecionadas={selecionadas} onChange={setSelecionadas} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* UMA DATA, não um intervalo: é foto, não fluxo. */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11.5px] text-gray-500">Situação em</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            aria-label="Data de referência"
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12.5px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex-shrink-0">{erro}</div>
      )}

      {!escopoGerado && !erro && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-2">
          <Users className="w-10 h-10 text-gray-300" />
          <p className="text-sm text-gray-500">
            Escolha o escopo e a data, e clique em <b>Gerar</b>.
          </p>
        </div>
      )}

      {escopoGerado && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
            {rotasDoEscopo.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mr-0.5">Rotas</span>
                {rotasDoEscopo.map((r) => {
                  const ligada = rotasAtivas.has(r.id);
                  return (
                    <button
                      key={r.id}
                      onClick={() => alternarRota(r.id)}
                      aria-pressed={ligada}
                      className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full border text-[12px] ${
                        ligada
                          ? 'bg-white border-gray-200 text-gray-900 hover:border-gray-400'
                          : 'bg-gray-50 border-dashed border-gray-300 text-gray-400'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${ligada ? 'bg-blue-500' : 'bg-gray-300'}`} />
                      <span className="truncate max-w-[180px]">{r.nome}</span>
                    </button>
                  );
                })}
                <span className="ml-auto flex gap-1.5">
                  <button
                    onClick={() => { setRotasAtivas(new Set(escopoGerado.rotas)); setPagina(0); }}
                    className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  >Todas</button>
                  <button
                    onClick={() => { setRotasAtivas(new Set()); setPagina(0); }}
                    className="text-[11px] px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  >Nenhuma</button>
                </span>
              </div>
            )}

            <div className={`flex flex-wrap ${rotasDoEscopo.length > 1 ? 'border-t border-gray-100' : ''}`}>
              <Ind rotulo="Situação em">{diaCurto(escopoGerado.data)}</Ind>
              <Ind rotulo="Clientes">{int(t?.clientes)}</Ind>
              <Ind rotulo="Com aberto">{int(t?.com_aberto)}</Ind>
              <Ind rotulo="Atrasados">
                <span className={t && t.atrasados > 0 ? 'text-red-600' : ''}>{int(t?.atrasados)}</span>
              </Ind>
              <Ind rotulo="Saldo">{fmt(t?.saldo)}</Ind>
              <Ind rotulo="Vencido">
                <span className={t && t.valor_vencido > 0 ? 'text-red-600' : ''}>{fmt(t?.valor_vencido)}</span>
              </Ind>
              <Ind rotulo="Pior atraso">{int(t?.pior_caso)} <small className="text-[11px] font-medium text-gray-400">dias</small></Ind>
            </div>

            {/* As faixas: a mesma escala de cor do app. Só quando há atraso. */}
            {(dados?.faixas.filter((f) => f.faixa !== 'em dia').length ?? 0) > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-1.5 border-t border-gray-100 bg-gray-50">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Atraso</span>
                {dados!.faixas.filter((f) => f.faixa !== 'em dia').map((f) => (
                  <span key={f.faixa} className="text-[11.5px] text-gray-500">
                    {f.faixa}{' '}
                    <b className="text-gray-900 tabular-nums">{f.clientes}</b>
                    <span className="text-gray-400"> · {fmt(f.valor)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-2.5">

            <div className="min-h-0 overflow-y-auto">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" />
                  </span>
                  <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Relatórios</h2>
                </div>
                {PRESETS.map((p) => {
                  const ativo = p.id === preset;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPreset(p.id)}
                      aria-pressed={ativo}
                      className={`w-full grid grid-cols-[28px_1fr] gap-x-2 items-center px-3 py-2 text-left border-b border-gray-100 last:border-b-0 ${
                        ativo ? 'bg-blue-50 shadow-[inset_3px_0_0_#2563eb]' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-md flex items-center justify-center ${p.selo}`}>
                        <p.icone className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[12.5px] font-semibold text-gray-900 truncate">{p.nome}</span>
                      <span className="col-start-2 text-[10.5px] text-gray-400 truncate">
                        {ativo && t ? `${int(t.clientes)} · ${p.sub}` : p.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0">
              <div className="bg-white rounded-lg border border-gray-200 h-full min-h-0 flex flex-col overflow-hidden">
                <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-gray-100 flex-shrink-0">
                  <span className={`w-7 h-7 rounded-md flex items-center justify-center ${presetAtual.selo}`}>
                    <presetAtual.icone className="w-3.5 h-3.5" />
                  </span>
                  <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">{presetAtual.nome}</h2>
                  <span className="text-[11.5px] text-gray-400">{presetAtual.sub}</span>
                  {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}

                  <span className="ml-auto flex items-center gap-1.5 flex-wrap">
                    {/* O PARÂMETRO DO PRESET. Nenhum prazo preso no código: o
                        "sem renovar" de 30 dias e o "por vencer" de 15 são
                        padrões, não constantes. */}
                    {presetAtual.parametro === 'dias_sem_contato' && (
                      <label className="flex items-center gap-1.5 text-[11.5px] text-gray-500">
                        sem pagar há
                        <input
                          type="number" min={1} value={params.diasSemContato}
                          onChange={(e) => setParams((p) => ({ ...p, diasSemContato: Number(e.target.value) || 1 }))}
                          className={`${campo} w-16 tabular-nums`}
                        />
                        dias
                      </label>
                    )}
                    {presetAtual.parametro === 'dias_por_vencer' && (
                      <label className="flex items-center gap-1.5 text-[11.5px] text-gray-500">
                        termina em até
                        <input
                          type="number" min={0} value={params.diasPorVencer}
                          onChange={(e) => setParams((p) => ({ ...p, diasPorVencer: Number(e.target.value) || 0 }))}
                          className={`${campo} w-16 tabular-nums`}
                        />
                        dias
                      </label>
                    )}
                    {presetAtual.parametro === 'periodo' && (
                      <span className="flex items-center gap-1.5 text-[11.5px] text-gray-500">
                        pagou entre
                        <input type="date" value={params.de}
                          onChange={(e) => setParams((p) => ({ ...p, de: e.target.value }))}
                          aria-label="De" className={campo} />
                        e
                        <input type="date" value={params.ate}
                          onChange={(e) => setParams((p) => ({ ...p, ate: e.target.value }))}
                          aria-label="Até" className={campo} />
                      </span>
                    )}
                    {presetAtual.parametro === 'principal' && (
                      <label className="flex items-center gap-1.5 text-[11.5px] text-gray-500">
                        principal a partir de
                        <input
                          type="number" min={0} step={100} value={params.principalMin}
                          onChange={(e) => setParams((p) => ({ ...p, principalMin: Number(e.target.value) || 0 }))}
                          className={`${campo} w-24 tabular-nums`}
                        />
                      </label>
                    )}
                    {presetAtual.parametro === 'taxa' && (
                      <span className="flex items-center gap-1.5 text-[11.5px] text-gray-500">
                        taxa de
                        <input type="number" min={0} step={1} value={params.taxaMin}
                          onChange={(e) => setParams((p) => ({ ...p, taxaMin: Number(e.target.value) || 0 }))}
                          aria-label="Taxa mínima" className={`${campo} w-16 tabular-nums`} />
                        a
                        <input type="number" min={0} step={1} value={params.taxaMax}
                          onChange={(e) => setParams((p) => ({ ...p, taxaMax: Number(e.target.value) || 0 }))}
                          aria-label="Taxa máxima" className={`${campo} w-16 tabular-nums`} />
                        %
                      </span>
                    )}

                    <input
                      type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
                      placeholder="Nome, documento ou telefone"
                      className={`${campo} w-[200px]`}
                    />
                    {/* IMPRIMIR É O CAMINHO ATÉ O VENDEDOR. O admin salva em
                        PDF pelo diálogo do navegador e manda por WhatsApp —
                        por isso a folha sai estreita, com quatro colunas. */}
                    <button
                      onClick={() => window.print()}
                      disabled={!paraImprimir.length}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-40"
                      title={marcados.size > 0
                        ? `Imprimir os ${marcados.size} marcados`
                        : 'Imprimir a página inteira'}
                    >
                      <Printer className="w-3 h-3" />
                      Imprimir{marcados.size > 0 ? ` (${marcados.size})` : ''}
                    </button>
                    <button
                      onClick={exportar}
                      disabled={!linhas.length}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-40"
                    >
                      <Download className="w-3 h-3" /> CSV
                    </button>
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-auto">
                  {rotasAtivas.size === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                      <MapPin className="w-9 h-9 text-gray-300" />
                      <p className="text-sm text-gray-500">Marque ao menos uma rota acima.</p>
                    </div>
                  ) : !carregando && linhas.length === 0 ? (
                    <p className="text-sm text-gray-500 p-8 text-center">Nenhum cliente com esses filtros.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-400 sticky top-0 z-[1]">
                        <tr>
                          <th className="w-8 px-3 py-1.5">
                            <input
                              type="checkbox"
                              checked={todosMarcados}
                              onChange={alternarTodos}
                              aria-label="Marcar todos da página"
                              className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600 align-middle"
                            />
                          </th>
                          <th className="text-left font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Cliente</th>
                          <th className="text-left font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Rota</th>
                          {/* TIPO JUNTO DO ATRASO, pedido de 09/10/2026: três
                              dias num diário e num mensal são problemas de
                              tamanhos diferentes. Antes a frequência estava
                              na outra ponta da tabela, sob o principal. */}
                          <th className="text-left font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Tipo</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Atraso</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Vencido</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Saldo</th>
                          <th className="text-left font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Último pgto.</th>
                          <th className="text-left font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Termina</th>
                          <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Principal</th>
                          {presetAtual.parametro === 'periodo' && (
                            <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Pago</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {linhas.map((l) => (
                          <tr
                            key={l.cliente_id}
                            className={`align-top ${marcados.has(l.cliente_id) ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={marcados.has(l.cliente_id)}
                                onChange={() => alternarMarca(l.cliente_id)}
                                aria-label={`Marcar ${l.cliente_nome}`}
                                className="w-3.5 h-3.5 rounded border-gray-300 accent-blue-600"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-gray-900">{l.cliente_nome}</span>
                              {/* O mesmo indicador da Liquidação Diária:
                                  `MessageSquare` em âmbar com a contagem. Só
                                  notas `ATIVA` — arquivada não é recado
                                  pendente. */}
                              {l.notas > 0 && (
                                <span
                                  className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 align-middle"
                                  title={`${l.notas} nota${l.notas > 1 ? 's' : ''}`}
                                >
                                  <MessageSquare className="w-3 h-3" />({l.notas})
                                </span>
                              )}
                              {l.cliente_status === 'SUSPENSO' && (
                                <span className="ml-1.5 text-[10px] font-bold uppercase px-1.5 rounded bg-red-50 text-red-700">
                                  suspenso
                                </span>
                              )}
                              <span className="block text-[11px] text-gray-400">
                                {l.cliente_documento || '—'}
                                {l.telefone ? ` · ${l.telefone}` : ''}
                                {l.emprestimos_total > 1 && ` · ${l.emprestimos_total} empréstimos`}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{l.rota_nome || '—'}</td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                              {l.frequencia ? (FREQ[l.frequencia] ?? l.frequencia) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <span className={`font-semibold tabular-nums ${corAtraso(l.dias_atraso)}`}>
                                {l.dias_atraso || '—'}
                              </span>
                              {l.parcelas_vencidas > 0 && (
                                <span className="block text-[11px] text-gray-400 tabular-nums">
                                  {l.parcelas_vencidas} parcela{l.parcelas_vencidas > 1 ? 's' : ''}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-red-600">
                              {l.valor_vencido > 0 ? fmt(l.valor_vencido) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-900">{fmt(l.saldo)}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                              {diaCurto(l.ultimo_pagamento)}
                              {l.dias_sem_pagar !== null && l.dias_sem_pagar > 0 && (
                                <span className="block text-[11px] text-gray-400 tabular-nums">
                                  há {l.dias_sem_pagar} dias
                                </span>
                              )}
                            </td>
                            {/* Negativo é prazo estourado; positivo é a fila de
                                renovação. São duas perguntas diferentes, e é por
                                isso que "Vencidos" e "Por vencer" são presets
                                separados. */}
                            <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                              {diaCurto(l.termina_em)}
                              {l.dias_para_terminar !== null && (
                                <span className={`block text-[11px] tabular-nums ${
                                  l.dias_para_terminar < 0 ? 'text-red-600' : 'text-emerald-700'
                                }`}>
                                  {l.dias_para_terminar < 0
                                    ? `${-l.dias_para_terminar} dias atrás`
                                    : `em ${l.dias_para_terminar} dias`}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <span className="tabular-nums text-gray-900">{fmt(l.principal_atual)}</span>
                              <span className="block text-[11px] text-gray-400 tabular-nums">
                                {l.taxa_atual !== null ? `${fmt(l.taxa_atual)}%` : ''}
                              </span>
                            </td>
                            {presetAtual.parametro === 'periodo' && (
                              <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-semibold">
                                {fmt(l.pago_no_intervalo)}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-wrap px-3 py-1.5 border-t border-gray-200 bg-gray-50 text-[11.5px] text-gray-600 flex-shrink-0">
                  <span>
                    {dados?.total_registros ?? 0} cliente(s)
                    {marcados.size > 0 && (
                      <span className="ml-1.5 text-blue-700 font-semibold">
                        · {marcados.size} marcado{marcados.size > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                  {t && (
                    <span className="ml-auto flex items-center gap-3.5 tabular-nums">
                      <span>saldo <b className="text-gray-900">{fmt(t.saldo)}</b></span>
                      {t.valor_vencido > 0 && (
                        <span className="text-red-600">vencido <b>{fmt(t.valor_vencido)}</b></span>
                      )}
                      {presetAtual.parametro === 'periodo' && (
                        <span className="text-emerald-700">pago <b>{fmt(t.pago_no_intervalo)}</b></span>
                      )}
                    </span>
                  )}
                  <span className={t ? '' : 'ml-auto'}>
                    <Paginacao
                      pagina={pagina}
                      porPagina={POR_PAGINA}
                      total={dados?.total_registros ?? 0}
                      onIr={setPagina}
                    />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          A FOLHA, que só existe no papel.

          Um bloco próprio em vez de tentar imprimir a tabela da tela: a
          página é travada com altura fixa e rolagem interna, e imprimir um
          contêiner que rola sai cortado na primeira folha. Aqui o conteúdo
          é solto e o navegador quebra em páginas sozinho.

          QUATRO COLUNAS, porque isto vai para o vendedor no WhatsApp e ele
          lê no telefone: quem é, de que tipo, quanto atrasou, quanto deve.
          Documento, rota, saldo, principal e taxa ficam na tela.
          ══════════════════════════════════════════════════════════════ */}
      <div id="folha" className="hidden print:block">
        <h1 style={{ fontSize: '15pt', fontWeight: 700, margin: 0 }}>
          {presetAtual.nome}
        </h1>
        <p style={{ fontSize: '9pt', color: '#555', margin: '2pt 0 8pt' }}>
          {rotasDoEscopo.filter((r) => rotasAtivas.has(r.id)).map((r) => r.nome).join(' · ') || '—'}
          {' · situação em '}{diaCurto(escopoGerado?.data ?? data)}
          {' · '}{paraImprimir.length} cliente{paraImprimir.length === 1 ? '' : 's'}
          {marcados.size > 0 ? ' (selecionados)' : ''}
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #000', padding: '3pt 0' }}>Cliente</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #000', padding: '3pt 4pt' }}>Tipo</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #000', padding: '3pt 4pt' }}>Atraso</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #000', padding: '3pt 0' }}>Deve</th>
            </tr>
          </thead>
          <tbody>
            {paraImprimir.map((l) => (
              <tr key={l.cliente_id} style={{ pageBreakInside: 'avoid' }}>
                <td style={{ padding: '3pt 0', borderBottom: '1px solid #ddd' }}>
                  {l.cliente_nome}
                  {l.telefone && (
                    <span style={{ color: '#666', fontSize: '8pt' }}> · {l.telefone}</span>
                  )}
                  {l.notas > 0 && (
                    <span style={{ color: '#92400e', fontSize: '8pt' }}> · {l.notas} nota{l.notas > 1 ? 's' : ''}</span>
                  )}
                </td>
                <td style={{ padding: '3pt 4pt', borderBottom: '1px solid #ddd', color: '#444' }}>
                  {l.frequencia ? (FREQ[l.frequencia] ?? l.frequencia) : '—'}
                </td>
                <td style={{ padding: '3pt 4pt', borderBottom: '1px solid #ddd', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {l.dias_atraso > 0 ? `${l.dias_atraso}d` : '—'}
                  {l.parcelas_vencidas > 0 && (
                    <span style={{ color: '#666', fontSize: '8pt' }}> ({l.parcelas_vencidas})</span>
                  )}
                </td>
                <td style={{ padding: '3pt 0', borderBottom: '1px solid #ddd', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(l.valor_vencido > 0 ? l.valor_vencido : l.saldo)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ padding: '5pt 0', fontWeight: 700 }}>Total</td>
              <td style={{ padding: '5pt 4pt', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {paraImprimir.filter((l) => l.dias_atraso > 0).length} em atraso
              </td>
              <td style={{ padding: '5pt 0', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(paraImprimir.reduce((a, l) => a + (l.valor_vencido > 0 ? l.valor_vencido : l.saldo), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* A regra de visibilidade: esconde a aplicação inteira e deixa só a
          folha. É o caminho confiável para imprimir uma região sem depender
          do layout do dashboard, que esta página não controla. */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: #fff; }
          body * { visibility: hidden; }
          #folha, #folha * { visibility: visible; }
          #folha { position: absolute; left: 0; top: 0; width: 100%; }
          thead { display: table-header-group; }
        }
      `}</style>
    </div>
  );
}
