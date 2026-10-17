'use client';

/**
 * Estado de tela que sobrevive a sair e voltar, durante a sessão.
 *
 * Pedido do cliente em 14/10/2026: "preservar o estado das telas durante a
 * sessão. Ao sair de uma área e depois voltar, o sistema não deve apagar o
 * contexto já selecionado. No Financeiro, manter período e filtros
 * aplicados; em Relatórios > Clientes, manter o relatório já gerado, seus
 * filtros e resultados. O estado só deve ser alterado quando o próprio
 * usuário mudar o filtro, gerar outra consulta ou trocar explicitamente o
 * contexto."
 *
 * Por que isto existe: navegar entre módulos DESMONTA a página, e
 * `useState` nasce do zero na volta. O [cacheDados](./cacheDados.ts) já
 * resolve o lado dos DADOS — o que faltava era o lado da ESCOLHA: período,
 * filtros, escopo, página.
 *
 * ESCOPO: memória do módulo, igual ao cacheDados. Vive enquanto a aba
 * estiver aberta e some num F5. Não é `sessionStorage` de propósito — os
 * valores guardados aqui incluem `Set` e o resultado inteiro de um
 * relatório, que pediriam serialização e esbarrariam na cota de 5 MB.
 * Guardar objeto vivo em memória não tem nenhum dos dois problemas.
 *
 * ⚠ E MORRER NO F5 É A DECISÃO, não a limitação que sobrou. Mauricio, em
 * 17/10/2026: "se o cliente der F5 é porque ele quer zerar mesmo". Então
 * recarregar a página é a forma de limpar a tela — não troque isto por
 * `sessionStorage` achando que é melhoria: tiraria do usuário o único
 * gesto óbvio que ele tem para começar de novo.
 *
 * A CHAVE CARREGA O CONTEXTO (empresa, rota). Trocar de empresa dá estado
 * novo; voltar para a anterior restaura o que estava lá. É o que o pedido
 * chama de "trocar explicitamente o contexto".
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

const estados = new Map<string, unknown>();

/** Monta a chave. Valor vazio vira '-', para `undefined` e `''` darem a mesma. */
export function chaveTela(
  prefixo: string,
  ...partes: Array<string | number | null | undefined>
): string {
  const corpo = partes.map((p) =>
    p === null || p === undefined || p === '' ? '-' : String(p)
  );
  return [prefixo, ...corpo].join('|');
}

function resolver<T>(inicial: T | (() => T)): T {
  return typeof inicial === 'function' ? (inicial as () => T)() : inicial;
}

/**
 * Como `useState`, mas o valor fica guardado sob `chave` e volta na próxima
 * montagem.
 *
 * @example
 *   const k = chaveTela('financeiro', empresaId, rotaId);
 *   const [status, setStatus] = useEstadoTela(`${k}|status`, 'PAGO');
 */
export function useEstadoTela<T>(
  chave: string,
  inicial: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  // O inicial é lido uma vez. Capturado em ref para a troca de chave poder
  // reusá-lo sem exigir que o chamador memoize o objeto que passou.
  const inicialRef = useRef(inicial);

  const [valor, setValor] = useState<T>(() =>
    estados.has(chave) ? (estados.get(chave) as T) : resolver(inicialRef.current)
  );

  const chaveAnterior = useRef(chave);

  // Gravar e reagir à troca de chave vão no MESMO efeito, e não em dois,
  // porque a ordem entre eles importa e o erro é silencioso: na troca de
  // contexto, um efeito de gravação rodando antes escreveria o valor do
  // contexto ANTIGO sob a chave NOVA — e o filtro de uma empresa
  // apareceria na outra, já salvo como se fosse dela.
  useEffect(() => {
    if (chaveAnterior.current !== chave) {
      chaveAnterior.current = chave;
      setValor(
        estados.has(chave) ? (estados.get(chave) as T) : resolver(inicialRef.current)
      );
      return; // sem gravar: o valor em mão ainda é do contexto anterior
    }
    estados.set(chave, valor);
  }, [chave, valor]);

  return [valor, setValor];
}

/**
 * Esquece o estado guardado. Sem argumento, esquece tudo.
 *
 * @example invalidarEstado('financeiro|')   // só o Financeiro
 */
export function invalidarEstado(prefixo?: string): void {
  if (!prefixo) {
    estados.clear();
    return;
  }
  for (const k of Array.from(estados.keys())) {
    if (k.startsWith(prefixo)) estados.delete(k);
  }
}
