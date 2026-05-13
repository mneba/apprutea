/**
 * Helpers de formatação de data e hora.
 *
 * Premissa: todos os timestamps vindos do banco são em UTC, independente
 * da coluna ser `timestamp without time zone` ou `timestamptz`. As funções
 * abaixo garantem que o JavaScript interprete o input como UTC e formate
 * no fuso horário do dispositivo do usuário.
 *
 * Por quê: parte das colunas do banco ainda é `timestamp without time zone`
 * (sem fuso), e `new Date('2026-05-09 21:02:54')` em JS interpreta a string
 * como hora LOCAL — o que dá hora errada no display. Adicionando 'Z' ou '+00:00'
 * forçamos interpretação como UTC, e então toLocaleString do navegador
 * converte para o fuso local automaticamente.
 *
 * Para colunas timestamptz (que vêm com +00 ou +00:00), o JS já interpreta
 * corretamente — basta NÃO modificar a string.
 */

/**
 * Garante que a string de timestamp seja interpretada como UTC.
 * Aceita formatos:
 *   - "2026-05-09 21:02:54" → adiciona Z (sem fuso, assume UTC)
 *   - "2026-05-09T21:02:54" → adiciona Z (sem fuso, assume UTC)
 *   - "2026-05-09T21:02:54.123Z" → mantém (já tem Z)
 *   - "2026-05-09T21:02:54+00" → mantém (já tem fuso curto)
 *   - "2026-05-09T21:02:54+00:00" → mantém (já tem fuso completo)
 *   - "2026-05-09T21:02:54-03:00" → mantém (já tem fuso)
 *   - Date object → retorna como está
 */
function normalizarParaUtc(input: string | Date): Date {
  if (input instanceof Date) return input;

  let str = input.trim();

  // Detecta se já tem indicador de fuso:
  // - Z ou z no final
  // - +HH ou -HH (só horas, ex: +00)
  // - +HH:MM ou -HH:MM (com minutos)
  // - +HHMM ou -HHMM (sem dois-pontos)
  const temFuso = /([Zz]|[+-]\d{2}(:?\d{2})?)$/.test(str);

  if (!temFuso) {
    // Substitui espaço por T (formato ISO) e adiciona Z
    str = str.replace(' ', 'T') + 'Z';
  }

  return new Date(str);
}

/**
 * Formata timestamp do banco como "DD/MM/YYYY HH:mm" no fuso do dispositivo.
 *
 * @example
 *   formatarDataHora('2026-05-09 21:02:54')
 *   // Em fuso BRT (UTC-3) → "09/05/2026 18:02"
 */
export function formatarDataHora(input: string | Date | null | undefined): string {
  if (!input) return '';
  const data = normalizarParaUtc(input);
  if (isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formata timestamp como "DD/MM HH:mm" (sem ano) no fuso do dispositivo.
 * Útil em listagens compactas e badges.
 */
export function formatarDataHoraCurto(input: string | Date | null | undefined): string {
  if (!input) return '';
  const data = normalizarParaUtc(input);
  if (isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formata apenas a data: "DD/MM/YYYY" no fuso do dispositivo.
 */
export function formatarData(input: string | Date | null | undefined): string {
  if (!input) return '';
  const data = normalizarParaUtc(input);
  if (isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formata apenas a hora: "HH:mm" no fuso do dispositivo.
 */
export function formatarHora(input: string | Date | null | undefined): string {
  if (!input) return '';
  const data = normalizarParaUtc(input);
  if (isNaN(data.getTime())) return '';
  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formata data por extenso: "qua, 09 de mai. de 2026".
 * Útil em headers e banners.
 *
 * IMPORTANTE: este helper recebe data PURA (YYYY-MM-DD), não timestamp.
 * Para datas dos campos DATE do banco (sem hora). Para evitar bug de
 * timezone com strings YYYY-MM-DD, é necessário forçar uma hora "neutra"
 * antes do parse (meio-dia evita problemas em fusos diferentes).
 *
 * @example
 *   formatarDataExtenso('2026-05-09')
 *   // → "qua, 09 de mai. de 2026"
 */
export function formatarDataExtenso(dataIso: string | null | undefined): string {
  if (!dataIso) return '';

  // Se vier um timestamp completo, pega só a parte da data
  const apenasData = dataIso.split('T')[0].split(' ')[0];

  // Constrói data ao meio-dia local para evitar deslocamento de fuso
  const partes = apenasData.split('-');
  if (partes.length !== 3) return '';
  const [ano, mes, dia] = partes.map(Number);

  const data = new Date(ano, mes - 1, dia, 12, 0, 0);
  if (isNaN(data.getTime())) return '';

  return data.toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
