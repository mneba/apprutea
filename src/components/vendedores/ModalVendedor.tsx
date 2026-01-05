'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Loader2, 
  Settings,
  Shield,
  Receipt,
  MapPin,
  Smartphone,
  Wifi,
  Clock,
  DollarSign,
  FileText,
  AlertCircle,
  Phone as PhoneIcon,
  Printer,
  Ban,
  Trash2,
  Calendar,
  RefreshCw,
  Info,
} from 'lucide-react';
import { vendedoresService } from '@/services/vendedores';
import type { Vendedor, VendedorConfiguracao, VendedorRestricao, VendedorRecibo } from '@/types/vendedores';

interface Props {
  vendedor: Vendedor | null;
  empresaId: string;
  onClose: () => void;
  onSave: () => void;
}

type TabType = 'dados' | 'configuracoes' | 'restricoes' | 'recibos';

// DDIs da América do Sul
const DDIS = [
  { codigo: '+55', pais: 'Brasil', bandeira: '🇧🇷' },
  { codigo: '+54', pais: 'Argentina', bandeira: '🇦🇷' },
  { codigo: '+56', pais: 'Chile', bandeira: '🇨🇱' },
  { codigo: '+57', pais: 'Colômbia', bandeira: '🇨🇴' },
  { codigo: '+51', pais: 'Peru', bandeira: '🇵🇪' },
  { codigo: '+598', pais: 'Uruguai', bandeira: '🇺🇾' },
  { codigo: '+595', pais: 'Paraguai', bandeira: '🇵🇾' },
  { codigo: '+591', pais: 'Bolívia', bandeira: '🇧🇴' },
  { codigo: '+593', pais: 'Equador', bandeira: '🇪🇨' },
  { codigo: '+58', pais: 'Venezuela', bandeira: '🇻🇪' },
];

// Configurações padrão (baseadas na imagem 2 - 13 opções)
const CONFIGURACOES_PADRAO: VendedorConfiguracao = {
  ativar_gps: false,
  ativar_sem_pagamentos: true,
  ativar_adiar_parcelas: true,
  ativar_auditoria_movel: true,
  abertura_caixa_manual: true,
  validar_endereco: false,
  carregar_imagens_wifi: true,
  atualizar_cel_renovacao: true,
  informacao_resumida: true,
  imprimir_recibos: true,
  so_frequencia_diaria: false,
  inativar_info_cliente: true,
  permitir_exclusao: true,
};

// Restrições padrão (baseadas na imagem 3 - 6 campos)
const RESTRICOES_PADRAO: VendedorRestricao = {
  valor_maximo_vendas: 0,
  valor_maximo_gastos: 0,
  valor_maximo_receitas: 0,
  max_parcelas_dia: 0,
  limite_parcelas: 0,
  whatsapp_aprovacoes: '',
};

// Recibos padrão (baseados na imagem 4 - 5 campos)
const RECIBOS_PADRAO: VendedorRecibo = {
  logo_url: '',
  tipo_recaudo: '',
  percentual_recaudo: 0,
  percentual_vendas: 0,
  valor_pensao: 0,
};

export function ModalVendedor({ vendedor, empresaId, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('dados');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // === ABA DADOS PESSOAIS ===
  const [codigoVendedor, setCodigoVendedor] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [documento, setDocumento] = useState('');
  const [ddi, setDdi] = useState('+55');
  const [telefoneNumero, setTelefoneNumero] = useState('');

  // === ABA CONFIGURAÇÕES ===
  const [configuracoes, setConfiguracoes] = useState<VendedorConfiguracao>(CONFIGURACOES_PADRAO);

  // === ABA RESTRIÇÕES ===
  const [restricoes, setRestricoes] = useState<VendedorRestricao>(RESTRICOES_PADRAO);
  const [restricoesAtivas, setRestricoesAtivas] = useState({
    valor_maximo_vendas: false,
    valor_maximo_gastos: false,
    valor_maximo_receitas: false,
    max_parcelas_dia: false,
    limite_parcelas: false,
    whatsapp_aprovacoes: false,
  });

  // === ABA RECIBOS ===
  const [recibos, setRecibos] = useState<VendedorRecibo>(RECIBOS_PADRAO);

  const isEdicao = !!vendedor;

  // Carregar dados do vendedor se for edição
  useEffect(() => {
    if (vendedor) {
      setCodigoVendedor(vendedor.codigo_vendedor || '');
      setNome(vendedor.nome || '');
      setEmail(vendedor.email || '');
      setDocumento(vendedor.documento || '');
      
      // Extrair DDI do telefone
      if (vendedor.telefone) {
        const ddiEncontrado = DDIS.find(d => vendedor.telefone?.startsWith(d.codigo));
        if (ddiEncontrado) {
          setDdi(ddiEncontrado.codigo);
          setTelefoneNumero(vendedor.telefone.substring(ddiEncontrado.codigo.length));
        } else {
          setTelefoneNumero(vendedor.telefone);
        }
      }

      // Carregar configurações, restrições e recibos do vendedor
      carregarDadosCompletos(vendedor.id);
    } else {
      // Gerar código automático para novo vendedor
      gerarCodigoAutomatico();
    }
  }, [vendedor]);

  const gerarCodigoAutomatico = async () => {
    try {
      const codigo = await vendedoresService.gerarCodigoVendedor();
      setCodigoVendedor(codigo);
    } catch (err) {
      console.error('Erro ao gerar código:', err);
      // Gerar código local como fallback
      setCodigoVendedor(`V${Date.now().toString().slice(-6)}`);
    }
  };

  const carregarDadosCompletos = async (vendedorId: string) => {
    setLoading(true);
    try {
      const [configData, restricoesData, recibosData] = await Promise.all([
        vendedoresService.buscarConfiguracoes(vendedorId),
        vendedoresService.buscarRestricoes(vendedorId),
        vendedoresService.buscarRecibos(vendedorId),
      ]);

      if (configData) setConfiguracoes({ ...CONFIGURACOES_PADRAO, ...configData });
      if (restricoesData) {
        setRestricoes({ ...RESTRICOES_PADRAO, ...restricoesData });
        setRestricoesAtivas({
          valor_maximo_vendas: (restricoesData.valor_maximo_vendas || 0) > 0,
          valor_maximo_gastos: (restricoesData.valor_maximo_gastos || 0) > 0,
          valor_maximo_receitas: (restricoesData.valor_maximo_receitas || 0) > 0,
          max_parcelas_dia: (restricoesData.max_parcelas_dia || 0) > 0,
          limite_parcelas: (restricoesData.limite_parcelas || 0) > 0,
          whatsapp_aprovacoes: !!(restricoesData.whatsapp_aprovacoes),
        });
      }
      if (recibosData) setRecibos({ ...RECIBOS_PADRAO, ...recibosData });
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle configuração
  const toggleConfiguracao = (campo: keyof VendedorConfiguracao) => {
    setConfiguracoes(prev => ({
      ...prev,
      [campo]: !prev[campo],
    }));
  };

  // Toggle restrição ativa
  const toggleRestricaoAtiva = (campo: keyof typeof restricoesAtivas) => {
    setRestricoesAtivas(prev => ({
      ...prev,
      [campo]: !prev[campo],
    }));
  };

  // Atualizar valor de restrição
  const updateRestricao = (campo: keyof VendedorRestricao, valor: any) => {
    setRestricoes(prev => ({
      ...prev,
      [campo]: valor,
    }));
  };

  // Atualizar valor de recibo
  const updateRecibo = (campo: keyof VendedorRecibo, valor: any) => {
    setRecibos(prev => ({
      ...prev,
      [campo]: valor,
    }));
  };

  // Salvar vendedor
  const handleSalvar = async () => {
    if (!codigoVendedor.trim()) {
      alert('Código do vendedor é obrigatório');
      setActiveTab('dados');
      return;
    }
    if (!nome.trim()) {
      alert('Nome é obrigatório');
      setActiveTab('dados');
      return;
    }

    setSaving(true);
    try {
      const telefoneCompleto = telefoneNumero ? `${ddi}${telefoneNumero.replace(/\D/g, '')}` : '';

      const dadosVendedor = {
        codigo_vendedor: codigoVendedor,
        nome,
        email,
        documento,
        telefone: telefoneCompleto,
        empresa_id: empresaId,
        status: 'ATIVO' as const,
      };

      let vendedorId: string;

      if (isEdicao && vendedor) {
        await vendedoresService.atualizarVendedor(vendedor.id, dadosVendedor);
        vendedorId = vendedor.id;
      } else {
        const novoVendedor = await vendedoresService.criarVendedor(dadosVendedor);
        vendedorId = novoVendedor.id;
      }

      // Salvar configurações, restrições e recibos
      await Promise.all([
        vendedoresService.salvarConfiguracoes(vendedorId, configuracoes),
        vendedoresService.salvarRestricoes(vendedorId, {
          ...restricoes,
          valor_maximo_vendas: restricoesAtivas.valor_maximo_vendas ? restricoes.valor_maximo_vendas : 0,
          valor_maximo_gastos: restricoesAtivas.valor_maximo_gastos ? restricoes.valor_maximo_gastos : 0,
          valor_maximo_receitas: restricoesAtivas.valor_maximo_receitas ? restricoes.valor_maximo_receitas : 0,
          max_parcelas_dia: restricoesAtivas.max_parcelas_dia ? restricoes.max_parcelas_dia : 0,
          limite_parcelas: restricoesAtivas.limite_parcelas ? restricoes.limite_parcelas : 0,
          whatsapp_aprovacoes: restricoesAtivas.whatsapp_aprovacoes ? restricoes.whatsapp_aprovacoes : '',
        }),
        vendedoresService.salvarRecibos(vendedorId, recibos),
      ]);

      onSave();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      alert(`Erro ao salvar: ${err.message || 'Tente novamente'}`);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'dados' as TabType, label: 'Dados Pessoais', icon: User },
    { id: 'configuracoes' as TabType, label: 'Configurações', icon: Settings },
    { id: 'restricoes' as TabType, label: 'Restrições', icon: Shield },
    { id: 'recibos' as TabType, label: 'Recibos', icon: Receipt },
  ];

  // Lista de configurações (13 opções - baseada na imagem)
  const configuracoesLista = [
    { campo: 'ativar_gps', label: 'Ativar GPS', descricao: 'Rastreamento de localização no app', icon: MapPin },
    { campo: 'ativar_sem_pagamentos', label: 'Ativar Sem Pagamentos', descricao: 'Botão "Não Pagou" no app', icon: Ban },
    { campo: 'ativar_adiar_parcelas', label: 'Ativar Adiar Parcelas', descricao: 'Permitir reagendamento de parcelas', icon: Calendar },
    { campo: 'ativar_auditoria_movel', label: 'Ativar Auditoria Móvel', descricao: 'Log detalhado de ações no app', icon: FileText },
    { campo: 'abertura_caixa_manual', label: 'Abertura Caixa Manual', descricao: 'Permitir abertura manual do caixa', icon: DollarSign },
    { campo: 'validar_endereco', label: 'Validar Endereço', descricao: 'Endereço obrigatório nos cadastros', icon: MapPin },
    { campo: 'carregar_imagens_wifi', label: 'Carregar Imagens WiFi', descricao: 'Upload apenas com conexão WiFi', icon: Wifi },
    { campo: 'atualizar_cel_renovacao', label: 'Atualizar Cel na Renovação', descricao: 'Sincronizar dados ao renovar', icon: RefreshCw },
    { campo: 'informacao_resumida', label: 'Informação Resumida', descricao: 'Mostrar dados resumidos no app', icon: Info },
    { campo: 'imprimir_recibos', label: 'Imprimir Recibos', descricao: 'Compartilhar/imprimir recibos', icon: Printer },
    { campo: 'so_frequencia_diaria', label: 'Só Frequência Diária', descricao: 'Apenas empréstimos diários', icon: Clock },
    { campo: 'inativar_info_cliente', label: 'Inativar Info Cliente', descricao: 'Limpar dados ao renovar', icon: Ban },
    { campo: 'permitir_exclusao', label: 'Permitir Exclusão', descricao: 'Deletar parcelas no app', icon: Trash2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdicao ? 'Editar Vendedor' : 'Novo Vendedor'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* ABA DADOS PESSOAIS */}
              {activeTab === 'dados' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Código Vendedor
                    </label>
                    <input
                      type="text"
                      value={codigoVendedor}
                      onChange={(e) => setCodigoVendedor(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-lg"
                      placeholder="V000001"
                      disabled={isEdicao}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome completo do vendedor"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="email@exemplo.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Documento
                      </label>
                      <input
                        type="text"
                        value={documento}
                        onChange={(e) => setDocumento(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="CPF, RUT, CI, etc."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Telefone
                      </label>
                      <div className="flex">
                        <select
                          value={ddi}
                          onChange={(e) => setDdi(e.target.value)}
                          className="px-3 py-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 min-w-[110px]"
                        >
                          {DDIS.map((d) => (
                            <option key={d.codigo} value={d.codigo}>
                              {d.bandeira} {d.codigo}
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          value={telefoneNumero}
                          onChange={(e) => setTelefoneNumero(e.target.value)}
                          className="flex-1 px-4 py-3 rounded-r-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="11999999999"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-800">
                      Após criar, você poderá configurar opções avançadas
                    </p>
                  </div>
                </div>
              )}

              {/* ABA CONFIGURAÇÕES */}
              {activeTab === 'configuracoes' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings className="w-5 h-5 text-gray-500" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Configurações Operacionais ({configuracoesLista.length} opções)
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {configuracoesLista.map((config) => {
                      const Icon = config.icon;
                      const isAtivo = configuracoes[config.campo as keyof VendedorConfiguracao];
                      
                      return (
                        <div
                          key={config.campo}
                          className={`
                            flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                            ${isAtivo 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-white border-gray-200 hover:border-gray-300'}
                          `}
                          onClick={() => toggleConfiguracao(config.campo as keyof VendedorConfiguracao)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isAtivo ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              <Icon className={`w-4 h-4 ${isAtivo ? 'text-green-600' : 'text-gray-500'}`} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{config.label}</p>
                              <p className="text-xs text-gray-500">{config.descricao}</p>
                            </div>
                          </div>
                          <div className={`
                            relative w-12 h-7 rounded-full transition-colors
                            ${isAtivo ? 'bg-green-500' : 'bg-gray-300'}
                          `}>
                            <div className={`
                              absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform
                              ${isAtivo ? 'translate-x-6' : 'translate-x-1'}
                            `} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ABA RESTRIÇÕES */}
              {activeTab === 'restricoes' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Restrições e Validações
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="flex items-center gap-2 mb-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restricoesAtivas.valor_maximo_vendas}
                          onChange={() => toggleRestricaoAtiva('valor_maximo_vendas')}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <DollarSign className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-medium text-gray-700">Valor Máximo Vendas</span>
                      </label>
                      <input
                        type="number"
                        value={restricoes.valor_maximo_vendas}
                        onChange={(e) => updateRestricao('valor_maximo_vendas', parseFloat(e.target.value) || 0)}
                        disabled={!restricoesAtivas.valor_maximo_vendas}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="0,00"
                        step="0.01"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="flex items-center gap-2 mb-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restricoesAtivas.valor_maximo_gastos}
                          onChange={() => toggleRestricaoAtiva('valor_maximo_gastos')}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-700">Valor Máximo Gastos</span>
                      </label>
                      <input
                        type="number"
                        value={restricoes.valor_maximo_gastos}
                        onChange={(e) => updateRestricao('valor_maximo_gastos', parseFloat(e.target.value) || 0)}
                        disabled={!restricoesAtivas.valor_maximo_gastos}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="0,00"
                        step="0.01"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="flex items-center gap-2 mb-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restricoesAtivas.valor_maximo_receitas}
                          onChange={() => toggleRestricaoAtiva('valor_maximo_receitas')}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <DollarSign className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700">Valor Máximo Receitas</span>
                      </label>
                      <input
                        type="number"
                        value={restricoes.valor_maximo_receitas}
                        onChange={(e) => updateRestricao('valor_maximo_receitas', parseFloat(e.target.value) || 0)}
                        disabled={!restricoesAtivas.valor_maximo_receitas}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="0,00"
                        step="0.01"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="flex items-center gap-2 mb-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restricoesAtivas.max_parcelas_dia}
                          onChange={() => toggleRestricaoAtiva('max_parcelas_dia')}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Clock className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium text-gray-700">Máx. Parcelas por Dia</span>
                      </label>
                      <input
                        type="number"
                        value={restricoes.max_parcelas_dia}
                        onChange={(e) => updateRestricao('max_parcelas_dia', parseInt(e.target.value) || 0)}
                        disabled={!restricoesAtivas.max_parcelas_dia}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="0"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="flex items-center gap-2 mb-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restricoesAtivas.limite_parcelas}
                          onChange={() => toggleRestricaoAtiva('limite_parcelas')}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <FileText className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-medium text-gray-700">Limite de Parcelas</span>
                      </label>
                      <input
                        type="number"
                        value={restricoes.limite_parcelas}
                        onChange={(e) => updateRestricao('limite_parcelas', parseInt(e.target.value) || 0)}
                        disabled={!restricoesAtivas.limite_parcelas}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="0"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="flex items-center gap-2 mb-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={restricoesAtivas.whatsapp_aprovacoes}
                          onChange={() => toggleRestricaoAtiva('whatsapp_aprovacoes')}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <PhoneIcon className="w-4 h-4 text-green-500" />
                        <span className="text-sm font-medium text-gray-700">WhatsApp Aprovações</span>
                      </label>
                      <input
                        type="text"
                        value={restricoes.whatsapp_aprovacoes}
                        onChange={(e) => updateRestricao('whatsapp_aprovacoes', e.target.value)}
                        disabled={!restricoesAtivas.whatsapp_aprovacoes}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="11 9 9999-9999"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA RECIBOS */}
              {activeTab === 'recibos' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Receipt className="w-5 h-5 text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-900">
                      Restrições e Validações
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logo Personalizado (URL)
                      </label>
                      <input
                        type="url"
                        value={recibos.logo_url}
                        onChange={(e) => updateRecibo('logo_url', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="https://exemplo.com/logo.png"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        % Recaudo
                      </label>
                      <select
                        value={recibos.tipo_recaudo}
                        onChange={(e) => updateRecibo('tipo_recaudo', e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecione</option>
                        <option value="DIARIO">Diário</option>
                        <option value="SEMANAL">Semanal</option>
                        <option value="QUINZENAL">Quinzenal</option>
                        <option value="MENSAL">Mensal</option>
                      </select>
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        % Recaudo
                      </label>
                      <input
                        type="number"
                        value={recibos.percentual_recaudo}
                        onChange={(e) => updateRecibo('percentual_recaudo', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max="100"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        % Vendas
                      </label>
                      <input
                        type="number"
                        value={recibos.percentual_vendas}
                        onChange={(e) => updateRecibo('percentual_vendas', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max="100"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor Pensão
                      </label>
                      <input
                        type="number"
                        value={recibos.valor_pensao}
                        onChange={(e) => updateRecibo('valor_pensao', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            Após criar, você poderá configurar opções avançadas
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdicao ? 'Salvar Alterações' : 'Criar Vendedor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
