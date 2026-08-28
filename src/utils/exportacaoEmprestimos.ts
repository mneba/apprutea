// =====================================================
// EXPORTAÇÃO DE EMPRÉSTIMOS — colunas, rótulos e formatação
// Arquivo: src/utils/exportacaoEmprestimos.ts
// =====================================================
//
// Definição única das colunas dos dois botões da tela de Clientes (CSV e
// Excel). Os dois têm de produzir exatamente o mesmo conteúdo — o que mudava
// entre eles antes era só o formato do arquivo, e mesmo assim as listas de
// colunas viviam duplicadas e divergiam.
//
// O layout espelha o relatório do sistema legado do cliente, que é por
// EMPRÉSTIMO. Ficaram de fora, por decisão: `ID. VENTA` (não temos código
// sequencial de empréstimo) e `VISITAS`.
//
// Rótulos em pt-BR ou es conforme o locale da rota. Ao contrário do resto do
// dashboard — que tem português no código — aqui a tradução é requisito: o
// arquivo vai para o cliente final, que opera em espanhol.

import type { ColunaPlanilha } from './xlsx';
import type { LinhaExportacaoEmprestimo } from '@/types/clientes';

type Idioma = 'pt-BR' | 'es';

const ehEs = (locale: string): boolean => locale.toLowerCase().startsWith('es');

// ─── Rótulos ────────────────────────────────────────────────────────────────

const R: Record<Idioma, Record<string, string>> = {
  'pt-BR': {
    pais: 'País', vendedor: 'Vendedor', rota: 'Rota', dataVenda: 'Data Venda',
    consecutivo: 'Consecutivo', cliente: 'Cliente', documento: 'Documento',
    telefone: 'Telefone', endereco: 'Endereço', emprestado: 'Valor Emprestado',
    aPagar: 'Valor a Pagar', juros: 'Juros', taxa: '%', valorParcela: 'Valor Parcela',
    parcelas: 'Parcelas', pagas: 'Parcelas Pagas', restantes: 'Parcelas Restantes',
    saldo: 'Saldo', multa: 'Multa', frequencia: 'Frequência', ultPago: 'Último Pagamento',
    total: 'TOTAL', aba: 'Empréstimos', arquivo: 'emprestimos',
  },
  'es': {
    pais: 'País', vendedor: 'Vendedor', rota: 'Ruta', dataVenda: 'Fecha Venta',
    consecutivo: 'Consecutivo', cliente: 'Cliente', documento: 'Identificación',
    telefone: 'Teléfono', endereco: 'Dirección', emprestado: 'Valor Prestado',
    aPagar: 'Valor a Pagar', juros: 'Interés', taxa: '%', valorParcela: 'V. Cuota',
    parcelas: 'Cuotas', pagas: 'C. Pagas', restantes: 'C. Resta',
    saldo: 'Saldo', multa: 'Sanción', frequencia: 'Frec.', ultPago: 'Últ. Pago',
    total: 'TOTAL', aba: 'Préstamos', arquivo: 'prestamos',
  },
};

const FREQ: Record<Idioma, Record<string, string>> = {
  'pt-BR': { DIARIO: 'Diário', SEMANAL: 'Semanal', QUINZENAL: 'Quinzenal', MENSAL: 'Mensal', FLEXIVEL: 'Flexível' },
  'es': { DIARIO: 'Diario', SEMANAL: 'Semanal', QUINZENAL: 'Quincenal', MENSAL: 'Mensual', FLEXIVEL: 'Flexible' },
};

const DIAS_SEMANA: Record<Idioma, string[]> = {
  'pt-BR': ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  'es': ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
};

// ─── Formatação ─────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' → 'DD/MM/AAAA'. Sem `new Date`: a string já é a data local. */
const fmtData = (d: string | null): string => {
  if (!d) return '';
  const [a, m, dia] = d.substring(0, 10).split('-');
  return a && m && dia ? `${dia}/${m}/${a}` : '';
};

/**
 * "Diário", "Semanal (Sábado)", "Mensal (Dia 10)", "Flexível (Dias 1, 15)".
 * O legado escrevia "Semanal (     Sabado  )" — com o alinhamento por espaços
 * de um relatório de terminal. Aqui sai limpo.
 */
const fmtFrequencia = (l: LinhaExportacaoEmprestimo, i: Idioma): string => {
  const base = FREQ[i][l.frequencia_pagamento || ''] || l.frequencia_pagamento || '';
  const diaMes = i === 'es' ? 'Día' : 'Dia';
  const diasMes = i === 'es' ? 'Días' : 'Dias';

  if (l.frequencia_pagamento === 'SEMANAL' && l.dia_semana_cobranca != null) {
    return `${base} (${DIAS_SEMANA[i][l.dia_semana_cobranca] || l.dia_semana_cobranca})`;
  }
  if (l.frequencia_pagamento === 'MENSAL' && l.dia_mes_cobranca != null) {
    return `${base} (${diaMes} ${l.dia_mes_cobranca})`;
  }
  if (l.frequencia_pagamento === 'FLEXIVEL' && l.dias_mes_cobranca?.length) {
    return `${base} (${diasMes} ${l.dias_mes_cobranca.join(', ')})`;
  }
  return base;
};

/** País no formato do legado: "BRASIL (SAO PABLO)". */
const fmtPais = (l: LinhaExportacaoEmprestimo): string => {
  if (!l.pais) return l.cidade || '';
  return l.cidade ? `${l.pais} (${l.cidade})` : l.pais;
};

// ─── Colunas ────────────────────────────────────────────────────────────────

export function colunasEmprestimos(locale: string): ColunaPlanilha<LinhaExportacaoEmprestimo>[] {
  const i: Idioma = ehEs(locale) ? 'es' : 'pt-BR';
  const t = R[i];
  return [
    { titulo: t.pais,         largura: 24, valor: l => fmtPais(l) },
    { titulo: t.vendedor,     largura: 22, valor: l => l.vendedor_nome },
    { titulo: t.rota,         largura: 26, valor: l => l.rota_nome },
    { titulo: t.dataVenda,    largura: 12, valor: l => fmtData(l.data_emprestimo) },
    { titulo: t.consecutivo,  largura: 14, numero: true, valor: l => l.codigo_cliente },
    { titulo: t.cliente,      largura: 32, valor: l => l.cliente_nome },
    { titulo: t.documento,    largura: 16, valor: l => l.cliente_documento },
    { titulo: t.telefone,     largura: 16, valor: l => l.cliente_telefone },
    { titulo: t.endereco,     largura: 40, valor: l => l.cliente_endereco },
    { titulo: t.emprestado,   largura: 15, numero: true, valor: l => l.valor_principal },
    { titulo: t.aPagar,       largura: 15, numero: true, valor: l => l.valor_total },
    { titulo: t.juros,        largura: 12, numero: true, valor: l => l.valor_juros },
    { titulo: t.taxa,         largura: 7,  numero: true, valor: l => l.taxa_juros },
    { titulo: t.valorParcela, largura: 13, numero: true, valor: l => l.valor_parcela },
    { titulo: t.parcelas,     largura: 10, numero: true, valor: l => l.numero_parcelas },
    { titulo: t.pagas,        largura: 13, numero: true, valor: l => l.parcelas_pagas },
    { titulo: t.restantes,    largura: 15, numero: true, valor: l => l.parcelas_restantes },
    { titulo: t.saldo,        largura: 14, numero: true, valor: l => l.valor_saldo },
    { titulo: t.multa,        largura: 10, numero: true, valor: l => l.valor_multa },
    { titulo: t.frequencia,   largura: 22, valor: l => fmtFrequencia(l, i) },
    { titulo: t.ultPago,      largura: 15, valor: l => fmtData(l.ultimo_pagamento) },
  ];
}

/**
 * Linha TOTAL, como no relatório legado. Soma só as colunas onde somar faz
 * sentido — somar `%` ou `Parcelas` daria um número sem significado.
 *
 * Devolve um objeto no mesmo formato das linhas para atravessar as mesmas
 * colunas. Os campos não somados vão vazios.
 */
export function linhaTotal(
  linhas: LinhaExportacaoEmprestimo[],
  locale: string,
): LinhaExportacaoEmprestimo {
  const soma = (f: (l: LinhaExportacaoEmprestimo) => number) =>
    linhas.reduce((s, l) => s + (Number(f(l)) || 0), 0);

  return {
    pais: null, estado: null, cidade: null,
    vendedor_nome: null, rota_nome: null, data_emprestimo: null,
    codigo_cliente: null,
    cliente_nome: R[ehEs(locale) ? 'es' : 'pt-BR'].total,
    cliente_documento: null, cliente_telefone: null, cliente_endereco: null,
    valor_principal: soma(l => l.valor_principal),
    valor_total: soma(l => l.valor_total),
    valor_juros: soma(l => l.valor_juros),
    taxa_juros: null as unknown as number,
    valor_parcela: null as unknown as number,
    numero_parcelas: null as unknown as number,
    parcelas_pagas: null as unknown as number,
    parcelas_restantes: null as unknown as number,
    valor_saldo: soma(l => l.valor_saldo),
    valor_multa: soma(l => l.valor_multa),
    frequencia_pagamento: null, dia_semana_cobranca: null,
    dia_mes_cobranca: null, dias_mes_cobranca: null,
    ultimo_pagamento: null, status: null,
  };
}

/** Nome do arquivo, sem extensão. */
export const nomeArquivoExportacao = (locale: string): string =>
  `${R[ehEs(locale) ? 'es' : 'pt-BR'].arquivo}_${new Date().toISOString().split('T')[0]}`;

/** Nome da aba da planilha. */
export const nomeAbaExportacao = (locale: string): string =>
  R[ehEs(locale) ? 'es' : 'pt-BR'].aba;

// ─── CSV ────────────────────────────────────────────────────────────────────

/**
 * Mesmo conteúdo do Excel, em CSV. Mantém as escolhas do arquivo antigo:
 * separador `;` (o Excel em pt-BR/es abre direto) e BOM UTF-8, sem o qual os
 * acentos saem quebrados no Excel do Windows.
 *
 * Aspas dentro do valor são duplicadas — o arquivo antigo não fazia isso, e um
 * endereço com aspas quebrava a coluna.
 */
export function montarCsv<T>(colunas: ColunaPlanilha<T>[], linhas: T[]): Blob {
  const celula = (v: unknown): string => {
    if (v === null || v === undefined) return '""';
    return `"${String(v).replace(/"/g, '""')}"`;
  };
  const conteudo = [
    colunas.map(c => celula(c.titulo)).join(';'),
    ...linhas.map(l => colunas.map(c => celula(c.valor(l))).join(';')),
  ].join('\n');

  // BOM como escape, não como caractere literal: U+FEFF é invisível no
  // editor e some numa normalização de arquivo sem ninguém perceber.
  return new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
}
