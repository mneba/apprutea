'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

// ⚠ As paginas do dashboard sao todas `'use client'`, mas o Next AINDA as
// pre-renderiza no servidor -- e la `useLayoutEffect` emite aviso no console.
// A escolha e por ambiente, uma vez, no modulo: nao e hook condicional.
const useEfeitoDeLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Posiciona o painel de um menu proprio (um botao + uma lista, no lugar de um
 * <select> nativo) em `position: fixed`, medido do botao que o abre.
 *
 * ⚠ POR QUE `fixed` E NAO `absolute` -- as duas metades de um relato sao UM
 * defeito.
 *
 * Relatado pelo Julio em 08/11/2026, no modal de Adicionar transacao do
 * Financeiro: a lista de contas *"aparece em uma area muito pequena e o scroll
 * fica praticamente preso dentro desse espaco, obrigando a percorrer toda a
 * lista antes de conseguir continuar navegando no restante do modal"*.
 *
 * O painel era `absolute` dentro do corpo do modal, que e `overflow-y-auto`.
 * Esse ancestral o RECORTA: a caixa tinha 288px (`max-h-72`) e o que sobrava
 * visivel era so o que cabia ate a borda do corpo -- a "area muito pequena".
 * E porque essa faixa recortada ainda tinha rolagem PROPRIA, a roda do mouse
 * precisava percorrer a lista toda antes de escapar para o modal -- o "scroll
 * preso". Uma causa, dois sintomas: consertar um conserta o outro.
 *
 * `position: fixed` escapa do recorte porque o bloco de contencao dele e a
 * janela, nao o ancestral que rola. Nao e preciso portal.
 *
 * ⚠ ISSO DEIXA DE VALER se algum ancestral do painel ganhar `transform`,
 * `filter`, `backdrop-filter`, `will-change` ou `contain` -- qualquer um deles
 * cria bloco de contencao para filho `fixed` e o recorte volta, calado. Uma
 * animacao de abertura no modal e o jeito mais facil de reintroduzir este bug.
 *
 * ⚠ E o painel PRECISA ter `overflow-y-auto`: o hook escreve `maxHeight`, e
 * sem rolagem propria a altura limitada passa a CORTAR item em vez de rolar.
 *
 * A direcao, medida contra a janela: abaixo quando cabe, acima quando cabe la,
 * e senao o MAIOR lado livre. A margem de 25% existe porque sem ela o painel
 * trocaria de lado por 30px de diferenca, o que na tela parece defeito. Ele
 * nunca cobre o gatilho -- e e isso que o mantem COLADO no campo quando o
 * modal rola. Ancorar na janela daria lista maior e o painel se descolaria do
 * campo ao rolar; foi comparado em mockup com o Mauricio em 09/11/2026 e a
 * diferenca de area era de 3 ou 4 itens, que nao paga o descolamento.
 */

const FOLGA = 4;    // o `mt-1` que o painel tinha: respiro entre campo e lista
const MARGEM = 8;   // folga minima da borda da janela
const TETO = 0.7;   // o painel nao passa de 70% da altura da janela

// Primeiro quadro, antes de medir. `useLayoutEffect` troca isto ANTES da
// pintura, entao nao ha piscada -- com `useEffect` haveria.
const OCULTO: CSSProperties = { position: 'fixed', top: 0, left: 0, visibility: 'hidden' };

export function useMenuFlutuante(aberto: boolean, onFechar?: () => void) {
  const refGatilho = useRef<HTMLButtonElement | null>(null);
  const refPainel = useRef<HTMLDivElement | null>(null);
  const [estiloPainel, setEstiloPainel] = useState<CSSProperties>(OCULTO);

  // ⚠ `onFechar` vive numa ref, nao nas dependencias. Os chamadores passam
  // arrow inline -- identidade nova a cada render --, e com ela em
  // `useCallback` o efeito re-rodaria, chamaria `posicionar`, que faz
  // `setEstiloPainel`, que re-renderiza: laco infinito.
  const refFechar = useRef(onFechar);
  refFechar.current = onFechar;

  const posicionar = useCallback(() => {
    const gatilho = refGatilho.current;
    const painel = refPainel.current;
    if (!gatilho || !painel) return;

    const r = gatilho.getBoundingClientRect();

    // O campo saiu da vista (o modal rolou): fecha, em vez de deixar o painel
    // flutuando solto longe do campo a que ele pertence.
    if (r.bottom < 0 || r.top > window.innerHeight) {
      refFechar.current?.();
      return;
    }

    // Mede o conteudo ANTES de limitar a altura, senao o limite anterior
    // responde pelo natural e o painel nunca mais cresce.
    painel.style.maxHeight = 'none';
    const natural = painel.scrollHeight;

    const abaixo = window.innerHeight - r.bottom - FOLGA - MARGEM;
    const acima = r.top - FOLGA - MARGEM;
    const alvo = Math.min(natural, Math.round(window.innerHeight * TETO));

    let top: number;
    let altura: number;
    if (abaixo >= alvo) {
      top = r.bottom + FOLGA;              // cabe abaixo: o caso normal
      altura = alvo;
    } else if (acima >= alvo) {
      top = r.top - FOLGA - alvo;          // cabe acima: vira para cima
      altura = alvo;
    } else if (acima > abaixo * 1.25) {
      top = r.top - FOLGA - acima;         // nenhum cabe: o maior lado livre
      altura = acima;
    } else {
      top = r.bottom + FOLGA;
      altura = abaixo;
    }

    setEstiloPainel({
      position: 'fixed',
      left: Math.round(r.left),
      width: Math.round(r.width),
      top: Math.round(top),
      maxHeight: Math.max(0, Math.round(altura)),
      // A outra metade do conserto: a roda sobre a lista nao vaza para o
      // modal, entao os dois rolam de forma independente.
      overscrollBehavior: 'contain',
    });
  }, []);

  useEfeitoDeLayout(() => {
    if (!aberto) {
      // `OCULTO` e constante de modulo, entao fechado->fechado nao re-renderiza.
      setEstiloPainel(prev => (prev === OCULTO ? prev : OCULTO));
      return;
    }
    posicionar();
    // `true` = fase de captura: pega tambem a rolagem do CORPO do modal, que
    // nao borbulha ate a janela.
    window.addEventListener('scroll', posicionar, true);
    window.addEventListener('resize', posicionar);
    return () => {
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    };
  }, [aberto, posicionar]);

  return { refGatilho, refPainel, estiloPainel };
}
