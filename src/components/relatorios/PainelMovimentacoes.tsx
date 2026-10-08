'use client';

// =====================================================================
// PAINEL DAS MOVIMENTAÇÕES
// =====================================================================
//
// O detalhe atrás das movimentações, aberto clicando no próprio número —
// mesmo comportamento de Cobrança e Venda.
//
// SERVE OS DOIS CARDS: o da conta da rota e o da conta do microseguro. Não
// há um painel por card porque a única diferença entre eles é de qual conta o
// dinheiro saiu ou entrou — duplicar o componente duplicaria também toda
// correção futura de rodapé, filtro e CSV.
//
// O ESCOPO VEM DA CONTA, NÃO DA LIQUIDAÇÃO. Trinta e nove lançamentos do
// sistema não têm `liquidacao_id` — entre eles TODAS as transferências — e
// amarrados por liquidação nunca apareceriam. Esses caem em `data_lancamento`
// e a linha mostra a marca, porque é exatamente o lançamento que o usuário
// não lembra de ter feito e depois contesta.
//
// O QUE ENTRA, E O QUE NÃO ENTRA
// Tudo que passou pelo caixa MENOS empréstimo e cobrança de parcela. Esses
// dois já têm painel próprio no mesmo relatório; contá-los aqui mostraria o
// mesmo dinheiro duas vezes na mesma tela, e quem somasse os três totais
// chegaria a um número que não existe.
//
// O resto não é lista fixa. A RPC agrupa pela categoria que encontrar, então
// aporte, retirada e o que o cliente inventar amanhã aparecem sozinhos. Fixar
// nomes aqui seria garantir que a tela mente no dia em que ele criar uma
// categoria nova — e ele cria.

import { ArrowRightLeft, ChevronDown, Shield, Tag, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ListaRelatorio, { Paginacao } from '@/components/relatorios/ListaRelatorio';
import { relatoriosService } from '@/services/relatorios';
import type { LinhaMovimentacao, MovimentacoesPeriodo } from '@/types/relatorios';
import { baixarCsv, numCsv } from '@/utils/csv';

interface Props {
  /** A listagem só consulta quando está no palco. */
  aberto: boolean;
  rotaIds: string[];
  de: string;
  ate: string;
  /**
   * O tipo em que o painel abre, quando se chegou clicando numa grandeza
   * específica da faixa. A página remonta o painel por `key` ao trocar, de
   * modo que isto é valor inicial de estado e não sincronização — sem
   * efeito extra, sem busca jogada fora.
   */
  tipoInicial?: string;
  /**
   * `ROTA` para o card de movimentações, `MICROSEGURO` para o do microseguro.
   * Muda a conta consultada e o vocabulário da tela: no microseguro a entrada
   * é *venda* e a saída é *retirada*.
   */
  tipoConta?: 'ROTA' | 'MICROSEGURO';
}

const POR_PAGINA = 100;

const fmt = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `YYYY-MM-DD` → `DD/MM`. Sem `new Date`: evita o recuo de fuso. */
const diaCurto = (d: string) => {
  const [, m, dd] = d.substring(0, 10).split('-');
  return `${dd}/${m}`;
};

// Transferência em âmbar e ajuste em azul porque nenhum dos dois é entrada nem
// saída: um troca de bolso, o outro corrige — e a cor é o que impede de ler
// todos como a mesma coisa.
//
// A transferência vem desdobrada em duas: a RPC devolve uma linha por ponta
// que está no escopo, com o sentido no tipo, porque as duas contas realmente
// se moveram. A da Barcelona é `TRANSF_SAIU` no microseguro e `TRANSF_ENTROU`
// na conta da rota — o mesmo dinheiro visto dos dois lados.
const TIPOS: Record<string, { rotulo: string; classe: string; cor: string }> = {
  RECEBER: { rotulo: 'Entrada', classe: 'bg-emerald-50 text-emerald-700', cor: 'text-emerald-700' },
  PAGAR: { rotulo: 'Saída', classe: 'bg-red-50 text-red-700', cor: 'text-red-700' },
  TRANSF_ENTROU: { rotulo: 'Transf. recebida', classe: 'bg-amber-50 text-amber-700', cor: 'text-amber-700' },
  TRANSF_SAIU: { rotulo: 'Transf. enviada', classe: 'bg-amber-50 text-amber-800', cor: 'text-amber-800' },
  AJUSTE: { rotulo: 'Ajuste', classe: 'bg-blue-50 text-blue-700', cor: 'text-blue-700' },
  // Grupo, não `financeiro.tipo`: o lançamento continua `AJUSTE` ou
  // `RECEBER` como nasceu, e a RPC o classifica como aporte na leitura pela
  // categoria `APORTE_FINANCEIRO`.
  APORTE: { rotulo: 'Aporte', classe: 'bg-violet-50 text-violet-700', cor: 'text-violet-700' },
};

/** No microseguro a entrada é venda e a saída é retirada. */
const VOCAB = {
  ROTA: {
    titulo: 'Movimentações financeiras',
    subtitulo: 'fora empréstimo e cobrança',
    arquivo: 'movimentacoes',
    entrada: 'de entrada',
    saida: 'de saída',
    vazio: 'Nenhuma movimentação com esses filtros.',
  },
  MICROSEGURO: {
    titulo: 'Microseguro',
    subtitulo: 'conta própria da rota · vendas e retiradas',
    arquivo: 'microseguro',
    entrada: 'em vendas',
    saida: 'em pagamentos',
    vazio: 'Nenhum movimento de microseguro com esses filtros.',
  },
} as const;

const campo =
  'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function PainelMovimentacoes({
  aberto, rotaIds, de, ate, tipoInicial, tipoConta = 'ROTA',
}: Props) {
  const voc = VOCAB[tipoConta];
  const [dados, setDados] = useState<MovimentacoesPeriodo | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState(tipoInicial ?? '');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(0);
  const [menuCat, setMenuCat] = useState(false);
  const caixaCat = useRef<HTMLDivElement>(null);

  // O dropdown fecha ao clicar fora ou com Esc. Sem isso ele fica preso
  // aberto sobre a tabela, e com onze categorias ele é alto.
  useEffect(() => {
    if (!menuCat) return;
    const fora = (ev: MouseEvent) => {
      if (caixaCat.current && !caixaCat.current.contains(ev.target as Node)) setMenuCat(false);
    };
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setMenuCat(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [menuCat]);

  const carregar = useCallback(async () => {
    if (!aberto || rotaIds.length === 0) return;
    setCarregando(true);
    const r = await relatoriosService.buscarMovimentacoes(rotaIds, de, ate, {
      busca, tipo, categoria, tipoConta,
      limite: POR_PAGINA, offset: pagina * POR_PAGINA,
    });
    setDados(r);
    setCarregando(false);
  }, [aberto, rotaIds, de, ate, busca, tipo, categoria, tipoConta, pagina]);

  // A busca espera o usuário parar de digitar; o resto vale na hora.
  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(carregar, busca ? 400 : 0);
    return () => clearTimeout(t);
  }, [aberto, carregar, busca]);

  useEffect(() => { setPagina(0); }, [busca, tipo, categoria, de, ate]);

  const t = dados?.totais ?? null;
  const linhas = dados?.linhas ?? [];

  // As categorias do próprio período alimentam o filtro, com quantidade e
  // total. Lista fixa aqui envelheceria junto com o cadastro do cliente — e
  // mudar o escopo de rotas muda as categorias que existem.
  //
  // Quando a mesma categoria aparece em mais de um tipo (uma despesa e um
  // ajuste de mesmo nome), as duas linhas se somam numa: quem filtra quer a
  // categoria, não o par tipo-categoria.
  const categorias = Object.values(
    (dados?.por_categoria ?? []).reduce<Record<string, { nome: string; qtd: number; total: number }>>(
      (acc, c) => {
        const e = acc[c.categoria] ?? { nome: c.categoria, qtd: 0, total: 0 };
        e.qtd += c.qtd;
        e.total += c.total;
        acc[c.categoria] = e;
        return acc;
      }, {})
  ).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const exportar = () => {
    if (!linhas.length) return;
    baixarCsv<LinhaMovimentacao>(
      `${voc.arquivo}_${de}_a_${ate}`,
      [
        { cabecalho: 'Dia', valor: (l) => l.data_operacional },
        { cabecalho: 'Data do lançamento', valor: (l) => l.data_lancamento },
        { cabecalho: 'Tem liquidação', valor: (l) => (l.tem_liquidacao ? 'sim' : 'não') },
        { cabecalho: 'Rota', valor: (l) => l.rota_nome },
        { cabecalho: 'Conta', valor: (l) => l.conta_nome },
        { cabecalho: 'Contraparte', valor: (l) => l.contraparte },
        { cabecalho: 'Tipo', valor: (l) => TIPOS[l.tipo]?.rotulo ?? l.tipo },
        { cabecalho: 'Categoria', valor: (l) => l.categoria },
        { cabecalho: 'Descrição', valor: (l) => l.descricao },
        { cabecalho: 'Cliente', valor: (l) => l.cliente_nome },
        { cabecalho: 'Forma', valor: (l) => l.forma_pagamento },
        { cabecalho: 'Status', valor: (l) => l.status },
        { cabecalho: 'Valor', valor: (l) => numCsv(l.valor) },
      ],
      linhas
    );
  };

  if (!aberto) return null;

  return (
    <ListaRelatorio
      icone={tipoConta === 'MICROSEGURO' ? Shield : ArrowRightLeft}
      cor={tipoConta === 'MICROSEGURO' ? 'ambar' : 'roxo'}
      titulo={voc.titulo}
      subtitulo={voc.subtitulo}
      carregando={carregando}
      onExportar={exportar}
      podeExportar={linhas.length > 0}
      filtros={
        <>
          <input
            id="mov-busca"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Descrição, cliente ou categoria"
            className={`${campo} w-[210px]`}
          />
          <select id="mov-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo" className={campo}>
            <option value="">Todo tipo</option>
            {Object.entries(TIPOS).map(([k, v]) => (
              <option key={k} value={k}>{v.rotulo}</option>
            ))}
          </select>

          {/* CATEGORIA EM DROPDOWN, não em coluna fixa nem em fila de
              pastílhas. Onze categorias ocupando largura permanente para algo
              que se usa de vez em quando foi recusado pelo cliente em
              08/10/2026; e a fila de pílulas lia-se como caminho de
              navegação, que não é o que são.

              Aqui cada uma traz quantidade e total — que é a informação que
              justificava a fila — sem gastar a tela quando está fechado. */}
          <div className="relative" ref={caixaCat}>
            <button
              onClick={() => setMenuCat((v) => !v)}
              aria-expanded={menuCat}
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border max-w-[230px] ${
                categoria
                  ? 'bg-purple-50 border-transparent text-purple-700'
                  : 'border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Tag className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{categoria || 'Toda categoria'}</span>
              <span className="text-[10px] font-bold tabular-nums px-1.5 rounded-full bg-white/70 border border-current/20">
                {categoria ? (dados?.total_registros ?? 0) : categorias.length}
              </span>
              <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
            </button>

            {menuCat && (
              <div className="absolute right-0 mt-1 z-30 w-[330px] max-w-[86vw] bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden">
                <div className="flex items-center gap-2 px-2.5 py-2 border-b border-gray-100">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Por categoria
                  </span>
                  {categoria && (
                    <button
                      onClick={() => { setCategoria(''); setMenuCat(false); }}
                      className="ml-auto inline-flex items-center gap-0.5 text-[10.5px] text-blue-600 hover:text-blue-700"
                    >
                      <X className="w-3 h-3" /> limpar
                    </button>
                  )}
                </div>

                <div className="max-h-[46vh] overflow-y-auto">
                  {categorias.length === 0 ? (
                    <p className="px-3 py-6 text-xs text-gray-400 text-center">
                      Nenhum lançamento no período
                    </p>
                  ) : (
                    categorias.map((c) => (
                      <button
                        key={c.nome}
                        onClick={() => { setCategoria(categoria === c.nome ? '' : c.nome); setMenuCat(false); }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left border-b border-gray-50 ${
                          categoria === c.nome ? 'bg-purple-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-300" />
                        <span className="flex-1 min-w-0">
                          <span className={`block text-[12.5px] truncate ${categoria === c.nome ? 'text-purple-700 font-medium' : 'text-gray-700'}`}>
                            {c.nome}
                          </span>
                          <span className="block text-[10.5px] text-gray-400">
                            {c.qtd} lançamento{c.qtd > 1 ? 's' : ''}
                          </span>
                        </span>
                        <span className={`text-[12.5px] font-semibold tabular-nums ${categoria === c.nome ? 'text-purple-700' : 'text-gray-900'}`}>
                          {fmt(c.total)}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <div className="flex justify-between gap-2 px-2.5 py-1.5 border-t border-gray-100 bg-gray-50 text-[10.5px] text-gray-400">
                  <span>
                    {categorias.length} categoria(s) ·{' '}
                    {categorias.reduce((a, c) => a + c.qtd, 0)} lançamentos
                  </span>
                  <span className="tabular-nums">
                    {fmt(categorias.reduce((a, c) => a + c.total, 0))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      }
      contagem={
        <span>
          {dados?.total_registros ?? 0} registro(s)
          {/* O PEDIDO DE 08/10/2026, literal: "o usuário vai esquecer, e vai
              questionar divergências que ele mesmo causou e não se lembra".
              Estes não passaram por liquidação nenhuma, então não estão em
              nenhum dia fechado — e é por isso que o total do período não
              fecha com a soma dos dias. Dito, não deduzido. */}
          {(t?.sem_liquidacao ?? 0) > 0 && (
            <span className="ml-1.5 text-amber-700">
              · {t!.sem_liquidacao} fora de dia de liquidação (<b className="tabular-nums">{fmt(t!.sem_liquidacao_valor)}</b>)
            </span>
          )}
        </span>
      }
      totais={
        t && (
          <span className="tabular-nums">
            <b className="text-emerald-700">{fmt(t.entradas)}</b> {voc.entrada} ·{' '}
            <b className="text-red-700">{fmt(t.saidas)}</b> {voc.saida}
              {/* As duas pontas, não o líquido: o líquido some quando a
                  transferência foi interna, e aqui o usuário quer ver que
                  houve movimento. */}
              {t.transf_entrou !== 0 && (
                <> · <b className="text-amber-700">{fmt(t.transf_entrou)}</b> recebido</>
              )}
              {t.transf_saiu !== 0 && (
                <> · <b className="text-amber-800">{fmt(t.transf_saiu)}</b> transferido</>
              )}
              {t.ajustes !== 0 && (
                <> · <b className="text-blue-700">{fmt(t.ajustes)}</b> de ajuste</>
              )}
              {t.aportes !== 0 && (
                <> · <b className="text-violet-700">{fmt(t.aportes)}</b> de aporte</>
              )}
              {/* A transferência NÃO entra no resultado: ela sai de uma conta e
                  entra em outra, e o resultado do período é o mesmo com ou sem
                  ela.

                  O APORTE TAMBÉM NÃO. Ele move saldo, mas não é resultado de
                  operação: é capital entrando para a rota começar e saindo
                  depois. Somá-lo faria um mês de implantação parecer o melhor
                  ou o pior da história, pelo motivo errado.

                  O ajuste entra porque é correção da operação, com o sinal
                  que já vem no valor. */}
              <span className="ml-2 text-gray-400">
                · resultado{' '}
                <b className={t.entradas - t.saidas + t.ajustes >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                  {fmt(t.entradas - t.saidas + t.ajustes)}
                </b>
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
        <p className="text-sm text-gray-500 p-8 text-center">{voc.vazio}</p>
      ) : (
        <>
          {/* O resumo por categoria antes da lista: dez despesas de gasolina e
              uma retirada grande somam igual, e só o agrupamento mostra isso. */}
          {(dados?.por_categoria.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 p-3 border-b border-gray-100 bg-gray-50">
              {dados!.por_categoria.map((c) => (
                <button
                  key={`${c.tipo}-${c.categoria}`}
                  onClick={() => { setTipo(c.tipo); setCategoria(c.categoria); }}
                  className={`text-[11px] px-2 py-1 rounded-full border border-transparent hover:border-gray-300 ${TIPOS[c.tipo]?.classe ?? 'bg-gray-100 text-gray-600'}`}
                  title={`${c.qtd} lançamento(s)`}
                >
                  {c.categoria} <b className="tabular-nums">{fmt(c.total)}</b>
                </button>
              ))}
            </div>
          )}

          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 sticky top-0">
              <tr>
                <th className="text-left font-medium px-3 py-2">Dia</th>
                <th className="text-left font-medium px-3 py-2">Rota</th>
                <th className="text-left font-medium px-3 py-2">Tipo</th>
                <th className="text-left font-medium px-3 py-2">Categoria</th>
                <th className="text-left font-medium px-3 py-2">Descrição</th>
                <th className="text-right font-medium px-3 py-2">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {linhas.map((l) => {
                const marca = TIPOS[l.tipo] ?? {
                  rotulo: l.tipo, classe: 'bg-gray-100 text-gray-600', cor: 'text-gray-700',
                };
                return (
                  <tr key={l.financeiro_id} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {diaCurto(l.data_operacional)}
                      {/* A data do lançamento é a REAL e pode ser outra: o dia
                          operacional vem da liquidação. Só mostra quando
                          divergem, para não poluir o caso normal. */}
                      {l.data_lancamento &&
                        l.data_lancamento.substring(0, 10) !== l.data_operacional.substring(0, 10) && (
                          <span className="block text-[11px] text-gray-400">
                            lançado {diaCurto(l.data_lancamento)}
                          </span>
                        )}
                      {/* Sem liquidação: a data é a do lançamento, e este
                          dinheiro não está em nenhum dia fechado. É o caso
                          que o usuário não lembra e depois contesta. */}
                      {!l.tem_liquidacao && (
                        <span className="block text-[10px] font-bold uppercase text-amber-700">
                          sem liquidação
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {l.rota_nome || '—'}
                      {/* A conta só quando não é a da rota: no card do
                          microseguro repetir "Conta Microseguro X" em toda
                          linha só gasta largura. */}
                      {l.contraparte && (
                        <span className="block text-[11px] text-gray-400">
                          {l.tipo === 'TRANSF_SAIU' ? '→ ' : '← '}{l.contraparte}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${marca.classe}`}>
                        {marca.rotulo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                      {l.categoria}
                      {/* Status só quando não é `PAGO`: transferência e ajuste
                          movem o saldo sem estar pagos, e esconder isso faria
                          o extrato discordar da lista sem explicação. */}
                      {l.status !== 'PAGO' && (
                        <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                          {l.status}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {l.descricao || '—'}
                      {l.cliente_nome && (
                        <span className="block text-[11px] text-gray-400">{l.cliente_nome}</span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${marca.cor}`}>
                      {fmt(l.valor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </ListaRelatorio>
  );
}
