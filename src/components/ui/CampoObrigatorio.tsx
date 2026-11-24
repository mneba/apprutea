'use client';

/**
 * Peças visuais do campo obrigatório. A regra está em
 * hooks/useCamposObrigatorios.ts (relato do Julio, 14/10/2026).
 */

import { AlertCircle } from 'lucide-react';

/** O asterisco vermelho, depois do texto do rótulo. */
export function Obrigatorio() {
  return (
    <span className="text-red-600" aria-hidden="true">
      {' '}*
    </span>
  );
}

/** A mensagem embaixo do campo. Sem mensagem, não ocupa espaço. */
export function ErroCampo({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
      {mensagem}
    </p>
  );
}

/**
 * Borda e fundo do CARTÃO que envolve o campo (o `p-4 rounded-xl border-2`
 * dos modais). Devolve as duas cores inteiras, e não um acréscimo: duas
 * classes de borda na mesma linha não têm ordem garantida no Tailwind.
 */
export const cartaoCampo = (mensagem?: string) =>
  mensagem ? 'border-red-400 bg-red-50/40' : 'border-gray-200 bg-white';

/** Borda de um campo solto, quando não há cartão em volta. */
export const bordaCampo = (mensagem?: string) =>
  mensagem
    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
    : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500';
