/**
 * Pré-carregamento dos módulos após escolher empresa/rota no seletor.
 *
 * Ideia: no instante em que o usuário define onde vai trabalhar, já buscamos
 * em segundo plano o que os módulos mais visitados pedem na montagem. Quando
 * ele entra em Clientes ou Financeiro, o dado já está em `cacheDados` e a tela
 * abre sem "carregando".
 *
 * ATENÇÃO: as chaves aqui precisam ser IDÊNTICAS às usadas nas páginas —
 * `chave()` monta a string a partir dos mesmos argumentos, na mesma ordem.
 * Se uma página mudar seus filtros padrão, o prefetch correspondente vira
 * trabalho jogado fora (não quebra nada, só deixa de aproveitar).
 */

import { comCache, chave, TTL_CURTO, TTL_LONGO } from './cacheDados';
import { clientesService } from '@/services/clientes';
import { financeiroService } from '@/services/financeiro';
import { vendedoresService } from '@/services/vendedores';

// Espelha o estado inicial dos filtros em (dashboard)/clientes/page.tsx
const FREQUENCIAS_PADRAO = ['DIARIO', 'SEMANAL', 'QUINZENAL', 'MENSAL', 'FLEXIVEL'];
const STATUS_PADRAO = '';

/** Roda quando o navegador estiver ocioso, para não competir com a tela atual */
function quandoOcioso(fn: () => void) {
  if (typeof window === 'undefined') return;
  const ric = (window as any).requestIdleCallback;
  if (typeof ric === 'function') ric(fn, { timeout: 3000 });
  else setTimeout(fn, 300);
}

interface ParamsPrefetch {
  empresaId?: string | null;
  rotaId?: string | null;
}

/**
 * Dispara o prefetch e retorna imediatamente. Falha de rede aqui é silenciosa
 * de propósito: é só um aquecimento, a página refaz a busca se precisar.
 */
export function prefetchModulos({ empresaId, rotaId }: ParamsPrefetch): void {
  if (!empresaId) return;

  const rotaParam = rotaId || undefined;

  const tarefas: Array<() => Promise<unknown>> = [
    // ── Clientes ──
    () => comCache(chave('clientes:rotas', empresaId), () => clientesService.buscarRotasEmpresa(empresaId), { ttlMs: TTL_LONGO }),
    () => comCache(chave('clientes:segmentos'), () => clientesService.buscarSegmentos(), { ttlMs: TTL_LONGO }),
    () => comCache(
      chave('clientes:lista', empresaId, rotaParam, STATUS_PADRAO, FREQUENCIAS_PADRAO),
      () => clientesService.buscarClientes({
        empresa_id: empresaId,
        rota_id: rotaParam,
        frequencias: FREQUENCIAS_PADRAO,
      } as any),
    ),
    () => comCache(
      chave('clientes:base', empresaId, rotaParam, FREQUENCIAS_PADRAO),
      () => clientesService.buscarClientes({
        empresa_id: empresaId,
        rota_id: rotaParam,
        frequencias: FREQUENCIAS_PADRAO,
      } as any),
    ),

    // ── Financeiro ──
    () => comCache(chave('financeiro:saldos', empresaId, rotaParam), () => financeiroService.buscarSaldosContas(empresaId, rotaParam), { ttlMs: TTL_CURTO }),
    () => comCache(chave('financeiro:contas', empresaId), () => financeiroService.buscarContas(empresaId)),
    () => comCache(chave('financeiro:categorias'), () => financeiroService.buscarCategorias(), { ttlMs: TTL_LONGO }),

    // ── Vendedores ──
    () => comCache(chave('vendedores:lista', empresaId), () => vendedoresService.listarVendedoresComRota(empresaId)),
  ];

  quandoOcioso(() => {
    for (const tarefa of tarefas) {
      // `comCache` já ignora o que estiver quente e junta chamadas em voo,
      // então repetir o prefetch para a mesma seleção não custa rede.
      void tarefa().catch(() => { /* aquecimento: falha não afeta a UI */ });
    }
  });
}
