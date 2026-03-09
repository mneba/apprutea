'use client';

import { useState, useEffect } from 'react';
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
  cliente_id: string | null;
  cliente_nome: string | null;
  emprestimo_id: string | null;
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
  cliente_consecutivo: string;
  emprestimo_id: string;
  numero_parcela: number;
  numero_parcelas: number;
  valor_pago: number;
  forma_pagamento: string;
  created_at: string;
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
}

function ModalBase({ isOpen, onClose, title, subtitle, icon, iconBgColor, children }: ModalBaseProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
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
        setRegistros(data || []);
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
        setRegistros(data || []);
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
// MODAL PAGAMENTOS (COBRANÇAS)
// =====================================================

interface ClienteAgrupado {
  cliente_id: string;
  cliente_nome: string;
  cliente_consecutivo: string;
  total_pago: number;
  parcelas: PagamentoParcela[];
}

interface ModalPagamentosProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacaoId: string;
  clientesPagos: number;
  clientesNaoPagos: number;
  valorRecebido: number;
}

export function ModalPagamentos({ 
  isOpen, 
  onClose, 
  liquidacaoId, 
  clientesPagos,
  clientesNaoPagos,
  valorRecebido 
}: ModalPagamentosProps) {
  const [loading, setLoading] = useState(true);
  const [clientesAgrupados, setClientesAgrupados] = useState<ClienteAgrupado[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && liquidacaoId) {
      carregarDados();
    }
  }, [isOpen, liquidacaoId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Buscar pagamentos de parcelas (da tabela pagamentos_parcelas ou financeiro)
      const { data, error } = await supabase
        .from('financeiro')
        .select('*')
        .eq('liquidacao_id', liquidacaoId)
        .eq('tipo', 'RECEBER')
        .eq('status', 'PAGO')
        .in('categoria', ['COBRANCA_PARCELAS', 'COBRANCA_CUOTAS'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Agrupar por cliente
        const mapa = new Map<string, ClienteAgrupado>();
        
        data.forEach((pag: MovimentacaoFinanceiro) => {
          const clienteId = pag.cliente_id || 'desconhecido';
          const existente = mapa.get(clienteId);
          
          const parcela: PagamentoParcela = {
            id: pag.id,
            cliente_id: clienteId,
            cliente_nome: pag.cliente_nome || 'Cliente',
            cliente_consecutivo: '',
            emprestimo_id: pag.emprestimo_id || '',
            numero_parcela: 0,
            numero_parcelas: 0,
            valor_pago: Number(pag.valor),
            forma_pagamento: pag.forma_pagamento || 'DINHEIRO',
            created_at: pag.created_at,
          };

          if (existente) {
            existente.total_pago += Number(pag.valor);
            existente.parcelas.push(parcela);
          } else {
            mapa.set(clienteId, {
              cliente_id: clienteId,
              cliente_nome: pag.cliente_nome || 'Cliente',
              cliente_consecutivo: '',
              total_pago: Number(pag.valor),
              parcelas: [parcela],
            });
          }
        });

        setClientesAgrupados(Array.from(mapa.values()));
      }
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalReal = loading ? valorRecebido : clientesAgrupados.reduce((s, c) => s + c.total_pago, 0);
  const efetividade = clientesPagos + clientesNaoPagos > 0 
    ? Math.round((clientesPagos / (clientesPagos + clientesNaoPagos)) * 100) 
    : 0;

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Cobranças do Dia"
      subtitle={`${clientesPagos} cliente(s) · ${formatarMoeda(totalReal)}`}
      icon={<Users className="w-5 h-5 text-blue-600" />}
      iconBgColor="bg-blue-100"
    >
      <div className="p-4">
        {/* Resumo */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="p-2 bg-green-50 rounded-lg text-center">
            <p className="text-lg font-bold text-green-600">{clientesPagos}</p>
            <p className="text-xs text-gray-500">Pagos</p>
          </div>
          <div className="p-2 bg-red-50 rounded-lg text-center">
            <p className="text-lg font-bold text-red-600">{clientesNaoPagos}</p>
            <p className="text-xs text-gray-500">Não Pagos</p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-center">
            <p className="text-lg font-bold text-blue-600">{efetividade}%</p>
            <p className="text-xs text-gray-500">Efetividade</p>
          </div>
        </div>

        {/* Lista de clientes */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : clientesAgrupados.length > 0 ? (
          <div className="space-y-2">
            {clientesAgrupados.map((cliente) => (
              <div key={cliente.cliente_id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Header do cliente */}
                <button
                  onClick={() => setExpandido(expandido === cliente.cliente_id ? null : cliente.cliente_id)}
                  className="w-full p-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-700">
                      {cliente.cliente_nome.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{cliente.cliente_nome}</p>
                      <p className="text-xs text-gray-500">{cliente.parcelas.length} parcela(s)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-green-600">{formatarMoeda(cliente.total_pago)}</span>
                    {expandido === cliente.cliente_id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Detalhes das parcelas */}
                {expandido === cliente.cliente_id && (
                  <div className="p-3 bg-white border-t border-gray-100 space-y-2">
                    {cliente.parcelas.map((parcela) => (
                      <div key={parcela.id} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          {parcela.forma_pagamento === 'DINHEIRO' ? (
                            <Banknote className="w-4 h-4 text-green-500" />
                          ) : (
                            <CreditCard className="w-4 h-4 text-blue-500" />
                          )}
                          <span className="text-gray-600">{formatarHora(parcela.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {formatarFormaPagamento(parcela.forma_pagamento)}
                          </span>
                          <span className="font-medium text-green-600">
                            {formatarMoeda(parcela.valor_pago)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhuma cobrança registrada hoje
          </div>
        )}

        {/* Total */}
        <div className="mt-4 p-3 bg-blue-100 rounded-lg flex justify-between items-center">
          <span className="font-medium text-blue-800">TOTAL RECEBIDO</span>
          <span className="font-bold text-blue-800">{formatarMoeda(totalReal)}</span>
        </div>
      </div>
    </ModalBase>
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
        setRegistros(data || []);
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