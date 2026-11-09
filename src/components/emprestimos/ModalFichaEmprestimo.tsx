'use client';

// =====================================================================
// FICHA DO EMPRÉSTIMO — web
// Arquivo: src/components/emprestimos/ModalFichaEmprestimo.tsx
// =====================================================================
//
// A ficha existia SÓ no app do vendedor desde 15/09/2026. Pedido do Mauricio
// em 08/11/2026: ter a mesma coisa no web, porque quem confere a operação
// confere pelo navegador.
//
// Mesma RPC, mesmos números, mesma ordem de leitura que
// apprutea_android/src/screens/FichaEmprestimoScreen.tsx. Não é uma segunda
// ficha: é a mesma, renderizada em HTML. Toda regra de conta vive em
// `fn_ficha_emprestimo`; aqui só há apresentação e as duas derivações do
// resumo, comentadas uma a uma abaixo porque foram exatamente o defeito
// relatado pelo Julio em 06/11/2026.
//
// ⚠ Se o resumo mudar aqui, muda na tela do app também. Foi a lição do
// extrato, que ficou dezenove dias mostrando parcela onde a tela de
// liquidação já mostrava recebimento.

import { useCallback, useEffect, useState } from 'react';
import {
  X, FileText, ShieldCheck, AlertTriangle, Loader2, Paperclip,
  ChevronDown, ChevronUp, ArrowRightLeft, Banknote, CreditCard,
  Download, CheckCheck, CloudDownload, Circle,
} from 'lucide-react';
import { buscarFicha, type Ficha, type EventoFicha } from '@/services/fichaEmprestimo';
import { AnexosCliente } from '@/components/clientes/AnexosCliente';

// ─── Formatação ──────────────────────────────────────────────────────────
//
// O símbolo é `$` e as casas decimais FICAM (regra do Mauricio, 04/11/2026):
// o sistema opera em mais de um país, não existe campo de moeda no schema, e
// `R$` aqui seria inferir o país a partir de nada.

const moeda = (v: number | null | undefined) =>
  '$ ' + new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v || 0));

/**
 * Data PURA (`YYYY-MM-DD`) → `DD/MM/AAAA`.
 *
 * ⚠ NÃO use `formatarData` de `@/utils/dateFormat` aqui. Aquele helper é para
 * TIMESTAMP: acrescenta `Z` quando não acha fuso, então uma data pura é lida
 * como meia-noite UTC e, a oeste de Greenwich, volta um dia.
 * Conferido rodando: '2026-04-09' sai como 08/04/2026 em São Paulo.
 * Vencimento um dia antes na tela é a cara do bug de data deste projeto.
 */
const dataPura = (d?: string | null) => {
  if (!d) return '';
  const iso = String(d).substring(0, 10);
  if (iso.length !== 10) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
};

/** Hora do instante real da operação. Vazio quando só há data (concessão). */
const horaDe = (ts?: string | null) => {
  if (!ts || String(ts).length <= 10) return '';
  const s = String(ts).replace(' ', 'T');
  const temFuso = /([Zz]|[+-]\d{2}(:?\d{2})?)$/.test(s);
  const d = new Date(temFuso ? s : s + 'Z');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const ROTULO_EVENTO: Record<string, string> = {
  CONCESSAO: 'Empréstimo concedido',
  PAGAMENTO: 'Pagamento',
  QUITACAO: 'Quitação',
  CREDITO_CASCATA: 'Crédito aplicado',
  IMPORTACAO: 'Importação',
};

const COR_EVENTO: Record<string, string> = {
  CONCESSAO: 'text-indigo-600 bg-indigo-50',
  PAGAMENTO: 'text-emerald-600 bg-emerald-50',
  QUITACAO: 'text-emerald-700 bg-emerald-50',
  CREDITO_CASCATA: 'text-indigo-700 bg-indigo-50',
  IMPORTACAO: 'text-gray-600 bg-gray-100',
};

const ICONE_EVENTO: Record<string, React.ElementType> = {
  CONCESSAO: Banknote,
  PAGAMENTO: Download,
  QUITACAO: CheckCheck,
  CREDITO_CASCATA: CreditCard,
  IMPORTACAO: CloudDownload,
};

const ROTULO_STATUS: Record<string, string> = {
  PAGO: 'Pago', PARCIAL: 'Parcial', CANCELADO: 'Cancelado',
  PENDENTE: 'Pendente', VENCIDO: 'Vencido',
};

const COR_STATUS: Record<string, string> = {
  PAGO: 'text-emerald-600', PARCIAL: 'text-amber-600',
  CANCELADO: 'text-gray-400', PENDENTE: 'text-gray-500', VENCIDO: 'text-red-600',
};

/** Uma linha do painel: rótulo à esquerda, valor à direita. */
function Linha({ rot, val, cor, forte, derivada }: {
  rot: string; val: string; cor?: string; forte?: boolean; derivada?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${derivada ? 'pl-5 py-1' : 'py-1.5'}`}>
      {/* Sem `truncate`: o rótulo cresce com a contagem de parcelas e, cortado,
          viraria "…em abert…". Deixando quebrar, o pior caso é a linha ficar
          mais alta. */}
      <span className={`min-w-0 ${
        derivada ? 'text-xs text-white/60'
          : forte ? 'text-sm font-semibold text-white'
          : 'text-[13px] text-white/80'
      }`}>
        {derivada ? '↳ ' : ''}{rot}
      </span>
      <span className={`shrink-0 tabular-nums ${
        derivada ? 'text-[13px] font-semibold'
          : forte ? 'text-lg font-bold'
          : 'text-[15px] font-bold'
      } ${cor || 'text-white'}`}>
        {val}
      </span>
    </div>
  );
}

// ─── Componente ──────────────────────────────────────────────────────────

export function ModalFichaEmprestimo({
  emprestimoId,
  clienteNome,
  onClose,
}: {
  emprestimoId: string;
  clienteNome?: string | null;
  onClose: () => void;
}) {
  // A cadeia é navegável DENTRO do modal: no app isso é uma troca de tela, e
  // aqui seria fechar e reabrir por outro caminho. `idAtual` é o empréstimo
  // que está sendo visto, e começa no que foi clicado.
  const [idAtual, setIdAtual] = useState(emprestimoId);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<'parcelas' | 'tempo'>('parcelas');
  const [soAbertas, setSoAbertas] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [anexoAberto, setAnexoAberto] = useState<string | null>(null);

  useEffect(() => { setIdAtual(emprestimoId); }, [emprestimoId]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setFicha(await buscarFicha(idAtual));
    } catch (e: any) {
      console.error('❌ Ficha:', e);
      setErro(e?.message || 'Não foi possível carregar a ficha');
    } finally {
      setCarregando(false);
    }
  }, [idAtual]);

  useEffect(() => { carregar(); }, [carregar]);

  // ⚠ TODA derivação fica ANTES de qualquer retorno antecipado — o dashboard
  // já pagou um React #310 por hook atrás de `return` (ver CLAUDE.md).
  const conf = ficha?.conferencia;
  const tudoConfere = !!conf && conf.caixa_confere && conf.credito_confere;

  const principalEmp = Number(ficha?.emprestimo?.valor_principal || 0);
  const totalEmp = Number(ficha?.totais?.valor_total || 0);
  const saldoEmp = Number(ficha?.totais?.saldo_atual || 0);
  const creditoEmp = Number(ficha?.totais?.credito_disponivel || 0);
  const valorParcelaEmp = Number(ficha?.emprestimo?.valor_parcela || 0);

  // SALDO é o que o cliente ainda tem de TRAZER, e `saldo_atual` JÁ É isso:
  // `emprestimos.valor_saldo` vem LÍQUIDO DE CRÉDITO, porque o gatilho
  // `atualizar_saldo_emprestimo` faz `GREATEST(0, Σ parcelas abertas − crédito)`.
  //
  // ⚠ NÃO SUBTRAIA O CRÉDITO AQUI. A tela do app subtraía, e era desconto
  // duplo: na Camila Rafaela (relato do Julio, 06/11/2026) as parcelas abertas
  // somavam 170, o crédito era 135 e `valor_saldo` 35 — e a ficha mostrava
  // `max(35 − 135, 0)` = 0,00 em verde, com uma parcela de 200 em aberto.
  // Medido na base: 389 empréstimos em aberto têm crédito, e em 23 o saldo
  // aparecia zerado. O mesmo erro já tinha sido consertado dentro do banco,
  // em `fn_quitar_emprestimo`, e os 35 aqui são o MESMO número que aquela
  // função cobra em dinheiro.
  const saldoFaltaEmp = Math.max(saldoEmp, 0);

  // PAGO é tudo o que o cliente entregou, crédito incluído: quem paga 150 numa
  // parcela de 100 pagou 150. O CRÉDITO não é um irmão desta linha — é um
  // PEDAÇO dela, a parte que ainda não baixou parcela, e por isso aparece
  // recuado abaixo.
  //
  // Derivado do saldo, e não de `dinheiro_recebido + crédito`, para fechar
  // também quando o crédito vem de outro empréstimo da cadeia — ali ele já
  // entrou no abatimento, e somá-lo contaria o mesmo dinheiro duas vezes.
  //
  // A cadeia fecha por construção: Juros − Pago = Saldo. Na Camila,
  // 4.800 − 35 = 4.765, que é o dinheiro que ela entregou de verdade.
  const pagoEmp = Math.max(totalEmp - saldoFaltaEmp, 0);

  const taxaEmp = ficha?.emprestimo?.taxa_juros;
  const taxaTx = taxaEmp == null || isNaN(Number(taxaEmp))
    ? '—'
    : Number(taxaEmp).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + '%';

  // PARCELA SE CONTA EM PARCELA, NÃO EM DINHEIRO.
  //
  // ⚠ A tela do app contava `dinheiro ÷ valor_parcela`, e era a outra metade
  // do relato do Julio: a Camila aparecia com "Pago (24 parcelas)" e, na lista
  // logo abaixo, uma parcela em aberto. 4.800 / 200 = 24 — o resumo
  // contradizia a lista na mesma tela.
  //
  // Quem conta é o banco, em `totais`. Conferido antes de confiar:
  // `status = 'PAGO'` ⟺ `valor_saldo = 0` em 32.099 de 32.099 parcelas, zero
  // divergências nas duas direções — ao contrário de PENDENTE × VENCIDO, que
  // o gatilho grava contra CURRENT_DATE e por isso mente.
  //
  // O denominador é `parcelas_total`, não `numero_parcelas`: as 58 parcelas
  // CANCELADO da base não são devidas nem pagas e ficam fora das duas
  // contagens — somá-las deixaria "23 de 24" com uma a mais.
  const parcelasPagas = Number(ficha?.totais?.parcelas_pagas || 0);
  const parcelasAbertas = Number(ficha?.totais?.parcelas_abertas || 0);
  const parcelasTotal = Number(ficha?.totais?.parcelas_total || 0);

  /** "Pago (23 de 24 parcelas)" — e sem o "de 24" quando não falta nenhuma. */
  const rotPagas = (rot: string) => {
    if (!parcelasTotal) return rot;
    const un = parcelasPagas === 1 ? 'parcela' : 'parcelas';
    return parcelasAbertas === 0
      ? `${rot} (${parcelasPagas} ${un})`
      : `${rot} (${parcelasPagas} de ${parcelasTotal} parcelas)`;
  };

  /** "Saldo (1 parcela em aberto)" — e só "Saldo" quando não há nenhuma. */
  const rotAbertas = (rot: string) => {
    if (!parcelasAbertas) return rot;
    const un = parcelasAbertas === 1 ? 'parcela em aberto' : 'parcelas em aberto';
    return `${rot} (${parcelasAbertas} ${un})`;
  };

  const nomeCliente = ficha?.cliente?.nome || clienteNome || '';
  const cadeia = ficha?.cadeia || [];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col">

        {/* ── Cabeçalho ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-blue-50 rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-blue-700 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-semibold text-blue-900 leading-tight">Ficha do empréstimo</h3>
              <p className="text-xs text-blue-800/70 truncate">
                {nomeCliente}
                {ficha?.rota_nome ? ` · ${ficha.rota_nome}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/5 shrink-0"
            title="Fechar"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* ── Corpo ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {carregando ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Abrindo a ficha…
            </div>
          ) : erro ? (
            <div className="flex flex-col items-center gap-3 py-14">
              <AlertTriangle className="w-9 h-9 text-red-500" />
              <p className="text-sm text-gray-700 text-center">{erro}</p>
              <button
                type="button"
                onClick={carregar}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Tentar de novo
              </button>
            </div>
          ) : !ficha ? null : (
            <>

              {/* ── Resumo ──
                  Linha a linha, rótulo à esquerda e valor à direita: a conta do
                  empréstimo se lê de cima para baixo como um extrato.
                  A cadeia fecha em `Juros − Pago = Saldo`, por construção. */}
              <div className="rounded-2xl bg-blue-800 px-5 py-3 shadow-sm">
                <Linha rot="Emprestado" val={moeda(principalEmp)} />
                <Linha rot={`Juros (${taxaTx})`} val={moeda(totalEmp)} />

                <div className="h-px bg-white/20 my-1.5" />

                <Linha rot={rotPagas('Pago')} val={moeda(pagoEmp)} />
                <Linha
                  rot="Crédito"
                  val={moeda(creditoEmp)}
                  cor={creditoEmp > 0 ? 'text-indigo-200' : undefined}
                  derivada
                />

                <div className="h-px bg-white/20 my-1.5" />

                {/* Âmbar quando ainda deve, verde quando zerou: no fundo escuro
                    o vermelho some, e o que importa é a distinção. */}
                <Linha
                  rot={rotAbertas('Saldo')}
                  val={moeda(saldoFaltaEmp)}
                  cor={saldoFaltaEmp > 0 ? 'text-amber-300' : 'text-emerald-300'}
                  forte
                />
                <Linha rot="Parcela" val={moeda(valorParcelaEmp)} />
              </div>

              {/* ── Conferência ──
                  Aparece sempre, verde ou vermelha. Um empréstimo que não
                  fecha precisa gritar, não ficar escondido atrás de um clique. */}
              <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
                tudoConfere ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              }`}>
                {tudoConfere
                  ? <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${tudoConfere ? 'text-emerald-800' : 'text-red-800'}`}>
                    {tudoConfere ? 'Contas conferem' : 'Divergência encontrada'}
                  </p>
                  {!conf?.caixa_confere && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      O dinheiro recebido ({moeda(conf?.dinheiro_recebido)}) não bate com o
                      registrado nas parcelas ({moeda(conf?.pago_nas_parcelas)}).
                    </p>
                  )}
                  {!conf?.credito_confere && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      O crédito dos registros ({moeda(conf?.credito_saldo_registros)}) não bate
                      com o das parcelas ({moeda(conf?.credito_saldo_parcelas)}).
                    </p>
                  )}
                </div>
              </div>

              {/* ── Cadeia de empréstimos ──
                  Sem emoji dentro do `select` — reclamação já registrada no
                  Financeiro. A posição ("2 de 4") é o que diz onde você está. */}
              {cadeia.length > 1 && (
                <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                  <ArrowRightLeft className="w-4 h-4 text-indigo-700 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-indigo-700/70">
                      Empréstimos deste cliente
                    </p>
                    <select
                      value={idAtual}
                      onChange={(e) => setIdAtual(e.target.value)}
                      className="mt-1 w-full bg-white border border-indigo-200 rounded-lg px-2 py-1.5 text-sm text-gray-800"
                    >
                      {cadeia.map((elo, i) => (
                        <option key={elo.id} value={elo.id}>
                          {i + 1} de {cadeia.length} · {elo.tipo_emprestimo || '—'} ·{' '}
                          {dataPura(elo.data_emprestimo) || '—'} · {moeda(elo.valor_principal)} ·{' '}
                          {elo.status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* ── Abas ── */}
              <div className="flex gap-1 border-b border-gray-200">
                {([['parcelas', 'Parcelas'], ['tempo', 'Linha do tempo']] as const).map(([k, rot]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAba(k)}
                    className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
                      aba === k
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {rot}
                  </button>
                ))}
              </div>

              {aba === 'parcelas' ? (
                <>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSoAbertas(true)}
                      className={`px-3 py-1.5 text-xs rounded-full border ${
                        soAbertas
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-gray-300 text-gray-600'
                      }`}
                    >
                      Em aberto ({ficha.totais.parcelas_abertas})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoAbertas(false)}
                      className={`px-3 py-1.5 text-xs rounded-full border ${
                        !soAbertas
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-gray-300 text-gray-600'
                      }`}
                    >
                      Todas ({ficha.totais.parcelas_total})
                    </button>
                  </div>

                  <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                    {ficha.parcelas
                      .filter((p: any) => !soAbertas || p.status !== 'PAGO')
                      .map((p: any) => {
                        // Anexos são gravados por PAGAMENTO. Parcela ainda não
                        // paga não tem onde pendurar arquivo — o clipe some em
                        // vez de abrir uma gaveta que não aceita nada.
                        const pags: string[] = p.pagamento_ids || [];
                        const abertoAnexos = anexoAberto === p.id;
                        return (
                          <div key={p.id} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <span className="text-xs font-bold text-gray-400 tabular-nums mt-0.5 shrink-0">
                                {String(p.numero_parcela).padStart(2, '0')}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] text-gray-700">
                                  Venc. {dataPura(p.data_vencimento)}
                                  {p.data_pagamento ? ` · Pago ${dataPura(p.data_pagamento)}` : ''}
                                </p>
                                <p className={`text-xs font-semibold ${COR_STATUS[p.status] || 'text-gray-500'}`}>
                                  {ROTULO_STATUS[p.status] || p.status}
                                </p>
                                {!!p.observacoes && (
                                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{p.observacoes}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-gray-900 tabular-nums">{moeda(p.valor_parcela)}</p>
                                {Number(p.valor_pago || 0) > 0 && (
                                  <p className="text-xs text-emerald-600 tabular-nums">{moeda(p.valor_pago)}</p>
                                )}
                                {Number(p.saldo_excedente || 0) > 0 && (
                                  <p className="text-xs text-indigo-600 tabular-nums">+{moeda(p.saldo_excedente)}</p>
                                )}
                              </div>
                              {pags.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setAnexoAberto(abertoAnexos ? null : p.id)}
                                  className={`shrink-0 p-1.5 rounded-md border ${
                                    abertoAnexos
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'bg-white border-gray-300 text-gray-500'
                                  }`}
                                  title="Comprovantes"
                                >
                                  <Paperclip className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            {abertoAnexos && (
                              <div className="mt-3 pl-8 space-y-3">
                                {pags.map((pid) => (
                                  <AnexosCliente
                                    key={pid}
                                    clienteId={ficha.cliente?.id}
                                    pagamentoId={pid}
                                    podeEditar={false}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </>
              ) : ficha.eventos.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="space-y-3">
                  {ficha.eventos.map((ev: EventoFicha, i: number) => {
                    const Icone = ICONE_EVENTO[ev.tipo] || Circle;
                    const corIcone = ev.estornado
                      ? 'text-gray-400 bg-gray-100'
                      : (COR_EVENTO[ev.tipo] || 'text-gray-600 bg-gray-100');
                    const chave = ev.operacao_id || `${ev.tipo}-${i}`;
                    const aberto = expandido === chave;
                    const temDetalhe = !!(ev.pagamento_ids?.length || ev.observacoes);
                    return (
                      <div
                        key={chave}
                        className={`rounded-xl border px-4 py-3 ${
                          ev.estornado ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${corIcone}`}>
                            <Icone className="w-4 h-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold text-gray-900 ${ev.estornado ? 'line-through' : ''}`}>
                              {ROTULO_EVENTO[ev.tipo] || ev.tipo}
                            </p>
                            <p className="text-xs text-gray-500">
                              {dataPura(ev.data_operacional)}
                              {horaDe(ev.quando) ? ` · ${horaDe(ev.quando)}` : ''}
                              {ev.autor ? ` · ${ev.autor}` : ''}
                            </p>
                          </div>
                          <p className={`text-sm font-bold tabular-nums shrink-0 ${
                            ev.estornado ? 'text-gray-400 line-through' : 'text-gray-900'
                          }`}>
                            {moeda(ev.tipo === 'CONCESSAO' ? ev.valor_emprestado : ev.aplicado)}
                          </p>
                        </div>

                        {/* Composição: dinheiro e crédito separados. É o que
                            faltava no extrato — a quitação da Paloma mostrava
                            360 sem dizer que outros 120 vieram de crédito. */}
                        {ev.tipo !== 'CONCESSAO' && (
                          <div className="mt-2 pl-12 space-y-1.5">
                            {!!ev.parcelas?.length && (
                              <p className="text-xs text-gray-600">
                                {ev.parcelas.length === 1
                                  ? `Parcela ${ev.parcelas[0]}`
                                  : `Parcelas ${ev.parcelas[0]}–${ev.parcelas[ev.parcelas.length - 1]} (${ev.parcelas.length})`}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              {(ev.dinheiro || 0) > 0 && (
                                <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-700">
                                  Dinheiro: {moeda(ev.dinheiro)}
                                </span>
                              )}
                              {(ev.credito_usado || 0) > 0 && (
                                <span className="px-2 py-0.5 rounded text-[11px] bg-indigo-50 text-indigo-700">
                                  Crédito usado: {moeda(ev.credito_usado)}
                                </span>
                              )}
                              {(ev.credito_gerado || 0) > 0 && (
                                <span className="px-2 py-0.5 rounded text-[11px] bg-blue-50 text-blue-700">
                                  Gerou crédito: {moeda(ev.credito_gerado)}
                                </span>
                              )}
                              {!!ev.forma_pagamento && (
                                <span className="px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-600">
                                  {ev.forma_pagamento}
                                </span>
                              )}
                            </div>

                            {!!ev.liquidacao_data && (
                              <p className="text-[11px] text-gray-400">
                                Liquidação {dataPura(ev.liquidacao_data)}
                              </p>
                            )}

                            {ev.estornado ? (
                              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                                <span className="text-[10px] font-bold text-red-700 tracking-wide">ESTORNADO</span>
                                <p className="text-xs text-red-800">
                                  Estornado em {dataPura(ev.data_estorno)}
                                  {ev.estornado_por ? ` por ${ev.estornado_por}` : ''}
                                </p>
                                {!!ev.motivo_estorno && (
                                  <p className="text-xs text-red-800">Motivo: {ev.motivo_estorno}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-500">
                                Depois deste evento: {moeda(ev.saldo_devedor)} devedor
                                {(ev.saldo_credito || 0) > 0 ? ` · ${moeda(ev.saldo_credito)} crédito` : ''}
                              </p>
                            )}

                            {temDetalhe && (
                              <button
                                type="button"
                                onClick={() => setExpandido(aberto ? null : chave)}
                                className="flex items-center gap-1 text-xs text-blue-700 hover:underline"
                              >
                                {aberto
                                  ? <ChevronUp className="w-3.5 h-3.5" />
                                  : <ChevronDown className="w-3.5 h-3.5" />}
                                Comprovantes ({ev.anexos ?? 0})
                              </button>
                            )}

                            {aberto && (
                              <div className="space-y-3 pt-1">
                                {!!ev.observacoes && (
                                  <p className="text-xs text-gray-600 whitespace-pre-line">{ev.observacoes}</p>
                                )}
                                {ev.pagamento_ids?.map((pid) => (
                                  <AnexosCliente
                                    key={pid}
                                    clienteId={ficha.cliente?.id}
                                    pagamentoId={pid}
                                    podeEditar={false}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Documentos do cliente ── */}
              {!!ficha.cliente?.id && (
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-3">Documentos do cliente</p>
                  <AnexosCliente clienteId={ficha.cliente.id} podeEditar={false} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
