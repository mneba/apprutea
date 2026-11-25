'use client';

// =====================================================================
// AS CONDIÇÕES DE UM EMPRÉSTIMO — aberto pela Auditoria
// =====================================================================
//
// Pedido do Julio de 03/11/2026: "reconstruir como um empréstimo foi
// registrado originalmente e comparar com alterações posteriores".
//
// Lê `fn_auditoria_emprestimo`. O "original" é o ANTES da primeira alteração
// (desde 14/10/2026 a alteração grava as condições inteiras); sem alteração é
// o próprio registro. Datas de vencimento só entraram no registro da alteração
// em 24/11/2026: em alteração mais antiga aparecem como "não registrado", e
// isso é dito em vez de mostrar a data de hoje como se fosse a de antes.

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Loader2, X } from 'lucide-react';
import { moeda } from '@/utils/moeda';
import { formatarDataHora, formatarDataPura } from '@/utils/dateFormat';
import {
  auditoriaService,
  type Condicoes,
  type CondicoesEmprestimo,
} from '@/services/auditoria';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const FREQUENCIAS: Record<string, string> = {
  DIARIO: 'Diário',
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
  FLEXIVEL: 'Flexível',
};

const NAO_REGISTRADO = 'não registrado';

/** O dia de cobrança é UM conceito guardado em quatro colunas. */
function textoCobranca(c: Condicoes | null | undefined): string {
  if (!c) return '—';
  const sem = (c.dias_semana_cobranca?.length ? c.dias_semana_cobranca : null)
    ?? (c.dia_semana_cobranca != null ? [c.dia_semana_cobranca] : null);
  const mes = (c.dias_mes_cobranca?.length ? c.dias_mes_cobranca : null)
    ?? (c.dia_mes_cobranca != null ? [c.dia_mes_cobranca] : null);
  const partes: string[] = [];
  if (sem) partes.push(sem.map((d) => DIAS_SEMANA[d] ?? String(d)).join(', '));
  if (mes) partes.push(`dia ${mes.join(' e ')}`);
  return partes.length ? partes.join(' · ') : '—';
}

function textoVencimentos(v: string[] | null | undefined): string {
  if (!v || v.length === 0) return '—';
  return v.map((d) => formatarDataPura(d, true)).join(', ');
}

/** As linhas da comparação, na ordem em que se confere um contrato. */
const LINHAS: { rotulo: string; valor: (c: Condicoes) => string }[] = [
  { rotulo: 'Valor emprestado', valor: (c) => (c.valor_principal == null ? '—' : moeda(c.valor_principal)) },
  { rotulo: 'Taxa de juros', valor: (c) => (c.taxa_juros == null ? '—' : `${Number(c.taxa_juros)}%`) },
  { rotulo: 'Parcelas', valor: (c) => (c.numero_parcelas == null ? '—' : String(c.numero_parcelas)) },
  {
    rotulo: 'Frequência',
    valor: (c) => (c.frequencia_pagamento ? FREQUENCIAS[c.frequencia_pagamento] ?? c.frequencia_pagamento : '—'),
  },
  { rotulo: 'Dia de cobrança', valor: textoCobranca },
  {
    rotulo: '1º vencimento',
    valor: (c) =>
      !('data_primeiro_vencimento' in c)
        ? NAO_REGISTRADO
        : c.data_primeiro_vencimento
        ? formatarDataPura(c.data_primeiro_vencimento)
        : '—',
  },
  {
    rotulo: 'Vencimentos',
    valor: (c) => (!('vencimentos' in c) ? NAO_REGISTRADO : textoVencimentos(c.vencimentos)),
  },
];

/** Rótulos dos campos que só a CORREÇÃO por script grava. */
const OUTROS_CAMPOS: Record<string, string> = {
  valor_saldo: 'Saldo',
  credito_absorvido: 'Crédito incorporado às parcelas',
};

function textoGenerico(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') return moeda(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function ModalCondicoesEmprestimo({
  emprestimoId,
  onFechar,
}: {
  emprestimoId: string;
  onFechar: () => void;
}) {
  const [dados, setDados] = useState<CondicoesEmprestimo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    auditoriaService
      .condicoesEmprestimo(emprestimoId)
      .then((d) => {
        if (!vivo) return;
        if (!d) setErro('Empréstimo não encontrado.');
        setDados(d);
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar as condições.');
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [emprestimoId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Condições do empréstimo</h2>
            {dados && (
              <p className="text-sm text-gray-500 truncate">
                {dados.emprestimo.cliente ?? 'Cliente'}
                {dados.emprestimo.codigo_cliente != null ? ` (${dados.emprestimo.codigo_cliente})` : ''}
                {dados.emprestimo.rota ? ` · ${dados.emprestimo.rota}` : ''}
              </p>
            )}
          </div>
          <button onClick={onFechar} className="p-1 rounded-lg hover:bg-gray-100 shrink-0" aria-label="Fechar">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {carregando && (
            <div className="py-10 text-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
            </div>
          )}

          {erro && !carregando && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{erro}</p>
          )}

          {dados && !carregando && (
            <>
              {/* Ficha de nascimento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Info rotulo="Tipo" valor={dados.emprestimo.tipo_emprestimo ?? '—'} />
                <Info rotulo="Situação" valor={dados.emprestimo.status ?? '—'} />
                <Info
                  rotulo="Data do empréstimo"
                  valor={dados.emprestimo.data_emprestimo ? formatarDataPura(dados.emprestimo.data_emprestimo) : '—'}
                />
                <Info
                  rotulo="Liquidação"
                  valor={dados.emprestimo.dia_liquidacao ? formatarDataPura(dados.emprestimo.dia_liquidacao) : '—'}
                />
                <Info rotulo="Lançado por" valor={dados.emprestimo.criado_por ?? '—'} />
                <Info
                  rotulo="Lançado em"
                  valor={dados.emprestimo.criado_em ? formatarDataHora(dados.emprestimo.criado_em) : '—'}
                />
                <Info
                  rotulo="Total hoje"
                  valor={dados.emprestimo.valor_total == null ? '—' : moeda(dados.emprestimo.valor_total)}
                />
                <Info
                  rotulo="Parcela hoje"
                  valor={dados.emprestimo.valor_parcela == null ? '—' : moeda(dados.emprestimo.valor_parcela)}
                />
              </div>

              {dados.antes_do_registro && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
                  Empréstimo anterior a 14/10/2026. Alterações feitas antes dessa data não foram registradas,
                  então a coluna &quot;Original&quot; pode já trazer uma alteração.
                </p>
              )}

              {/* Original × atual */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-200">
                      <th className="py-2 pr-3 font-medium">Condição</th>
                      <th className="py-2 pr-3 font-medium">
                        Original
                        <span className="block font-normal text-[11px] text-gray-400">
                          {dados.fonte_original === 'PRIMEIRA_ALTERACAO'
                            ? 'antes da 1ª alteração'
                            : 'nunca alterado'}
                        </span>
                      </th>
                      <th className="py-2 font-medium">Atual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LINHAS.map((l) => {
                      const o = l.valor(dados.original);
                      const a = l.valor(dados.atual);
                      const mudou = o !== a && o !== NAO_REGISTRADO;
                      return (
                        <tr key={l.rotulo} className="border-b border-gray-100 align-top">
                          <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{l.rotulo}</td>
                          <td className={`py-2 pr-3 ${o === NAO_REGISTRADO ? 'text-gray-400 italic' : 'text-gray-900'}`}>
                            {o}
                          </td>
                          <td className={`py-2 ${mudou ? 'text-purple-700 font-medium' : 'text-gray-900'}`}>{a}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Renovação: as condições do anterior, porque o novo costuma herdá-las */}
              {dados.origem && (
                <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="font-medium text-gray-700 mb-1">Empréstimo anterior ({dados.origem.status ?? '—'})</p>
                  <p>
                    Feito em {dados.origem.data_emprestimo ? formatarDataPura(dados.origem.data_emprestimo) : '—'} ·{' '}
                    {dados.origem.frequencia_pagamento
                      ? FREQUENCIAS[dados.origem.frequencia_pagamento] ?? dados.origem.frequencia_pagamento
                      : '—'}{' '}
                    · cobrança {textoCobranca(dados.origem)} · 1º vencimento{' '}
                    {dados.origem.data_primeiro_vencimento
                      ? formatarDataPura(dados.origem.data_primeiro_vencimento)
                      : '—'}
                  </p>
                </div>
              )}

              {/* Cada alteração, com o antes e o depois do que mudou */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  Alterações {dados.alteracoes.length > 0 ? `(${dados.alteracoes.length})` : ''}
                </h3>
                {dados.alteracoes.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma alteração registrada.</p>
                ) : (
                  <div className="space-y-3">
                    {dados.alteracoes.map((alt, i) => (
                      <CartaoAlteracao key={i} alt={alt} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500 uppercase tracking-wide">{rotulo}</p>
      <p className="text-gray-900 break-words">{valor}</p>
    </div>
  );
}

function CartaoAlteracao({ alt }: { alt: CondicoesEmprestimo['alteracoes'][number] }) {
  const antes = alt.antes ?? {};
  const depois = alt.depois ?? {};

  // Só o que mudou. Campo que não existia no "antes" (registro antigo) não
  // conta como mudança: seria comparar "não registrado" com um valor.
  const mudancas = LINHAS.map((l) => ({ rotulo: l.rotulo, de: l.valor(antes), para: l.valor(depois) })).filter(
    (m) => m.de !== m.para && m.de !== NAO_REGISTRADO && m.para !== NAO_REGISTRADO
  );

  // Campos fora da lista de condições (a correção por script grava saldo).
  const conhecidos = new Set([
    'valor_principal', 'taxa_juros', 'numero_parcelas', 'frequencia_pagamento',
    'dia_semana_cobranca', 'dias_semana_cobranca', 'dia_mes_cobranca', 'dias_mes_cobranca',
    'data_primeiro_vencimento', 'vencimentos',
  ]);
  const outros = Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)]))
    .filter((k) => !conhecidos.has(k))
    .filter((k) => k !== 'credito_absorvido' || Number(depois[k] ?? 0) > 0)
    .map((k) => ({
      rotulo: OUTROS_CAMPOS[k] ?? k,
      de: k in antes ? textoGenerico(antes[k]) : null,
      para: textoGenerico(depois[k]),
    }));

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mb-2">
        <span
          className={`px-2 py-0.5 rounded font-medium ${
            alt.acao === 'CORRECAO' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-700'
          }`}
        >
          {alt.acao === 'CORRECAO' ? 'Correção' : 'Alteração'}
        </span>
        <span>{formatarDataHora(alt.momento)}</span>
        <span>· {alt.usuario ?? '—'}</span>
      </div>

      {alt.descricao && <p className="text-sm text-gray-700 mb-2">{alt.descricao}</p>}

      {mudancas.length === 0 && outros.length === 0 ? (
        <p className="text-sm text-gray-500">{alt.resumo || 'Sem diferença nas condições.'}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {[...mudancas, ...outros].map((m) => (
            <li key={m.rotulo} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
              <span className="text-gray-500">{m.rotulo}</span>
              <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                {m.de !== null && (
                  <>
                    <span className="text-gray-500 line-through break-words">{m.de}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  </>
                )}
                <span className="text-gray-900 font-medium break-words">{m.para}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
