'use client';

import { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Hash,
  Percent,
  TrendingUp,
  History,
} from 'lucide-react';
import { clientesService } from '@/services/clientes';
import type { 
  Cliente, 
  EmprestimoHistorico, 
  ParcelaView,
  ClienteComTotais 
} from '@/types/clientes';

// =====================================================
// HELPERS
// =====================================================

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function formatarData(data: string): string {
  if (!data) return '-';
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
}

function formatarDataHora(data: string): string {
  if (!data) return '-';
  return new Date(data).toLocaleString('pt-BR');
}

// =====================================================
// SUB-COMPONENTES
// =====================================================

function BadgeStatus({ status, tipo = 'emprestimo' }: { status: string; tipo?: 'emprestimo' | 'parcela' | 'cliente' }) {
  const configs: Record<string, Record<string, { bg: string; text: string; label: string }>> = {
    emprestimo: {
      ATIVO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo' },
      QUITADO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Quitado' },
      CANCELADO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Cancelado' },
      VENCIDO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Vencido' },
      RENEGOCIADO: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Renegociado' },
    },
    parcela: {
      PENDENTE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendente' },
      PAGO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Pago' },
      PARCIAL: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Parcial' },
      VENCIDO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Vencido' },
      CANCELADO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Cancelado' },
    },
    cliente: {
      ATIVO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo' },
      INATIVO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Inativo' },
      SUSPENSO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspenso' },
    },
  };

  const config = configs[tipo]?.[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function ProgressBar({ percentual, cor = 'blue' }: { percentual: number; cor?: string }) {
  const cores: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    amber: 'bg-amber-500',
  };

  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div 
        className={`h-full ${cores[cor] || cores.blue} transition-all`}
        style={{ width: `${Math.min(100, percentual)}%` }}
      />
    </div>
  );
}

function CardEmprestimo({
  emprestimo,
  expandido,
  onToggle,
  parcelas,
  carregandoParcelas,
}: {
  emprestimo: EmprestimoHistorico;
  expandido: boolean;
  onToggle: () => void;
  parcelas: ParcelaView[];
  carregandoParcelas: boolean;
}) {
  const isAtivo = emprestimo.emprestimo_status === 'ATIVO';
  
  return (
    <div className={`border rounded-xl overflow-hidden ${isAtivo ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
      {/* Header do empréstimo */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isAtivo ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <CreditCard className={`w-5 h-5 ${isAtivo ? 'text-blue-600' : 'text-gray-500'}`} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{formatarMoeda(emprestimo.valor_principal)}</span>
              <BadgeStatus status={emprestimo.emprestimo_status} tipo="emprestimo" />
              {emprestimo.tipo_emprestimo && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {emprestimo.tipo_emprestimo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatarData(emprestimo.data_emprestimo)}
              </span>
              <span className="flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" />
                {emprestimo.numero_parcelas}x de {formatarMoeda(emprestimo.valor_parcela)}
              </span>
              <span className="flex items-center gap-1">
                <Percent className="w-3.5 h-3.5" />
                {emprestimo.taxa_juros}%
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {emprestimo.parcelas_pagas}/{emprestimo.numero_parcelas} parcelas
            </p>
            <p className="text-xs text-gray-500">
              {emprestimo.percentual_quitado.toFixed(0)}% quitado
            </p>
          </div>
          {expandido ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Resumo financeiro */}
      <div className="px-4 pb-3 grid grid-cols-4 gap-3 border-t border-gray-100 pt-3">
        <div>
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-sm font-semibold text-gray-900">{formatarMoeda(emprestimo.valor_total)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Pago</p>
          <p className="text-sm font-semibold text-green-600">{formatarMoeda(emprestimo.total_pago_parcelas)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Saldo</p>
          <p className="text-sm font-semibold text-amber-600">{formatarMoeda(emprestimo.total_saldo_parcelas)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Vencidas</p>
          <p className={`text-sm font-semibold ${emprestimo.parcelas_vencidas > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {emprestimo.parcelas_vencidas}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-4">
        <ProgressBar 
          percentual={emprestimo.percentual_valor_pago} 
          cor={emprestimo.parcelas_vencidas > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Parcelas expandidas */}
      {expandido && (
        <div className="border-t border-gray-200 bg-gray-50/50">
          {carregandoParcelas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : parcelas.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Vencimento</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Valor</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Pago</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Saldo</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parcelas.map((parcela) => (
                    <tr key={parcela.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900 font-medium">{parcela.numero_parcela}</td>
                      <td className="px-4 py-2 text-gray-600">{formatarData(parcela.data_vencimento)}</td>
                      <td className="px-4 py-2 text-right text-gray-900">{formatarMoeda(parcela.valor_parcela)}</td>
                      <td className="px-4 py-2 text-right text-green-600">{formatarMoeda(parcela.valor_pago)}</td>
                      <td className="px-4 py-2 text-right text-amber-600">{formatarMoeda(parcela.valor_saldo)}</td>
                      <td className="px-4 py-2 text-center">
                        <BadgeStatus status={parcela.status} tipo="parcela" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              Nenhuma parcela encontrada
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// MODAL PRINCIPAL
// =====================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteComTotais | null;
}

export function ModalDetalhesCliente({ isOpen, onClose, cliente }: Props) {
  const [carregando, setCarregando] = useState(true);
  const [clienteCompleto, setClienteCompleto] = useState<Cliente | null>(null);
  const [emprestimosAtivos, setEmprestimosAtivos] = useState<EmprestimoHistorico[]>([]);
  const [emprestimosFinalizados, setEmprestimosFinalizados] = useState<EmprestimoHistorico[]>([]);
  const [emprestimoExpandido, setEmprestimoExpandido] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<Record<string, ParcelaView[]>>({});
  const [carregandoParcelas, setCarregandoParcelas] = useState<string | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<'dados' | 'ativos' | 'historico'>('dados');

  // Carregar dados completos do cliente
  useEffect(() => {
    async function carregar() {
      if (!cliente?.id || !isOpen) return;
      
      setCarregando(true);
      try {
        const { cliente: clienteData, emprestimos } = await clientesService.buscarClienteCompleto(cliente.id);
        
        setClienteCompleto(clienteData);
        setEmprestimosAtivos(emprestimos.ativos);
        setEmprestimosFinalizados(emprestimos.finalizados);
        
        // Se tem empréstimos ativos, expande o primeiro
        if (emprestimos.ativos.length > 0) {
          setAbaAtiva('ativos');
        }
      } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
      } finally {
        setCarregando(false);
      }
    }
    
    carregar();
  }, [cliente?.id, isOpen]);

  // Carregar parcelas quando expandir empréstimo
  useEffect(() => {
    async function carregarParcelas() {
      if (!emprestimoExpandido || parcelas[emprestimoExpandido]) return;
      
      setCarregandoParcelas(emprestimoExpandido);
      try {
        const parcelasData = await clientesService.buscarParcelasViaView(emprestimoExpandido);
        setParcelas(prev => ({ ...prev, [emprestimoExpandido]: parcelasData }));
      } catch (error) {
        console.error('Erro ao carregar parcelas:', error);
      } finally {
        setCarregandoParcelas(null);
      }
    }
    
    carregarParcelas();
  }, [emprestimoExpandido, parcelas]);

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setClienteCompleto(null);
      setEmprestimosAtivos([]);
      setEmprestimosFinalizados([]);
      setEmprestimoExpandido(null);
      setParcelas({});
      setAbaAtiva('dados');
    }
  }, [isOpen]);

  if (!isOpen || !cliente) return null;

  const dadosExibicao = clienteCompleto || cliente;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-4">
            {dadosExibicao.foto_url ? (
              <img 
                src={dadosExibicao.foto_url} 
                alt="" 
                className="w-14 h-14 rounded-full object-cover border-2 border-white/30" 
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-7 h-7 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{dadosExibicao.nome}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-white/20 px-2 py-0.5 rounded font-mono text-white/90 text-sm">
                  #{dadosExibicao.codigo_cliente || cliente.codigo_cliente || '...'}
                </span>
                <BadgeStatus status={dadosExibicao.status} tipo="cliente" />
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setAbaAtiva('dados')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              abaAtiva === 'dados'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <User className="w-4 h-4" />
              Dados
            </div>
          </button>
          <button
            onClick={() => setAbaAtiva('ativos')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              abaAtiva === 'ativos'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Empréstimos Ativos
              {emprestimosAtivos.length > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                  {emprestimosAtivos.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setAbaAtiva('historico')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              abaAtiva === 'historico'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <History className="w-4 h-4" />
              Histórico
              {emprestimosFinalizados.length > 0 && (
                <span className="bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded-full">
                  {emprestimosFinalizados.length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {carregando ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* ABA: DADOS DO CLIENTE */}
              {abaAtiva === 'dados' && (
                <div className="space-y-6">
                  {/* Informações de contato */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dadosExibicao.documento && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Documento</p>
                          <p className="font-medium text-gray-900">{dadosExibicao.documento}</p>
                        </div>
                      </div>
                    )}
                    
                    {dadosExibicao.telefone_celular && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Celular</p>
                          <p className="font-medium text-gray-900">{dadosExibicao.telefone_celular}</p>
                        </div>
                      </div>
                    )}
                    
                    {dadosExibicao.telefone_fixo && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <Phone className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Telefone Fixo</p>
                          <p className="font-medium text-gray-900">{dadosExibicao.telefone_fixo}</p>
                        </div>
                      </div>
                    )}
                    
                    {dadosExibicao.email && (
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <Mail className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">E-mail</p>
                          <p className="font-medium text-gray-900">{dadosExibicao.email}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Endereços */}
                  <div className="space-y-3">
                    {dadosExibicao.endereco && (
                      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                        <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Endereço Residencial</p>
                          <p className="font-medium text-gray-900">{dadosExibicao.endereco}</p>
                        </div>
                      </div>
                    )}
                    
                    {dadosExibicao.endereco_comercial && (
                      <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                        <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Endereço Comercial</p>
                          <p className="font-medium text-gray-900">{dadosExibicao.endereco_comercial}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resumo financeiro */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      Resumo Financeiro
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Empréstimos Ativos</p>
                        <p className="text-xl font-bold text-blue-600">{cliente.qtd_emprestimos_ativos}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Emprestado</p>
                        <p className="text-xl font-bold text-gray-900">{formatarMoeda(cliente.valor_total_emprestimos)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Pago</p>
                        <p className="text-xl font-bold text-green-600">{formatarMoeda(cliente.valor_total_pago)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Saldo Devedor</p>
                        <p className="text-xl font-bold text-amber-600">{formatarMoeda(cliente.valor_saldo_devedor)}</p>
                      </div>
                    </div>
                    {(cliente.parcelas_atrasadas || 0) > 0 && (
                      <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">{cliente.parcelas_atrasadas} parcela(s) em atraso</span>
                      </div>
                    )}
                  </div>

                  {/* Observações */}
                  {dadosExibicao.observacoes && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Observações</h3>
                      <p className="text-gray-600">{dadosExibicao.observacoes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA: EMPRÉSTIMOS ATIVOS */}
              {abaAtiva === 'ativos' && (
                <div className="space-y-4">
                  {emprestimosAtivos.length > 0 ? (
                    emprestimosAtivos.map((emp) => (
                      <CardEmprestimo
                        key={emp.emprestimo_id}
                        emprestimo={emp}
                        expandido={emprestimoExpandido === emp.emprestimo_id}
                        onToggle={() => setEmprestimoExpandido(
                          emprestimoExpandido === emp.emprestimo_id ? null : emp.emprestimo_id
                        )}
                        parcelas={parcelas[emp.emprestimo_id] || []}
                        carregandoParcelas={carregandoParcelas === emp.emprestimo_id}
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum empréstimo ativo</h3>
                      <p className="text-gray-500">Este cliente não possui empréstimos em andamento.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA: HISTÓRICO */}
              {abaAtiva === 'historico' && (
                <div className="space-y-4">
                  {emprestimosFinalizados.length > 0 ? (
                    emprestimosFinalizados.map((emp) => (
                      <CardEmprestimo
                        key={emp.emprestimo_id}
                        emprestimo={emp}
                        expandido={emprestimoExpandido === emp.emprestimo_id}
                        onToggle={() => setEmprestimoExpandido(
                          emprestimoExpandido === emp.emprestimo_id ? null : emp.emprestimo_id
                        )}
                        parcelas={parcelas[emp.emprestimo_id] || []}
                        carregandoParcelas={carregandoParcelas === emp.emprestimo_id}
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <History className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Sem histórico</h3>
                      <p className="text-gray-500">Nenhum empréstimo finalizado encontrado.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}