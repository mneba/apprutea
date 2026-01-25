'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Edit3,
  Save,
  XCircle,
  MapPinned,
  Tag,
  Shield,
  Route,
  Camera,
  Upload,
  ShieldCheck,
  Banknote,
} from 'lucide-react';
import { clientesService } from '@/services/clientes';
import type { 
  Cliente, 
  EmprestimoHistorico, 
  ParcelaView,
  ClienteComTotais,
  Segmento,
} from '@/types/clientes';

// =====================================================
// HELPERS
// =====================================================

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
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
        className={`h-full ${cores[cor] || cores.blue} transition-all duration-500`}
        style={{ width: `${Math.min(percentual, 100)}%` }}
      />
    </div>
  );
}

function ItemInfo({ 
  icone: Icone, 
  label, 
  valor, 
  className = '' 
}: { 
  icone: React.ElementType; 
  label: string; 
  valor: string | number | undefined | null;
  className?: string;
}) {
  if (!valor && valor !== 0) return null;
  
  return (
    <div className={`flex items-start gap-3 p-4 bg-gray-50 rounded-xl ${className}`}>
      <Icone className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-medium text-gray-900 break-words">{valor}</p>
      </div>
    </div>
  );
}

// Toggle Switch Component
function Toggle({ 
  checked, 
  onChange, 
  disabled = false 
}: { 
  checked: boolean; 
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// Card de Empréstimo com parcelas expansíveis
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
  const percentualPago = emprestimo.percentual_valor_pago || 0;
  
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header do Card */}
      <button
        onClick={onToggle}
        className="w-full p-4 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {formatarMoeda(emprestimo.valor_principal)}
              </span>
              <BadgeStatus status={emprestimo.emprestimo_status} tipo="emprestimo" />
            </div>
            <p className="text-sm text-gray-500">
              {formatarData(emprestimo.data_emprestimo)} • {emprestimo.numero_parcelas}x de {formatarMoeda(emprestimo.valor_parcela)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{percentualPago.toFixed(0)}% pago</p>
            <p className="text-xs text-gray-500">
              {emprestimo.parcelas_pagas}/{emprestimo.numero_parcelas} parcelas
            </p>
          </div>
          {expandido ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Conteúdo Expandido */}
      {expandido && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          {/* Resumo Financeiro */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-white p-3 rounded-lg">
              <p className="text-xs text-gray-500">Valor Total</p>
              <p className="font-semibold text-gray-900">{formatarMoeda(emprestimo.valor_total)}</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <p className="text-xs text-gray-500">Total Pago</p>
              <p className="font-semibold text-green-600">{formatarMoeda(emprestimo.total_pago_parcelas)}</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <p className="text-xs text-gray-500">Saldo Restante</p>
              <p className="font-semibold text-amber-600">{formatarMoeda(emprestimo.total_saldo_parcelas)}</p>
            </div>
            <div className="bg-white p-3 rounded-lg">
              <p className="text-xs text-gray-500">Taxa de Juros</p>
              <p className="font-semibold text-gray-900">{emprestimo.taxa_juros}%</p>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progresso do Pagamento</span>
              <span>{percentualPago.toFixed(1)}%</span>
            </div>
            <ProgressBar percentual={percentualPago} cor="green" />
          </div>

          {/* Tabela de Parcelas */}
          {carregandoParcelas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : parcelas.length > 0 ? (
            <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Vencimento</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Valor</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Pago</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-700">Saldo</th>
                    <th className="px-3 py-2 text-center font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parcelas.map((parcela) => (
                    <tr key={parcela.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{parcela.numero_parcela}</td>
                      <td className="px-3 py-2 text-gray-600">{formatarData(parcela.data_vencimento)}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{formatarMoeda(parcela.valor_parcela)}</td>
                      <td className="px-3 py-2 text-right text-green-600">{formatarMoeda(parcela.valor_pago)}</td>
                      <td className="px-3 py-2 text-right text-amber-600">{formatarMoeda(parcela.valor_saldo)}</td>
                      <td className="px-3 py-2 text-center">
                        <BadgeStatus status={parcela.status} tipo="parcela" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">Nenhuma parcela encontrada</p>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// COMPONENTE DE EDIÇÃO
// =====================================================

interface FormEdicaoCliente {
  nome: string;
  documento: string;
  telefone_celular: string;
  telefone_fixo: string;
  email: string;
  endereco: string;
  endereco_comercial: string;
  observacoes: string;
  status: string;
  segmento_id: string;
  permite_emprestimo_adicional: boolean;
  foto_url: string;
}

interface MicroseguroInfo {
  id: string;
  valor: number;
  data_venda: string;
  emprestimo_id?: string;
}

function FormularioEdicao({
  cliente,
  segmentos,
  microseguros,
  onSalvar,
  onCancelar,
  salvando,
}: {
  cliente: Cliente;
  segmentos: Segmento[];
  microseguros: MicroseguroInfo[];
  onSalvar: (dados: FormEdicaoCliente) => void;
  onCancelar: () => void;
  salvando: boolean;
}) {
  const [form, setForm] = useState<FormEdicaoCliente>({
    nome: cliente.nome || '',
    documento: cliente.documento || '',
    telefone_celular: cliente.telefone_celular || '',
    telefone_fixo: cliente.telefone_fixo || '',
    email: cliente.email || '',
    endereco: cliente.endereco || '',
    endereco_comercial: cliente.endereco_comercial || '',
    observacoes: cliente.observacoes || '',
    status: cliente.status || 'ATIVO',
    segmento_id: cliente.segmento_id || '',
    permite_emprestimo_adicional: cliente.permite_emprestimo_adicional || false,
    foto_url: cliente.foto_url || '',
  });

  const handleChange = (campo: keyof FormEdicaoCliente, valor: string | boolean) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  return (
    <div className="space-y-5">
      {/* Foto do Cliente */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {form.foto_url ? (
            <img 
              src={form.foto_url} 
              alt="Foto do cliente" 
              className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
              <Camera className="w-8 h-8 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">URL da Foto</label>
          <input
            type="url"
            value={form.foto_url}
            onChange={(e) => handleChange('foto_url', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="https://exemplo.com/foto.jpg"
          />
        </div>
      </div>

      {/* Nome e Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => handleChange('nome', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nome completo do cliente"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => handleChange('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="ATIVO">Ativo</option>
            <option value="INATIVO">Inativo</option>
            <option value="SUSPENSO">Suspenso</option>
          </select>
        </div>
      </div>

      {/* Documento e Segmento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Documento (CPF/CNPJ)</label>
          <input
            type="text"
            value={form.documento}
            onChange={(e) => handleChange('documento', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="000.000.000-00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
          <select
            value={form.segmento_id}
            onChange={(e) => handleChange('segmento_id', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Selecione um segmento</option>
            {segmentos.map(seg => (
              <option key={seg.id} value={seg.id}>{seg.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Telefones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Phone className="w-4 h-4 inline mr-1" />
            Celular
          </label>
          <input
            type="tel"
            value={form.telefone_celular}
            onChange={(e) => handleChange('telefone_celular', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="(00) 00000-0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Phone className="w-4 h-4 inline mr-1" />
            Telefone Fixo
          </label>
          <input
            type="tel"
            value={form.telefone_fixo}
            onChange={(e) => handleChange('telefone_fixo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="(00) 0000-0000"
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Mail className="w-4 h-4 inline mr-1" />
          E-mail
        </label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="email@exemplo.com"
        />
      </div>

      {/* Endereço Residencial */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <MapPin className="w-4 h-4 inline mr-1" />
          Endereço Residencial
        </label>
        <textarea
          value={form.endereco}
          onChange={(e) => handleChange('endereco', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Rua, número, bairro, cidade, estado, CEP"
        />
      </div>

      {/* Endereço Comercial */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <Building2 className="w-4 h-4 inline mr-1" />
          Endereço Comercial
        </label>
        <textarea
          value={form.endereco_comercial}
          onChange={(e) => handleChange('endereco_comercial', e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Endereço do trabalho ou comércio"
        />
      </div>

      {/* Toggle Empréstimo Adicional */}
      <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-medium text-gray-900">Permite Empréstimo Adicional</p>
            <p className="text-sm text-gray-500">Autoriza novo empréstimo mesmo com outro ativo</p>
          </div>
        </div>
        <Toggle
          checked={form.permite_emprestimo_adicional}
          onChange={(value) => handleChange('permite_emprestimo_adicional', value)}
        />
      </div>

      {/* Microseguros (somente leitura) */}
      {microseguros.length > 0 && (
        <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="w-5 h-5 text-purple-600" />
            <h4 className="font-medium text-gray-900">Microseguros Contratados</h4>
          </div>
          <div className="space-y-2">
            {microseguros.map((ms, idx) => (
              <div key={ms.id || idx} className="flex justify-between items-center text-sm bg-white p-2 rounded-lg">
                <span className="text-gray-600">{formatarData(ms.data_venda)}</span>
                <span className="font-medium text-purple-700">{formatarMoeda(ms.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Observações */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <FileText className="w-4 h-4 inline mr-1" />
          Observações
        </label>
        <textarea
          value={form.observacoes}
          onChange={(e) => handleChange('observacoes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Informações adicionais sobre o cliente..."
        />
      </div>

      {/* Botões */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          onClick={onCancelar}
          disabled={salvando}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <XCircle className="w-4 h-4" />
          Cancelar
        </button>
        <button
          onClick={() => onSalvar(form)}
          disabled={salvando || !form.nome.trim()}
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {salvando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar Alterações
        </button>
      </div>
    </div>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteComTotais | null;
  onClienteAtualizado?: () => void;
}

export function ModalDetalhesCliente({ isOpen, onClose, cliente, onClienteAtualizado }: Props) {
  const [abaAtiva, setAbaAtiva] = useState<'dados' | 'ativos' | 'historico'>('dados');
  const [clienteCompleto, setClienteCompleto] = useState<Cliente | null>(null);
  const [emprestimosAtivos, setEmprestimosAtivos] = useState<EmprestimoHistorico[]>([]);
  const [emprestimosFinalizados, setEmprestimosFinalizados] = useState<EmprestimoHistorico[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [emprestimoExpandido, setEmprestimoExpandido] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<Record<string, ParcelaView[]>>({});
  const [carregandoParcelas, setCarregandoParcelas] = useState<string | null>(null);
  
  // Dados auxiliares
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [microseguros, setMicroseguros] = useState<MicroseguroInfo[]>([]);
  
  // Estados de edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Carregar dados completos do cliente
  useEffect(() => {
    if (isOpen && cliente?.id) {
      carregarDadosCompletos();
      carregarSegmentos();
      carregarMicroseguros();
      setModoEdicao(false);
      setErro(null);
      setSucesso(null);
    }
  }, [isOpen, cliente?.id]);

  // Carregar parcelas ao expandir empréstimo
  useEffect(() => {
    if (emprestimoExpandido && !parcelas[emprestimoExpandido]) {
      carregarParcelas(emprestimoExpandido);
    }
  }, [emprestimoExpandido]);

  // Definir aba inicial baseado nos empréstimos
  useEffect(() => {
    if (emprestimosAtivos.length > 0) {
      setAbaAtiva('ativos');
    } else {
      setAbaAtiva('dados');
    }
  }, [emprestimosAtivos]);

  const carregarDadosCompletos = async () => {
    if (!cliente?.id) return;
    
    setCarregando(true);
    try {
      const resultado = await clientesService.buscarClienteCompleto(cliente.id);
      setClienteCompleto(resultado.cliente);
      setEmprestimosAtivos(resultado.emprestimos.ativos);
      setEmprestimosFinalizados(resultado.emprestimos.finalizados);
    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
    } finally {
      setCarregando(false);
    }
  };

  const carregarSegmentos = async () => {
    try {
      const data = await clientesService.buscarSegmentos();
      setSegmentos(data);
    } catch (error) {
      console.error('Erro ao carregar segmentos:', error);
    }
  };

  const carregarMicroseguros = async () => {
    if (!cliente?.id) return;
    try {
      // Buscar microseguros do cliente
      const data = await clientesService.buscarMicrosegurosCliente(cliente.id);
      setMicroseguros(data || []);
    } catch (error) {
      console.error('Erro ao carregar microseguros:', error);
      setMicroseguros([]);
    }
  };

  const carregarParcelas = async (emprestimoId: string) => {
    setCarregandoParcelas(emprestimoId);
    try {
      const data = await clientesService.buscarParcelasViaView(emprestimoId);
      setParcelas(prev => ({ ...prev, [emprestimoId]: data }));
    } catch (error) {
      console.error('Erro ao carregar parcelas:', error);
    } finally {
      setCarregandoParcelas(null);
    }
  };

  const handleSalvar = async (dados: FormEdicaoCliente) => {
    if (!cliente?.id) return;
    
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    
    try {
      const resultado = await clientesService.atualizarCliente({
        cliente_id: cliente.id,
        nome: dados.nome,
        documento: dados.documento || undefined,
        telefone_celular: dados.telefone_celular || undefined,
        telefone_fixo: dados.telefone_fixo || undefined,
        email: dados.email || undefined,
        endereco: dados.endereco || undefined,
        endereco_comercial: dados.endereco_comercial || undefined,
        observacoes: dados.observacoes || undefined,
        status: dados.status as 'ATIVO' | 'INATIVO' | 'SUSPENSO',
        segmento_id: dados.segmento_id || undefined,
        foto_url: dados.foto_url || undefined,
        permite_emprestimo_adicional: dados.permite_emprestimo_adicional,
      });
      
      if (resultado.success) {
        setSucesso('Cliente atualizado com sucesso!');
        setModoEdicao(false);
        await carregarDadosCompletos();
        onClienteAtualizado?.();
      } else {
        setErro(resultado.error || 'Erro ao atualizar cliente');
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setErro('Erro ao salvar alterações');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen || !cliente) return null;

  // Usar dados completos se disponíveis, senão usar dados básicos
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
          <div className="flex items-center gap-2">
            {!modoEdicao && abaAtiva === 'dados' && (
              <button
                onClick={() => setModoEdicao(true)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
                title="Editar cliente"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Mensagens de Feedback */}
        {erro && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{erro}</p>
          </div>
        )}
        {sucesso && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{sucesso}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => { setAbaAtiva('dados'); setModoEdicao(false); }}
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
            onClick={() => { setAbaAtiva('ativos'); setModoEdicao(false); }}
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
            onClick={() => { setAbaAtiva('historico'); setModoEdicao(false); }}
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
                modoEdicao && clienteCompleto ? (
                  <FormularioEdicao
                    cliente={clienteCompleto}
                    segmentos={segmentos}
                    microseguros={microseguros}
                    onSalvar={handleSalvar}
                    onCancelar={() => setModoEdicao(false)}
                    salvando={salvando}
                  />
                ) : (
                  <div className="space-y-6">
                    {/* Foto e Info Principal */}
                    {dadosExibicao.foto_url && (
                      <div className="flex justify-center">
                        <img 
                          src={dadosExibicao.foto_url} 
                          alt="Foto do cliente" 
                          className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 shadow-lg"
                        />
                      </div>
                    )}

                    {/* Informações de contato */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ItemInfo icone={FileText} label="Documento" valor={dadosExibicao.documento} />
                      <ItemInfo icone={Phone} label="Celular" valor={dadosExibicao.telefone_celular} />
                      <ItemInfo icone={Phone} label="Telefone Fixo" valor={dadosExibicao.telefone_fixo} />
                      <ItemInfo icone={Mail} label="E-mail" valor={dadosExibicao.email} />
                    </div>

                    {/* Endereços */}
                    <div className="grid grid-cols-1 gap-4">
                      <ItemInfo icone={MapPin} label="Endereço Residencial" valor={dadosExibicao.endereco} />
                      <ItemInfo icone={Building2} label="Endereço Comercial" valor={dadosExibicao.endereco_comercial} />
                    </div>

                    {/* Informações adicionais */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <ItemInfo 
                        icone={Calendar} 
                        label="Data de Cadastro" 
                        valor={dadosExibicao.data_cadastro ? formatarData(dadosExibicao.data_cadastro) : null} 
                      />
                      <ItemInfo 
                        icone={Route} 
                        label="Rotas" 
                        valor={dadosExibicao.rotas_nomes || (dadosExibicao.rotas_ids?.length ? `${dadosExibicao.rotas_ids.length} rota(s)` : null)} 
                      />
                      <ItemInfo 
                        icone={Tag} 
                        label="Segmento" 
                        valor={dadosExibicao.segmento_nome} 
                      />
                    </div>

                    {/* GPS e Empréstimo Adicional */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {dadosExibicao.latitude && dadosExibicao.longitude && (
                        <ItemInfo 
                          icone={MapPinned} 
                          label="Localização GPS" 
                          valor={`${dadosExibicao.latitude}, ${dadosExibicao.longitude}`} 
                        />
                      )}
                      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                        <ShieldCheck className={`w-5 h-5 ${dadosExibicao.permite_emprestimo_adicional ? 'text-green-500' : 'text-gray-400'}`} />
                        <div>
                          <p className="text-xs text-gray-500">Empréstimo Adicional</p>
                          <p className={`font-medium ${dadosExibicao.permite_emprestimo_adicional ? 'text-green-600' : 'text-gray-600'}`}>
                            {dadosExibicao.permite_emprestimo_adicional ? 'Permitido' : 'Não permitido'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Microseguros */}
                    {microseguros.length > 0 && (
                      <div className="bg-purple-50 rounded-xl p-5 border border-purple-100">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Banknote className="w-5 h-5 text-purple-600" />
                          Microseguros Contratados ({microseguros.length})
                        </h3>
                        <div className="space-y-2">
                          {microseguros.map((ms, idx) => (
                            <div key={ms.id || idx} className="flex justify-between items-center bg-white p-3 rounded-lg">
                              <span className="text-gray-600">{formatarData(ms.data_venda)}</span>
                              <span className="font-semibold text-purple-700">{formatarMoeda(ms.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-gray-500" />
                          Observações
                        </h3>
                        <p className="text-gray-600 whitespace-pre-wrap">{dadosExibicao.observacoes}</p>
                      </div>
                    )}
                  </div>
                )
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
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum histórico</h3>
                      <p className="text-gray-500">Este cliente ainda não possui empréstimos finalizados.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
