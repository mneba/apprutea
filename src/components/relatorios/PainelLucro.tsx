'use client';

// =====================================================================
// LISTAGEM DO LUCRO
// =====================================================================
//
// O detalhe atrás da ganancia: quanto de juro cada empréstimo devolveu
// DENTRO do intervalo. É a lista que o modal de Ganancia do sistema legado
// mostrava, e a única das cinco que ainda não tinha tela.
//
// POR QUE ELA PEDE UMA CONSULTA PRÓPRIA
// `fn_liquidacoes_periodo` só devolve `por_emprestimo` quando chamada com
// `p_detalhe = true`, e com razão: num mês de país inteiro são milhares de
// linhas que quase ninguém abre. Então a página pede o resumo sem detalhe, e
// esta listagem repete a chamada com detalhe quando entra no palco.
//
// AS DUAS GANANCIAS NÃO SÃO A MESMA COISA, e é o ponto da lista:
//   • `ganancia_total` é o juro cheio do empréstimo, independente do recorte;
//   • `ganancia_periodo` é quanto desse juro caiu dentro do intervalo pedido.
// Somada, a segunda bate com o total do card. A primeira quase nunca bate, e
// quem não souber disso vai achar que a tela está errada.

import { TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ListaRelatorio, { Paginacao } from '@/components/relatorios/ListaRelatorio';
import { relatoriosService } from '@/services/relatorios';
import type { EmprestimoGanancia } from '@/types/relatorios';
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

/** `YYYY-MM-DD` → `DD/MM`. Sem `new Date`: evita o recuo de fuso. */
const diaCurto = (d: string | null) => {
  if (!d) return '—';
  const [, m, dd] = d.substring(0, 10).split('-');
  return `${dd}/${m}`;
};

const STATUS: Record<string, string> = {
  ATIVO: 'bg-emerald-50 text-emerald-700',
  VENCIDO: 'bg-red-50 text-red-700',
  QUITADO: 'bg-gray-100 text-gray-600',
  RENEGOCIADO: 'bg-amber-50 text-amber-700',
  CANCELADO: 'bg-gray-100 text-gray-400',
};

const campo =
  'border border-gray-200 rounded-md px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function PainelLucro({ aberto, rotaIds, de, ate }: Props) {
  const [linhas, setLinhas] = useState<EmprestimoGanancia[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(0);

  // A RPC devolve a lista inteira de uma vez — ela já vem ordenada por
  // ganancia e não tem paginação própria. Filtro e página são locais.
  const carregar = useCallback(async () => {
    if (!aberto || rotaIds.length === 0) return;
    setCarregando(true);
    const r = await relatoriosService.buscarLiquidacoesPeriodo(rotaIds, de, ate, true);
    setLinhas(r?.por_emprestimo ?? []);
    setCarregando(false);
  }, [aberto, rotaIds, de, ate]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { setPagina(0); }, [busca, status, de, ate]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter(
      (l) =>
        (!status || l.status === status) &&
        (!termo || (l.cliente_nome ?? '').toLowerCase().includes(termo))
    );
  }, [linhas, busca, status]);

  const total = useMemo(
    () => filtradas.reduce((a, l) => a + l.ganancia_periodo, 0),
    [filtradas]
  );

  const pagina0 = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const exportar = () => {
    if (!filtradas.length) return;
    baixarCsv<EmprestimoGanancia>(
      `lucro_${de}_a_${ate}`,
      [
        { cabecalho: 'Cliente', valor: (l) => l.cliente_nome },
        { cabecalho: 'Status', valor: (l) => l.status },
        { cabecalho: 'Data do empréstimo', valor: (l) => l.data_emprestimo },
        { cabecalho: 'Valor total', valor: (l) => numCsv(l.valor_total) },
        { cabecalho: 'Total pago', valor: (l) => numCsv(l.total_pago) },
        { cabecalho: 'Saldo', valor: (l) => numCsv(l.saldo) },
        { cabecalho: 'Juro do empréstimo', valor: (l) => numCsv(l.ganancia_total) },
        { cabecalho: 'Juro no período', valor: (l) => numCsv(l.ganancia_periodo) },
      ],
      filtradas
    );
  };

  if (!aberto) return null;

  return (
    <ListaRelatorio
      icone={TrendingUp}
      cor="verde"
      titulo="Lucro"
      subtitulo={`${diaCurto(de)} a ${diaCurto(ate)} · juro recebido, por empréstimo`}
      carregando={carregando}
      onExportar={exportar}
      podeExportar={filtradas.length > 0}
      filtros={
        <>
          <input
            id="lucro-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente"
            className={`${campo} w-[180px]`}
          />
          <select
            id="lucro-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Status do empréstimo"
            className={campo}
          >
            <option value="">Todo status</option>
            {Object.keys(STATUS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </>
      }
      contagem={<span>{filtradas.length} empréstimo(s)</span>}
      totais={
        <span className="tabular-nums">
          <b className="text-emerald-700">{fmt(total)}</b> de juro no período
        </span>
      }
      paginacao={
        <Paginacao pagina={pagina} porPagina={POR_PAGINA} total={filtradas.length} onIr={setPagina} />
      }
    >
      {!carregando && filtradas.length === 0 ? (
        <p className="text-sm text-gray-500 p-8 text-center">
          Nenhum empréstimo gerou juro com esses filtros.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-400 sticky top-0">
            <tr>
              <th className="text-left font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Cliente</th>
              <th className="text-left font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Empréstimo</th>
              <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Total</th>
              <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Pago</th>
              <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Saldo</th>
              <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Juro do empréstimo</th>
              <th className="text-right font-semibold text-[10px] uppercase tracking-wide px-3 py-1.5">Juro no período</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pagina0.map((l) => (
              <tr key={l.emprestimo_id} className="hover:bg-gray-50 align-top">
                <td className="px-3 py-2 text-gray-900">{l.cliente_nome || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS[l.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {l.status}
                  </span>
                  <span className="block text-[11px] text-gray-400 mt-0.5 tabular-nums">
                    {diaCurto(l.data_emprestimo)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(l.valor_total)}</td>
                <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(l.total_pago)}</td>
                <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{fmt(l.saldo)}</td>
                {/* O juro cheio do empréstimo. Quase nunca bate com a soma da
                    coluna ao lado, e não deveria: só parte dele caiu dentro
                    do intervalo. */}
                <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{fmt(l.ganancia_total)}</td>
                <td className="px-3 py-2 text-right font-semibold text-emerald-700 tabular-nums">
                  {fmt(l.ganancia_periodo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ListaRelatorio>
  );
}
