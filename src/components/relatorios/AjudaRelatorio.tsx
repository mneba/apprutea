'use client';

// =====================================================================
// A AJUDA DO RELATÓRIO
// =====================================================================
//
// Um `?` ao lado do título, que abre o que o relatório é, como se lê e onde
// ele engana.
//
// JANELA, NÃO EXPANSÃO NA PRÓPRIA TELA. As páginas de relatório são travadas
// em altura, e empurrar o conteúdo esconderia os indicadores justamente
// quando o usuário está tentando entendê-los.
//
// O QUE ENTRA AQUI, E O QUE NÃO ENTRA. Isto não é manual de uso da interface
// — ninguém lê "clique no botão Gerar". O que vale escrever é o que o número
// significa, o que ele NÃO significa, e as armadilhas que já custaram tempo:
// que cobrança e venda não se comparam, que atraso conta em dias de cobrança,
// que caixa não soma entre dias. Quem souber isso lê o relatório sozinho.

import { HelpCircle, X } from 'lucide-react';
import { useEffect } from 'react';

export interface SecaoAjuda {
  titulo: string;
  /** Cada item é um parágrafo. O primeiro trecho em `**negrito**` vira rótulo. */
  itens: string[];
}

interface Props {
  titulo: string;
  secoes: SecaoAjuda[];
  aberta: boolean;
  onAbrir: () => void;
  onFechar: () => void;
}

/** `**assim**` no começo do item vira o rótulo em negrito. */
function Item({ texto }: { texto: string }) {
  // Sem a bandeira `s`: o alvo deste projeto não a tem, e `[\s\S]` faz o
  // mesmo trabalho em qualquer alvo.
  const m = texto.match(/^\*\*(.+?)\*\*\s*([\s\S]*)$/);
  if (!m) return <p className="text-[13px] text-gray-600 leading-relaxed">{texto}</p>;
  return (
    <p className="text-[13px] text-gray-600 leading-relaxed">
      <b className="text-gray-900 font-semibold">{m[1]}</b>
      {m[2] ? ` — ${m[2]}` : ''}
    </p>
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
            <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
              <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <HelpCircle className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900">{titulo}</h2>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  O que o relatório responde, como lê-lo e onde ele engana.
                </p>
              </div>
              <button
                onClick={onFechar}
                aria-label="Fechar"
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
              {secoes.map((s) => (
                <section key={s.titulo}>
                  <h3 className="text-[10.5px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                    {s.titulo}
                  </h3>
                  <div className="space-y-2">
                    {s.itens.map((it, i) => <Item key={i} texto={it} />)}
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
