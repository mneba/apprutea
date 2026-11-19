'use client';

// ============================================================
// useTrabalhaCredito — o parâmetro de TELA da rota (web)
//
// Espelho de apprutea_android/src/hooks/useTrabalhaCredito.ts. Mudou lá,
// muda aqui.
//
// `rotas.trabalha_credito` NÃO muda regra nenhuma: o crédito existe e funciona
// igual em toda rota. O parâmetro só decide se a tela mostra a palavra
// crédito, ou se o pago a mais aparece como fração de parcela. Ver
// sql/2026-11-18_rota_trabalha_credito.sql.
//
// Aceita a rota direto ou o empréstimo (a ficha só conhece o empréstimo).
//
// ⚠ Sem rota, ou com falha de leitura, devolve `true` — mostrar o crédito
// como hoje. Esconder por engano tiraria da tela um dinheiro que existe.
// ============================================================

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
const TTL_MS = 60_000;
const porRota = new Map<string, { valor: boolean; em: number }>();
const rotaDoEmprestimo = new Map<string, string>();

async function lerPorRota(rotaId: string): Promise<boolean> {
  const c = porRota.get(rotaId);
  if (c && Date.now() - c.em < TTL_MS) return c.valor;
  const { data, error } = await supabase
    .from('rotas')
    .select('trabalha_credito')
    .eq('id', rotaId)
    .single();
  const v = error ? true : (data as { trabalha_credito?: boolean } | null)?.trabalha_credito !== false;
  porRota.set(rotaId, { valor: v, em: Date.now() });
  return v;
}

async function lerPorEmprestimo(emprestimoId: string): Promise<boolean> {
  let rotaId = rotaDoEmprestimo.get(emprestimoId);
  if (!rotaId) {
    const { data, error } = await supabase
      .from('emprestimos')
      .select('rota_id')
      .eq('id', emprestimoId)
      .single();
    if (error || !data?.rota_id) return true;
    rotaId = data.rota_id as string;
    rotaDoEmprestimo.set(emprestimoId, rotaId);
  }
  return lerPorRota(rotaId);
}

export function useTrabalhaCredito(alvo: { rotaId?: string | null; emprestimoId?: string | null }): boolean {
  const { rotaId, emprestimoId } = alvo;
  const [valor, setValor] = useState<boolean>(() => {
    const c = rotaId ? porRota.get(rotaId) : undefined;
    return c?.valor ?? true;
  });

  useEffect(() => {
    if (!rotaId && !emprestimoId) { setValor(true); return; }
    let vivo = true;
    const p = rotaId ? lerPorRota(rotaId) : lerPorEmprestimo(emprestimoId as string);
    p.then(
      v => { if (vivo) setValor(v); },
      () => { if (vivo) setValor(true); },
    );
    return () => { vivo = false; };
  }, [rotaId, emprestimoId]);

  return valor;
}
