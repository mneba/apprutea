'use client';

/**
 * Faixa "você está operando um dia passado" (pedido do Julio, 12/10/2026).
 *
 * Operar dia passado é o fluxo NORMAL de recuperar dias atrasados, e tudo o
 * que se registra fica com a data do dia aberto — a regra "a liquidação é a
 * régua do tempo" (CLAUDE.md). Faltava DIZER isso: na Prueba Julio 1 um
 * empréstimo feito em 12/10 entrou em 29/09 sem nenhum aviso.
 *
 * Compara o dia aberto da rota (`data_liquidacao`, ABERTO/REABERTO) com o
 * hoje da ROTA (`fn_data_hoje_rota`), nunca com o relógio do navegador. Some
 * sem dia aberto, com o dia aberto = hoje, e quando qualquer leitura falha.
 *
 * Mesma regra do app (`AvisoDiaAntigo` no mobile) — mudou num, muda no outro.
 */

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatarDataPura } from '@/utils/dateFormat';

function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.substring(0, 10).split('-').map(Number);
  const [a2, m2, d2] = ate.substring(0, 10).split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

interface Props {
  rotaId: string | null | undefined;
  /** 'faixa' no topo do dashboard; 'linha' junto do botão de confirmar. */
  variante?: 'faixa' | 'linha';
  /** Classes extras do contêiner (ex.: `mr-auto` num rodapé de botões). */
  className?: string;
}

export function AvisoDiaOperacional({ rotaId, variante = 'faixa', className = '' }: Props) {
  const pathname = usePathname();
  const [estado, setEstado] = useState<{ dia: string; reaberto: boolean; hoje: string } | null>(null);

  const ler = useCallback(async () => {
    if (!rotaId) { setEstado(null); return; }
    try {
      const supabase = createClient();
      const [h, l] = await Promise.all([
        supabase.rpc('fn_data_hoje_rota', { p_rota_id: rotaId }),
        supabase
          .from('liquidacoes_diarias')
          .select('data_liquidacao, status')
          .eq('rota_id', rotaId)
          .in('status', ['ABERTO', 'REABERTO'])
          .order('data_liquidacao', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (h.error || l.error || !h.data || !l.data) { setEstado(null); return; }
      setEstado({ dia: String(l.data.data_liquidacao), reaberto: l.data.status === 'REABERTO', hoje: String(h.data) });
    } catch {
      setEstado(null);
    }
  }, [rotaId]);

  // Relê ao trocar de rota, ao navegar, ao voltar para a aba e a cada minuto
  // (abrir ou fechar o dia muda a resposta).
  useEffect(() => { ler(); }, [ler, pathname]);
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible') ler(); };
    document.addEventListener('visibilitychange', aoVoltar);
    const t = setInterval(() => { if (document.visibilityState === 'visible') ler(); }, 60000);
    return () => { document.removeEventListener('visibilitychange', aoVoltar); clearInterval(t); };
  }, [ler]);

  if (!estado) return null;
  const atras = diasEntre(estado.dia, estado.hoje);
  if (atras <= 0) return null;

  const quando = atras === 1 ? 'ontem' : `${atras} dias atrás`;
  const titulo = `${estado.reaberto ? 'Dia reaberto' : 'Você está operando o dia'} ${formatarDataPura(estado.dia)} (${quando})`;
  const corpo = 'Tudo o que registrar fica com essa data.';

  if (variante === 'linha') {
    return (
      <div className={`flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-900 ${className}`}>
        <CalendarClock className="w-4 h-4 flex-shrink-0 mt-px" />
        <span>{titulo}. {corpo}</span>
      </div>
    );
  }

  return (
    <div className="mb-3 flex-shrink-0 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-900">
      <CalendarClock className="w-5 h-5 flex-shrink-0" />
      <div className="min-w-0 text-sm">
        <span className="font-semibold">{titulo}.</span>{' '}
        <span>{corpo}</span>
      </div>
    </div>
  );
}
