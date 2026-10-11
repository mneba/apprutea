'use client';

// =====================================================================
// A AJUDA DO RELATÓRIO
// =====================================================================
//
// Um `?` ao lado do título, que abre o que cada coisa faz e onde o relatório
// engana.
//
// JANELA, NÃO EXPANSÃO NA PRÓPRIA TELA. As páginas de relatório são travadas
// em altura, e empurrar o conteúdo esconderia os indicadores justamente
// quando o usuário está tentando entendê-los.
//
// O ITEM ILUSTRADO MOSTRA O PRÓPRIO BOTÃO. Descrever "o preset Por vencer"
// com texto obriga o leitor a procurar na tela qual é; mostrando o mesmo selo
// e o mesmo nome, ele reconhece de imediato. E como a ilustração é montada a
// partir da mesma lista que desenha a lateral, ela não tem como divergir.
//
// NÃO EXPLICA BOTÃO. Ninguém lê "clique em Gerar". O que vale escrever é o
// que o número significa, o que ele NÃO significa, e as armadilhas que já
// custaram tempo.

import { HelpCircle, X } from 'lucide-react';
import { useEffect } from 'react';

export interface ItemIlustrado {
  icone: React.ElementType;
  /** As mesmas classes do selo que a tela usa, para ser o mesmo botão. */
  selo: string;
  nome: string;
  texto: string;
}

export interface SecaoAjuda {
  /** Sem título quando a seção dispensa — a primeira costuma dispensar. */
  titulo?: string;
  itens: (string | ItemIlustrado)[];
}

interface Props {
  titulo: string;
  secoes: SecaoAjuda[];
  aberta: boolean;
  onAbrir: () => void;
  onFechar: () => void;
}

/** `**assim**` no começo do item vira o rótulo em negrito. */
function Texto({ texto }: { texto: string }) {
  const m = texto.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
  if (!m) return <>{texto}</>;
  return (
    <>
      <b className="text-gray-900 font-semibold">{m[1]}</b>
      {m[2] ? ` — ${m[2]}` : ''}
    </>
  );
}

export default function AjudaRelatorio({ titulo, secoes, aberta, onAbrir, onFechar }: Props) {
  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberta, onFechar]);

  return (
    <>
      <button
        onClick={onAbrir}
        aria-label="Como ler este relatório"
        title="Como ler este relatório"
        className="p-1 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
      >
        <HelpCircle className="w-[18px] h-[18px]" />
      </button>

      {aberta && (
        <div
          className="fixed inset-0 z-50 bg-gray-900/50 flex items-start justify-center p-4 overflow-y-auto print:hidden"
          onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Como ler: ${titulo}`}
            className="bg-white rounded-xl border border-gray-200 w-full max-w-2xl my-8 overflow-hidden"
          >
            <div className="flex items-start gap-3 px-5 py-3.5 border-b border-gray-100">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900">{titulo}</h2>
                <p className="text-[12px] text-gray-400">O que cada coisa faz, e onde engana.</p>
              </div>
              <button
                onClick={onFechar}
                aria-label="Fechar"
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {secoes.map((s, si) => (
                <section key={s.titulo ?? si}>
                  {s.titulo && (
                    <h3 className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                      {s.titulo}
                    </h3>
                  )}
                  <div className={s.itens.some((i) => typeof i !== 'string') ? '' : 'space-y-1.5'}>
                    {s.itens.map((it, i) =>
                      typeof it === 'string' ? (
                        <p key={i} className="text-[13px] text-gray-600 leading-relaxed">
                          <Texto texto={it} />
                        </p>
                      ) : (
                        <div key={i} className="flex items-center gap-2.5 py-1">
                          <span className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${it.selo}`}>
                            <it.icone className="w-3.5 h-3.5" />
                          </span>
                          <span className="text-[12.5px] font-semibold text-gray-900 w-[118px] flex-shrink-0">
                            {it.nome}
                          </span>
                          <span className="text-[12.5px] text-gray-500 leading-snug">{it.texto}</span>
                        </div>
                      )
                    )}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
