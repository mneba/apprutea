/**
 * Data e hora no web: UMA régua (22/11/2026).
 *
 * Duas regras, e as duas são a causa dos relatos do Julio de 12 e 14/10/2026
 * ("lançamento de 12/10 23:24 aparece 13/10 02:23", "nota das 15:47 aparece
 * 18:47"):
 *
 * 1. TODO timestamp do banco é UTC, mesmo em coluna `timestamp without time
 *    zone` (notas.created_at, financeiro.created_at, emprestimos.created_at,
 *    liquidacoes_diarias.data_abertura/data_fechamento…). Essas chegam do
 *    PostgREST SEM marca de fuso, e `new Date('2026-10-13T02:24:00')` as lê
 *    como hora LOCAL — a hora UTC aparece crua, 3 h à frente em São Paulo.
 *    `paraInstante` acrescenta o `Z` quando falta. As `timestamptz` já vêm
 *    com `+00:00` e passam intactas (é por isso que a Auditoria acertava).
 *
 * 2. A hora é mostrada no FUSO DA ROTA, não no do navegador (decisão do
 *    Mauricio em 22/11/2026). O fuso é `empresas.timezone` da empresa
 *    selecionada — o mesmo que o banco usa em `fn_data_hoje_rota` —, e o
 *    `UserContext` o entrega aqui por `definirFusoExibicao` sempre que a
 *    empresa muda. Sem empresa, vale o fuso do navegador. Quem olha de São
 *    Paulo uma rota de Bogotá vê a hora de Bogotá: a hora em que aconteceu.
 *
 * ⚠ Data PURA (`YYYY-MM-DD`, colunas `date`) NÃO é instante e não tem fuso:
 * use `formatarDataPura`, que fatia o texto. `new Date('2026-10-10')` é
 * meia-noite UTC e sai 09/10 no Brasil — foi o bug das notas de 08/11.
 *
 * ⚠ Não escreva outro `new Date(x).toLocale...` numa tela: importe daqui.
 */

let fusoExibicao: string | undefined;

/** Chamado pelo UserContext. Fuso inválido ou vazio volta ao do navegador. */
export function definirFusoExibicao(fuso: string | null | undefined): void {
  if (!fuso) { fusoExibicao = undefined; return; }
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: fuso });
    fusoExibicao = fuso;
  } catch {
    fusoExibicao = undefined;
  }
}

export function obterFusoExibicao(): string | undefined {
  return fusoExibicao;
}

/**
 * Timestamp do banco -> Date (instante certo). Aceita:
 *   "2026-05-09 21:02:54" / "2026-05-09T21:02:54"  -> acrescenta Z (é UTC)
 *   "...Z", "...+00", "...+00:00", "...-03:00"     -> mantém
 *   Date                                           -> mantém
 */
export function paraInstante(input: string | Date): Date {
  if (input instanceof Date) return input;
  let str = String(input).trim();
  const temFuso = /([Zz]|[+-]\d{2}(:?\d{2})?)$/.test(str);
  if (!temFuso) str = str.replace(' ', 'T') + 'Z';
  return new Date(str);
}

function fmt(input: string | Date | null | undefined, opcoes: Intl.DateTimeFormatOptions): string {
  if (!input) return '';
  const d = paraInstante(input);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { ...opcoes, timeZone: fusoExibicao });
}

/** "DD/MM/YYYY HH:mm" no fuso da rota. */
export function formatarDataHora(input: string | Date | null | undefined): string {
  return fmt(input, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** "DD/MM/YY HH:mm" no fuso da rota. */
export function formatarDataHoraAno2(input: string | Date | null | undefined): string {
  return fmt(input, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** "DD/MM HH:mm" (sem ano) no fuso da rota. */
export function formatarDataHoraCurto(input: string | Date | null | undefined): string {
  return fmt(input, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** "DD/MM/YYYY" de um TIMESTAMP, no fuso da rota. Para coluna `date`, use formatarDataPura. */
export function formatarData(input: string | Date | null | undefined): string {
  return fmt(input, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "HH:mm" de um timestamp, no fuso da rota. */
export function formatarHora(input: string | Date | null | undefined): string {
  return fmt(input, { hour: '2-digit', minute: '2-digit' });
}

/** "HH:mm:ss" de um timestamp, no fuso da rota. */
export function formatarHoraSegundos(input: string | Date | null | undefined): string {
  return fmt(input, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Data PURA "YYYY-MM-DD" (ou timestamp do qual só interessa o texto da data)
 * -> "DD/MM/YYYY" ou "DD/MM/YY". Fatia texto: sem Date, sem fuso.
 */
export function formatarDataPura(dataIso: string | null | undefined, ano2 = false): string {
  if (!dataIso) return '';
  const [a, m, d] = String(dataIso).substring(0, 10).split('-');
  if (!a || !m || !d) return '';
  return `${d}/${m}/${ano2 ? a.slice(2) : a}`;
}

/** "YYYY-MM-DD" de um instante, no fuso da rota. */
export function chaveDiaNoFuso(instante: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD
  return instante.toLocaleDateString('en-CA', {
    timeZone: fusoExibicao, year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

/**
 * HOJE no fuso da rota, "YYYY-MM-DD". Substitui `new Date().toISOString()
 * .split('T')[0]`, que é o dia em UTC e vira o dia seguinte às 21h em São
 * Paulo (o filtro "Hoje" do Financeiro, relato de 14/10/2026).
 *
 * ⚠ Onde houver liquidação, o dia operacional é ela, não "hoje" — ver
 * CLAUDE.md, "A liquidação é a régua do tempo". Isto é para filtro de
 * calendário e valor inicial.
 */
export function hojeNoFuso(): string {
  return chaveDiaNoFuso(new Date());
}

/** Soma dias a um "YYYY-MM-DD" (aritmética de calendário, em UTC). */
export function somarDias(dataIso: string, dias: number): string {
  const [a, m, d] = dataIso.substring(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return t.toISOString().substring(0, 10);
}

/**
 * Data PURA por extenso: "qua, 09 de mai. de 2026". Monta ao meio-dia UTC e
 * formata em UTC: o texto da data não depende de fuso nenhum.
 */
export function formatarDataExtenso(dataIso: string | null | undefined): string {
  if (!dataIso) return '';
  const apenasData = dataIso.split('T')[0].split(' ')[0];
  const partes = apenasData.split('-');
  if (partes.length !== 3) return '';
  const [ano, mes, dia] = partes.map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
  if (isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}
