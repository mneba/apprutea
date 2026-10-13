import { createClient } from '@/lib/supabase/client';

// =====================================================================
// A AUDITORIA DE MOVIMENTOS
// =====================================================================
//
// Lê `fn_auditoria_movimentos`, que monta a linha do tempo a partir do que as
// tabelas de operação já guardam — `pagamentos_parcelas.user_id`,
// `estornado_por` + `data_estorno`, `criado_por_user_id`, `financeiro.usuario_id`
// e `audit_logs`. Nenhuma trilha nova foi criada para isto, e a razão está no
// COMMENT da função.
//
// A JANELA É O INSTANTE DO EVENTO, não o dia da liquidação. Um estorno feito
// hoje sobre um pagamento de agosto pertence a hoje — é o caso que a tela
// existe para pegar.

const supabase = createClient();

export interface EventoAuditoria {
  momento: string;
  tipo: string;
  usuario: string | null;
  rota: string | null;
  descricao: string | null;
  valor: number | null;
  /** NULO é "não derivável", nunca zero. Ver o COMMENT da função. */
  impacto_caixa: number | null;
  motivo: string | null;
  referencia_id: string | null;
}

export interface FiltrosAuditoria {
  empresaId: string;
  de: string;
  ate: string;
  rotaId?: string | null;
  tipo?: string | null;
  usuario?: string | null;
  limite?: number;
  offset?: number;
}

/** Os tipos que a função produz, na ordem em que fazem sentido num filtro. */
export const TIPOS_AUDITORIA = [
  { valor: 'PAGAMENTO', rotulo: 'Pagamento' },
  { valor: 'ESTORNO', rotulo: 'Estorno' },
  { valor: 'EMPRESTIMO', rotulo: 'Empréstimo' },
  { valor: 'ALTERACAO', rotulo: 'Alteração de empréstimo' },
  { valor: 'MOVIMENTO', rotulo: 'Movimentação financeira' },
  { valor: 'ANULACAO', rotulo: 'Anulação' },
  { valor: 'RELANCAMENTO', rotulo: 'Relançamento' },
  { valor: 'REABERTURA', rotulo: 'Reabertura de dia' },
  { valor: 'FECHAMENTO_POS_REABERTURA', rotulo: 'Fechamento pós-reabertura' },
] as const;

export const auditoriaService = {
  async buscar(f: FiltrosAuditoria): Promise<EventoAuditoria[]> {
    const { data, error } = await supabase.rpc('fn_auditoria_movimentos', {
      p_empresa_id: f.empresaId,
      p_de: f.de,
      p_ate: f.ate,
      p_rota_id: f.rotaId || null,
      p_tipo: f.tipo || null,
      p_usuario: f.usuario?.trim() || null,
      p_limite: f.limite ?? 200,
      p_offset: f.offset ?? 0,
    });

    if (error) {
      console.error('Erro na auditoria:', error);
      throw error;
    }
    return (data ?? []) as EventoAuditoria[];
  },
};
