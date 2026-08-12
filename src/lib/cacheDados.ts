/**
 * Cache em memória para dados de módulo.
 *
 * Motivo: cada página do dashboard busca tudo de novo a cada montagem, e
 * navegar entre módulos desmonta a página. O resultado era um "carregando"
 * toda vez que se entrava em Clientes, Financeiro, etc., mesmo sem nada
 * ter mudado.
 *
 * Escopo: memória do módulo, ou seja, vive enquanto a aba estiver aberta e
 * some num F5. Não é persistência — é só para evitar refazer a mesma query
 * segundos depois.
 *
 * IMPORTANTE: a chave precisa conter tudo que muda o resultado (empresa,
 * rota, filtros), senão um usuário vê dado de outra seleção. Use `chave()`.
 */

interface EntradaCache<T> {
  valor: T;
  expiraEm: number;
}

const cache = new Map<string, EntradaCache<unknown>>();

/** Requisições em voo, para não disparar a mesma query duas vezes em paralelo */
const emVoo = new Map<string, Promise<unknown>>();

export const TTL_CURTO = 60 * 1000;        // 1 min  — dados que mudam durante o dia
export const TTL_PADRAO = 5 * 60 * 1000;   // 5 min  — listas de trabalho
export const TTL_LONGO = 30 * 60 * 1000;   // 30 min — dados de referência (segmentos, categorias)

/**
 * Monta uma chave estável. Valores nulos viram '-', arrays são ordenados
 * para que a mesma seleção em ordem diferente reaproveite o cache.
 */
export function chave(
  prefixo: string,
  ...partes: Array<string | number | boolean | null | undefined | string[]>
): string {
  const corpo = partes.map((p) => {
    if (p === null || p === undefined || p === '') return '-';
    if (Array.isArray(p)) return [...p].sort().join(',') || '-';
    return String(p);
  });
  return [prefixo, ...corpo].join('|');
}

export function temCache(k: string): boolean {
  const e = cache.get(k);
  return !!e && e.expiraEm > Date.now();
}

export function lerCache<T>(k: string): T | undefined {
  const e = cache.get(k);
  if (!e) return undefined;
  if (e.expiraEm <= Date.now()) {
    cache.delete(k);
    return undefined;
  }
  return e.valor as T;
}

export function gravarCache<T>(k: string, valor: T, ttlMs: number = TTL_PADRAO): void {
  cache.set(k, { valor, expiraEm: Date.now() + ttlMs });
}

/**
 * Invalida por prefixo. Sem argumento, limpa tudo.
 *
 * @example invalidarCache('clientes:')            // todo o módulo
 * @example invalidarCache(`clientes:lista|${id}`) // só uma empresa
 */
export function invalidarCache(prefixo?: string): void {
  if (!prefixo) {
    cache.clear();
    emVoo.clear();
    return;
  }
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefixo)) cache.delete(k);
  }
  for (const k of Array.from(emVoo.keys())) {
    if (k.startsWith(prefixo)) emVoo.delete(k);
  }
}

/**
 * Executa `buscar` só se não houver valor válido em cache.
 *
 * Chamadas concorrentes para a mesma chave compartilham a mesma promise, o
 * que evita a rajada de queries iguais quando vários efeitos disparam juntos.
 */
export async function comCache<T>(
  k: string,
  buscar: () => Promise<T>,
  opts?: { ttlMs?: number; forcar?: boolean }
): Promise<T> {
  if (!opts?.forcar) {
    const emCache = lerCache<T>(k);
    if (emCache !== undefined) return emCache;

    const jaEmVoo = emVoo.get(k);
    if (jaEmVoo) return jaEmVoo as Promise<T>;
  }

  const promessa = buscar()
    .then((valor) => {
      gravarCache(k, valor, opts?.ttlMs);
      return valor;
    })
    .finally(() => {
      emVoo.delete(k);
    });

  emVoo.set(k, promessa);
  return promessa;
}
