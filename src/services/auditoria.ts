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
  /** Quando a operação aconteceu — o relógio. */
  momento: string;
  /**
   * O DIA A QUE a operação pertence, que neste domínio é a régua do tempo
   * (ver CLAUDE.md). Diferente de `momento` quando houve correção retroativa:
   * estorno feito em outubro sobre pagamento de setembro.
   */
  data_liquidacao: string | null;
  tipo: string;
  usuario: string | null;
  rota: string | null;
  cliente: string | null;
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
  /** Nome ou código. Quem investiga tem um dos dois, nunca o uuid. */
  cliente?: string | null;
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
      p_cliente: f.cliente?.trim() || null,
      p_limite: f.limite ?? 200,
      p_offset: f.offset ?? 0,
    });

    if (error) {
      console.error('Erro na auditoria:', error);
      throw error;
    }
    return (data ?? []) as EventoAuditoria[];
  },

  /** As condições do empréstimo: originais, atuais e cada alteração. */
  async condicoesEmprestimo(emprestimoId: string): Promise<CondicoesEmprestimo | null> {
    const { data, error } = await supabase.rpc('fn_auditoria_emprestimo', {
      p_emprestimo_id: emprestimoId,
    });
    if (error) {
      console.error('Erro na auditoria do empréstimo:', error);
      throw error;
    }
    return (data ?? null) as CondicoesEmprestimo | null;
  },
};

// =====================================================================
// AS CONDIÇÕES DE UM EMPRÉSTIMO (fn_auditoria_emprestimo, 24/11/2026)
// =====================================================================
// Pedido do Julio de 03/11: reconstruir como o empréstimo foi configurado e
// comparar com as alterações. O "original" é o ANTES da primeira alteração
// (desde 14/10/2026 a alteração grava as condições inteiras); sem alteração,
// é o próprio registro. `data_primeiro_vencimento` e `vencimentos` só passaram
// a ser gravados na alteração em 24/11/2026 — em alteração mais velha eles
// não existem no "antes", e a tela diz "não registrado".

/** Campos de condição. Todos opcionais: registro antigo não tem todos. */
export interface Condicoes {
  valor_principal?: number | null;
  taxa_juros?: number | null;
  numero_parcelas?: number | null;
  frequencia_pagamento?: string | null;
  dia_semana_cobranca?: number | null;
  dias_semana_cobranca?: number[] | null;
  dia_mes_cobranca?: number | null;
  dias_mes_cobranca?: number[] | null;
  data_primeiro_vencimento?: string | null;
  vencimentos?: string[] | null;
  credito_absorvido?: number | null;
  [outra: string]: unknown;
}

export interface AlteracaoEmprestimo {
  momento: string;
  /** ALTERACAO (pela tela) ou CORRECAO (reparo por script). */
  acao: 'ALTERACAO' | 'CORRECAO';
  usuario: string | null;
  antes: Condicoes | null;
  depois: Condicoes | null;
  resumo: string | null;
  descricao: string | null;
}

export interface CondicoesEmprestimo {
  emprestimo: {
    id: string;
    cliente: string | null;
    codigo_cliente: number | null;
    rota: string | null;
    tipo_emprestimo: string | null;
    status: string | null;
    data_emprestimo: string | null;
    dia_liquidacao: string | null;
    criado_em: string | null;
    criado_por: string | null;
    valor_total: number | null;
    valor_parcela: number | null;
  };
  original: Condicoes;
  fonte_original: 'REGISTRO' | 'PRIMEIRA_ALTERACAO';
  atual: Condicoes;
  alteracoes: AlteracaoEmprestimo[];
  /** Condições do empréstimo anterior, na renovação/renegociação. */
  origem: (Condicoes & { id: string; data_emprestimo: string | null; status: string | null }) | null;
  /** Criado antes de 14/10/2026: pode ter sido alterado sem deixar rastro. */
  antes_do_registro: boolean;
}
