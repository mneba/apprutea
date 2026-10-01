// =====================================================================
// EXPORTAÇÃO CSV
// =====================================================================
//
// Sem dependência: o relatório do legado tem Imprimir, Excel e CSV, e relatório
// que não vira arquivo é pedido de novo na semana seguinte. CSV cobre o uso
// real — abre no Excel — sem trazer `xlsx` para o bundle.

/** Escapa um valor para CSV: aspas dobradas, e só envolve quando precisa. */
function campo(v: unknown, separador: string): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  const precisa = s.includes(separador) || s.includes('"') || s.includes('\n') || s.includes('\r');
  return precisa ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface ColunaCsv<T> {
  cabecalho: string;
  valor: (linha: T) => unknown;
}

/**
 * Monta e baixa um CSV.
 *
 * Usa `;` como separador e BOM UTF-8 de propósito: o Excel em português
 * interpreta `,` como separador decimal e, sem o BOM, come os acentos. Com
 * vírgula e sem BOM o arquivo abre numa coluna só e com "JoÃ£o" — o que leva o
 * usuário a concluir que o sistema exportou errado.
 */
export function baixarCsv<T>(nomeArquivo: string, colunas: ColunaCsv<T>[], linhas: T[]) {
  const SEP = ';';

  const corpo = [
    colunas.map((c) => campo(c.cabecalho, SEP)).join(SEP),
    ...linhas.map((l) => colunas.map((c) => campo(c.valor(l), SEP)).join(SEP)),
  ].join('\r\n');

  const blob = new Blob(['﻿' + corpo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Número com vírgula decimal, para o Excel pt-BR não tratar como texto. */
export const numCsv = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(n).replace('.', ',');
