'use client';

// =====================================================================
// LISTAGEM DAS VENDAS
// =====================================================================
//
// O detalhe atrás do total emprestado — a aba "Ventas por Periodos" do
// sistema legado.
//
// A CLASSIFICAÇÃO DA RENOVAÇÃO é a razão de esta listagem valer mais que uma
// lista crua: cada renovação vem marcada como MAIOR, IGUAL ou MENOR contra o
// empréstimo anterior do cliente. Lido no rodapé, isso responde de uma vez se
// a carteira está crescendo, parada ou encolhendo — pergunta que hoje ninguém
// consegue fazer ao sistema.
//
// A comparação é sobre o PRINCIPAL, não sobre o total: o total embute o juro,
// e uma mudança de taxa faria uma renovação de mesmo valor parecer maior.

import { ArrowUpFromLine } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ListaRelatorio, { Paginacao } from '@/components/relatorios/ListaRelatorio';
import { relatoriosService } from '@/services/relatorios';
import type { LinhaVenda, VendasPeriodo } from '@/types/relatorios';
import { baixarCsv, numCsv } from '@/utils/csv';

interface Props {
  /** A listagem só consulta quando está no palco. */
  aberto: boolean;
  rotaIds: string[];
  de: string;
  ate: string;
}

const POR_PAGINA = 100;

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const diaCurto = (d: string) => {
  const [, m, dd] = d.substring(0, 10).split('-');
  return `${dd}/${m}`;
};

const CLASSES: Record<string, { rotulo: string; classe: string }> = {
  MAIOR: { rotulo: 'Maior valor', classe: 'bg-emerald-50 text-emerald-700' },
  IGUAL: { rotulo: 'Igual valor', classe: 'bg-blue-50 text-blue-700' },
  MENOR: { rotulo: 'Menor valor', classe: 'bg-amber-50 text-amber-700' },
  PRIMEIRO: { rotulo: 'Primeiro', classe: 'bg-gray-100 text-gray-600' },
};

const FREQ: Record<string, string> = {
  DIARIO: 'Diário',
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
  FLEXIVEL: 'Flexível',
};

const campo =
  'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function PainelVendas({ aberto, rotaIds, de, ate }: Props) {
  const [dados, setDados] = useState<VendasPeriodo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [classe, setClasse] = useState('');
  const [pagina, setPagina] = useState(0);

  const carregar = useCallback(async () => {
    if (!aberto || rotaIds.length === 0) return;
    setCarregando(true);
    const r = await relatoriosService.buscarVendas(rotaIds, de, ate, {
      busca, tipo, classe, limite: POR_PAGINA, offset: pagina * POR_PAGINA,
    });
    setDados(r);
    setCarregando(false);
  }, [aberto, rotaIds, de, ate, busca, tipo, classe, pagina]);

  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(carregar, busca ? 400 : 0);
    return () => clearTimeout(t);
  }, [aberto, carregar, busca]);

  useEffect(() => { setPagina(0); }, [busca, tipo, classe, de, ate]);

  const t = dados?.totais ?? null;
  const linhas = dados?.linhas ?? [];

  const exportar = () => {
    if (!linhas.length) return;
    baixarCsv<LinhaVenda>(
      `vendas_${de}_a_${ate}`,
      [
        { cabecalho: 'Dia', valor: (l) => l.data_operacional },
        { cabecalho: 'Cliente', valor: (l) => l.cliente_nome },
        { cabecalho: 'Documento', valor: (l) => l.cliente_documento },
        { cabecalho: 'Rota', valor: (l) => l.rota_nome },
        { cabecalho: 'Tipo', valor: (l) => l.tipo_emprestimo },
        { cabecalho: 'Frequência', valor: (l) => FREQ[l.frequencia] ?? l.frequencia },
        { cabecalho: 'Valor anterior', valor: (l) => numCsv(l.valor_anterior) },
        { cabecalho: 'Principal', valor: (l) => numCsv(l.valor_principal) },
        { cabecalho: 'Comparação', valor: (l) => CLASSES[l.classificacao]?.rotulo ?? l.classificacao },
        { cabecalho: 'Taxa %', valor: (l) => numCsv(l.taxa_juros) },
        { cabecalho: 'Juro', valor: (l) => numCsv(l.juros) },
        { cabecalho: 'Total', valor: (l) => numCsv(l.valor_total) },
        { cabecalho: 'Parcelas', valor: (l) => l.numero_parcelas },
        { cabecalho: 'Valor da parcela', valor: (l) => numCsv(l.valor_parcela) },
        { cabecalho: 'Saldo', valor: (l) => numCsv(l.saldo) },
      ],
      linhas
    );
  };

  if (!aberto) return null;

  return (
    <ListaRelatorio
      icone={ArrowUpFromLine}
      cor="azul"
      titulo="Venda"
      subtitulo={`${diaCurto(de)} a ${diaCurto(ate)} · ${rotaIds.length} rota(s)`}
      carregando={carregando}
      onExportar={exportar}
      podeExportar={linhas.length > 0}
      filtros={
        <>
          <input
            id="vendas-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente ou documento"
            className={`${campo} min-w-[200px]`}
          />
          <select id="vendas-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de empréstimo" className={campo}>
            <option value="">Todo tipo</option>
            <option value="NOVO">Novo</option>
            <option value="RENOVACAO">Renovação</option>
            <option value="ADICIONAL">Adicional</option>
            <option value="RENEGOCIACAO">Renegociação</option>
          </select>
          <select id="vendas-classe" value={classe} onChange={(e) => setClasse(e.target.value)} aria-label="Comparação com o anterior" className={campo}>
            <option value="">Toda comparação</option>
            {Object.entries(CLASSES).map(([k, v]) => (
              <option key={k} value={k}>{v.rotulo}</option>
            ))}
          </select>
        </>
      }
      contagem={<span>{dados?.total_registros ?? 0} empréstimo(s)</span>}
      totais={
        t && (
          <span className="tabular-nums">
            <b className="text-gray-900">{fmt(t.principal)}</b> emprestado ·{' '}
            <b className="text-gray-900">{fmt(t.juros)}</b> de juro
            {/* A leitura que a classificação permite: a carteira cresceu,
                ficou parada ou encolheu neste período. */}
            <span className="ml-2 text-gray-500">
              · <b className="text-emerald-700">{t.maior}</b> maior ·{' '}
              <b className="text-blue-700">{t.igual}</b> igual ·{' '}
              <b className="text-amber-700">{t.menor}</b> menor ·{' '}
              <b className="text-gray-700">{t.primeiro}</b> primeiro
            </span>
          </span>
        )
      }
      paginacao={
        <Paginacao
          pagina={pagina}
          porPagina={POR_PAGINA}
          total={dados?.total_registros ?? 0}
          onIr={setPagina}
        />
      }
    >
      {!carregando && linhas.length === 0 ? (
        <p className="text-sm text-gray-500 p-8 text-center">
          Nenhum empréstimo com esses filtros.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 sticky top-0">
            <tr>
              <th className="text-left font-medium px-3 py-2">Dia</th>
              <th className="text-left font-medium px-3 py-2">Cliente</th>
              <th className="text-left font-medium px-3 py-2">Rota</th>
              <th className="text-left font-medium px-3 py-2">Frequência</th>
              <th className="text-right font-medium px-3 py-2">Anterior</th>
              <th className="text-right font-medium px-3 py-2">Principal</th>
              <th className="text-left font-medium px-3 py-2">Comparação</th>
              <th className="text-right font-medium px-3 py-2">Juro</th>
              <th className="text-right font-medium px-3 py-2">Parcelas</th>
              <th className="text-right font-medium px-3 py-2">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {linhas.map((l) => {
              const cl = CLASSES[l.classificacao] ?? {
                rotulo: l.classificacao,
                classe: 'bg-gray-100 text-gray-600',
              };
              return (
                <tr key={l.emprestimo_id} className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                    {diaCurto(l.data_operacional)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-gray-900">{l.cliente_nome || '—'}</span>
                    <span className="block text-[11px] text-gray-400">
                      {l.cliente_documento || ''}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{l.rota_nome || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                    {FREQ[l.frequencia] ?? l.frequencia}
                    <span className="block text-[11px] text-gray-400">{l.tipo_emprestimo}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400 tabular-nums">
                    {l.valor_anterior > 0 ? fmt(l.valor_anterior) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">
                    {fmt(l.valor_principal)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${cl.classe}`}>
                      {cl.rotulo}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                    {fmt(l.juros)}
                    <span className="block text-[11px] text-gray-400">{l.taxa_juros ?? '—'}%</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                    {l.numero_parcelas}×{fmt(l.valor_parcela)}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(l.saldo)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </ListaRelatorio>
  );
}
