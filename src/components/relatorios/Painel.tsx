'use client';

// =====================================================================
// A CASCA DOS PAINÉIS DE DETALHE
// =====================================================================
//
// Todo total do resumo abre a sua listagem aqui. Cobrança e venda têm colunas
// e filtros próprios, mas a moldura é a mesma: cabeçalho com o total repetido,
// faixa de filtros, corpo rolável, rodapé com totais e paginação.
//
// Extraída em vez de duplicada. Duas cópias de uma moldura divergem — este
// projeto já pagou por isso na carteira, no status da parcela e nas datas de
// vencimento, e não há motivo para repetir em CSS.
//
// Sobreposição de tela cheia, como o modal de Ganancia do sistema legado.
// Painel lateral não serve: as listas têm dez colunas e perderiam metade.

import { Download, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo: string;
  /** O total do card, repetido: quem chegou clicando no número precisa
   *  reconhecer que é o mesmo. */
  totalRotulo: string;
  totalValor: string;
  carregando?: boolean;
  filtros: React.ReactNode;
  rodape?: React.ReactNode;
  onExportar?: () => void;
  podeExportar?: boolean;
  children: React.ReactNode;
}

export default function Painel({
  aberto, onFechar, titulo, subtitulo, totalRotulo, totalValor,
  carregando, filtros, rodape, onExportar, podeExportar, children,
}: Props) {
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    fecharRef.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/55 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="bg-white rounded-xl border border-gray-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center gap-3 flex-wrap p-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{titulo}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{subtitulo}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {totalRotulo}
            </p>
            <p className="text-lg font-extrabold text-gray-900 tabular-nums">{totalValor}</p>
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
          {filtros}
          {carregando && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          {onExportar && (
            <button
              onClick={onExportar}
              disabled={!podeExportar}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          )}
        </div>

        <div className="overflow-auto flex-1">{children}</div>

        {rodape && (
          <div className="flex items-center gap-3 flex-wrap p-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-600">
            {rodape}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Paginação.
 *
 * Existe porque a lista costuma ser maior que a página: um mês de 48 rotas dá
 * centenas de lançamentos. Antes o painel mostrava os primeiros e dizia o
 * total noutro canto — o usuário via "567" e contava 100 na tela, sem saber o
 * que fazer a respeito.
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
  if (total <= porPagina) return null;

  const primeiro = pagina * porPagina + 1;
  const ultimo = Math.min((pagina + 1) * porPagina, total);

  const bt = 'w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-600 flex items-center justify-center hover:bg-gray-100 disabled:opacity-35 disabled:hover:bg-white';

  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums text-gray-500">
        {primeiro}–{ultimo} de {total}
      </span>
      <button
        onClick={() => onIr(pagina - 1)}
        disabled={pagina === 0}
        className={bt}
        aria-label="Página anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="tabular-nums text-gray-600">
        {pagina + 1} / {paginas}
      </span>
      <button
        onClick={() => onIr(pagina + 1)}
        disabled={pagina + 1 >= paginas}
        className={bt}
        aria-label="Próxima página"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </span>
  );
}
