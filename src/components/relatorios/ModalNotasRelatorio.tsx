'use client';

// =====================================================================
// AS NOTAS DO CLIENTE, VISTAS DO RELATÓRIO
// =====================================================================
//
// SÓ LEITURA, de propósito.
//
// O `ModalNotasCliente` da Liquidação Diária escreve e lê, mas para escrever
// ele exige `liquidacaoId`, `vendedorId` e `empresaId` — e o relatório não
// tem nenhum dos três: ele atravessa várias rotas e nenhum dia aberto. Dar
// valores inventados para reaproveitar o componente criaria nota pendurada em
// liquidação errada, que é pior que não ter o botão.
//
// Nota se escreve na operação do dia, onde existe liquidação. Aqui se lê.
//
// Usa a mesma `fn_listar_notas` da outra tela, com `p_status = 'ATIVA'` — o
// mesmo recorte que a contagem do relatório usa, senão o número do ícone e a
// lista que ele abre discordariam.

import { Loader2, MessageSquare, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

interface Nota {
  id: string;
  nota: string;
  autor_nome: string | null;
  prioridade: 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';
  data_referencia: string | null;
  created_at: string;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  clienteId: string;
  clienteNome: string;
  rotaId: string;
}

const PRIORIDADE: Record<string, string> = {
  URGENTE: 'bg-red-50 text-red-700',
  ALTA: 'bg-amber-50 text-amber-700',
  NORMAL: 'bg-gray-100 text-gray-600',
  BAIXA: 'bg-gray-100 text-gray-400',
};

/** Timestamp do banco → `DD/MM/AA HH:MM`. Vem sem `Z` mas é UTC. */
const quando = (ts: string) => {
  if (!ts) return '';
  const utc = ts.endsWith('Z') || ts.includes('+') ? ts : `${ts}Z`;
  const d = new Date(utc);
  return isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
};

export default function ModalNotasRelatorio({
  aberto, onFechar, clienteId, clienteNome, rotaId,
}: Props) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    if (!aberto || !clienteId || !rotaId) return;
    setCarregando(true);
    const { data, error } = await supabase.rpc('fn_listar_notas', {
      p_rota_id: rotaId,
      p_data_inicio: null,
      p_data_fim: null,
      p_cliente_id: clienteId,
      p_liquidacao_id: null,
      p_status: 'ATIVA',
      p_prioridade: null,
      p_limite: 100,
    });
    if (error) console.error('Erro ao carregar as notas:', error);
    setNotas(
      ((data as Nota[]) ?? []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );
    setCarregando(false);
  }, [aberto, clienteId, rotaId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/50 flex items-start justify-center p-4 overflow-y-auto print:hidden"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Notas de ${clienteNome}`}
        className="bg-white rounded-xl border border-gray-200 w-full max-w-lg my-8 overflow-hidden"
      >
        <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-100">
          <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 truncate">{clienteNome}</h2>
            <p className="text-[12px] text-gray-400">
              {carregando ? 'Carregando…' : `${notas.length} nota${notas.length === 1 ? '' : 's'} ativa${notas.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-50">
          {carregando ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : notas.length === 0 ? (
            <p className="p-8 text-sm text-gray-400 text-center">Nenhuma nota ativa.</p>
          ) : (
            notas.map((n) => (
              <div key={n.id} className="px-4 py-3">
                <p className="text-[13.5px] text-gray-800 whitespace-pre-wrap">{n.nota}</p>
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {n.prioridade !== 'NORMAL' && (
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${PRIORIDADE[n.prioridade] ?? ''}`}>
                      {n.prioridade}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    {n.autor_nome || 'autor desconhecido'} · {quando(n.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <p className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-400">
          Nota se escreve na Liquidação Diária, onde há um dia aberto. Aqui é só leitura.
        </p>
      </div>
    </div>
  );
}
