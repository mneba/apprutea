'use client';

// =====================================================================
// RELATÓRIO: LIQUIDAÇÃO POR PERÍODO
// =====================================================================
//
// Substitui as abas "Liquidacion" e "Resumen" do sistema legado — elas
// mostram o mesmo dado em granularidades diferentes.
//
// A HIERARQUIA DO RESUMO
// Cobrança e venda são as duas OPERAÇÕES da rota: peso visual igual entre si,
// lado a lado. O lucro é o RESULTADO delas, apartado à direita e com a margem
// sobre o cobrado, porque 6.450,76 sozinho não diz se foi bom. Caixa e base de
// clientes descrevem o CENÁRIO, não a operação, e por isso vivem na linha do
// cabeçalho, miúdos. A carteira mora dentro da venda — é o que a venda
// acumula.
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
// o que NÃO somar. Ver sql/2026-10-01_fn_liquidacoes_periodo.sql.

import { ArrowLeft, ChevronDown, ChevronRight, Download, Globe, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PainelCobranca from '@/components/relatorios/PainelCobranca';
import PainelVendas from '@/components/relatorios/PainelVendas';
import PainelMovimentacoes from '@/components/relatorios/PainelMovimentacoes';
import ArvoreEscopo from '@/components/relatorios/ArvoreEscopo';
import SeletorPeriodo from '@/components/relatorios/SeletorPeriodo';
import { Link } from '@/i18n/routing';
import { relatoriosService } from '@/services/relatorios';
import type { EstruturaVisivel, LiquidacoesPeriodo, RotaNo } from '@/types/relatorios';
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

/**
 * Uma grandeza da faixa de movimentações: sinal, valor e nome, clicável.
 *
 * É botão por grandeza, e não uma faixa clicável inteira, porque cada uma abre
 * o painel já filtrada no seu tipo — quem clica em "transferências" quer as
 * transferências, não a lista toda para filtrar de novo.
 */
function Grandeza({
  sinal, nome, valor, cor, onClick,
}: {
  sinal: string;
  nome: string;
  valor: number;
  cor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group/g flex items-baseline gap-1.5 px-2 py-1 -my-1 rounded hover:bg-gray-100 text-left"
      title={`Ver ${nome} do período`}
    >
      <span className="text-[12.5px] text-gray-400">{sinal}</span>
      <b className={`${cor} tabular-nums text-[15px]`}>{fmt(valor)}</b>
      <span className="text-[11.5px] text-gray-400 group-hover/g:text-gray-600">{nome}</span>
    </button>
  );
}

/** Cor da barra de atingido, na mesma escala da tela de Liquidação Diária. */
const corPct = (p: number) =>
  p >= 100 ? 'bg-emerald-500' : p >= 70 ? 'bg-blue-500' : p >= 50 ? 'bg-amber-500' : 'bg-red-500';

export default function LiquidacaoPeriodoPage() {
  const [estrutura, setEstrutura] = useState<EstruturaVisivel | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [de, setDe] = useState(primeiroDoMes());
  const [ate, setAte] = useState(hojeIso());

  const [dados, setDados] = useState<LiquidacoesPeriodo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<'cobranca' | 'venda' | 'movimentacao' | null>(null);
  /**
   * O tipo com que o painel de movimentações abre. Vai como `key` no painel,
   * para ele remontar com o filtro já posto em vez de sincronizar por efeito —
   * sincronizar custaria uma busca jogada fora a cada abertura.
   */
  const [movTipo, setMovTipo] = useState('');
  /**
   * Qual conta o painel abre: a da rota ou a do microseguro. São duas contas
   * de verdade — a Barcelona tem `Conta Rota Barcelona` e
   * `Conta Microseguro Barcelona`, com saldos próprios — e por isso cada uma
   * tem card e listagem próprios.
   */
  const [movConta, setMovConta] = useState<'ROTA' | 'MICROSEGURO'>('ROTA');
  const abrirMov = (tipo: string, conta: 'ROTA' | 'MICROSEGURO' = 'ROTA') => {
    setMovTipo(tipo);
    setMovConta(conta);
    setPainel('movimentacao');
  };
  const [escopoAberto, setEscopoAberto] = useState(false);
  const caixaEscopo = useRef<HTMLDivElement>(null);

  // O recorte usado na última geração, não o marcado agora. Sem isso, mexer na
  // árvore trocaria o conteúdo do painel sem o relatório ter sido refeito.
  const [escopoGerado, setEscopoGerado] = useState<{ rotas: string[]; de: string; ate: string } | null>(null);

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

  // As rotas do recorte, com o vendedor. Sai do que foi GERADO, não do que
  // está marcado agora — o cabeçalho descreve o relatório na tela.
  const rotasDoResumo = useMemo(() => {
    if (!escopoGerado) return [];
    const mapa = new Map(todasAsRotas.map((r) => [r.rota_id, r]));
    return escopoGerado.rotas
      .map((id) => mapa.get(id))
      .filter((r): r is RotaNo => !!r)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [escopoGerado, todasAsRotas]);

  const podeGerar = selecionadas.size > 0 && !!de && !!ate && ate >= de && !carregando;

  const gerar = useCallback(async () => {
    if (selecionadas.size === 0) return;
    setCarregando(true);
    setErro(null);
    const rotas = Array.from(selecionadas);
    try {
      const r = await relatoriosService.buscarLiquidacoesPeriodo(rotas, de, ate);
      if (!r || !r.sucesso) {
        setErro(r?.mensagem || 'Não foi possível gerar o relatório.');
        setDados(null);
        setEscopoGerado(null);
      } else {
        setDados(r);
        setEscopoGerado({ rotas, de, ate });
      }
    } finally {
      setCarregando(false);
    }
  }, [selecionadas, de, ate]);

  const exportarDias = () => {
    if (!dados) return;
    baixarCsv(
      `liquidacao_${de}_a_${ate}`,
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
        // No CSV vão sempre, mesmo zeradas: planilha com cabeçalho variável
        // quebra quem empilha dois períodos.
        { cabecalho: 'Transferências', valor: (d) => numCsv(d.transferencias) },
        { cabecalho: 'Ajustes', valor: (d) => numCsv(d.ajustes) },
        { cabecalho: 'Microseguro vendas', valor: (d) => numCsv(d.microseguro_vendas) },
        { cabecalho: 'Microseguro retiradas', valor: (d) => numCsv(d.microseguro_retiradas) },
        { cabecalho: 'Aporte', valor: (d) => numCsv(d.aportes) },
      ],
      dados.por_dia
    );
  };

  const c = dados?.consolidado ?? null;
  const margem = c && c.recebido > 0 ? (c.ganancia / c.recebido) * 100 : 0;

  /**
   * Transferência e ajuste são raros: a maioria dos períodos não tem nenhum.
   * Coluna de zeros ocupa largura que as outras precisam e some do olhar, por
   * isso só aparecem quando há. No CSV vão sempre — planilha com cabeçalho
   * variável quebra quem empilha dois períodos.
   */
  const temTransferencia = (dados?.por_dia ?? []).some((d) => d.transferencias !== 0);
  const temAjuste = (dados?.por_dia ?? []).some((d) => d.ajustes !== 0);
  const temAporte = (c?.aportes ?? 0) !== 0;
  const temMicro =
    (c?.microseguro_vendas ?? 0) !== 0 || (c?.microseguro_retiradas ?? 0) !== 0;

  /**
   * Dias com dinheiro e sem liquidação. Entram na tabela do dia a dia como
   * linha marcada, mas fora de `por_dia` — logo não contaminam
   * `dias_trabalhados` nem a média diária, que significam "dia em que a rota
   * trabalhou".
   */
  const semLiq = dados?.dias_sem_liquidacao ?? [];

  /** Colunas do dia a dia que só existem quando houve liquidação. */
  const COLUNAS_DA_LIQUIDACAO = 11;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Link
          href="/relatorios"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 mt-0.5"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidação por período</h1>
          <p className="text-gray-500 mt-1">
            Consolidado, dia a dia e por rota, para o recorte e o intervalo escolhidos.
          </p>
        </div>
      </div>

      {/* ── Filtros, numa barra só ──
          Antes eram dois cartões altos lado a lado. Filtro não é conteúdo:
          devolver a altura para o dado é o ganho. O escopo virou um botão que
          abre a árvore num popover; período e atalhos ficam na mesma linha. */}
      <div className="bg-white rounded-lg border border-gray-200 p-2.5 flex flex-wrap items-center gap-2.5">
        <div className="relative" ref={caixaEscopo}>
          <button
            onClick={() => setEscopoAberto((v) => !v)}
            aria-expanded={escopoAberto}
            className="inline-flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <Globe className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-gray-900">{rotuloEscopo}</span>
            {selecionadas.size > 0 && (
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 tabular-nums">
                {selecionadas.size}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {escopoAberto && (
            <div className="absolute z-30 mt-1 w-[380px] max-w-[90vw] bg-white rounded-lg border border-gray-200 shadow-lg p-3">
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

        <SeletorPeriodo de={de} ate={ate} onChange={(d, a) => { setDe(d); setAte(a); }} compacto />

        <button
          onClick={gerar}
          disabled={!podeGerar}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-blue-200 disabled:cursor-not-allowed"
        >
          {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
          {carregando ? 'Gerando…' : 'Gerar'}
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{erro}</div>
      )}

      {dados && !c && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Nenhuma liquidação encontrada nesse recorte e intervalo.
        </div>
      )}

      {dados && c && (
        <>
          {/* ── Resumo: um card só ── */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-900">
                Resumo do período
              </p>
              {/* O CENÁRIO: o universo em que o período aconteceu. */}
              <p className="text-[11.5px] text-gray-400 mt-1 flex flex-wrap gap-x-2.5 gap-y-1">
                <span>{diaCurto(dados.de)} a {diaCurto(dados.ate)}</span>
                <span className="text-gray-300">·</span>
                <span><b className="text-gray-500 tabular-nums">{c.dias_trabalhados}</b> dias trabalhados</span>
                <span className="text-gray-300">·</span>
                <span><b className="text-gray-500 tabular-nums">{dados.rotas_no_escopo}</b> rotas</span>
                <span className="text-gray-300">·</span>
                <span>
                  <b className="text-gray-500 tabular-nums">{int(c.clientes_ativos)}</b> clientes ativos,{' '}
                  <b className="text-gray-500 tabular-nums">{int(c.clientes_suspensos)}</b> suspensos
                </span>
                <span className="text-gray-300">·</span>
                <span>
                  caixa <b className="text-gray-500 tabular-nums">{fmt(c.caixa_inicial)}</b> →{' '}
                  <b className="text-gray-500 tabular-nums">{fmt(c.caixa_final)}</b>
                </span>
                <span className="text-gray-300">·</span>
                <span>
                  carteira <b className="text-gray-500 tabular-nums">{fmt(c.carteira_inicial)}</b> →{' '}
                  <b className="text-gray-500 tabular-nums">{fmt(c.carteira)}</b>
                </span>
              </p>

              {/* As rotas do recorte, com quem as opera. Cortadas em seis: com
                  48 marcadas a lista viraria um parágrafo e empurraria os
                  números para baixo. O `title` carrega todas, para conferência
                  sem sair da tela. */}
              {rotasDoResumo.length > 0 && (
                <p
                  className="text-[11.5px] text-gray-400 mt-1"
                  title={rotasDoResumo
                    .map((r) => (r.vendedor_nome ? `${r.nome} (${r.vendedor_nome})` : r.nome))
                    .join(' · ')}
                >
                  {rotasDoResumo.slice(0, 6).map((r, i) => (
                    <span key={r.rota_id}>
                      {i > 0 && <span className="text-gray-300"> · </span>}
                      <span className="text-gray-500">{r.nome}</span>
                      {r.vendedor_nome && <span> ({r.vendedor_nome})</span>}
                    </span>
                  ))}
                  {rotasDoResumo.length > 6 && (
                    <span className="text-gray-400"> e mais {rotasDoResumo.length - 6}</span>
                  )}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_0.8fr]">
              {/* Operação 1 — o dinheiro que volta */}
              <div className="p-4 border-b lg:border-b-0 lg:border-r border-gray-100">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                  Cobrança
                </p>
                <button
                  onClick={() => setPainel('cobranca')}
                  className="group inline-flex items-center gap-2 text-left"
                >
                  <span className="text-[26px] leading-tight font-extrabold text-gray-900 tabular-nums border-b-2 border-transparent group-hover:border-current">
                    {fmt(c.recebido)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </button>
                <p className="text-[11.5px] text-gray-400 mt-0.5">
                  {fmt(c.media_diaria)} por dia trabalhado
                </p>
                <div className="mt-3 pt-2 border-t border-gray-100 text-[12.5px] space-y-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Clientes atendidos</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{int(c.clientes_pagos)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Não pagos</span>
                    <span className="font-semibold text-red-600 tabular-nums">{int(c.clientes_nao_pagos)}</span>
                  </div>
                </div>
              </div>

              {/* Operação 2 — o dinheiro que sai */}
              <div className="p-4 border-b lg:border-b-0 lg:border-r border-gray-100">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                  Venda
                </p>
                <button
                  onClick={() => setPainel('venda')}
                  className="group inline-flex items-center gap-2 text-left"
                >
                  <span className="text-[26px] leading-tight font-extrabold text-gray-900 tabular-nums border-b-2 border-transparent group-hover:border-current">
                    {fmt(c.emprestado)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                </button>
                <p className="text-[11.5px] text-gray-400 mt-0.5">
                  {c.qtd_emprestimos} empréstimos · {c.clientes_novos} novos, {c.clientes_renovados} renovações
                </p>
                <div className="mt-3 pt-2 border-t border-gray-100 text-[12.5px] space-y-1">
                  <div className="flex justify-between gap-3">
                    <span className="text-gray-500">Juro contratado</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{fmt(c.juros_vendidos)}</span>
                  </div>
                  {/* A carteira é o que a venda acumula — por isso mora aqui. */}
                  <div className="flex justify-between gap-3 mt-1.5 pt-2 border-t border-dashed border-gray-200">
                    <span className="text-violet-700 font-semibold">Carteira a receber</span>
                    <span className="font-extrabold text-violet-700 tabular-nums">{fmt(c.carteira)}</span>
                  </div>
                </div>
              </div>

              {/* O resultado das duas */}
              <div className="p-4 bg-emerald-50 flex flex-col justify-center">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-emerald-700 mb-1.5">
                  Lucro
                </p>
                <p className="text-[30px] leading-tight font-extrabold text-emerald-700 tabular-nums">
                  {fmt(c.ganancia)}
                </p>
                <p className="text-[11.5px] text-emerald-700/85 mt-0.5">juro recebido no período</p>
                <div className="mt-2.5 pt-2 border-t border-emerald-200 flex justify-between gap-2 text-[12px] text-emerald-700">
                  <span>Margem sobre o cobrado</span>
                  <b className="tabular-nums font-extrabold">
                    {margem.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </b>
                </div>
              </div>
            </div>

            {/* MOVIMENTAÇÕES FINANCEIRAS — o dinheiro que não é cobrança nem
                empréstimo. Fica abaixo das três zonas, numa faixa própria,
                porque é de outra natureza: cobrança e venda são a OPERAÇÃO da
                rota; despesa, aporte e retirada são o que atravessa o caixa
                por fora dela. Juntar numa coluna convidaria a somar os cinco
                números, e a soma não significa nada.

                SÃO QUATRO GRANDEZAS, NÃO DUAS, e as duas últimas aparecem só
                quando existem — na maioria dos períodos não há nenhuma, e zero
                fixo na tela ensina a ignorar o campo.

                Transferência fora de entrada e saída de propósito: o trigger
                subtrai da origem e soma no destino, então somá-la nas duas
                pontas inflaria as duas. Ajuste também à parte, e com sinal —
                `AJUSTE_NEGATIVO` guarda o valor negativo. */}
            <div className="w-full px-4 py-2.5 border-t border-gray-100 flex items-center gap-x-2 gap-y-1 flex-wrap">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-gray-500 mr-1">
                Movimentações financeiras
              </span>

              <Grandeza
                sinal="(+)"
                nome="entradas"
                valor={c.entradas}
                cor="text-emerald-700"
                onClick={() => abrirMov('RECEBER')}
              />
              <Grandeza
                sinal="(−)"
                nome="saídas"
                valor={c.saidas}
                cor="text-red-700"
                onClick={() => abrirMov('PAGAR')}
              />

              {/* Transferências e ajustes: seção própria, só quando há. */}
              {c.transferencias !== 0 && (
                <>
                  <span className="text-gray-200 mx-1">|</span>
                  <Grandeza
                    sinal="(⇄)"
                    nome="transferências"
                    valor={c.transferencias}
                    cor="text-amber-700"
                    onClick={() => abrirMov('TRANSFERENCIA')}
                  />
                </>
              )}
              {c.ajustes !== 0 && (
                <>
                  {c.transferencias === 0 && <span className="text-gray-200 mx-1">|</span>}
                  <Grandeza
                    sinal="(±)"
                    nome="ajustes"
                    valor={c.ajustes}
                    cor="text-blue-700"
                    onClick={() => abrirMov('AJUSTE')}
                  />
                </>
              )}
              {/* APORTE — lastro de implantação, não operação da rota.
                  Em linha própria porque era o que fazia a Barcelona mostrar
                  −117.219,77 de "ajustes" num caixa de 1.289,23. */}
              {c.aportes !== 0 && (
                <Grandeza
                  sinal="(¤)"
                  nome="aporte"
                  valor={c.aportes}
                  cor="text-violet-700"
                  onClick={() => abrirMov('APORTE')}
                />
              )}

              <button
                onClick={() => abrirMov('')}
                className="ml-auto flex items-center gap-1 text-[11.5px] text-gray-400 hover:text-gray-700 px-2 py-1 -my-1 rounded hover:bg-gray-100"
              >
                ver tudo
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* MICROSEGURO — seção própria, só quando há movimento.

                É OUTRA CONTA, não outro tipo de lançamento: a rota tem
                `Conta Rota X` e `Conta Microseguro X`, cada uma com seu saldo.
                A venda cai na conta do microseguro e a retirada sai dela para
                a da rota — por isso a venda NÃO aparece em `(+) entradas` ali
                acima, e não por uma regra que alguém precise lembrar de
                manter.

                A retirada aparece aqui como saída e, na faixa de cima, como
                transferência recebida. Não é duplicação: o microseguro perdeu
                o dinheiro e a conta da rota ganhou. */}
            {temMicro && (
              <div className="w-full px-4 py-2.5 border-t border-gray-100 flex items-center gap-x-2 gap-y-1 flex-wrap bg-sky-50/40">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-sky-800 mr-1">
                  Microseguro
                </span>
                <Grandeza
                  sinal="(+)"
                  nome="vendas"
                  valor={c.microseguro_vendas}
                  cor="text-emerald-700"
                  onClick={() => abrirMov('RECEBER', 'MICROSEGURO')}
                />
                <Grandeza
                  sinal="(−)"
                  nome="retiradas"
                  valor={c.microseguro_retiradas}
                  cor="text-amber-800"
                  onClick={() => abrirMov('', 'MICROSEGURO')}
                />
                <span className="text-[11.5px] text-gray-400">
                  conta própria — a venda entra nela e a retirada vai para a conta da rota
                </span>
                <button
                  onClick={() => abrirMov('', 'MICROSEGURO')}
                  className="ml-auto flex items-center gap-1 text-[11.5px] text-gray-400 hover:text-gray-700 px-2 py-1 -my-1 rounded hover:bg-gray-100"
                >
                  ver tudo
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="px-4 py-1.5 border-t border-gray-100 bg-gray-50 text-[10.5px] text-gray-400">
              Clique no total para ver a listagem · carteira e caixa são do último dia de cada rota
            </div>
          </div>

          {/* ── Dia a dia ── */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-gray-100">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-900">
                Dia a dia · {dados.por_dia.length} dias
              </h2>
              <button
                onClick={exportarDias}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Data</th>
                    <th className="text-right font-medium px-3 py-2">Cobrado</th>
                    <th className="text-right font-medium px-3 py-2">Esperado</th>
                    <th className="text-right font-medium px-3 py-2">Atingido</th>
                    <th className="text-right font-medium px-3 py-2">Emprestado</th>
                    <th className="text-right font-medium px-3 py-2">Lucro</th>
                    <th className="text-right font-medium px-3 py-2">Pagos</th>
                    <th className="text-right font-medium px-3 py-2">Não pagos</th>
                    {/* Caixa e carteira nas duas pontas do dia. O cliente pediu
                        em 07/10/2026: só o final estava aqui, e saldo sem o de
                        onde partiu não diz se o dia subiu ou desceu. */}
                    <th className="text-right font-medium px-3 py-2">Caixa inicial</th>
                    <th className="text-right font-medium px-3 py-2">Caixa final</th>
                    <th className="text-right font-medium px-3 py-2">Carteira inicial</th>
                    <th className="text-right font-medium px-3 py-2">Carteira final</th>
                    {/* Só quando o período tem alguma: coluna de zeros ocupa
                        largura que as outras precisam e some do olhar. */}
                    {temTransferencia && (
                      <th className="text-right font-medium px-3 py-2">Transferências</th>
                    )}
                    {temAjuste && (
                      <th className="text-right font-medium px-3 py-2">Ajustes</th>
                    )}
                    {temMicro && (
                      <>
                        <th className="text-right font-medium px-3 py-2">Micro. vendas</th>
                        <th className="text-right font-medium px-3 py-2">Micro. retiradas</th>
                      </>
                    )}
                    {temAporte && (
                      <th className="text-right font-medium px-3 py-2">Aporte</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dados.por_dia.map((d) => (
                    <tr key={d.data} className="hover:bg-gray-50">
                      {/* O dia da semana na frente do dia do mês: sem ele,
                          ler uma queda de cobrança exige contar no calendário.
                          Domingo em vermelho discreto — na maioria das rotas
                          `trabalha_domingo` é falso, e o dia aparecer fraco já
                          explica o número baixo sem precisar de nota. */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {(() => {
                          const s = diaSemana(d.data) === 0;
                          return (
                            <>
                              <span className={`text-[11px] font-semibold mr-1.5 ${s ? 'text-rose-600' : 'text-gray-400'}`}>
                                {SEMANA[diaSemana(d.data)]}
                              </span>
                              <span className={s ? 'text-rose-700' : 'text-gray-900'}>
                                {diaCurto(d.data)}
                              </span>
                            </>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">{fmt(d.recebido)}</td>
                      <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(d.esperado)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="inline-flex items-center gap-2 justify-end">
                          <span className="w-11 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <span
                              className={`block h-full ${corPct(d.percentual_recebimento)}`}
                              style={{ width: `${Math.min(100, d.percentual_recebimento)}%` }}
                            />
                          </span>
                          <span className="tabular-nums text-gray-600">
                            {Math.round(d.percentual_recebimento)}%
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(d.emprestado)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">{fmt(d.ganancia)}</td>
                      <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{d.clientes_pagos}</td>
                      <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{d.clientes_nao_pagos}</td>
                      <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{fmt(d.caixa_inicial)}</td>
                      <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(d.caixa_final)}</td>
                      <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{fmt(d.carteira_inicial)}</td>
                      <td className="px-3 py-2 text-right text-violet-700 tabular-nums">{fmt(d.carteira)}</td>
                      {temTransferencia && (
                        <td className="px-3 py-2 text-right text-amber-700 tabular-nums">
                          {d.transferencias ? fmt(d.transferencias) : '—'}
                        </td>
                      )}
                      {temAjuste && (
                        <td className="px-3 py-2 text-right text-blue-700 tabular-nums">
                          {d.ajustes ? fmt(d.ajustes) : '—'}
                        </td>
                      )}
                      {temMicro && (
                        <>
                          <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">
                            {d.microseguro_vendas ? fmt(d.microseguro_vendas) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-amber-800 tabular-nums">
                            {d.microseguro_retiradas ? fmt(d.microseguro_retiradas) : '—'}
                          </td>
                        </>
                      )}
                      {temAporte && (
                        <td className="px-3 py-2 text-right text-violet-700 tabular-nums">
                          {d.aportes ? fmt(d.aportes) : '—'}
                        </td>
                      )}
                    </tr>
                  ))}

                  {/* DIAS COM DINHEIRO E SEM LIQUIDAÇÃO.

                      Pedido de 08/10/2026, com a razão dele: *"o usuário vai
                      esquecer, e vai questionar divergências que ele mesmo
                      causou e não se lembra"*. Sem estas linhas, o total do
                      período seria maior que a soma dos dias e nada na tela
                      explicaria por quê.

                      Ficam no fim e marcadas, não intercaladas: não são dia
                      de trabalho da rota, e as colunas da liquidação não
                      existem para elas — não houve cobrança, nem caixa, nem
                      carteira. */}
                  {semLiq.map((d) => (
                    <tr key={`sl-${d.data}`} className="bg-amber-50/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-[11px] font-semibold mr-1.5 text-gray-400">
                          {SEMANA[diaSemana(d.data)]}
                        </span>
                        <span className="text-gray-900">{diaCurto(d.data)}</span>
                        <span className="block text-[10px] font-bold uppercase text-amber-700">
                          sem liquidação
                        </span>
                      </td>
                      <td colSpan={COLUNAS_DA_LIQUIDACAO} className="px-3 py-2 text-[11.5px] text-amber-800">
                        Dinheiro lançado em dia sem liquidação aberta — não entra em
                        nenhum dia fechado, e por isso o total do período não fecha
                        com a soma dos dias acima.
                        <span className="ml-1 tabular-nums text-gray-600">
                          {d.entradas !== 0 && <> entradas <b>{fmt(d.entradas)}</b></>}
                          {d.saidas !== 0 && <> · saídas <b>{fmt(d.saidas)}</b></>}
                        </span>
                      </td>
                      {temTransferencia && (
                        <td className="px-3 py-2 text-right text-amber-700 tabular-nums">
                          {d.transferencias ? fmt(d.transferencias) : '—'}
                        </td>
                      )}
                      {temAjuste && (
                        <td className="px-3 py-2 text-right text-blue-700 tabular-nums">
                          {d.ajustes ? fmt(d.ajustes) : '—'}
                        </td>
                      )}
                      {temMicro && (
                        <>
                          <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">
                            {d.microseguro_vendas ? fmt(d.microseguro_vendas) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-amber-800 tabular-nums">
                            {d.microseguro_retiradas ? fmt(d.microseguro_retiradas) : '—'}
                          </td>
                        </>
                      )}
                      {temAporte && (
                        <td className="px-3 py-2 text-right text-violet-700 tabular-nums">
                          {d.aportes ? fmt(d.aportes) : '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por rota só com mais de uma: com uma só, repetiria o consolidado. */}
          {dados.por_rota.length > 1 && (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-900">
                  Por rota · {dados.por_rota.length}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Rota</th>
                      <th className="text-right font-medium px-3 py-2">Dias</th>
                      <th className="text-right font-medium px-3 py-2">Cobrado</th>
                      <th className="text-right font-medium px-3 py-2">Emprestado</th>
                      <th className="text-right font-medium px-3 py-2">Lucro</th>
                      <th className="text-right font-medium px-3 py-2">Empréstimos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dados.por_rota.map((r) => (
                      <tr key={r.rota_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{r.rota_nome || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{r.dias}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">{fmt(r.recebido)}</td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(r.emprestado)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">{fmt(r.ganancia)}</td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{r.qtd_emprestimos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {escopoGerado && (
        <>
          <PainelCobranca
            aberto={painel === 'cobranca'}
            onFechar={() => setPainel(null)}
            rotaIds={escopoGerado.rotas}
            de={escopoGerado.de}
            ate={escopoGerado.ate}
            totalCard={c?.recebido ?? 0}
          />
          <PainelMovimentacoes
            key={`mov-${movConta}-${movTipo}`}
            aberto={painel === 'movimentacao'}
            onFechar={() => setPainel(null)}
            rotaIds={escopoGerado.rotas}
            de={escopoGerado.de}
            ate={escopoGerado.ate}
            entradasCard={
              movConta === 'MICROSEGURO' ? (c?.microseguro_vendas ?? 0) : (c?.entradas ?? 0)
            }
            saidasCard={
              movConta === 'MICROSEGURO' ? (c?.microseguro_retiradas ?? 0) : (c?.saidas ?? 0)
            }
            transferenciasCard={movConta === 'MICROSEGURO' ? 0 : (c?.transferencias ?? 0)}
            ajustesCard={movConta === 'MICROSEGURO' ? 0 : (c?.ajustes ?? 0)}
            tipoInicial={movTipo}
            tipoConta={movConta}
          />

          <PainelVendas
            aberto={painel === 'venda'}
            onFechar={() => setPainel(null)}
            rotaIds={escopoGerado.rotas}
            de={escopoGerado.de}
            ate={escopoGerado.ate}
            totalCard={c?.emprestado ?? 0}
          />
        </>
      )}
    </div>
  );
}
