'use client';

/**
 * Campo numérico que pode ficar VAZIO enquanto se digita.
 *
 * Reclamação do Julio em 03/10/2026: *"ao editar campos numéricos do
 * cliente, como valor, juros ou número de parcelas, o sistema não permite
 * apagar completamente o conteúdo: às vezes mantém o último número ou
 * deixa 0"*.
 *
 * A CAUSA é o idioma `onChange={e => setX(parseFloat(e.target.value) || 0)}`
 * com `value={x}`. Apagar o campo manda string vazia, `parseFloat('')` é
 * `NaN`, o `|| 0` o troca por zero — e como o `value` vem do estado, o
 * zero volta para a tela no mesmo instante. Com `|| minParcelas` é pior: o
 * campo salta para o mínimo enquanto a pessoa ainda está digitando.
 *
 * A SAÍDA é separar o que se VÊ do que se CALCULA. Este componente guarda
 * o texto digitado — que pode ser "" — e entrega para fora sempre um
 * número. Quem consome continua recebendo `number` e não precisa saber de
 * nada disto; foi assim que os quinze lugares que fazem conta com esses
 * valores ficaram intocados.
 */

import { useEffect, useRef, useState } from 'react';

type PropsInput = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
>;

interface Props extends PropsInput {
  /**
   * Aceita nulo e indefinido de propósito: campo opcional que ainda não
   * foi preenchido tem de aparecer VAZIO, não como zero. Mostrar 0 onde
   * não há valor é a mesma mentira que o `|| 0` contava.
   */
  valor: number | null | undefined;
  onChange: (n: number) => void;
  /** O número reportado enquanto o campo está vazio. Padrão 0. */
  vazio?: number;
  /** Trunca para inteiro, como o `parseInt` que estava no lugar. */
  inteiro?: boolean;
}

export function InputNumero({ valor, onChange, vazio = 0, inteiro, ...resto }: Props) {
  const [texto, setTexto] = useState(() =>
    typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : ''
  );

  // O último número que NÓS emitimos. Sem isto, limpar o campo de um valor
  // 500 emitiria 0, o efeito abaixo veria "o valor mudou" e escreveria
  // "0" de volta no texto — exatamente o defeito que este componente
  // existe para resolver, só que mais difícil de achar.
  const emitido = useRef<number | null | undefined>(valor);

  useEffect(() => {
    if (valor === emitido.current) return;
    emitido.current = valor;
    setTexto(typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : '');
  }, [valor]);

  return (
    <input
      {...resto}
      type="number"
      value={texto}
      onChange={(e) => {
        const t = e.target.value;
        setTexto(t); // o que se vê é o que foi digitado, inclusive vazio

        const n = inteiro ? parseInt(t, 10) : parseFloat(t);
        const limpo = Number.isFinite(n) ? n : vazio;
        emitido.current = limpo;
        onChange(limpo);
      }}
    />
  );
}
