'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Loader2, 
  Settings,
  Shield,
  Receipt,
  MapPin,
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
  Users,
  Percent,
  Camera,
  Upload,
  Plus,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { vendedoresService } from '@/services/vendedores';
import type { 
  Vendedor, 
  ConfiguracaoVendedor, 
  RestricaoVendedor, 
  ConfiguracaoRecibo 
} from '@/types/vendedores';

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

// Taxas de juros padrão
const TAXAS_PADRAO = [5, 10, 15, 20, 25];

// Valores padrão - configuracoes_vendedor
const CONFIGURACOES_PADRAO: Omit<ConfiguracaoVendedor, 'vendedor_id'> = {
  ativar_gps: true,
  ativar_sem_pagamentos: true,
  ativar_adiar_parcelas: false,
  ativar_auditoria_movel: false,
  abertura_caixa_manual: false,
  validar_endereco: false,
  carregar_imagens_wifi: true,
  atualizar_movel_renovacao: false,
  informacao_resumida_movel: false,
  imprimir_compartilhar_recibo: false,
  somente_frequencia_diaria: false,
  inativar_info_cliente_renovar: false,
  permitir_exclusao_parcelas: true,
};

// Valores padrão - restricoes_vendedor
const RESTRICOES_PADRAO: Omit<RestricaoVendedor, 'vendedor_id'> = {
  validar_valor_max_vendas: false,
  valor_max_vendas: 0,
  validar_valor_gastos: false,
  valor_max_gastos: 0,
  validar_valor_entradas: false,
  valor_max_entradas: 0,
  validar_valor_max_renovacoes: false,
  valor_max_renovacoes: 0,
  renovacao_dia_seguinte_se_exceder: false,
  numero_max_parcelas_por_dia: 0,
  numero_parcelas_limite: 99,
  numero_max_parcelas_cancelar_venda: 0,
  parcelas_permitidas_cancelar: 0,
  validar_clientes_outros_vendedores: false,
  numero_whatsapp_aprovacoes: '',
  taxas_juros_permitidas: [],
  saldo_inicial: 0,
  data_vencimento: undefined,
};

// Valores padrão - configuracoes_recibos
const RECIBOS_PADRAO: Partial<ConfiguracaoRecibo> = {
  logo_url: '',
  mensagem_personalizada: '',
  aplicar_todos_vendedores: false,
  periodo_pago: '',
  percentual_recaudo: 0,
  percentual_vendas: 0,
  valor_pensao: 0,
  valor_saude: 0,
  ativo: true,
};

export function ModalVendedor({ vendedor, empresaId, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('dados');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === ABA DADOS PESSOAIS ===
  const [codigoVendedor, setCodigoVendedor] = useState('');
  const [nome, setNome] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [documento, setDocumento] = useState('');
  const [ddi, setDdi] = useState('+55');
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [endereco, setEndereco] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [regerando, setRegerando] = useState(false);

  // === ABA CONFIGURAÇÕES ===
  const [configuracoes, setConfiguracoes] = useState<Omit<ConfiguracaoVendedor, 'vendedor_id'>>(CONFIGURACOES_PADRAO);

  // === ABA RESTRIÇÕES ===
  const [restricoes, setRestricoes] = useState<Omit<RestricaoVendedor, 'vendedor_id'>>(RESTRICOES_PADRAO);
  const [taxasPersonalizadas, setTaxasPersonalizadas] = useState<number[]>([]);
  const [novaTaxa, setNovaTaxa] = useState('');
  const [todasTaxas, setTodasTaxas] = useState(false);

  // === ABA RECIBOS ===
  const [recibos, setRecibos] = useState<Partial<ConfiguracaoRecibo>>(RECIBOS_PADRAO);

  const isEdicao = !!vendedor;

  // Carregar dados do vendedor se for edição
  useEffect(() => {
    if (vendedor) {
      setCodigoVendedor(vendedor.codigo_vendedor || '');
      setNome(vendedor.nome || '');
      setApellidos(vendedor.apellidos || '');
      setEmail(vendedor.email || '');
      setDocumento(vendedor.documento || '');
      setEndereco(vendedor.endereco || '');
      setFotoUrl(vendedor.foto_url || '');
      setCodigoAcesso(vendedor.codigo_acesso || '');

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

      carregarDadosCompletos(vendedor.id);
    } else {
      gerarCodigoAutomatico();
    }
  }, [vendedor]);

  const gerarCodigoAutomatico = async () => {
    try {
      const codigo = await vendedoresService.gerarCodigoVendedor();
      setCodigoVendedor(codigo);
    } catch (err) {
      console.error('Erro ao gerar código:', err);
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
        setDataVencimento(restricoesData.data_vencimento || '');
        
        // Processar taxas de juros
        const taxas = restricoesData.taxas_juros_permitidas || [];
        if (taxas.length === 0) {
          setTodasTaxas(false);
          setTaxasPersonalizadas([]);
        } else {
          const taxasPadrao = taxas.filter((t: number) => TAXAS_PADRAO.includes(t));
          const taxasCustom = taxas.filter((t: number) => !TAXAS_PADRAO.includes(t));
          setTaxasPersonalizadas(taxasCustom);
          
          // Se tem todas as taxas padrão, marca "todas"
          if (TAXAS_PADRAO.every(t => taxas.includes(t))) {
            setTodasTaxas(true);
          }
        }
      }
      
      if (recibosData) setRecibos({ ...RECIBOS_PADRAO, ...recibosData });
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  // Upload de foto
  const handleUploadFoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida.');
      return;
    }

    // Validar tamanho (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB.');
      return;
    }

    setUploadingFoto(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `vendedor_${Date.now()}.${fileExt}`;
      const filePath = `vendedores/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('fotos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('fotos')
        .getPublicUrl(filePath);

      setFotoUrl(publicUrl);
    } catch (err: any) {
      console.error('Erro ao fazer upload:', err);
      alert(`Erro ao fazer upload: ${err.message}`);
    } finally {
      setUploadingFoto(false);
    }
  };

  // Toggle configuração
  const toggleConfiguracao = (campo: keyof ConfiguracaoVendedor) => {
    setConfiguracoes(prev => ({
      ...prev,
      [campo]: !prev[campo as keyof typeof prev],
    }));
  };

  // Atualizar restrição
  const updateRestricao = (campo: keyof RestricaoVendedor, valor: any) => {
    setRestricoes(prev => ({
      ...prev,
      [campo]: valor,
    }));
  };

  // Atualizar recibo
  const updateRecibo = (campo: keyof ConfiguracaoRecibo, valor: any) => {
    setRecibos(prev => ({
      ...prev,
      [campo]: valor,
    }));
  };

  // Toggle taxa de juros
  const toggleTaxa = (taxa: number) => {
    const taxasAtuais = restricoes.taxas_juros_permitidas || [];
    if (taxasAtuais.includes(taxa)) {
      updateRestricao('taxas_juros_permitidas', taxasAtuais.filter(t => t !== taxa));
    } else {
      updateRestricao('taxas_juros_permitidas', [...taxasAtuais, taxa].sort((a, b) => a - b));
    }
  };

  // Toggle todas as taxas
  const toggleTodasTaxas = () => {
    if (todasTaxas) {
      // Desmarcar todas
      setTodasTaxas(false);
      updateRestricao('taxas_juros_permitidas', taxasPersonalizadas);
    } else {
      // Marcar todas
      setTodasTaxas(true);
      const todasAsTaxas = [...TAXAS_PADRAO, ...taxasPersonalizadas].sort((a, b) => a - b);
      updateRestricao('taxas_juros_permitidas', todasAsTaxas);
    }
  };

  // Adicionar taxa personalizada
  const adicionarTaxaPersonalizada = () => {
    const valor = parseFloat(novaTaxa);
    if (isNaN(valor) || valor <= 0 || valor > 100) {
      alert('Digite um valor válido entre 0 e 100');
      return;
    }
    
    const taxasAtuais = restricoes.taxas_juros_permitidas || [];
    if (taxasAtuais.includes(valor)) {
      alert('Esta taxa já foi adicionada');
      return;
    }

    setTaxasPersonalizadas(prev => [...prev, valor].sort((a, b) => a - b));
    updateRestricao('taxas_juros_permitidas', [...taxasAtuais, valor].sort((a, b) => a - b));
    setNovaTaxa('');
  };

  // Remover taxa personalizada
  const removerTaxaPersonalizada = (taxa: number) => {
    setTaxasPersonalizadas(prev => prev.filter(t => t !== taxa));
    const taxasAtuais = restricoes.taxas_juros_permitidas || [];
    updateRestricao('taxas_juros_permitidas', taxasAtuais.filter(t => t !== taxa));
  };

  // Regerar código de acesso (6 dígitos) — ação destrutiva: invalida o código atual
  const handleRegerarCodigoAcesso = async () => {
    if (!vendedor) return;
    const ok = window.confirm(
      'Regerar o código de acesso vai INVALIDAR o código atual do vendedor. ' +
      'Ele precisará usar o novo código para acessar o app. Deseja continuar?'
    );
    if (!ok) return;

    setRegerando(true);
    try {
      const { codigo_novo } = await vendedoresService.regerarCodigoAcesso(vendedor.id);
      setCodigoAcesso(codigo_novo);
      alert(`Novo código de acesso: ${codigo_novo}`);
    } catch (e) {
      console.error('Erro ao regerar código de acesso:', e);
      alert('Erro ao regerar o código de acesso. Tente novamente.');
    } finally {
      setRegerando(false);
    }
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

      // Buscar hierarquia_id da empresa
      const hierarquiaId = await vendedoresService.buscarHierarquiaEmpresa(empresaId);

      const dadosVendedor: Partial<Vendedor> = {
        codigo_vendedor: codigoVendedor,
        nome,
        apellidos,
        email,
        documento,
        telefone: telefoneCompleto,
        endereco,
        foto_url: fotoUrl || null,  // null para remover, não undefined
        empresa_id: empresaId,
        hierarquia_id: hierarquiaId || undefined,
        status: 'ATIVO',
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
          data_vencimento: dataVencimento || undefined,
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

  // Lista de configurações (13 opções)
  const configuracoesLista = [
    { campo: 'ativar_gps', label: 'Ativar GPS', descricao: 'Rastreamento de localização no app', icon: MapPin },
    { campo: 'ativar_sem_pagamentos', label: 'Ativar Sem Pagamentos', descricao: 'Botão "Não Pagou" no app', icon: Ban },
    { campo: 'ativar_adiar_parcelas', label: 'Ativar Adiar Parcelas', descricao: 'Permitir reagendamento de parcelas', icon: Calendar },
    { campo: 'ativar_auditoria_movel', label: 'Ativar Auditoria Móvel', descricao: 'Log detalhado de ações no app', icon: FileText },
    { campo: 'abertura_caixa_manual', label: 'Abertura Caixa Manual', descricao: 'Permitir abertura manual do caixa', icon: DollarSign },
    { campo: 'validar_endereco', label: 'Validar Endereço', descricao: 'Endereço obrigatório nos cadastros', icon: MapPin },
    { campo: 'carregar_imagens_wifi', label: 'Carregar Imagens WiFi', descricao: 'Upload apenas com conexão WiFi', icon: Wifi },
    { campo: 'atualizar_movel_renovacao', label: 'Atualizar Móvel na Renovação', descricao: 'Sincronizar dados ao renovar', icon: RefreshCw },
    { campo: 'informacao_resumida_movel', label: 'Informação Resumida', descricao: 'Mostrar dados resumidos no app', icon: Info },
    { campo: 'imprimir_compartilhar_recibo', label: 'Imprimir Recibos', descricao: 'Compartilhar/imprimir recibos', icon: Printer },
    { campo: 'somente_frequencia_diaria', label: 'Só Frequência Diária', descricao: 'Apenas empréstimos diários', icon: Clock },
    { campo: 'inativar_info_cliente_renovar', label: 'Inativar Info Cliente', descricao: 'Limpar dados ao renovar', icon: Ban },
    { campo: 'permitir_exclusao_parcelas', label: 'Permitir Exclusão', descricao: 'Deletar parcelas no app', icon: Trash2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdicao ? 'Gerenciar Vendedor' : 'Novo Vendedor'}
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
                  {/* Header com foto */}
                  <div className="flex items-start gap-6 p-4 bg-gray-50 rounded-xl">
                    {/* Foto */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                          {fotoUrl ? (
                            <img
                              src={fotoUrl}
                              alt="Foto"
                              className="w-24 h-24 object-cover"
                              onError={() => setFotoUrl('')}
                            />
                          ) : (
                            <span className="text-white font-bold text-3xl">
                              {nome?.charAt(0).toUpperCase() || 'V'}
                            </span>
                          )}
                        </div>
                        {/* Botão alterar foto */}
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingFoto}
                          className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 disabled:opacity-50"
                          title="Alterar foto"
                        >
                          {uploadingFoto ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Camera className="w-4 h-4" />
                          )}
                        </button>
                        {/* Botão excluir foto */}
                        {fotoUrl && (
                          <button
                            onClick={() => setFotoUrl('')}
                            className="absolute -bottom-1 -left-1 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600"
                            title="Remover foto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleUploadFoto}
                          className="hidden"
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {fotoUrl ? 'Alterar ou remover' : 'Clique para adicionar'}
                      </span>
                    </div>

                    {/* Código e Acesso */}
                    <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Código Vendedor
                          </label>
                          <input
                            type="text"
                            value={codigoVendedor}
                            onChange={(e) => setCodigoVendedor(e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 font-mono text-lg focus:ring-2 focus:ring-blue-500"
                            placeholder="V000001"
                            disabled={isEdicao}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Data Vencimento do Acesso
                          </label>
                          <input
                            type="date"
                            value={dataVencimento}
                            onChange={(e) => setDataVencimento(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                            min="2020-01-01"
                          />
                        </div>
                      </div>

                      {/* Código de Acesso (somente leitura + regerar) */}
                      {isEdicao && codigoAcesso && (
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <label className="block text-xs font-medium text-purple-700 mb-1">
                                Código de Acesso (App Móvel)
                              </label>
                              <code className="text-xl font-mono text-purple-700 font-bold tracking-widest">
                                {codigoAcesso}
                              </code>
                            </div>
                            <div className="flex items-center gap-3">
                              {dataVencimento && (
                                <div className="text-right">
                                  <span className="text-xs text-purple-600">Válido até</span>
                                  <p className="text-sm font-medium text-purple-700">
                                    {new Date(dataVencimento).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={handleRegerarCodigoAcesso}
                                disabled={regerando}
                                title="Gerar um novo código de acesso (invalida o atual)"
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                              >
                                {regerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                Regerar
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nota sobre associação de rota */}
                  <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
                    <MapPin className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-orange-800">
                        Associação de Rota
                      </p>
                      <p className="text-sm text-orange-700 mt-0.5">
                        Para vincular ou alterar a rota deste vendedor, acesse o <strong>módulo de Rotas</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Dados pessoais */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome do vendedor"
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

                  {!isEdicao && (
                    <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-800">
                        Após criar, o código de acesso será gerado automaticamente.
                      </p>
                    </div>
                  )}
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
                      const isAtivo = configuracoes[config.campo as keyof typeof configuracoes] as boolean;
                      
                      return (
                        <div
                          key={config.campo}
                          className={`
                            flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer
                            ${isAtivo 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-white border-gray-200 hover:border-gray-300'}
                          `}
                          onClick={() => toggleConfiguracao(config.campo as keyof ConfiguracaoVendedor)}
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
                <div className="space-y-6">
                  {/* Seção: Taxas de Juros Permitidas */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Taxas de Juros Permitidas
                    </h3>
                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white space-y-4">
                      {/* Opção "Todas" */}
                      <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={todasTaxas}
                          onChange={toggleTodasTaxas}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Permitir todas as taxas</span>
                      </label>

                      {/* Taxas padrão */}
                      <div className="flex flex-wrap gap-2">
                        {TAXAS_PADRAO.map((taxa) => {
                          const isSelected = (restricoes.taxas_juros_permitidas || []).includes(taxa);
                          return (
                            <button
                              key={taxa}
                              onClick={() => toggleTaxa(taxa)}
                              disabled={todasTaxas}
                              className={`
                                px-4 py-2 rounded-lg text-sm font-medium transition-all
                                ${isSelected || todasTaxas
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                                ${todasTaxas ? 'opacity-50 cursor-not-allowed' : ''}
                              `}
                            >
                              {taxa}%
                            </button>
                          );
                        })}
                      </div>

                      {/* Taxas personalizadas */}
                      {taxasPersonalizadas.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {taxasPersonalizadas.map((taxa) => (
                            <span
                              key={taxa}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium"
                            >
                              {taxa}%
                              <button
                                onClick={() => removerTaxaPersonalizada(taxa)}
                                className="ml-1 hover:text-purple-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Adicionar taxa personalizada */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={novaTaxa}
                          onChange={(e) => setNovaTaxa(e.target.value)}
                          placeholder="Outra taxa..."
                          className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500"
                          min="0"
                          max="100"
                          step="0.5"
                        />
                        <button
                          onClick={adicionarTaxaPersonalizada}
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Seção: Validações de Valores */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Validações de Valores
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Valor Máximo Vendas */}
                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="flex items-center gap-2 mb-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={restricoes.validar_valor_max_vendas}
                            onChange={() => updateRestricao('validar_valor_max_vendas', !restricoes.validar_valor_max_vendas)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Valor Máximo Vendas</span>
                        </label>
                        <input
                          type="number"
                          value={restricoes.valor_max_vendas}
                          onChange={(e) => updateRestricao('valor_max_vendas', parseFloat(e.target.value) || 0)}
                          disabled={!restricoes.validar_valor_max_vendas}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>

                      {/* Valor Máximo Gastos */}
                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="flex items-center gap-2 mb-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={restricoes.validar_valor_gastos}
                            onChange={() => updateRestricao('validar_valor_gastos', !restricoes.validar_valor_gastos)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Valor Máximo Gastos</span>
                        </label>
                        <input
                          type="number"
                          value={restricoes.valor_max_gastos}
                          onChange={(e) => updateRestricao('valor_max_gastos', parseFloat(e.target.value) || 0)}
                          disabled={!restricoes.validar_valor_gastos}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>

                      {/* Valor Máximo Entradas */}
                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="flex items-center gap-2 mb-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={restricoes.validar_valor_entradas}
                            onChange={() => updateRestricao('validar_valor_entradas', !restricoes.validar_valor_entradas)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Valor Máximo Entradas</span>
                        </label>
                        <input
                          type="number"
                          value={restricoes.valor_max_entradas}
                          onChange={(e) => updateRestricao('valor_max_entradas', parseFloat(e.target.value) || 0)}
                          disabled={!restricoes.validar_valor_entradas}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>

                      {/* Valor Máximo Renovações */}
                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="flex items-center gap-2 mb-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={restricoes.validar_valor_max_renovacoes}
                            onChange={() => updateRestricao('validar_valor_max_renovacoes', !restricoes.validar_valor_max_renovacoes)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">Valor Máximo Renovações</span>
                        </label>
                        <input
                          type="number"
                          value={restricoes.valor_max_renovacoes}
                          onChange={(e) => updateRestricao('valor_max_renovacoes', parseFloat(e.target.value) || 0)}
                          disabled={!restricoes.validar_valor_max_renovacoes}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                          placeholder="0.00"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Limites de Parcelas */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Limites de Parcelas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Máx. Parcelas por Dia
                        </label>
                        <input
                          type="number"
                          value={restricoes.numero_max_parcelas_por_dia}
                          onChange={(e) => updateRestricao('numero_max_parcelas_por_dia', parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>

                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Limite de Parcelas (Total)
                        </label>
                        <input
                          type="number"
                          value={restricoes.numero_parcelas_limite}
                          onChange={(e) => updateRestricao('numero_parcelas_limite', parseInt(e.target.value) || 99)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                          placeholder="99"
                        />
                      </div>

                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Máx. Parcelas p/ Cancelar Venda
                        </label>
                        <input
                          type="number"
                          value={restricoes.numero_max_parcelas_cancelar_venda}
                          onChange={(e) => updateRestricao('numero_max_parcelas_cancelar_venda', parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>

                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Parcelas Permitidas Cancelar
                        </label>
                        <input
                          type="number"
                          value={restricoes.parcelas_permitidas_cancelar}
                          onChange={(e) => updateRestricao('parcelas_permitidas_cancelar', parseInt(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Seção: Outras Configurações */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Outras Configurações
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={restricoes.validar_clientes_outros_vendedores}
                            onChange={() => updateRestricao('validar_clientes_outros_vendedores', !restricoes.validar_clientes_outros_vendedores)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">Validar Clientes de Outros Vendedores</span>
                        </label>
                      </div>

                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={restricoes.renovacao_dia_seguinte_se_exceder}
                            onChange={() => updateRestricao('renovacao_dia_seguinte_se_exceder', !restricoes.renovacao_dia_seguinte_se_exceder)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm font-medium text-gray-700">Renovação no Dia Seguinte se Exceder</span>
                        </label>
                      </div>

                      <div className="p-4 rounded-xl border-2 border-gray-200 bg-white col-span-2">
                        <label className="flex items-center gap-2 mb-3">
                          <PhoneIcon className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-medium text-gray-700">WhatsApp para Aprovações</span>
                        </label>
                        <input
                          type="text"
                          value={restricoes.numero_whatsapp_aprovacoes}
                          onChange={(e) => updateRestricao('numero_whatsapp_aprovacoes', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                          placeholder="55 11 99999-9999"
                        />
                      </div>
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
                      Configurações de Recibos e Comissões
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logo Personalizado (URL)
                      </label>
                      <input
                        type="url"
                        value={recibos.logo_url || ''}
                        onChange={(e) => updateRecibo('logo_url', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="https://exemplo.com/logo.png"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Período de Pagamento
                      </label>
                      <select
                        value={recibos.periodo_pago || ''}
                        onChange={(e) => updateRecibo('periodo_pago', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
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
                        % Recaudo (Comissão sobre cobranças)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={recibos.percentual_recaudo}
                          onChange={(e) => updateRecibo('percentual_recaudo', parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 pr-10"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          max="100"
                        />
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        % Vendas (Comissão sobre vendas)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={recibos.percentual_vendas}
                          onChange={(e) => updateRecibo('percentual_vendas', parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 pr-10"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          max="100"
                        />
                        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor Pensão
                      </label>
                      <input
                        type="number"
                        value={recibos.valor_pensao}
                        onChange={(e) => updateRecibo('valor_pensao', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Valor Saúde
                      </label>
                      <input
                        type="number"
                        value={recibos.valor_saude}
                        onChange={(e) => updateRecibo('valor_saude', parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                        step="0.01"
                      />
                    </div>

                    <div className="p-4 rounded-xl border-2 border-gray-200 bg-white col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mensagem Personalizada (Recibo)
                      </label>
                      <textarea
                        value={recibos.mensagem_personalizada || ''}
                        onChange={(e) => updateRecibo('mensagem_personalizada', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Mensagem que aparecerá nos recibos..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
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
  );
}