'use client';

// =====================================================================
// AUDITORIA DE MOVIMENTOS — SUPER ADMIN
// =====================================================================
//
// Pedido do cliente: "disponibilizar uma visão de auditoria para consultar o
// histórico de movimentos e identificar quem adicionou, alterou ou reverteu
// uma operação, quando ocorreu e seu impacto na caixa ou no fechamento."
//
// ESTA TELA É LOG, NÃO EXTRATO, e a diferença decide o que entra:
//
//   extrato   documento de dinheiro — caixa inicial, entradas, saídas, final.
//             Lista pagamentos como VALORES.
//   log       rastro de operação — quem fez, quando, por quê. Inclui coisa
//             que não mexe em dinheiro nenhum.
//
// Despejar a linha do tempo no extrato repetiria, em forma de ação, o que ele
// já mostra como dinheiro. Por isso o extrato recebeu só o bloco da reabertura
// (ver ModalExtratoLiquidacao.tsx) e a lista completa vive aqui.
//
// POR QUE A BUSCA NÃO É AUTOMÁTICA
// Um mês de uma empresa com várias rotas são milhares de eventos. Recarregar a
// cada tecla no campo de usuário faria o banco varrer seis tabelas a cada
// letra. O botão Buscar é deliberado: a tela só consulta quando se pede.

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { relatoriosService } from '@/services/relatorios';
import { auditoriaService, TIPOS_AUDITORIA, type EventoAuditoria } from '@/services/auditoria';
import type { EstruturaVisivel } from '@/types/relatorios';

const POR_PAGINA = 200;

const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const seteDiasAtras = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtMoeda = (v: number | null) =>
  v === null
    ? '—'
    : (v < 0 ? '-' : '') +
      '$ ' +
      Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `momento` vem como timestamptz; o navegador já o mostra no fuso local. */
const fmtDia = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** A cor diz o que o evento é, não quanto vale. */
const CORES: Record<string, string> = {
  PAGAMENTO: 'bg-green-100 text-green-700',
  ESTORNO: 'bg-red-100 text-red-700',
  EMPRESTIMO: 'bg-blue-100 text-blue-700',
  ALTERACAO: 'bg-purple-100 text-purple-700',
  MOVIMENTO: 'bg-gray-100 text-gray-700',
  ANULACAO: 'bg-orange-100 text-orange-700',
  RELANCAMENTO: 'bg-orange-100 text-orange-700',
  REABERTURA: 'bg-amber-100 text-amber-800',
  FECHAMENTO_POS_REABERTURA: 'bg-amber-100 text-amber-800',
};

const rotulo = (tipo: string) =>
  TIPOS_AUDITORIA.find((t) => t.valor === tipo)?.rotulo ?? tipo;

export default function AuditoriaPage() {
  const { profile } = useUser();
  const [estrutura, setEstrutura] = useState<EstruturaVisivel | null>(null);

  const [empresaId, setEmpresaId] = useState('');
  const [rotaId, setRotaId] = useState('');
  const [de, setDe] = useState(seteDiasAtras());
  const [ate, setAte] = useState(hojeIso());
  const [tipo, setTipo] = useState('');
  const [usuario, setUsuario] = useState('');

  const [eventos, setEventos] = useState<EventoAuditoria[] | null>(null);
  const [pagina, setPagina] = useState(0);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => setEstrutura(await relatoriosService.buscarEstrutura()))();
  }, []);

  const empresas = useMemo(
    () =>
      (estrutura?.paises ?? []).flatMap((p) =>
        p.estados.flatMap((es) => es.cidades.flatMap((c) => c.empresas))
      ),
    [estrutura]
  );

  const rotasDaEmpresa = useMemo(
    () => empresas.find((e) => e.empresa_id === empresaId)?.rotas ?? [],
    [empresas, empresaId]
  );

  // Primeira empresa visível como padrão: a tela abre pronta para buscar, em
  // vez de pedir uma escolha antes de mostrar qualquer coisa.
  useEffect(() => {
    if (!empresaId && empresas.length > 0) setEmpresaId(empresas[0].empresa_id);
  }, [empresas, empresaId]);

  const buscar = async (p = 0) => {
    if (!empresaId) return;
    setCarregando(true);
    setErro(null);
    try {
      const r = await auditoriaService.buscar({
        empresaId,
        de,
        ate,
        rotaId: rotaId || null,
        tipo: tipo || null,
        usuario,
        limite: POR_PAGINA,
        offset: p * POR_PAGINA,
      });
      setEventos(r);
      setPagina(p);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a auditoria.');
      setEventos(null);
    } finally {
      setCarregando(false);
    }
  };

  // Agrupado por dia: a pergunta de quem investiga é sempre "o que aconteceu
  // no dia tal", e uma lista corrida de duzentos eventos não responde isso.
  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoAuditoria[]>();
    for (const ev of eventos ?? []) {
      const dia = fmtDia(ev.momento);
      if (!mapa.has(dia)) mapa.set(dia, []);
      mapa.get(dia)!.push(ev);
    }
    return Array.from(mapa.entries());
  }, [eventos]);

  if (profile && profile.tipo_usuario !== 'SUPER_ADMIN') {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-6 text-center">
          <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Acesso restrito</h2>
          <p className="text-sm text-gray-600 mt-1">
            A auditoria de movimentos é exclusiva do Super Administrador.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auditoria de Movimentos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Quem lançou, estornou, alterou ou reabriu — quando e com que impacto no caixa.
        </p>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Empresa</label>
            <select
              value={empresaId}
              onChange={(e) => { setEmpresaId(e.target.value); setRotaId(''); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              {empresas.map((e) => (
                <option key={e.empresa_id} value={e.empresa_id}>{e.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Rota</label>
            <select
              value={rotaId}
              onChange={(e) => setRotaId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              <option value="">Todas</option>
              {rotasDaEmpresa.map((r) => (
                <option key={r.rota_id} value={r.rota_id}>{r.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">De</label>
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Até</label>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            >
              <option value="">Todos</option>
              {TIPOS_AUDITORIA.map((t) => (
                <option key={t.valor} value={t.valor}>{t.rotulo}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mt-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Usuário</label>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') buscar(0); }}
              placeholder="Parte do nome — ex.: Julio"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => buscar(0)}
              disabled={carregando || !empresaId}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      {/* ── Resultado ── */}
      {eventos !== null && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {eventos.length === 0
                ? 'Nenhum movimento no período.'
                : `${eventos.length} evento${eventos.length > 1 ? 's' : ''}` +
                  (eventos.length === POR_PAGINA ? ' (há mais — avance a página)' : '')}
            </p>
            {(pagina > 0 || eventos.length === POR_PAGINA) && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => buscar(pagina - 1)}
                  disabled={pagina === 0 || carregando}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500">página {pagina + 1}</span>
                <button
                  onClick={() => buscar(pagina + 1)}
                  disabled={eventos.length < POR_PAGINA || carregando}
                  className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {porDia.map(([dia, lista]) => (
              <div key={dia}>
                <div className="px-4 py-2 bg-gray-50 sticky top-0">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{dia}</p>
                </div>
                {lista.map((ev, i) => (
                  <div key={`${ev.referencia_id}-${i}`} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
                    <div className="w-12 shrink-0 text-xs text-gray-400 flex items-center gap-1 pt-0.5">
                      <Clock className="w-3 h-3" />
                      {fmtHora(ev.momento)}
                    </div>

                    <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-medium ${CORES[ev.tipo] ?? 'bg-gray-100 text-gray-700'}`}>
                      {rotulo(ev.tipo)}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{ev.descricao}</p>
                      <p className="text-xs text-gray-500">
                        {ev.usuario || '—'}
                        {ev.rota ? ` · ${ev.rota}` : ''}
                      </p>
                      {/* O motivo é o que o cliente pediu nominalmente: sem ele,
                          a reabertura vira "alguém mexeu" e a tela não responde
                          a pergunta que a motivou. */}
                      {ev.motivo && (
                        <p className="text-xs text-gray-700 mt-0.5 italic">{ev.motivo}</p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {ev.impacto_caixa !== null && ev.impacto_caixa !== 0 && (
                          ev.impacto_caixa > 0
                            ? <ArrowUpCircle className="w-3.5 h-3.5 text-green-600" />
                            : <ArrowDownCircle className="w-3.5 h-3.5 text-red-600" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            ev.impacto_caixa === null
                              ? 'text-gray-400'
                              : ev.impacto_caixa > 0
                              ? 'text-green-600'
                              : ev.impacto_caixa < 0
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}
                          // Nulo é "não derivável", não zero: anulação e
                          // relançamento mexem na conta por fora do gatilho, e
                          // inferir o líquido daí é o método que custou caro em
                          // 02/10/2026.
                          title={ev.impacto_caixa === null ? 'Impacto no caixa não derivável' : undefined}
                        >
                          {fmtMoeda(ev.impacto_caixa)}
                        </span>
                      </div>
                      {ev.valor !== null && (
                        <p className="text-[11px] text-gray-400">
                          valor {fmtMoeda(ev.valor)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {eventos === null && !carregando && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Escolha o período e clique em Buscar.
          </p>
        </div>
      )}
    </div>
  );
}
