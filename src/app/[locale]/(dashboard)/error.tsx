'use client';

/**
 * Tela de erro do dashboard.
 *
 * Sem este arquivo, qualquer exceção de cliente numa página do dashboard
 * sobe até a raiz e o Next mostra *"Application error: a client-side
 * exception has occurred"* numa tela branca — foi o que o Julio viu em
 * 12/10/2026 ao dar F5 no Financeiro. Tela branca não diz o que houve,
 * não deixa voltar e não dá nenhuma pista para quem for consertar.
 *
 * Aqui a pessoa lê o que aconteceu, tenta de novo sem perder a sessão, e
 * tem um identificador para repassar. O `digest` é o que o Next registra
 * no servidor: é por ele que se acha o erro real quando a mensagem vem
 * ofuscada pelo build de produção.
 */

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Link } from '@/i18n/routing';

export default function ErroDashboard({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Com emoji, como o resto do projeto — é o canal de depuração daqui.
    console.error('❌ Erro na tela do dashboard:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-red-600" />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Esta tela não conseguiu abrir
      </h2>
      <p className="text-sm text-gray-500 max-w-md">
        O erro está abaixo. Tentar de novo costuma resolver quando foi falha de
        rede; se repetir, mande esta mensagem para o suporte.
      </p>

      <pre className="mt-4 max-w-xl w-full overflow-x-auto rounded-lg bg-gray-50 border border-gray-200 p-3 text-left text-xs text-gray-700 whitespace-pre-wrap break-words">
        {error.message || 'Erro sem mensagem.'}
        {error.digest ? `\n\nIdentificador: ${error.digest}` : ''}
      </pre>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <RotateCcw className="w-4 h-4" />
          Tentar de novo
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Home className="w-4 h-4" />
          Ir para o início
        </Link>
      </div>
    </div>
  );
}
