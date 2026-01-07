'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  User, 
  Loader2, 
  CreditCard,
  MapPin,
  DollarSign,
  Calendar,
  Camera,
  Trash2,
  Building2,
  Phone,
  Mail,
  FileText,
  Hash,
  Percent,
  Check,
  AlertCircle,
} from 'lucide-react';
import { clientesService } from '@/services/clientes';
import type { 
  ClienteComTotais, 
  Segmento, 
  RotaSimples, 
  FrequenciaPagamento,
} from '@/types/clientes';

// =====================================================
// CONSTANTES
// =====================================================

// DDIs da América Latina
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
  { codigo: '+52', pais: 'México', bandeira: '🇲🇽' },
  { codigo: '+507', pais: 'Panamá', bandeira: '🇵🇦' },
  { codigo: '+506', pais: 'Costa Rica', bandeira: '🇨🇷' },
];

const FREQUENCIAS: { value: FrequenciaPagamento; label: string }[] = [
  { value: 'DIARIO', label: 'Diário' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'QUINZENAL', label: 'Quinzenal' },
  { value: 'MENSAL', label: 'Mensal' },
];

// =====================================================
// TIPOS
// =====================================================

type TabType = 'cliente' | 'emprestimo' | 'resumo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cliente?: ClienteComTotais | null;
  segmentos: Segmento[];
  rotas: RotaSimples[];
  empresaId: string;
  userId: string;
  rotaIdContexto?: string | null; // Rota do seletor de localização
  onSucesso: () => void;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function ModalNovaVenda({ 
  isOpen, 
  onClose, 
  cliente, 
  segmentos, 
  rotas, 
  empresaId, 
  userId,
  rotaIdContexto,
  onSucesso 
}: Props) {
  const isNovoCliente = !cliente;
  const temEmprestimoAtivo = cliente && cliente.qtd_emprestimos_ativos > 0;
  
  const [activeTab, setActiveTab] = useState<TabType>('cliente');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === ABA DADOS DO CLIENTE ===
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [ddiCelular, setDdiCelular] = useState('+55');
  const [telefoneCelular, setTelefoneCelular] = useState('');
  const [ddiFixo, setDdiFixo] = useState('+55');
  const [telefoneFixo, setTelefoneFixo] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [enderecoComercial, setEnderecoComercial] = useState('');
  const [segmentoId, setSegmentoId] = useState('');
  const [observacoesCliente, setObservacoesCliente] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');

  // === ABA EMPRÉSTIMO ===
  const [rotaId, setRotaId] = useState('');
  const [valorPrincipal, setValorPrincipal] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState('12');
  const [taxaJuros, setTaxaJuros] = useState('20');
  const [frequencia, setFrequencia] = useState<FrequenciaPagamento>('DIARIO');
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState('');
  const [observacoesEmprestimo, setObservacoesEmprestimo] = useState('');
  const [microseguroValor, setMicroseguroValor] = useState('');

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      // Se é cliente existente, pula para aba de empréstimo
      setActiveTab(isNovoCliente ? 'cliente' : 'emprestimo');
      setErro('');
      
      if (cliente) {
        // Preencher dados do cliente existente
        setNome(cliente.nome);
        setDocumento(cliente.documento || '');
        
        // Extrair DDI do celular
        if (cliente.telefone_celular) {
          const ddiEncontrado = DDIS.find(d => cliente.telefone_celular?.startsWith(d.codigo));
          if (ddiEncontrado) {
            setDdiCelular(ddiEncontrado.codigo);
            setTelefoneCelular(cliente.telefone_celular.substring(ddiEncontrado.codigo.length));
          } else {
            setTelefoneCelular(cliente.telefone_celular);
          }
        }
        
        setEmail(cliente.email || '');
        setFotoUrl(cliente.foto_url || '');
      } else {
        // Limpar campos para novo cliente
        setNome('');
        setDocumento('');
        setDdiCelular('+55');
        setTelefoneCelular('');
        setDdiFixo('+55');
        setTelefoneFixo('');
        setEmail('');
        setEndereco('');
        setEnderecoComercial('');
        setSegmentoId('');
        setObservacoesCliente('');
        setFotoUrl('');
      }
      
      // Campos do empréstimo
      // Se só tem 1 rota, seleciona automaticamente. Se tem rota no contexto, usa ela.
      if (rotaIdContexto) {
        setRotaId(rotaIdContexto);
      } else if (rotas.length === 1) {
        setRotaId(rotas[0].id);
      } else {
        setRotaId('');
      }
      
      setValorPrincipal('');
      setNumeroParcelas('12');
      setTaxaJuros('20');
      setFrequencia('DIARIO');
      setMicroseguroValor('');
      setObservacoesEmprestimo('');
      
      // Data padrão: amanhã
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      setDataPrimeiroVencimento(amanha.toISOString().split('T')[0]);
    }
  }, [isOpen, cliente, isNovoCliente, rotas, rotaIdContexto]);

  // Cálculos do empréstimo
  const calculo = clientesService.calcularEmprestimo(
    parseFloat(valorPrincipal) || 0,
    parseFloat(taxaJuros) || 0,
    parseInt(numeroParcelas) || 1
  );

  const totalComMicroseguro = calculo.valor_total + (parseFloat(microseguroValor) || 0);

  // Validações
  const podeAvancarCliente = nome.trim() && telefoneCelular.trim();
  const podeAvancarEmprestimo = rotaId && valorPrincipal && numeroParcelas && taxaJuros && dataPrimeiroVencimento;

  // Upload de foto
  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tamanho (máx 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Imagem muito grande. Máximo 2MB.');
      return;
    }
    
    setUploadingFoto(true);
    try {
      // Converter para base64 ou fazer upload
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoUrl(reader.result as string);
        setUploadingFoto(false);
      };
      reader.onerror = () => {
        setUploadingFoto(false);
        alert('Erro ao carregar imagem');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploadingFoto(false);
    }
  };

  // Salvar
  const handleSalvar = async () => {
    setSaving(true);
    setErro('');

    try {
      const telefoneCompletoC = telefoneCelular ? `${ddiCelular}${telefoneCelular.replace(/\D/g, '')}` : '';
      const telefoneCompletoF = telefoneFixo ? `${ddiFixo}${telefoneFixo.replace(/\D/g, '')}` : '';
      
      let resultado;

      if (isNovoCliente) {
        // Nova venda completa (cliente + empréstimo)
        resultado = await clientesService.novaVendaCompleta({
          cliente_nome: nome,
          cliente_documento: documento || undefined,
          cliente_telefone: telefoneCompletoC,
          cliente_telefone_fixo: telefoneCompletoF || undefined,
          cliente_email: email || undefined,
          cliente_endereco: endereco || undefined,
          cliente_endereco_comercial: enderecoComercial || undefined,
          cliente_segmento_id: segmentoId || undefined,
          cliente_foto_url: fotoUrl || undefined,
          cliente_observacoes: observacoesCliente || undefined,
          valor_principal: parseFloat(valorPrincipal),
          numero_parcelas: parseInt(numeroParcelas),
          taxa_juros: parseFloat(taxaJuros),
          frequencia,
          data_primeiro_vencimento: dataPrimeiroVencimento,
          observacoes: observacoesEmprestimo || undefined,
          empresa_id: empresaId,
          rota_id: rotaId,
          user_id: userId,
          microseguro_valor: microseguroValor ? parseFloat(microseguroValor) : undefined,
        });
      } else if (temEmprestimoAtivo) {
        // Venda adicional
        resultado = await clientesService.vendaAdicional({
          cliente_id: cliente!.id,
          valor_principal: parseFloat(valorPrincipal),
          numero_parcelas: parseInt(numeroParcelas),
          taxa_juros: parseFloat(taxaJuros),
          frequencia,
          data_primeiro_vencimento: dataPrimeiroVencimento,
          observacoes: observacoesEmprestimo || undefined,
          empresa_id: empresaId,
          rota_id: rotaId,
          user_id: userId,
          microseguro_valor: microseguroValor ? parseFloat(microseguroValor) : undefined,
        });
      } else {
        // Renovação
        resultado = await clientesService.renovarEmprestimo({
          cliente_id: cliente!.id,
          valor_principal: parseFloat(valorPrincipal),
          numero_parcelas: parseInt(numeroParcelas),
          taxa_juros: parseFloat(taxaJuros),
          frequencia,
          data_primeiro_vencimento: dataPrimeiroVencimento,
          observacoes: observacoesEmprestimo || undefined,
          empresa_id: empresaId,
          rota_id: rotaId,
          user_id: userId,
          microseguro_valor: microseguroValor ? parseFloat(microseguroValor) : undefined,
        });
      }

      if (!resultado.success) {
        throw new Error(resultado.error || 'Erro ao processar venda');
      }

      onSucesso();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // Tabs
  const tabs = isNovoCliente 
    ? [
        { id: 'cliente' as TabType, label: 'Dados do Cliente', icon: User },
        { id: 'emprestimo' as TabType, label: 'Empréstimo', icon: CreditCard },
        { id: 'resumo' as TabType, label: 'Resumo', icon: FileText },
      ]
    : [
        { id: 'emprestimo' as TabType, label: 'Empréstimo', icon: CreditCard },
        { id: 'resumo' as TabType, label: 'Resumo', icon: FileText },
      ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {isNovoCliente ? 'Nova Venda' : temEmprestimoAtivo ? 'Venda Adicional' : 'Renovação'}
            </h2>
            {cliente && <p className="text-blue-200 text-sm">{cliente.nome}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-gray-50">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDisabled = (
              (tab.id === 'emprestimo' && isNovoCliente && !podeAvancarCliente) ||
              (tab.id === 'resumo' && !podeAvancarEmprestimo)
            );
            
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${isActive
                    ? 'border-blue-600 text-blue-600'
                    : isDisabled 
                      ? 'border-transparent text-gray-300 cursor-not-allowed'
                      : 'border-transparent text-gray-500 hover:text-gray-700'}
                `}
              >
                <span className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'}
                `}>
                  {index + 1}
                </span>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {erro && (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {/* ==================== ABA DADOS DO CLIENTE ==================== */}
          {activeTab === 'cliente' && (
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
                          {nome?.charAt(0).toUpperCase() || 'C'}
                        </span>
                      )}
                    </div>
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

                {/* Campos principais */}
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Completo *
                      </label>
                      <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Nome do cliente"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Documento (CPF/RG)
                      </label>
                      <input
                        type="text"
                        value={documento}
                        onChange={(e) => setDocumento(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Telefones com DDI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    Celular *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={ddiCelular}
                      onChange={(e) => setDdiCelular(e.target.value)}
                      className="w-28 px-2 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      {DDIS.map(d => (
                        <option key={d.codigo} value={d.codigo}>
                          {d.bandeira} {d.codigo}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={telefoneCelular}
                      onChange={(e) => setTelefoneCelular(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                      placeholder="11 99999-9999"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    Telefone Fixo
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={ddiFixo}
                      onChange={(e) => setDdiFixo(e.target.value)}
                      className="w-28 px-2 py-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      {DDIS.map(d => (
                        <option key={d.codigo} value={d.codigo}>
                          {d.bandeira} {d.codigo}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={telefoneFixo}
                      onChange={(e) => setTelefoneFixo(e.target.value)}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                      placeholder="11 3333-3333"
                    />
                  </div>
                </div>
              </div>

              {/* Endereços */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    Endereço Residencial
                  </label>
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    placeholder="Rua, número, bairro"
                  />
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    Endereço Comercial
                  </label>
                  <input
                    type="text"
                    value={enderecoComercial}
                    onChange={(e) => setEnderecoComercial(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    placeholder="Local de trabalho"
                  />
                </div>
              </div>

              {/* Segmento e Observações */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Segmento / Atividade
                  </label>
                  <select
                    value={segmentoId}
                    onChange={(e) => setSegmentoId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {segmentos.map(s => (
                      <option key={s.id} value={s.id}>{s.nome_pt}</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Observações
                  </label>
                  <textarea
                    value={observacoesCliente}
                    onChange={(e) => setObservacoesCliente(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Anotações sobre o cliente..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ==================== ABA EMPRÉSTIMO ==================== */}
          {activeTab === 'emprestimo' && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900">
                  Dados do Empréstimo
                </h3>
              </div>

              {/* Rota - só mostra se tiver mais de 1 rota */}
              {rotas.length > 1 && (
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    Rota *
                  </label>
                  <select
                    value={rotaId}
                    onChange={(e) => setRotaId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione a rota</option>
                    {rotas.map(r => (
                      <option key={r.id} value={r.id}>{r.nome} ({r.cidade_nome})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Se só tem 1 rota, mostra info */}
              {rotas.length === 1 && (
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <MapPin className="w-5 h-5 text-blue-500" />
                  <div>
                    <span className="text-sm font-medium text-blue-700">Rota: </span>
                    <span className="text-sm text-blue-600">{rotas[0].nome}</span>
                  </div>
                </div>
              )}

              {/* Valores */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    Valor Principal *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={valorPrincipal}
                      onChange={(e) => setValorPrincipal(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Percent className="w-4 h-4 text-amber-500" />
                    Taxa de Juros *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxaJuros}
                      onChange={(e) => setTaxaJuros(e.target.value)}
                      className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                      placeholder="20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Hash className="w-4 h-4 text-purple-500" />
                    Nº de Parcelas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    placeholder="12"
                  />
                </div>
              </div>

              {/* Frequência e Data */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    Frequência *
                  </label>
                  <select
                    value={frequencia}
                    onChange={(e) => setFrequencia(e.target.value as FrequenciaPagamento)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {FREQUENCIAS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 text-orange-500" />
                    1º Vencimento *
                  </label>
                  <input
                    type="date"
                    value={dataPrimeiroVencimento}
                    onChange={(e) => setDataPrimeiroVencimento(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="w-4 h-4 text-teal-500" />
                    Microseguro
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={microseguroValor}
                      onChange={(e) => setMicroseguroValor(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              {/* Preview do cálculo */}
              {valorPrincipal && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Resumo do Cálculo
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600">Principal:</span>
                      <p className="font-semibold text-blue-900">{calculo.valor_principal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div>
                      <span className="text-blue-600">Juros ({taxaJuros}%):</span>
                      <p className="font-semibold text-blue-900">{calculo.valor_juros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div>
                      <span className="text-blue-600">Total:</span>
                      <p className="font-semibold text-blue-900">{calculo.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div>
                      <span className="text-blue-600">Parcela:</span>
                      <p className="font-semibold text-blue-900">{calculo.valor_parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações do Empréstimo
                </label>
                <textarea
                  value={observacoesEmprestimo}
                  onChange={(e) => setObservacoesEmprestimo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Anotações..."
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* ==================== ABA RESUMO ==================== */}
          {activeTab === 'resumo' && (
            <div className="space-y-6">
              {/* Cliente */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Cliente
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Nome:</span>
                    <p className="font-medium text-gray-900">{nome}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Celular:</span>
                    <p className="font-medium text-gray-900">{ddiCelular} {telefoneCelular}</p>
                  </div>
                  {documento && (
                    <div>
                      <span className="text-gray-500">Documento:</span>
                      <p className="font-medium text-gray-900">{documento}</p>
                    </div>
                  )}
                  {email && (
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <p className="font-medium text-gray-900">{email}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Empréstimo */}
              <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Empréstimo
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Valor Principal:</span>
                    <span className="font-medium">{calculo.valor_principal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Juros ({taxaJuros}%):</span>
                    <span className="font-medium">+ {calculo.valor_juros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between border-t border-green-200 pt-2">
                    <span className="text-green-700 font-medium">Total a Receber:</span>
                    <span className="font-bold text-green-900">{calculo.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>{numeroParcelas}x {frequencia}</span>
                    <span>{calculo.valor_parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              </div>

              {/* Microseguro */}
              {microseguroValor && parseFloat(microseguroValor) > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Microseguro
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Valor:</span>
                    <span className="font-medium">{parseFloat(microseguroValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              )}

              {/* Total Geral */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-lg">TOTAL A RECEBER:</span>
                  <span className="text-3xl font-bold">{totalComMicroseguro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
          >
            Cancelar
          </button>

          <div className="flex gap-3">
            {/* Botão Voltar */}
            {activeTab !== 'cliente' && (isNovoCliente || activeTab === 'resumo') && (
              <button
                onClick={() => setActiveTab(activeTab === 'resumo' ? 'emprestimo' : 'cliente')}
                className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors font-medium"
              >
                Voltar
              </button>
            )}

            {/* Botão Avançar/Salvar */}
            {activeTab !== 'resumo' ? (
              <button
                onClick={() => {
                  if (activeTab === 'cliente') setActiveTab('emprestimo');
                  else setActiveTab('resumo');
                }}
                disabled={activeTab === 'cliente' ? !podeAvancarCliente : !podeAvancarEmprestimo}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Avançar
              </button>
            ) : (
              <button
                onClick={handleSalvar}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />
                Confirmar Venda
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
