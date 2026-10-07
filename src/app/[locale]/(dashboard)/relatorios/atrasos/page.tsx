'use client';

// =====================================================================
// RELATÓRIO: ATRASOS
// =====================================================================
//
// Pedido do cliente em 07/10/2026.
//
// É uma FOTO numa data, e não um período — por isso a barra de filtros vem no
// modo `data`. Atraso é estado, não fluxo: "quanto atraso houve em setembro"
// não tem resposta única, porque o mesmo cliente esteve atrasado em dias
// diferentes por valores diferentes. A pergunta que tem resposta é "quem está
// atrasado nesta data, e há quanto tempo".
//
// ⚠ OS DIAS SÃO DIAS DE COBRANÇA, não de calendário. Domingo em rota que não
// trabalha domingo e feriado de `feriados_rota` não contam — ninguém foi
// cobrar. É a mesma regra que o app usa no card do cliente, e os dois números
// precisam bater: se o escritório vê 20 e o vendedor vê 17, a conversa entre
// eles acaba em discussão sobre quem está certo.
//
// Nenhuma conta acontece aqui. Ver sql/2026-10-07_fn_atrasos.sql.

import { ArrowLeft, Download, Loader2, Phone } from 'lucide-react';
import { useState } from 'react';
import BarraFiltros from '@/components/relatorios/BarraFiltros';
import { Link } from '@/i18n/routing';
import { relatoriosService } from '@/services/relatorios';
import type { AtrasosRelatorio, LinhaAtraso } from '@/types/relatorios';
import { baixarCsv, numCsv } from '@/utils/csv';

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dataBr = (d: string | null) => {
  if (!d) return '—';
  const [a, m, dd] = d.substring(0, 10).split('-');
  return `${dd}/${m}/${a}`;
};

const FREQ: Record<string, string> = {
  DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal', FLEXIVEL: 'Flexível',
};

/**
 * A cor da faixa — a MESMA escala do card no app
 * (apprutea_android/src/utils/diasCobranca.ts): verde em dia, amarelo até 3,
 * roxo até 7, vermelho acima. O roxo no nível médio é pedido do cliente:
 * laranja e amarelo ficavam indistinguíveis na tela do celular.
 */
const corDias = (d: number) =>
  d <= 3 ? 'bg-amber-50 text-amber-700'
    : d <= 7 ? 'bg-violet-50 text-violet-700'
      : d <= 30 ? 'bg-red-50 text-red-700'
        : 'bg-red-600 text-white';

const corFaixa = (faixa: string) =>
  faixa.startsWith('1 a 3') ? 'bg-amber-400'
    : faixa.startsWith('4 a 7') ? 'bg-violet-500'
      : faixa.startsWith('8 a 15') ? 'bg-red-400'
        : faixa.startsWith('16 a 30') ? 'bg-red-500'
          : 'bg-red-700';

export default function AtrasosPage() {
  const [dados, setDados] = useState<AtrasosRelatorio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [minDias, setMinDias] = useState(1);
  const [ultimo, setUltimo] = useState<{ rotas: string[]; data: string } | null>(null);

  const buscar = async (rotas: string[], data: string, md: number, q: string) => {
    setCarregando(true);
    setErro(null);
    const r = await relatoriosService.buscarAtrasos(rotas, data, {
      minDias: md, busca: q, limite: 500,
    });
    setCarregando(false);
    if (!r || !r.sucesso) {
      setErro(r?.mensagem ?? 'Não foi possível gerar o relatório.');
      setDados(null);
      return;
    }
    setUltimo({ rotas, data });
    setDados(r);
  };

  const gerar = (rotas: string[], de: string) => buscar(rotas, de, minDias, busca);

  // Refaz com os filtros da própria lista, sem pedir o escopo de novo.
  const refiltrar = (md: number, q: string) => {
    setMinDias(md);
    setBusca(q);
    if (ultimo) buscar(ultimo.rotas, ultimo.data, md, q);
  };

  const t = dados?.totais ?? null;

  const exportar = () => {
    if (!dados?.linhas.length) return;
    baixarCsv<LinhaAtraso>(
      `atrasos_${dados.data}`,
      [
        { cabecalho: 'Cliente', valor: (l) => l.cliente_nome },
        { cabecalho: 'Documento', valor: (l) => l.cliente_documento },
        { cabecalho: 'Telefone', valor: (l) => l.telefone },
        { cabecalho: 'Rota', valor: (l) => l.rota_nome },
        { cabecalho: 'Frequência', valor: (l) => FREQ[l.frequencia] ?? l.frequencia },
        { cabecalho: 'Venceu em', valor: (l) => l.vencimento_antigo },
        { cabecalho: 'Dias de atraso', valor: (l) => l.dias_atraso },
        { cabecalho: 'Parcelas vencidas', valor: (l) => l.parcelas_vencidas },
        { cabecalho: 'Valor vencido', valor: (l) => numCsv(l.valor_vencido) },
        { cabecalho: 'Saldo do empréstimo', valor: (l) => numCsv(l.saldo) },
        { cabecalho: 'Último pagamento', valor: (l) => l.ultimo_pagamento },
      ],
      dados.linhas
    );
  };

  const campo =
    'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

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
          <h1 className="text-lg font-bold text-gray-900">Atrasos</h1>
          <p className="text-xs text-gray-400">
            Quem está devendo, há quanto tempo e quanto — em dias de cobrança
          </p>
        </div>
      </div>

      <BarraFiltros modo="data" onGerar={(r, de) => gerar(r, de)} carregando={carregando} />

      {erro && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          {erro}
        </div>
      )}

      {carregando && !dados && (
        <div className="flex items-center gap-2 text-sm text-gray-400 p-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Levantando os atrasos…
        </div>
      )}

      {dados && t && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-gray-900">
                Posição em {dataBr(dados.data)}
              </h2>
              <span className="text-xs text-gray-400">
                média de {t.media_dias} dias · pior caso {t.pior_caso} dias
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Clientes</p>
                <p className="text-2xl font-extrabold text-gray-900 tabular-nums">{t.clientes}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Valor vencido</p>
                <p className="text-2xl font-extrabold text-red-700 tabular-nums">{fmt(t.valor_vencido)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Parcelas vencidas</p>
                <p className="text-xl font-bold text-gray-900 tabular-nums">{t.parcelas_vencidas}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  Saldo total envolvido
                </p>
                <p className="text-xl font-bold text-gray-900 tabular-nums">{fmt(t.saldo_total)}</p>
              </div>
            </div>

            {/* As faixas são a leitura que a lista sozinha não dá: dez clientes
                com três dias é um problema diferente de dois com sessenta. */}
            {dados.faixas.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                {dados.faixas.map((f) => {
                  const pct = t.clientes > 0 ? (f.clientes / t.clientes) * 100 : 0;
                  return (
                    <div key={f.faixa} className="flex items-center gap-3 text-xs">
                      <span className="w-28 text-gray-500 shrink-0">{f.faixa}</span>
                      <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <span
                          className={`block h-full ${corFaixa(f.faixa)}`}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </span>
                      <span className="w-14 text-right text-gray-700 tabular-nums">{f.clientes}</span>
                      <span className="w-28 text-right font-semibold text-gray-900 tabular-nums">
                        {fmt(f.valor)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center gap-2 flex-wrap bg-gray-50">
              <input
                id="atrasos-busca"
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') refiltrar(minDias, busca); }}
                placeholder="Cliente ou documento"
                className={`${campo} min-w-[200px]`}
              />
              <select
                id="atrasos-min"
                value={minDias}
                onChange={(e) => refiltrar(Number(e.target.value), busca)}
                aria-label="Atraso mínimo"
                className={campo}
              >
                <option value={1}>A partir de 1 dia</option>
                <option value={4}>A partir de 4 dias</option>
                <option value={8}>A partir de 8 dias</option>
                <option value={16}>A partir de 16 dias</option>
                <option value={31}>Mais de 30 dias</option>
              </select>
              <button
                onClick={() => refiltrar(minDias, busca)}
                className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Aplicar
              </button>
              {carregando && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              <span className="text-xs text-gray-400 ml-auto">
                {dados.total_registros} empréstimo(s)
                {dados.total_registros > dados.linhas.length && ` · mostrando ${dados.linhas.length}`}
              </span>
              <button
                onClick={exportar}
                disabled={!dados.linhas.length}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
            </div>

            {dados.linhas.length === 0 ? (
              <p className="text-sm text-gray-500 p-8 text-center">
                Nenhum atraso com esses filtros.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Cliente</th>
                      <th className="text-left font-medium px-3 py-2">Rota</th>
                      <th className="text-left font-medium px-3 py-2">Frequência</th>
                      <th className="text-left font-medium px-3 py-2">Venceu em</th>
                      <th className="text-right font-medium px-3 py-2">Atraso</th>
                      <th className="text-right font-medium px-3 py-2">Parcelas</th>
                      <th className="text-right font-medium px-3 py-2">Vencido</th>
                      <th className="text-right font-medium px-3 py-2">Saldo</th>
                      <th className="text-left font-medium px-3 py-2">Último pagto.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dados.linhas.map((l) => (
                      <tr key={l.emprestimo_id} className="hover:bg-gray-50 align-top">
                        <td className="px-3 py-2">
                          <span className="text-gray-900">{l.cliente_nome || '—'}</span>
                          <span className="block text-[11px] text-gray-400">
                            {l.cliente_documento || ''}
                            {l.telefone && (
                              <span className="inline-flex items-center gap-1 ml-2">
                                <Phone className="w-3 h-3" />{l.telefone}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{l.rota_nome}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {FREQ[l.frequencia] ?? l.frequencia}
                          <span className="block text-[11px] text-gray-400">{l.tipo_emprestimo}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {dataBr(l.vencimento_antigo)}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${corDias(l.dias_atraso)}`}>
                            {l.dias_atraso} {l.dias_atraso === 1 ? 'dia' : 'dias'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                          {l.parcelas_vencidas}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-red-700 tabular-nums">
                          {fmt(l.valor_vencido)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(l.saldo)}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {dataBr(l.ultimo_pagamento)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-[11px] text-gray-400 px-1">
            Dias contados em dias de cobrança: domingo sem expediente e feriado da rota não contam.
            É o mesmo número que o vendedor vê no card do cliente.
          </p>
        </>
      )}
    </div>
  );
}
