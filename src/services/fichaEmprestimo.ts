// =====================================================================
// FICHA DO EMPRÉSTIMO — acesso (web)
// Arquivo: src/services/fichaEmprestimo.ts
// =====================================================================
//
// ESPELHO de apprutea_android/src/services/fichaEmprestimo.ts. Mesma RPC,
// mesmos tipos, mesma forma. Se um mudar, o outro muda junto.
//
// Toda a montagem vive em `fn_ficha_emprestimo` (ver
// sql/2026-09-15_fn_ficha_emprestimo.sql): foi para o banco justamente para
// que as duas pontas não montassem a ficha cada uma do seu jeito — foi o que
// aconteceu com as regras de data entre julho e setembro de 2026.
//
// Nenhuma mudança de banco foi necessária para a ficha chegar ao web: a
// função é SECURITY DEFINER e já tinha EXECUTE para `authenticated`.
//
// ⚠ `anon` TAMBÉM tem EXECUTE nela, concessão padrão do Supabase para função
// nova. É a mesma dívida das funções de importação (ver CLAUDE.md): não é
// alcançável sem um id de empréstimo válido, mas está aberta com a chave
// pública. Não foi tocado aqui porque o conserto é um REVOKE no banco, não
// no cliente.
//
// Os campos `emprestimo`, `cliente` e `parcelas` vêm de `to_jsonb` da linha
// inteira: ganham colunas sozinhos quando a tabela ganha. Por isso são `any`
// aqui — tipar seria congelar o que o banco não congelou.

import { createClient } from '@/lib/supabase/client';

export type TipoEvento =
  | 'CONCESSAO'
  | 'PAGAMENTO'
  | 'QUITACAO'
  | 'CREDITO_CASCATA'
  | 'IMPORTACAO';

export interface EventoFicha {
  tipo: TipoEvento;
  operacao_id?: string;
  /** Instante real da operação (timestamptz). Na concessão é só a data. */
  quando: string;
  /** Data da liquidação em que a operação foi registrada. */
  data_operacional: string;
  liquidacao_data?: string | null;
  parcelas?: number[];
  pagamento_ids?: string[];
  /** Quantos comprovantes existem nesta operação. */
  anexos?: number;
  registros?: number;
  /** Total que entrou nesta operação: dinheiro + crédito usado, incluindo o
   *  excedente que virou crédito. É o que o cliente entregou. */
  aplicado?: number;
  /** O que de fato reduziu a dívida = `aplicado` menos o crédito gerado.
   *  Excedente não paga parcela: fica em `saldo_excedente` e abate depois,
   *  quando consumido. Somar `aplicado` contaria o mesmo dinheiro duas vezes. */
  abatido?: number;
  /** Só o que entrou no caixa. */
  dinheiro?: number;
  credito_usado?: number;
  credito_gerado?: number;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  estornado: boolean;
  data_estorno?: string | null;
  motivo_estorno?: string | null;
  estornado_por?: string | null;
  autor?: string | null;
  /** Saldos APÓS o evento, já descontando o que foi estornado. */
  saldo_devedor: number;
  saldo_credito: number;
  /** Só na CONCESSAO. */
  valor_emprestado?: number;
}

export interface EloCadeia {
  id: string;
  atual: boolean;
  tipo_emprestimo: string | null;
  status: string;
  data_emprestimo: string | null;
  valor_principal: number | null;
  valor_total: number | null;
  valor_saldo: number | null;
  origem_id: string | null;
}

export interface TotaisFicha {
  valor_total: number;
  /** `emprestimos.valor_saldo` — JÁ LÍQUIDO DE CRÉDITO. Ver o comentário no
   *  resumo de ModalFichaEmprestimo antes de subtrair crédito disto. */
  saldo_atual: number;
  dinheiro_recebido: number;
  credito_disponivel: number;
  /** Pagas + abertas. Exclui as parcelas CANCELADO, que não são nem uma
   *  coisa nem outra — por isso pode ser menor que `numero_parcelas`. */
  parcelas_total: number;
  parcelas_pagas: number;
  parcelas_abertas: number;
}

/**
 * As duas invariantes, calculadas pelo banco a cada abertura.
 *
 * `caixa_confere` compara o que as parcelas dizem ter recebido (menos o
 * crédito consumido) com o dinheiro que realmente entrou. `credito_confere`
 * compara o crédito gerado menos usado com o que ainda está parado em
 * `saldo_excedente`. Foram estas duas contas, feitas à mão, que resolveram o
 * caso Paloma Unhas.
 */
export interface ConferenciaFicha {
  dinheiro_recebido: number;
  pago_nas_parcelas: number;
  credito_usado: number;
  caixa_confere: boolean;
  credito_gerado: number;
  credito_saldo_registros: number;
  credito_saldo_parcelas: number;
  credito_confere: boolean;
}

export interface Ficha {
  sucesso: boolean;
  mensagem?: string;
  emprestimo: any;
  cliente: any;
  rota_nome: string | null;
  totais: TotaisFicha;
  eventos: EventoFicha[];
  parcelas: any[];
  cadeia: EloCadeia[];
  conferencia: ConferenciaFicha;
}

export async function buscarFicha(emprestimoId: string): Promise<Ficha> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('fn_ficha_emprestimo', {
    p_emprestimo_id: emprestimoId,
  });

  if (error) throw error;
  if (!data) throw new Error('Ficha vazia');
  if (data.sucesso === false) throw new Error(data.mensagem || 'Empréstimo não encontrado');

  return data as Ficha;
}
