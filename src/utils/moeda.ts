/**
 * Dinheiro no web: "$ 1.234,56", negativo "$ -12,50". UM lugar só (22/11/2026).
 *
 * ⚠ O símbolo é SEMPRE `$` e as casas são SEMPRE duas — regra do Mauricio em
 * 04/11/2026: o sistema opera na América Latina, não existe campo de moeda no
 * schema e já há mais de uma moeda na base. `currency: 'BRL'` (R$) seria
 * inventar o país; cortar os centavos seria inventar o peso colombiano.
 *
 * Mesma saída de `moeda()` em apprutea_android/src/utils/formato.ts e de
 * `fn_moeda` no banco. Até 22/11/2026 cada tela do web tinha a sua cópia, e 11
 * delas ainda mostravam R$ — por isso não crie outra: importe esta.
 *
 * No web o `Intl` é o do navegador e funciona (no app não: lá o formatador é
 * escrito à mão, ver o CLAUDE.md).
 */
export function moeda(valor: number | string | null | undefined): string {
  // Arredonda ao centavo ANTES de formatar, e `|| 0` desfaz o -0: sem isso
  // -0,004 sairia "$ -0,00".
  const centavos = Math.round((Number(valor) || 0) * 100) / 100 || 0;
  return '$ ' + centavos.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Texto de um campo de valor, cortado em `casas` decimais (padrão 2).
 *
 * Relato do Julio (14/10/2026): uma saída de 10,555 gravou 10,56, mas o caixa
 * do dia andou 10,55 e sobrou 1 centavo no extrato. O banco passou a arredondar
 * na entrada das funções de dinheiro (sql/2026-11-22_valores_em_duas_casas.sql);
 * isto é a segunda defesa: o campo não deixa digitar a 3ª casa, para o que se
 * vê ser o que se grava. CORTA, não arredonda — arredondar enquanto se digita
 * mudaria o número debaixo do dedo.
 *
 * Aceita ponto ou vírgula. Texto sem casa a mais volta intacto.
 */
export function limitarCasas(texto: string, casas = 2): string {
  const m = /^(-?\d*[.,])(\d*)$/.exec(texto);
  if (!m || m[2].length <= casas) return texto;
  return m[1] + m[2].slice(0, casas);
}
