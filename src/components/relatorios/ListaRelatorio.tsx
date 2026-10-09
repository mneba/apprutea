'use client';

// =====================================================================
// A CASCA DAS LISTAGENS DO RELATÓRIO
// =====================================================================
//
// Era um modal de tela cheia: clicar no total abria a listagem por cima da
// página. Saiu em 08/10/2026, por pedido do cliente — sobreposição esconde o
// que ficou atrás e obriga a fechar para comparar dois números.
//
// Agora a listagem é embutida: ela ocupa o palco da página, e quem troca o
// conteúdo são os totalizadores da lateral. Nada mais desliza sobre a tela.
//
// A MOLDURA É A MESMA para cobrança, venda, microseguro, movimentações e
// lucro. Extraída em vez de duplicada: cinco cópias de uma moldura divergem,
// e este projeto já pagou por isso na carteira, no status da parcela e nas
// datas de vencimento.
//
// ALTURA. A página é travada e só o corpo da lista rola. Por isso a casca é
// `h-full` com `min-h-0` em cada camada flexível — sem o `min-h-0` o filho
// cresce além do pai e a rolagem vai para a página inteira, que é justamente
// o que se quer evitar.

import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Loader2,
} from 'lucide-react';

/** As cores dos selos, pelas mesmas famílias que a tela do Financeiro usa. */
export type CorSelo = 'azul' | 'verde' | 'ambar' | 'roxo' | 'violeta';

const SELO: Record<CorSelo, string> = {
  azul: 'bg-blue-50 text-blue-600',
  verde: 'bg-emerald-50 text-emerald-600',
  ambar: 'bg-amber-50 text-amber-600',
  roxo: 'bg-purple-50 text-purple-600',
  violeta: 'bg-violet-50 text-violet-600',
};

interface Props {
  /** Ícone do lucide, no selo quadrado de 28px do Financeiro. */
  icone: React.ElementType;
  cor: CorSelo;
  titulo: string;
  subtitulo?: string;
  carregando?: boolean;
  /** Busca e seletores do cabeçalho. Opcional: o dia a dia não filtra. */
  filtros?: React.ReactNode;
  /** Contagem à esquerda do rodapé. */
  contagem?: React.ReactNode;
  /** Totais à direita do rodapé, antes da paginação. */
  totais?: React.ReactNode;
  /** A paginação, quando a lista tem mais que uma página. */
  paginacao?: React.ReactNode;
  onExportar?: () => void;
  podeExportar?: boolean;
  children: React.ReactNode;
}

export default function ListaRelatorio({
  icone: Icone, cor, titulo, subtitulo, carregando,
  filtros, contagem, totais, paginacao, onExportar, podeExportar, children,
}: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 h-full min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${SELO[cor]}`}>
          <Icone className="w-3.5 h-3.5" />
        </span>
        <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">{titulo}</h2>
        {subtitulo && <span className="text-[11.5px] text-gray-400">{subtitulo}</span>}
        {carregando && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}

        <span className="ml-auto flex items-center gap-1.5 flex-wrap">
          {filtros}
          {onExportar && (
            <button
              onClick={onExportar}
              disabled={!podeExportar}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-40"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          )}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">{children}</div>

      {(contagem || totais || paginacao) && (
        <div className="flex items-center gap-3 flex-wrap px-3 py-1.5 border-t border-gray-200 bg-gray-50 text-[11.5px] text-gray-600 flex-shrink-0">
          {contagem}
          {totais && <span className="ml-auto flex items-center gap-3.5">{totais}</span>}
          {paginacao && <span className={totais ? '' : 'ml-auto'}>{paginacao}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Paginação.
 *
 * Existe porque a lista costuma ser maior que a página: um mês de 48 rotas dá
 * centenas de lançamentos. Antes a listagem mostrava os primeiros e dizia o
 * total noutro canto — o usuário via "567" e contava 100 na tela, sem saber o
 * que fazer a respeito.
 *
 * Aparece mesmo com uma página só: num palco de altura fixa, o rodapé que
 * some faz a tabela pular de tamanho a cada filtro.
 *
 * O CONTADOR `2 / 5` EXISTE POR UM MOTIVO CONCRETO. Com 100 por página quase
 * toda lista cabia numa só, os botões ficavam desabilitados o tempo todo e o
 * usuário concluiu, com razão, que a paginação não funcionava — reclamação
 * de 09/10/2026. Nada estava quebrado; faltava a tela dizer que havia uma
 * página só. A página também baixou para 50.
 */
export function Paginacao({
  pagina, porPagina, total, onIr,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  onIr: (p: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const primeiro = total === 0 ? 0 : pagina * porPagina + 1;
  const ultimo = Math.min((pagina + 1) * porPagina, total);

  const bt =
    'w-6 h-6 rounded-md border border-gray-200 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 disabled:opacity-35 disabled:hover:bg-white';

  const naPrimeira = pagina === 0;
  const naUltima = pagina + 1 >= paginas;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tabular-nums text-gray-500 mr-1">
        {primeiro}–{ultimo} de {total}
      </span>
      <button onClick={() => onIr(0)} disabled={naPrimeira} className={bt} aria-label="Primeira página">
        <ChevronsLeft className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onIr(pagina - 1)} disabled={naPrimeira} className={bt} aria-label="Página anterior">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <span className="tabular-nums text-gray-600 px-0.5">
        {pagina + 1} / {paginas}
      </span>
      <button onClick={() => onIr(pagina + 1)} disabled={naUltima} className={bt} aria-label="Próxima página">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => onIr(paginas - 1)} disabled={naUltima} className={bt} aria-label="Última página">
        <ChevronsRight className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}
