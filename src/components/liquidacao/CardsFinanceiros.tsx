'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Loader2,
  DollarSign,
  Receipt,
  Shield,
  Users,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Wallet,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { ClienteDoDia } from '@/types/liquidacao';

// =====================================================
// TIPOS
// =====================================================

interface MovimentacaoFinanceiro {
  id: string;
  tipo: 'RECEBER' | 'PAGAR';
  categoria: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  created_at: string;
  forma_pagamento: string | null;
  // Tabela financeiro usa ref_cliente_id, não cliente_id
  ref_cliente_id: string | null;
  cliente_nome: string | null;
  ref_emprestimo_id: string | null;
  status: string;
}

interface MicroseguroVenda {
  id: string;
  cliente_id: string | null;
  cliente_nome?: string;
  cliente_consecutivo?: string;
  emprestimo_id: string | null;
  valor_principal?: number;
  numero_parcelas?: number;
  vendedor_nome?: string;
  valor: number;
  created_at: string;
}

interface PagamentoParcela {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  emprestimo_id: string;
  valor_pago: number;
  forma_pagamento: string;
  created_at: string;
  descricao: string;
}

// =====================================================
// HELPERS
// =====================================================

function formatarMoeda(valor: number | null | undefined): string {
  return `$ ${(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatarHora(data: string): string {
  return new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarCategoria(categoria: string): string {
  const mapa: Record<string, string> = {
    'COBRANCA_CUOTAS': 'Cobrança Parcelas',
    'COBRANCA_PARCELAS': 'Cobrança Parcelas',
    'EMPRESTIMO': 'Empréstimo',
    'VENDA_MICROSEGURO': 'Venda Microseguro',
    'MICROSEGURO': 'Microseguro',
    'PRESTAMO': 'Empréstimo',
    'APORTE': 'Aporte de Capital',
    'AJUSTE_CAJA': 'Ajuste de Caixa',
    'GASOLINA': 'Gasolina',
    'MANUTENCAO': 'Manutenção',
    'ALIMENTACAO': 'Alimentação',
    'TRANSPORTE': 'Transporte',
    'ESTORNO_PAGAMENTO': 'Estorno de Pagamento',
    'MULTA': 'Multa',
    'OUTROS': 'Outros',
    'RETIRADA': 'Retirada',
    'DESPESA': 'Despesa',
  };
  return mapa[categoria] || categoria;
}

function formatarFormaPagamento(forma: string | null): string {
  if (!forma) return '';
  const mapa: Record<string, string> = {
    'DINHEIRO': 'Dinheiro',
    'TRANSFERENCIA': 'Transferência',
    'PIX': 'PIX',
    'CARTAO': 'Cartão',
  };
  return mapa[forma] || forma;
}

// =====================================================
// MODAL BASE
// =====================================================

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor: string;
  children: React.ReactNode;
  maxWidth?: string;
}

function ModalBase({ isOpen, onClose, title, subtitle, icon, iconBgColor, children, maxWidth = 'max-w-lg' }: ModalBaseProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className={`relative bg-white rounded-xl shadow-xl w-full ${maxWidth} max-h-[85vh] flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${iconBgColor} rounded-lg flex items-center justify-center`}>
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MODAL EMPRÉSTIMOS (VENDAS)
// =====================================================

interface ModalEmprestimosProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacaoId: string;
  totalFallback: number;
  qtdFallback: number;
}

export function ModalEmprestimos({ isOpen, onClose, liquidacaoId, totalFallback, qtdFallback }: ModalEmprestimosProps) {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<MovimentacaoFinanceiro[]>([]);

  useEffect(() => {
    if (isOpen && liquidacaoId) {
      carregarDados();
    }
  }, [isOpen, liquidacaoId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('financeiro')
        .select('*')
        .eq('liquidacao_id', liquidacaoId)
        .eq('status', 'PAGO')
        .eq('categoria', 'EMPRESTIMO')
        .order('created_at', { ascending: false });

      if (!error) {
        setRegistros((data || []) as MovimentacaoFinanceiro[]);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const total = loading ? totalFallback : registros.reduce((s, r) => s + Number(r.valor), 0);
  const qtd = loading ? qtdFallback : registros.length;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Empréstimos do Dia"
      subtitle={`${qtd} empréstimo(s) · ${formatarMoeda(total)}`}
      icon={<DollarSign className="w-5 h-5 text-green-600" />}
      iconBgColor="bg-green-100"
    >
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : registros.length > 0 ? (
          <div className="space-y-3">
            {registros.map((reg) => (
              <div key={reg.id} className="p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{reg.cliente_nome || 'Cliente'}</p>
                    <p className="text-xs text-gray-500">{reg.descricao}</p>
                  </div>
                  <p className="font-bold text-green-600">{formatarMoeda(reg.valor)}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">{formatarHora(reg.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhum empréstimo registrado hoje
          </div>
        )}

        {/* Total */}
        <div className="mt-4 p-3 bg-green-100 rounded-lg flex justify-between items-center">
          <span className="font-medium text-green-800">TOTAL</span>
          <span className="font-bold text-green-800">{formatarMoeda(total)}</span>
        </div>
      </div>
    </ModalBase>
  );
}

// =====================================================
// MODAL DESPESAS
// =====================================================

interface ModalDespesasProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacaoId: string;
  totalFallback: number;
  qtdFallback: number;
}

export function ModalDespesas({ isOpen, onClose, liquidacaoId, totalFallback, qtdFallback }: ModalDespesasProps) {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<MovimentacaoFinanceiro[]>([]);

  useEffect(() => {
    if (isOpen && liquidacaoId) {
      carregarDados();
    }
  }, [isOpen, liquidacaoId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('financeiro')
        .select('*')
        .eq('liquidacao_id', liquidacaoId)
        .eq('tipo', 'PAGAR')
        .eq('status', 'PAGO')
        .neq('categoria', 'EMPRESTIMO')
        .order('created_at', { ascending: false });

      if (!error) {
        setRegistros((data || []) as MovimentacaoFinanceiro[]);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const total = loading ? totalFallback : registros.reduce((s, r) => s + Number(r.valor), 0);
  const qtd = loading ? qtdFallback : registros.length;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Despesas do Dia"
      subtitle={`${qtd} despesa(s) · ${formatarMoeda(total)}`}
      icon={<Receipt className="w-5 h-5 text-red-600" />}
      iconBgColor="bg-red-100"
    >
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          </div>
        ) : registros.length > 0 ? (
          <div className="space-y-3">
            {registros.map((reg) => (
              <div key={reg.id} className="p-3 bg-red-50 rounded-lg border border-red-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{formatarCategoria(reg.categoria)}</p>
                    <p className="text-xs text-gray-500">{reg.descricao || '-'}</p>
                  </div>
                  <p className="font-bold text-red-600">-{formatarMoeda(reg.valor)}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">{formatarHora(reg.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhuma despesa registrada hoje
          </div>
        )}

        {/* Total */}
        <div className="mt-4 p-3 bg-red-100 rounded-lg flex justify-between items-center">
          <span className="font-medium text-red-800">TOTAL</span>
          <span className="font-bold text-red-800">{formatarMoeda(total)}</span>
        </div>
      </div>
    </ModalBase>
  );
}

// =====================================================
// MODAL MICROSEGUROS
// =====================================================

interface ModalMicrosegurosProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacaoId: string;
  totalFallback: number;
  qtdFallback: number;
}

export function ModalMicroseguros({ isOpen, onClose, liquidacaoId, totalFallback, qtdFallback }: ModalMicrosegurosProps) {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<MicroseguroVenda[]>([]);

  useEffect(() => {
    if (isOpen && liquidacaoId) {
      carregarDados();
    }
  }, [isOpen, liquidacaoId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Buscar vendas de microseguro da liquidação
      const { data, error } = await supabase
        .from('microseguro_vendas')
        .select(`
          id,
          cliente_id,
          emprestimo_id,
          valor,
          created_at,
          clientes:cliente_id (nome, consecutivo),
          emprestimos:emprestimo_id (valor_principal, numero_parcelas),
          vendedores:vendedor_id (nome)
        `)
        .eq('liquidacao_id', liquidacaoId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const vendas = data.map((v: any) => ({
          id: v.id,
          cliente_id: v.cliente_id,
          cliente_nome: v.clientes?.nome || 'Cliente',
          cliente_consecutivo: v.clientes?.consecutivo || '',
          emprestimo_id: v.emprestimo_id,
          valor_principal: v.emprestimos?.valor_principal,
          numero_parcelas: v.emprestimos?.numero_parcelas,
          vendedor_nome: v.vendedores?.nome,
          valor: v.valor,
          created_at: v.created_at,
        }));
        setRegistros(vendas);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const total = loading ? totalFallback : registros.reduce((s, r) => s + Number(r.valor), 0);
  const qtd = loading ? qtdFallback : registros.length;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Microseguros do Dia"
      subtitle={`${qtd} contrato(s) · ${formatarMoeda(total)}`}
      icon={<Shield className="w-5 h-5 text-teal-600" />}
      iconBgColor="bg-teal-100"
    >
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          </div>
        ) : registros.length > 0 ? (
          <div className="space-y-3">
            {registros.map((reg) => (
              <div key={reg.id} className="p-3 bg-teal-50 rounded-lg border border-teal-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{reg.cliente_nome}</p>
                    {reg.cliente_consecutivo && (
                      <p className="text-xs text-gray-500">#{reg.cliente_consecutivo}</p>
                    )}
                    {reg.valor_principal && reg.numero_parcelas && (
                      <p className="text-xs text-gray-400">
                        Emp: {formatarMoeda(reg.valor_principal)} em {reg.numero_parcelas}x
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-teal-600">{formatarMoeda(reg.valor)}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">{formatarHora(reg.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhum microseguro vendido hoje
          </div>
        )}

        {/* Total */}
        <div className="mt-4 p-3 bg-teal-100 rounded-lg flex justify-between items-center">
          <span className="font-medium text-teal-800">TOTAL</span>
          <span className="font-bold text-teal-800">{formatarMoeda(total)}</span>
        </div>
      </div>
    </ModalBase>
  );
}

// =====================================================
// MODAL PAGAMENTOS (COBRANÇAS) — REFEITO
// =====================================================

type AbaPagamentos = 'TODOS' | 'PAGOS' | 'NAO_PAGOS' | 'DINHEIRO' | 'TRANSFERENCIA';

interface ModalPagamentosProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacaoId: string;
  clientesPagos: number;
  clientesNaoPagos: number;
  valorRecebido: number;
  // Lista de clientes do dia da liquidação (já carregada na page)
  clientesDia: ClienteDoDia[];
}

export function ModalPagamentos({ 
  isOpen, 
  onClose, 
  liquidacaoId, 
  clientesPagos,
  clientesNaoPagos,
  valorRecebido,
  clientesDia,
}: ModalPagamentosProps) {
  const [loading, setLoading] = useState(true);
  const [pagamentos, setPagamentos] = useState<PagamentoParcela[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<AbaPagamentos>('TODOS');

  useEffect(() => {
    if (isOpen && liquidacaoId) {
      carregarDados();
      setAbaAtiva('TODOS');
    }
  }, [isOpen, liquidacaoId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Buscar pagamentos de parcelas (cobranças)
      const { data, error } = await supabase
        .from('financeiro')
        .select('*')
        .eq('liquidacao_id', liquidacaoId)
        .eq('tipo', 'RECEBER')
        .eq('status', 'PAGO')
        .in('categoria', ['COBRANCA_PARCELAS', 'COBRANCA_CUOTAS'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        const lista: PagamentoParcela[] = data.map((pag: any) => ({
          id: pag.id,
          // CORREÇÃO: o campo correto é ref_cliente_id, não cliente_id
          cliente_id: pag.ref_cliente_id || 'desconhecido',
          cliente_nome: pag.cliente_nome || 'Cliente',
          emprestimo_id: pag.ref_emprestimo_id || '',
          valor_pago: Number(pag.valor),
          forma_pagamento: pag.forma_pagamento || 'DINHEIRO',
          created_at: pag.created_at,
          descricao: pag.descricao || '',
        }));
        setPagamentos(lista);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  // Clientes que NÃO pagaram (status_dia diferente de PAGO)
  const clientesNaoPagosList = useMemo(() => {
    return clientesDia.filter(c => c.status_dia !== 'PAGO');
  }, [clientesDia]);

  // Totais por forma de pagamento
  const totalDinheiro = useMemo(
    () => pagamentos.filter(p => p.forma_pagamento === 'DINHEIRO').reduce((s, p) => s + p.valor_pago, 0),
    [pagamentos]
  );
  const totalTransferencia = useMemo(
    () => pagamentos.filter(p => p.forma_pagamento !== 'DINHEIRO').reduce((s, p) => s + p.valor_pago, 0),
    [pagamentos]
  );

  // Contadores por aba
  const qtdPagos = pagamentos.length;
  const qtdNaoPagos = clientesNaoPagosList.length;
  const qtdDinheiro = pagamentos.filter(p => p.forma_pagamento === 'DINHEIRO').length;
  const qtdTransferencia = pagamentos.filter(p => p.forma_pagamento !== 'DINHEIRO').length;
  const qtdTodos = qtdPagos + qtdNaoPagos;

  // Lista renderizada conforme aba ativa
  const pagamentosFiltrados = useMemo(() => {
    if (abaAtiva === 'PAGOS' || abaAtiva === 'TODOS') return pagamentos;
    if (abaAtiva === 'DINHEIRO') return pagamentos.filter(p => p.forma_pagamento === 'DINHEIRO');
    if (abaAtiva === 'TRANSFERENCIA') return pagamentos.filter(p => p.forma_pagamento !== 'DINHEIRO');
    return [];
  }, [pagamentos, abaAtiva]);

  const mostrarNaoPagos = abaAtiva === 'TODOS' || abaAtiva === 'NAO_PAGOS';
  const mostrarPagos = abaAtiva !== 'NAO_PAGOS';

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Pagamentos do Dia"
      subtitle={`${qtdPagos} pago(s) · ${qtdNaoPagos} não pago(s) · ${formatarMoeda(valorRecebido)}`}
      icon={<Users className="w-5 h-5 text-blue-600" />}
      iconBgColor="bg-blue-100"
      maxWidth="max-w-2xl"
    >
      {/* Abas / Filtros */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-gray-50/50">
        <div className="flex flex-wrap gap-2">
          <AbaButton
            ativa={abaAtiva === 'TODOS'}
            onClick={() => setAbaAtiva('TODOS')}
            label="Todos"
            contagem={qtdTodos}
            cor="blue"
          />
          <AbaButton
            ativa={abaAtiva === 'PAGOS'}
            onClick={() => setAbaAtiva('PAGOS')}
            label="Pagos"
            contagem={qtdPagos}
            cor="green"
          />
          <AbaButton
            ativa={abaAtiva === 'NAO_PAGOS'}
            onClick={() => setAbaAtiva('NAO_PAGOS')}
            label="Não Pagos"
            contagem={qtdNaoPagos}
            cor="red"
          />
          <AbaButton
            ativa={abaAtiva === 'DINHEIRO'}
            onClick={() => setAbaAtiva('DINHEIRO')}
            label="Dinheiro"
            contagem={qtdDinheiro}
            valor={totalDinheiro}
            cor="emerald"
          />
          <AbaButton
            ativa={abaAtiva === 'TRANSFERENCIA'}
            onClick={() => setAbaAtiva('TRANSFERENCIA')}
            label="Transferência"
            contagem={qtdTransferencia}
            valor={totalTransferencia}
            cor="sky"
          />
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Lista de Pagos / Filtrados */}
            {mostrarPagos && pagamentosFiltrados.length > 0 && (
              <div>
                {abaAtiva === 'TODOS' && (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1">
                    Pagamentos Recebidos
                  </h3>
                )}
                <div className="space-y-2">
                  {pagamentosFiltrados.map((pag) => (
                    <div key={pag.id} className="p-3 bg-green-50 border border-green-100 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-2 flex-1">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-700 flex-shrink-0">
                            {pag.cliente_nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{pag.cliente_nome}</p>
                            {pag.descricao && (
                              <p className="text-xs text-gray-500 truncate">{pag.descricao}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                              {pag.forma_pagamento === 'DINHEIRO' ? (
                                <Banknote className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <CreditCard className="w-3 h-3 text-sky-500" />
                              )}
                              {formatarFormaPagamento(pag.forma_pagamento)} · {formatarHora(pag.created_at)}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-green-600 ml-2 whitespace-nowrap">
                          {formatarMoeda(pag.valor_pago)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de Não Pagos */}
            {mostrarNaoPagos && clientesNaoPagosList.length > 0 && (
              <div>
                {abaAtiva === 'TODOS' && (
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-1 mt-4">
                    Clientes Não Pagos
                  </h3>
                )}
                <div className="space-y-2">
                  {clientesNaoPagosList.map((cliente) => (
                    <div key={cliente.parcela_id} className="p-3 bg-red-50 border border-red-100 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-2 flex-1">
                          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-sm font-medium text-red-700 flex-shrink-0">
                            {cliente.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{cliente.nome}</p>
                            <p className="text-xs text-gray-500">
                              Parcela {cliente.numero_parcela}/{cliente.numero_parcelas}
                              {cliente.tem_parcelas_vencidas && (
                                <span className="ml-1 text-red-600">
                                  · {cliente.total_parcelas_vencidas} vencida(s)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Status: {cliente.status_dia === 'EM_ATRASO' ? 'Em atraso' : cliente.status_dia}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold text-red-600 ml-2 whitespace-nowrap">
                          {formatarMoeda(cliente.valor_parcela)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && pagamentosFiltrados.length === 0 && (!mostrarNaoPagos || clientesNaoPagosList.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                Nenhum registro nesta categoria
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rodapé com totais */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Total Recebido:</span>
            <span className="font-bold text-green-700">{formatarMoeda(valorRecebido)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Efetividade:</span>
            <span className="font-bold text-blue-700">
              {qtdTodos > 0 ? Math.round((qtdPagos / qtdTodos) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}

// =====================================================
// COMPONENTE: BOTÃO DE ABA / FILTRO
// =====================================================

interface AbaButtonProps {
  ativa: boolean;
  onClick: () => void;
  label: string;
  contagem: number;
  valor?: number;
  cor: 'blue' | 'green' | 'red' | 'emerald' | 'sky';
}

function AbaButton({ ativa, onClick, label, contagem, valor, cor }: AbaButtonProps) {
  const coresAtivas: Record<string, string> = {
    blue: 'bg-blue-600 text-white border-blue-600',
    green: 'bg-green-600 text-white border-green-600',
    red: 'bg-red-600 text-white border-red-600',
    emerald: 'bg-emerald-600 text-white border-emerald-600',
    sky: 'bg-sky-600 text-white border-sky-600',
  };
  const coresInativas: Record<string, string> = {
    blue: 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',
    green: 'bg-white text-green-700 border-green-200 hover:bg-green-50',
    red: 'bg-white text-red-700 border-red-200 hover:bg-red-50',
    emerald: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    sky: 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50',
  };

  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5
        ${ativa ? coresAtivas[cor] : coresInativas[cor]}
      `}
    >
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
        ativa ? 'bg-white/20' : 'bg-gray-100'
      }`}>
        {valor !== undefined ? formatarMoeda(valor) : contagem}
      </span>
    </button>
  );
}

// =====================================================
// MODAL RECEITAS (OUTRAS)
// =====================================================

interface ModalReceitasProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacaoId: string;
}

export function ModalReceitas({ isOpen, onClose, liquidacaoId }: ModalReceitasProps) {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<MovimentacaoFinanceiro[]>([]);

  useEffect(() => {
    if (isOpen && liquidacaoId) {
      carregarDados();
    }
  }, [isOpen, liquidacaoId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Receitas que NÃO são cobranças nem microseguros
      const { data, error } = await supabase
        .from('financeiro')
        .select('*')
        .eq('liquidacao_id', liquidacaoId)
        .eq('tipo', 'RECEBER')
        .eq('status', 'PAGO')
        .not('categoria', 'in', '("COBRANCA_PARCELAS","COBRANCA_CUOTAS","VENDA_MICROSEGURO","MICROSEGURO")')
        .order('created_at', { ascending: false });

      if (!error) {
        setRegistros((data || []) as MovimentacaoFinanceiro[]);
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const total = registros.reduce((s, r) => s + Number(r.valor), 0);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Outras Receitas"
      subtitle={`${registros.length} registro(s) · ${formatarMoeda(total)}`}
      icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
      iconBgColor="bg-emerald-100"
    >
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : registros.length > 0 ? (
          <div className="space-y-3">
            {registros.map((reg) => (
              <div key={reg.id} className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{formatarCategoria(reg.categoria)}</p>
                    <p className="text-xs text-gray-500">{reg.descricao || '-'}</p>
                    {reg.cliente_nome && (
                      <p className="text-xs text-gray-400">{reg.cliente_nome}</p>
                    )}
                  </div>
                  <p className="font-bold text-emerald-600">+{formatarMoeda(reg.valor)}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">{formatarHora(reg.created_at)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhuma outra receita registrada hoje
          </div>
        )}

        {/* Total */}
        {registros.length > 0 && (
          <div className="mt-4 p-3 bg-emerald-100 rounded-lg flex justify-between items-center">
            <span className="font-medium text-emerald-800">TOTAL</span>
            <span className="font-bold text-emerald-800">{formatarMoeda(total)}</span>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

// =====================================================
// CARDS CLICÁVEIS
// =====================================================

interface CardFinanceiroProps {
  titulo: string;
  valor: number;
  detalhe: string;
  icon: React.ReactNode;
  corFundo: string;
  corTexto: string;
  corHover: string;
  onClick: () => void;
}

export function CardFinanceiro({ titulo, valor, detalhe, icon, corFundo, corTexto, corHover, onClick }: CardFinanceiroProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-xl border border-gray-200 p-3 transition-all duration-300 ease-out hover:shadow-lg ${corHover} hover:-translate-y-1 group text-left`}
    >
      <h3 className={`text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5 transition-colors duration-300 group-hover:${corTexto}`}>
        {icon}
        {titulo}
      </h3>
      <div className={`text-center p-2 ${corFundo} rounded-lg`}>
        <p className={`text-lg font-bold ${corTexto}`}>{formatarMoeda(valor)}</p>
        <p className="text-xs text-gray-500">{detalhe}</p>
      </div>
    </button>
  );
}