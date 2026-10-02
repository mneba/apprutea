'use client';

// =====================================================================
// PAINEL DA COBRANÇA
// =====================================================================
//
// O detalhe atrás do total cobrado. Abre clicando no próprio número, para a
// relação ficar explícita: o total não é um número ao lado de uma lista, ele
// É a lista somada.
//
// Sobreposição de tela cheia, como o modal de Ganancia do sistema legado.
// Painel lateral não serve — a lista tem dez colunas e perderia metade.
//
// TRÊS COLUNAS QUE O LEGADO NÃO TEM
//
//   • DINHEIRO e CRÉDITO separados. Lá existe um "Valor" só. Separando, dá
//     para ver quanto entrou no caixa e quanto era crédito que o cliente já
//     tinha — a distinção que resolveu o caso Paloma Unhas.
//   • LUCRO por linha: o juro embutido naquele lançamento.
//   • A OBSERVAÇÃO do não pago: por que o cliente não pagou. Hoje isso morre
//     dentro da liquidação do dia.
//
// Os NÃO PAGOS vêm na mesma lista, zerados em todo valor. São parte da
// cobrança do dia — separá-los esconderia exatamente o que não entrou.

import { Download, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { relatoriosService } from '@/services/relatorios';
import type { CobrancaPeriodo, LinhaCobranca } from '@/types/relatorios';
import { baixarCsv, numCsv } from '@/utils/csv';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  rotaIds: string[];
  de: string;
  ate: string;
  /** O total do card, repetido no cabeçalho: quem chegou clicando no número
   *  precisa reconhecer que é o mesmo. */
  totalCard: number;
}

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `YYYY-MM-DD` → `DD/MM`. Sem `new Date`: evita o recuo de fuso. */
const diaCurto = (d: string) => {
  const [, m, dd] = d.substring(0, 10).split('-');
  return `${dd}/${m}`;
};

/** Timestamp do banco → `HH:MM`. Vem sem `Z` mas é UTC. */
const hora = (ts: string) => {
  if (!ts) return '';
  const utc = ts.endsWith('Z') || ts.includes('+') ? ts : `${ts}Z`;
  const d = new Date(utc);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const TIPOS: Record<string, { rotulo: string; classe: string }> = {
  PAGAMENTO: { rotulo: 'Pagamento', classe: 'bg-emerald-50 text-emerald-700' },
  QUITACAO: { rotulo: 'Quitação', classe: 'bg-blue-50 text-blue-700' },
  CREDITO_CASCATA: { rotulo: 'Crédito aplicado', classe: 'bg-violet-50 text-violet-700' },
  IMPORTACAO: { rotulo: 'Importação', classe: 'bg-gray-100 text-gray-600' },
  NAO_PAGO: { rotulo: 'Não pago', classe: 'bg-red-50 text-red-700' },
};

export default function PainelCobranca({
  aberto, onFechar, rotaIds, de, ate, totalCard,
}: Props) {
  const [dados, setDados] = useState<CobrancaPeriodo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [forma, setForma] = useState('');
  const fecharRef = useRef<HTMLButtonElement>(null);

  const carregar = useCallback(async () => {
    if (!aberto || rotaIds.length === 0) return;
    setCarregando(true);
    const r = await relatoriosService.buscarCobranca(rotaIds, de, ate, { busca, tipo, forma });
    setDados(r);
    setCarregando(false);
  }, [aberto, rotaIds, de, ate, busca, tipo, forma]);

  // A busca espera o usuário parar de digitar; os selects valem na hora. Sem
  // isso cada tecla dispara uma consulta que pode varrer o mês inteiro.
  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(carregar, busca ? 400 : 0);
    return () => clearTimeout(t);
  }, [aberto, carregar, busca]);

  useEffect(() => {
    if (!aberto) return;
    fecharRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const t = dados?.totais ?? null;
  const linhas = dados?.linhas ?? [];

  const exportar = () => {
    if (!linhas.length) return;
    baixarCsv<LinhaCobranca>(
      `cobranca_${de}_a_${ate}`,
      [
        { cabecalho: 'Dia', valor: (l) => l.data_operacional },
        { cabecalho: 'Hora', valor: (l) => hora(l.quando) },
        { cabecalho: 'Cliente', valor: (l) => l.cliente_nome },
        { cabecalho: 'Documento', valor: (l) => l.cliente_documento },
        { cabecalho: 'Rota', valor: (l) => l.rota_nome },
        { cabecalho: 'Parcela', valor: (l) => `${l.numero_parcela ?? ''}/${l.numero_parcelas ?? ''}` },
        { cabecalho: 'Tipo', valor: (l) => TIPOS[l.tipo_operacao]?.rotulo ?? l.tipo_operacao },
        { cabecalho: 'Forma', valor: (l) => l.forma_pagamento },
        { cabecalho: 'Dinheiro', valor: (l) => numCsv(l.dinheiro) },
        { cabecalho: 'Crédito', valor: (l) => numCsv(l.credito_usado) },
        { cabecalho: 'Lucro', valor: (l) => numCsv(l.lucro) },
        { cabecalho: 'Saldo depois', valor: (l) => numCsv(l.saldo_depois) },
        { cabecalho: 'Observação', valor: (l) => l.observacao },
      ],
      linhas
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/55 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cobrança do período"
        className="bg-white rounded-xl border border-gray-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center gap-3 flex-wrap p-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Cobrança</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {diaCurto(de)} a {diaCurto(ate)} · {rotaIds.length} rota(s)
              {t ? ` · ${t.registros} lançamentos` : ''}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Total cobrado
            </p>
            <p className="text-lg font-extrabold text-gray-900 tabular-nums">
              {fmt(totalCard)}
            </p>
          </div>
          <button
            ref={fecharRef}
            onClick={onFechar}
            className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap p-3 border-b border-gray-100 bg-gray-50">
          <input
            id="cobranca-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Cliente ou documento"
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            id="cobranca-tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            aria-label="Tipo"
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPOS).map(([k, v]) => (
              <option key={k} value={k}>{v.rotulo}</option>
            ))}
          </select>
          <select
            id="cobranca-forma"
            value={forma}
            onChange={(e) => setForma(e.target.value)}
            aria-label="Forma de pagamento"
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          >
            <option value="">Toda forma</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="TRANSFERENCIA">Transferência</option>
            <option value="PIX">PIX</option>
            <option value="CARTAO">Cartão</option>
          </select>
          {carregando && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          <button
            onClick={exportar}
            disabled={!linhas.length}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {!carregando && linhas.length === 0 ? (
            <p className="text-sm text-gray-500 p-8 text-center">
              Nenhum lançamento com esses filtros.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 sticky top-0">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Dia</th>
                  <th className="text-left font-medium px-3 py-2">Cliente</th>
                  <th className="text-left font-medium px-3 py-2">Rota</th>
                  <th className="text-left font-medium px-3 py-2">Parcela</th>
                  <th className="text-left font-medium px-3 py-2">Tipo</th>
                  <th className="text-right font-medium px-3 py-2">Dinheiro</th>
                  <th className="text-right font-medium px-3 py-2">Crédito</th>
                  <th className="text-right font-medium px-3 py-2">Lucro</th>
                  <th className="text-right font-medium px-3 py-2">Saldo depois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {linhas.map((l) => {
                  const marca = TIPOS[l.tipo_operacao] ?? {
                    rotulo: l.tipo_operacao,
                    classe: 'bg-gray-100 text-gray-600',
                  };
                  return (
                    <tr key={l.registro_id} className="hover:bg-gray-50 align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                        {diaCurto(l.data_operacional)}
                        <span className="block text-[11px] text-gray-400">{hora(l.quando)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-900">{l.cliente_nome || '—'}</span>
                        <span className="block text-[11px] text-gray-400">
                          {l.cliente_documento || ''}
                        </span>
                        {/* A observação só existe no não pago, e é o motivo
                            de a visita não ter virado dinheiro. */}
                        {l.observacao && (
                          <span className="block text-[11px] text-amber-700 mt-0.5">
                            {l.observacao}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                        {l.rota_nome || '—'}
                      </td>
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap tabular-nums">
                        {l.numero_parcela ?? '—'}
                        {l.numero_parcelas ? `/${l.numero_parcelas}` : ''}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${marca.classe}`}>
                          {marca.rotulo}
                        </span>
                        {l.forma_pagamento && (
                          <span className="block text-[11px] text-gray-400 mt-0.5">
                            {l.forma_pagamento}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900 tabular-nums">
                        {l.dinheiro > 0 ? fmt(l.dinheiro) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-violet-700 tabular-nums">
                        {l.credito_usado > 0 ? fmt(l.credito_usado) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700 tabular-nums">
                        {l.lucro > 0 ? fmt(l.lucro) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 tabular-nums">
                        {fmt(l.saldo_depois)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center gap-3 flex-wrap p-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-600">
          <span>Dinheiro e crédito aparecem separados — só o dinheiro entra no caixa.</span>
          {t && (
            <span className="ml-auto tabular-nums">
              <b className="text-gray-900">{fmt(t.dinheiro)}</b> em dinheiro ·{' '}
              <b className="text-violet-700">{fmt(t.credito)}</b> em crédito ·{' '}
              <b className="text-emerald-700">{fmt(t.lucro)}</b> de lucro ·{' '}
              {t.nao_pagos} não pagos
            </span>
          )}
          {/* O limite da RPC é 500. Sem este aviso, o usuário leria a lista
              visível como se fosse o total — e os totais acima são do filtro
              inteiro, o que tornaria a diferença inexplicável. */}
          {dados && dados.total_registros > linhas.length && (
            <span className="w-full text-amber-700">
              Mostrando {linhas.length} de {dados.total_registros}. Use os filtros
              para estreitar — os totais acima são do conjunto inteiro.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
