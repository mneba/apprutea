'use client';

// =====================================================================
// RELATÓRIO: LIQUIDAÇÃO POR PERÍODO
// =====================================================================
//
// Substitui, numa tela, as abas "Liquidacion" e "Resumen" do sistema legado —
// elas mostram o mesmo dado em granularidades diferentes, então viram
// consolidado em cima e quebra por rota embaixo.
//
// E acrescenta o que o legado não tem: a SÉRIE DIÁRIA. Lá dá para ver o total
// do período e o total por rota, mas não que a quarta-feira caiu.
//
// Nenhuma conta acontece aqui. Tudo vem de `fn_liquidacoes_periodo` — inclusive
// o que NÃO somar. Ver o cabeçalho da função: caixa e carteira somam entre
// rotas e nunca entre dias; a ganancia é juro realizado, distinta do juro
// vendido; e o período não tem percentual de recebimento de propósito.

import {
  ArrowLeft, Banknote, Download, Loader2, PiggyBank,
  TrendingUp, Users, Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import ArvoreEscopo from '@/components/relatorios/ArvoreEscopo';
import SeletorPeriodo from '@/components/relatorios/SeletorPeriodo';
import { Link } from '@/i18n/routing';
import { relatoriosService } from '@/services/relatorios';
import type { EstruturaVisivel, LiquidacoesPeriodo } from '@/types/relatorios';
import { baixarCsv, numCsv } from '@/utils/csv';

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `YYYY-MM-DD` → `DD/MM`. Sem `new Date`: evita o recuo de fuso. */
const diaCurto = (d: string) => {
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

export default function LiquidacaoPeriodoPage() {
  const [estrutura, setEstrutura] = useState<EstruturaVisivel | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [de, setDe] = useState(primeiroDoMes());
  const [ate, setAte] = useState(hojeIso());

  const [dados, setDados] = useState<LiquidacoesPeriodo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const e = await relatoriosService.buscarEstrutura();
      setEstrutura(e);
    })();
  }, []);

  const podeGerar = selecionadas.size > 0 && !!de && !!ate && ate >= de && !carregando;

  const gerar = useCallback(async () => {
    if (selecionadas.size === 0) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await relatoriosService.buscarLiquidacoesPeriodo(
        Array.from(selecionadas), de, ate
      );
      if (!r) {
        setErro('Não foi possível gerar o relatório.');
        setDados(null);
      } else if (!r.sucesso) {
        setErro(r.mensagem || 'Não foi possível gerar o relatório.');
        setDados(null);
      } else {
        setDados(r);
      }
    } finally {
      setCarregando(false);
    }
  }, [selecionadas, de, ate]);

  const c = dados?.consolidado ?? null;

  const grafico = useMemo(
    () =>
      (dados?.por_dia ?? []).map((d) => ({
        dia: diaCurto(d.data),
        Recebido: d.recebido,
        Emprestado: d.emprestado,
      })),
    [dados]
  );

  const exportarDias = () => {
    if (!dados) return;
    baixarCsv(
      `liquidacao_${de}_a_${ate}`,
      [
        { cabecalho: 'Data', valor: (d) => d.data },
        { cabecalho: 'Rotas', valor: (d) => d.rotas },
        { cabecalho: 'Recebido', valor: (d) => numCsv(d.recebido) },
        { cabecalho: 'Esperado do dia', valor: (d) => numCsv(d.esperado) },
        { cabecalho: '% do dia', valor: (d) => numCsv(d.percentual_recebimento) },
        { cabecalho: 'Emprestado', valor: (d) => numCsv(d.emprestado) },
        { cabecalho: 'Juros vendidos', valor: (d) => numCsv(d.juros_vendidos) },
        { cabecalho: 'Ganancia', valor: (d) => numCsv(d.ganancia) },
        { cabecalho: 'Empréstimos', valor: (d) => d.qtd_emprestimos },
        { cabecalho: 'Clientes pagos', valor: (d) => d.clientes_pagos },
        { cabecalho: 'Clientes não pagos', valor: (d) => d.clientes_nao_pagos },
        { cabecalho: 'Caixa final', valor: (d) => numCsv(d.caixa_final) },
        { cabecalho: 'Carteira', valor: (d) => numCsv(d.carteira) },
      ],
      dados.por_dia
    );
  };

  const cards = c
    ? [
        { rot: 'Recebido', val: fmt(c.recebido), icon: Banknote, cor: 'bg-green-100 text-green-600' },
        { rot: 'Ganancia', val: fmt(c.ganancia), icon: TrendingUp, cor: 'bg-emerald-100 text-emerald-600',
          sub: 'juro realizado' },
        { rot: 'Emprestado', val: fmt(c.emprestado), icon: PiggyBank, cor: 'bg-blue-100 text-blue-600',
          sub: `${c.qtd_emprestimos} empréstimos` },
        { rot: 'Carteira', val: fmt(c.carteira), icon: Wallet, cor: 'bg-indigo-100 text-indigo-600',
          sub: 'último dia' },
        { rot: 'Média diária', val: fmt(c.media_diaria), icon: TrendingUp, cor: 'bg-purple-100 text-purple-600',
          sub: `${c.dias_trabalhados} dias trabalhados` },
        { rot: 'Clientes', val: `${c.clientes_pagos}`, icon: Users, cor: 'bg-amber-100 text-amber-600',
          sub: `${c.clientes_nao_pagos} não pagos` },
      ]
    : [];

  return (
    <div className="space-y-6">
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

      {/* ── Filtros ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Escopo</h2>
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

        <div className="bg-white rounded-xl border border-gray-200 p-4 lg:col-span-2 flex flex-col">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Período</h2>
          <SeletorPeriodo
            de={de}
            ate={ate}
            onChange={(d, a) => {
              setDe(d);
              setAte(a);
            }}
          />

          <div className="mt-auto pt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={gerar}
              disabled={!podeGerar}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:bg-blue-200 disabled:cursor-not-allowed"
            >
              {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
              {carregando ? 'Gerando…' : 'Gerar'}
            </button>
            {selecionadas.size === 0 && (
              <span className="text-xs text-gray-500">Escolha ao menos uma rota.</span>
            )}
          </div>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {erro}
        </div>
      )}

      {dados && !c && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Nenhuma liquidação encontrada nesse recorte e intervalo.
        </div>
      )}

      {/* `dados` entra na guarda junto com `c`: o compilador nao liga um ao
          outro so porque `c` saiu de `dados?.consolidado`. */}
      {dados && c && (
        <>
          {/* ── Consolidado ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {cards.map((k) => (
              <div key={k.rot} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">{k.rot}</span>
                  <span className={`p-1.5 rounded-lg ${k.cor}`}>
                    <k.icon className="w-4 h-4" />
                  </span>
                </div>
                <p className="text-xl font-bold text-gray-900 mt-2">{k.val}</p>
                {k.sub && <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>

          {/* O caixa fica num bloco à parte, com o aviso do que ele é: somar
              caixa entre dias não significa nada, e é o erro mais fácil de
              cometer lendo um relatório de período. */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-xs font-medium text-gray-500">Caixa inicial</p>
                <p className="text-lg font-bold text-gray-900">{fmt(c.caixa_inicial)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Caixa final</p>
                <p className="text-lg font-bold text-gray-900">{fmt(c.caixa_final)}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Juros vendidos</p>
                <p className="text-lg font-bold text-gray-900">{fmt(c.juros_vendidos)}</p>
                <p className="text-xs text-gray-400">contratado, não recebido</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Novos / Renovados</p>
                <p className="text-lg font-bold text-gray-900">
                  {c.clientes_novos} / {c.clientes_renovados}
                </p>
              </div>
              <p className="text-xs text-gray-400 max-w-xs self-end">
                Caixa e carteira são do primeiro e do último dia de cada rota — não
                somam entre dias.
              </p>
            </div>
          </div>

          {/* ── Série diária ── */}
          {grafico.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Dia a dia</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={grafico}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                    <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="Recebido" fill="#2563EB" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Emprestado" fill="#A5B4FC" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Tabela dia a dia ── */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">
                Dia a dia ({dados.por_dia.length})
              </h2>
              <button
                type="button"
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
                    <th className="text-left font-medium px-4 py-2">Data</th>
                    <th className="text-right font-medium px-4 py-2">Recebido</th>
                    <th className="text-right font-medium px-4 py-2">Esperado do dia</th>
                    <th className="text-right font-medium px-4 py-2">%</th>
                    <th className="text-right font-medium px-4 py-2">Emprestado</th>
                    <th className="text-right font-medium px-4 py-2">Ganancia</th>
                    <th className="text-right font-medium px-4 py-2">Pagos</th>
                    <th className="text-right font-medium px-4 py-2">Não pagos</th>
                    <th className="text-right font-medium px-4 py-2">Caixa final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dados.por_dia.map((d) => (
                    <tr key={d.data} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900">{diaCurto(d.data)}</td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        {fmt(d.recebido)}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">{fmt(d.esperado)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">
                        {fmt(d.percentual_recebimento)}%
                      </td>
                      <td className="px-4 py-2 text-right text-gray-500">{fmt(d.emprestado)}</td>
                      <td className="px-4 py-2 text-right text-emerald-700">{fmt(d.ganancia)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{d.clientes_pagos}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{d.clientes_nao_pagos}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{fmt(d.caixa_final)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Por rota só aparece com mais de uma: com uma só, repetiria o
              consolidado linha por linha. */}
          {dados.por_rota.length > 1 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">
                  Por rota ({dados.por_rota.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-4 py-2">Rota</th>
                      <th className="text-right font-medium px-4 py-2">Dias</th>
                      <th className="text-right font-medium px-4 py-2">Recebido</th>
                      <th className="text-right font-medium px-4 py-2">Emprestado</th>
                      <th className="text-right font-medium px-4 py-2">Ganancia</th>
                      <th className="text-right font-medium px-4 py-2">Empréstimos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dados.por_rota.map((r) => (
                      <tr key={r.rota_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{r.rota_nome || '—'}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{r.dias}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">
                          {fmt(r.recebido)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">{fmt(r.emprestado)}</td>
                        <td className="px-4 py-2 text-right text-emerald-700">
                          {fmt(r.ganancia)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {r.qtd_emprestimos}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
