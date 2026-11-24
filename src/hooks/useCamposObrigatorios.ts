'use client';

/**
 * Campo obrigatório que DIZ o que falta.
 *
 * Relato do Julio em 14/10/2026: *"quando falta um campo obrigatório o botão
 * fica cinza e o sistema não diz o que falta"*. Em Financeiro > Nova
 * movimentação, sem a descrição o "Registrar Saída" ficava desativado e
 * ninguém sabia por quê.
 *
 * O padrão:
 *   - o botão NÃO se desliga por campo vazio — só enquanto salva;
 *   - ao clicar, `conferir()` marca TODOS os que faltam, rola até o primeiro
 *     e põe o cursor nele;
 *   - a marca de cada um some assim que ele é preenchido (as faltas são
 *     recalculadas a cada render, a partir do estado do formulário).
 *
 * Uso:
 *   const obrig = useCamposObrigatorios({
 *     descricao: !descricao.trim() && 'Informe a descrição',
 *     valor:     !(Number(valor) > 0) && 'Informe um valor maior que zero',
 *   });
 *   ...
 *   <div data-campo="descricao" className={cartaoCampo(obrig.erro('descricao'))}>
 *     <label>Descrição<Obrigatorio /></label>
 *     <input ... />
 *     <ErroCampo mensagem={obrig.erro('descricao')} />
 *   </div>
 *   ...
 *   const handleSalvar = () => { if (!obrig.conferir()) return; ... }
 *
 * Peças visuais em components/ui/CampoObrigatorio.tsx.
 */

import { useCallback, useRef, useState } from 'react';

/** Campo -> mensagem quando falta; `false`/vazio quando está ok. */
export type FaltasDoFormulario = Record<string, string | false | null | undefined>;

export function useCamposObrigatorios(faltas: FaltasDoFormulario) {
  // Só depois da primeira tentativa: abrir o formulário vazio todo em
  // vermelho seria acusar o usuário antes de ele fazer qualquer coisa.
  const [tentou, setTentou] = useState(false);

  // `conferir` é estável e lê sempre as faltas do render mais recente.
  const faltasRef = useRef(faltas);
  faltasRef.current = faltas;

  const erro = (campo: string): string | undefined => {
    if (!tentou) return undefined;
    const m = faltas[campo];
    return m ? m : undefined;
  };

  const conferir = useCallback((): boolean => {
    const pendentes = Object.keys(faltasRef.current).filter(k => !!faltasRef.current[k]);
    setTentou(true);
    if (pendentes.length === 0) return true;

    // Depois do render que pinta as marcas: rola até o primeiro e foca.
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(`[data-campo="${pendentes[0]}"]`);
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const alvo = el.matches('input, select, textarea, button')
        ? el
        : el.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
      alvo?.focus({ preventScroll: true });
    });
    return false;
  }, []);

  /** Volta ao estado inicial — ao abrir o formulário de novo. */
  const limpar = useCallback(() => setTentou(false), []);

  return { erro, conferir, limpar, tentou };
}
