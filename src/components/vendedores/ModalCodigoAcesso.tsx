'use client';

// =====================================================================
// O CÓDIGO DE ACESSO DO VENDEDOR, num modal pequeno (25/11/2026)
// =====================================================================
//
// O código É A SENHA do app (login sintético `codigo@apprutea.internal`).
// Ele não vem mais na lista nem no cadastro: só é pedido ao banco quando
// alguém clica "Ver código", por `fn_codigo_acesso_vendedor`, que confere a
// permissão (SUPER_ADMIN ou ADMIN da empresa) e registra quem viu. Ao fechar,
// o código sai da página.
//
// `codigoNovo` vem do "Regerar": aí o código já chegou na resposta da troca e
// não há o que pedir de novo.

import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, X } from 'lucide-react';
import { vendedoresService } from '@/services/vendedores';

export function ModalCodigoAcesso({
  vendedorId,
  vendedorNome,
  codigoNovo,
  onFechar,
}: {
  vendedorId: string;
  vendedorNome: string;
  codigoNovo?: string | null;
  onFechar: () => void;
}) {
  const [codigo, setCodigo] = useState<string | null>(codigoNovo ?? null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (codigoNovo) return;
    let vivo = true;
    vendedoresService
      .verCodigoAcesso(vendedorId)
      .then((c) => {
        if (!vivo) return;
        if (c) setCodigo(c);
        else setErro('Este vendedor ainda não tem código de acesso.');
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível buscar o código.');
      });
    return () => {
      vivo = false;
    };
  }, [vendedorId, codigoNovo]);

  // Esc fecha, como o resto dos modais.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFechar]);

  const copiar = async () => {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* sem permissão de área de transferência: o código está na tela */
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-xs p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Código de acesso"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="w-5 h-5 text-purple-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {codigoNovo ? 'Novo código de acesso' : 'Código de acesso'}
              </p>
              <p className="text-xs text-gray-500 truncate">{vendedorNome}</p>
            </div>
          </div>
          <button onClick={onFechar} className="p-1 rounded hover:bg-gray-100" aria-label="Fechar">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {erro ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{erro}</p>
        ) : !codigo ? (
          <div className="py-4 text-center">
            <Loader2 className="w-5 h-5 text-purple-600 animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-3">
              <code className="text-2xl font-mono font-bold tracking-widest text-purple-700">{codigo}</code>
              <button
                onClick={copiar}
                className="p-1.5 rounded hover:bg-purple-100 text-purple-700"
                title="Copiar"
                aria-label="Copiar código"
              >
                {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Este código é a senha do vendedor no app. Entregue só a ele.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
