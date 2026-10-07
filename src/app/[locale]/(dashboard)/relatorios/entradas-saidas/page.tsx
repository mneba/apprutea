'use client';

// =====================================================================
// RELATÓRIO: ENTRADAS E SAÍDAS
// =====================================================================
//
// Pedido do cliente em 07/10/2026: além de cobrado e emprestado, ver despesas,
// caixas iniciais e finais, carteira inicial e final, aportes, retiradas e
// "qualquer movimentação de dinheiro".
//
// A LEITURA EM TRÊS CAMADAS
//
//   SALDO    — caixa e carteira, nas pontas do período. Não são soma de nada:
//              somar o caixa final de cada dia daria um número sem significado.
//              Por isso aparecem como "de X para Y", nunca como total.
//
//   FLUXO    — entradas e saídas, e o resultado entre elas. É o que de fato
//              aconteceu no período.
//
//   DETALHE  — toda movimentação, por categoria. A lista é aberta: vem do que
//              existir em `financeiro`, sem nomes fixos no código. Aporte e
//              retirada aparecem por si, e categoria criada amanhã também.
//
// Nenhuma conta acontece aqui. Ver sql/2026-10-07_fn_entradas_saidas_periodo.sql.

import { ArrowLeft, Download, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import BarraFiltros from '@/components/relatorios/BarraFiltros';
import { Link } from '@/i18n/routing';
import { relatoriosService } from '@/services/relatorios';
import type { DiaEntradaSaida, EntradasSaidasPeriodo, MovimentoCategoria } from '@/types/relatorios';
import { baixarCsv, numCsv } from '@/utils/csv';

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `YYYY-MM-DD` → `DD/MM`. Sem `new Date`: evita o recuo de fuso. */
const diaCurto = (d: string) => {
  const [, m, dd] = d.substring(0, 10).split('-');
  return `${dd}/${m}`;
};

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const diaSemana = (d: string) => {
  const [a, m, dd] = d.substring(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, dd)).getUTCDay();
};

/** Caixa e carteira podem ser negativos; o sinal precisa aparecer. */
const comSinal = (n: number) => `${n < 0 ? '−' : ''}${fmt(Math.abs(n))}`;

export default function EntradasSaidasPage() {
  const [dados, setDados] = useState<EntradasSaidasPeriodo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<{ de: string; ate: string } | null>(null);

  const gerar = async (rotas: string[], de: string, ate: string) => {
    setCarregando(true);
    setErro(null);
    const r = await relatoriosService.buscarEntradasSaidas(rotas, de, ate);
    setCarregando(false);
    if (!r || !r.sucesso) {
      setErro(r?.mensagem ?? 'Não foi possível gerar o relatório.');
      setDados(null);
      return;
    }
    setPeriodo({ de, ate });
    setDados(r);
  };

  const c = dados?.consolidado ?? null;

  const exportarDias = () => {
    if (!dados?.por_dia.length) return;
    baixarCsv<DiaEntradaSaida>(
      `entradas_saidas_${periodo?.de}_a_${periodo?.ate}`,
      [
        { cabecalho: 'Dia', valor: (d) => d.data },
        { cabecalho: 'Caixa inicial', valor: (d) => numCsv(d.caixa_inicial) },
        { cabecalho: 'Entradas', valor: (d) => numCsv(d.entradas) },
        { cabecalho: 'Saídas', valor: (d) => numCsv(d.saidas) },
        { cabecalho: 'Cobrado', valor: (d) => numCsv(d.cobrado) },
        { cabecalho: 'Emprestado', valor: (d) => numCsv(d.emprestado) },
        { cabecalho: 'Despesas', valor: (d) => numCsv(d.despesas) },
        { cabecalho: 'Caixa final', valor: (d) => numCsv(d.caixa_final) },
        { cabecalho: 'Carteira final', valor: (d) => numCsv(d.carteira_final) },
      ],
      dados.por_dia
    );
  };

  const exportarCategorias = () => {
    if (!dados?.por_categoria.length) return;
    baixarCsv<MovimentoCategoria>(
      `movimentacoes_${periodo?.de}_a_${periodo?.ate}`,
      [
        { cabecalho: 'Tipo', valor: (m) => m.tipo },
        { cabecalho: 'Categoria', valor: (m) => m.categoria },
        { cabecalho: 'Lançamentos', valor: (m) => m.qtd },
        { cabecalho: 'Total', valor: (m) => numCsv(m.total) },
      ],
      dados.por_categoria
    );
  };

  const entradas = dados?.por_categoria.filter((m) => m.tipo === 'RECEBER') ?? [];
  const saidas = dados?.por_categoria.filter((m) => m.tipo === 'PAGAR') ?? [];
  const ajustes = dados?.por_categoria.filter((m) => m.tipo === 'AJUSTE') ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/relatorios"
          className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Entradas e saídas</h1>
          <p className="text-xs text-gray-400">
            Todo o dinheiro que entrou e saiu, por categoria
          </p>
        </div>
      </div>

      <BarraFiltros onGerar={gerar} carregando={carregando} />

      {erro && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          {erro}
        </div>
      )}

      {carregando && !dados && (
        <div className="flex items-center gap-2 text-sm text-gray-400 p-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Somando o período…
        </div>
      )}

      {dados && c && (
        <>
          {/* ── SALDO: as pontas. Não é soma, é posição. ───────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-900">
                Posição
              </h2>
              <span className="text-xs text-gray-400">
                {periodo && `${diaCurto(periodo.de)} a ${diaCurto(periodo.ate)}`} · {c.dias} dias · {dados.rotas} rota(s)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Caixa</p>
                <p className="text-sm text-gray-500 mt-1 tabular-nums">
                  {comSinal(c.caixa_inicial)}
                  <span className="mx-2 text-gray-300">→</span>
                  <b className={`text-lg ${c.caixa_final < 0 ? 'text-red-700' : 'text-gray-900'}`}>
                    {comSinal(c.caixa_final)}
                  </b>
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  Carteira a receber
                </p>
                <p className="text-sm text-gray-500 mt-1 tabular-nums">
                  {comSinal(c.carteira_inicial)}
                  <span className="mx-2 text-gray-300">→</span>
                  <b className="text-lg text-gray-900">{comSinal(c.carteira_final)}</b>
                </p>
              </div>
            </div>

            {/* ── FLUXO ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-gray-100">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-emerald-600" /> Entradas
                </p>
                <p className="text-lg font-extrabold text-emerald-700 tabular-nums">{fmt(c.entradas)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3 text-red-600" /> Saídas
                </p>
                <p className="text-lg font-extrabold text-red-700 tabular-nums">{fmt(c.saidas)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Cobrado</p>
                <p className="text-base font-bold text-gray-900 tabular-nums">{fmt(c.cobrado)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Emprestado</p>
                <p className="text-base font-bold text-gray-900 tabular-nums">{fmt(c.emprestado)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Despesas</p>
                <p className="text-base font-bold text-gray-900 tabular-nums">{fmt(c.despesas)}</p>
              </div>
            </div>

            {/* Despesa é saída que não é empréstimo: o dinheiro emprestado
                virou carteira, não sumiu. Sem esta linha, alguém vai somar
                despesa + emprestado e achar que falta dinheiro. */}
            <p className="text-[11px] text-gray-400 mt-3">
              Despesas não incluem os empréstimos: aquele dinheiro saiu do caixa e virou carteira.
            </p>
          </div>

          {/* ── DETALHE: toda movimentação, por categoria ──────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-900">
                Movimentações · {dados.por_categoria.length} categorias
              </h2>
              <button
                onClick={exportarCategorias}
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>

            {dados.por_categoria.length === 0 ? (
              <p className="text-sm text-gray-500 p-8 text-center">
                Nenhuma movimentação no período.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                {[
                  { titulo: 'Entradas', itens: entradas, cor: 'text-emerald-700' },
                  { titulo: 'Saídas', itens: saidas, cor: 'text-red-700' },
                  { titulo: 'Ajustes de saldo', itens: ajustes, cor: 'text-blue-700' },
                ].map((grupo) => (
                  <div key={grupo.titulo} className="p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                      {grupo.titulo}
                    </p>
                    {grupo.itens.length === 0 ? (
                      <p className="text-xs text-gray-400">—</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {grupo.itens.map((m) => (
                          <li key={`${m.tipo}-${m.categoria}`} className="flex items-baseline gap-2 text-sm">
                            <span className="text-gray-700 truncate">{m.categoria}</span>
                            <span className="text-[11px] text-gray-400">{m.qtd}</span>
                            <span className={`ml-auto font-semibold tabular-nums ${grupo.cor}`}>
                              {fmt(m.total)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── DIA A DIA ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-900">
                Dia a dia · {dados.por_dia.length} dias
              </h2>
              <button
                onClick={exportarDias}
                className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Data</th>
                    <th className="text-right font-medium px-3 py-2">Caixa inicial</th>
                    <th className="text-right font-medium px-3 py-2">Entradas</th>
                    <th className="text-right font-medium px-3 py-2">Saídas</th>
                    <th className="text-right font-medium px-3 py-2">Cobrado</th>
                    <th className="text-right font-medium px-3 py-2">Emprestado</th>
                    <th className="text-right font-medium px-3 py-2">Despesas</th>
                    <th className="text-right font-medium px-3 py-2">Caixa final</th>
                    <th className="text-right font-medium px-3 py-2">Carteira</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dados.por_dia.map((d) => {
                    const dom = diaSemana(d.data) === 0;
                    return (
                      <tr key={d.data} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`text-[11px] font-semibold mr-1.5 ${dom ? 'text-rose-600' : 'text-gray-400'}`}>
                            {SEMANA[diaSemana(d.data)]}
                          </span>
                          <span className={dom ? 'text-rose-700' : 'text-gray-900'}>{diaCurto(d.data)}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{comSinal(d.caixa_inicial)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">{fmt(d.entradas)}</td>
                        <td className="px-3 py-2 text-right text-red-700 tabular-nums">{fmt(d.saidas)}</td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(d.cobrado)}</td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(d.emprestado)}</td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(d.despesas)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">{comSinal(d.caixa_final)}</td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(d.carteira_final)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
