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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { clientesService } from '@/services/clientes';
import { createClient } from '@/lib/supabase/client';
import type { 
  Cliente,
  ClienteComTotais, 
  Segmento, 
  RotaSimples, 
  FrequenciaPagamento,
} from '@/types/clientes';

// =====================================================
// CONSTANTES
// =====================================================

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

const FREQUENCIAS: { value: FrequenciaPagamento; label: string; descricao: string }[] = [
  { value: 'DIARIO', label: 'Diário', descricao: 'Parcelas todos os dias úteis' },
  { value: 'SEMANAL', label: 'Semanal', descricao: 'Uma parcela por semana' },
  { value: 'QUINZENAL', label: 'Quinzenal', descricao: 'Parcelas a cada 15 dias' },
  { value: 'MENSAL', label: 'Mensal', descricao: 'Uma parcela por mês' },
  { value: 'FLEXIVEL', label: 'Flexível', descricao: 'Datas personalizadas' },
];

const DIAS_SEMANA = [
  { value: 0, label: 'Domingo', abrev: 'Dom' },
  { value: 1, label: 'Segunda', abrev: 'Seg' },
  { value: 2, label: 'Terça', abrev: 'Ter' },
  { value: 3, label: 'Quarta', abrev: 'Qua' },
  { value: 4, label: 'Quinta', abrev: 'Qui' },
  { value: 5, label: 'Sexta', abrev: 'Sex' },
  { value: 6, label: 'Sábado', abrev: 'Sáb' },
];

// =====================================================
// TIPOS
// =====================================================

type TabType = 'cliente' | 'emprestimo' | 'resumo';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cliente?: Cliente | ClienteComTotais | null;
  segmentos: Segmento[];
  rotas: RotaSimples[];
  empresaId: string;
  userId: string;
  rotaIdContexto?: string | null;
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
  const temEmprestimoAtivo = cliente && 'qtd_emprestimos_ativos' in cliente && cliente.qtd_emprestimos_ativos > 0;
  
  const [activeTab, setActiveTab] = useState<TabType>('cliente');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [uploadingFoto, setUploadingFoto] = useState(false);
  // Verificação de liquidação aberta na rota (apenas aviso no modal)
  const [liquidacaoAberta, setLiquidacaoAberta] = useState<boolean | null>(null);
  const [checandoLiquidacao, setChecandoLiquidacao] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const valorPrincipalRef = useRef<HTMLInputElement>(null);

  // === Dados do Cliente ===
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

  // === Dados do Empréstimo ===
  const [rotaId, setRotaId] = useState('');
  const [valorPrincipal, setValorPrincipal] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState('30');
  const [taxaJuros, setTaxaJuros] = useState('20');
  const [frequencia, setFrequencia] = useState<FrequenciaPagamento>('DIARIO');
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState('');
  const [observacoesEmprestimo, setObservacoesEmprestimo] = useState('');
  
  // === Campos específicos por frequência ===
  const [diaSemanaCobranca, setDiaSemanaCobranca] = useState<number>(1); // Segunda
  const [diaMesCobranca, setDiaMesCobranca] = useState<number>(10);
  const [diasMesCobranca, setDiasMesCobranca] = useState<number[]>([]);
  const [iniciarProximoMes, setIniciarProximoMes] = useState(false);
  
  // === Microseguro ===
  const [temMicroseguro, setTemMicroseguro] = useState(false);
  const [valorMicroseguro, setValorMicroseguro] = useState('');

  // === Cálculos ===
  const valorPrincipalNum = parseFloat(valorPrincipal) || 0;
  const taxaJurosNum = parseFloat(taxaJuros) || 0;
  const numParcelasNum = parseInt(numeroParcelas) || 0;
  const valorJuros = valorPrincipalNum * (taxaJurosNum / 100);
  const valorTotal = valorPrincipalNum + valorJuros;
  const valorParcela = numParcelasNum > 0 ? valorTotal / numParcelasNum : 0;
  const valorMicroseguroNum = temMicroseguro ? (parseFloat(valorMicroseguro) || 0) : 0;

  // Reset ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setActiveTab(isNovoCliente ? 'cliente' : 'emprestimo');
      setErro('');
      
      // Data padrão: amanhã
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      setDataPrimeiroVencimento(amanha.toISOString().split('T')[0]);
      
      if (cliente) {
        setNome(cliente.nome);
        setDocumento(cliente.documento || '');
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
      
      // Rota
      if (rotaIdContexto) {
        setRotaId(rotaIdContexto);
      } else if (rotas.length === 1) {
        setRotaId(rotas[0].id);
      } else {
        setRotaId('');
      }
      
      // Empréstimo
      setValorPrincipal('');
      setNumeroParcelas('30');
      setTaxaJuros('20');
      setFrequencia('DIARIO');
      setObservacoesEmprestimo('');
      setDiaSemanaCobranca(1);
      setDiaMesCobranca(10);
      setDiasMesCobranca([]);
      setIniciarProximoMes(false);
      setTemMicroseguro(false);
      setValorMicroseguro('');
    }
  }, [isOpen, cliente, isNovoCliente, rotas, rotaIdContexto]);

  // Handler para upload de foto
  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingFoto(true);
    try {
      // TODO: Implementar upload real
      const url = URL.createObjectURL(file);
      setFotoUrl(url);
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
    } finally {
      setUploadingFoto(false);
    }
  };

  // Validações
  const validarCliente = () => {
    if (!nome.trim()) return 'Nome é obrigatório';
    if (!telefoneCelular.trim()) return 'Celular é obrigatório';
    return null;
  };

  // Rota selecionada e vendedor
  const rotaSelecionada = rotas.find(r => r.id === rotaId);
  const vendedorId = rotaSelecionada?.vendedor_id;

  // Verifica se a rota tem liquidação aberta (aviso no modal; a FN também valida no backend)
  useEffect(() => {
    if (!isOpen || !rotaId) {
      setLiquidacaoAberta(null);
      return;
    }
    let cancelado = false;
    (async () => {
      setChecandoLiquidacao(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('liquidacoes_diarias')
          .select('id')
          .eq('rota_id', rotaId)
          .in('status', ['ABERTO', 'REABERTO'])
          .limit(1);
        if (!cancelado) {
          setLiquidacaoAberta(!error && Array.isArray(data) && data.length > 0);
        }
      } catch {
        if (!cancelado) setLiquidacaoAberta(null);
      } finally {
        if (!cancelado) setChecandoLiquidacao(false);
      }
    })();
    return () => { cancelado = true; };
  }, [isOpen, rotaId]);

  const validarEmprestimo = () => {
    if (!rotaId) return 'Selecione uma rota';
    if (!vendedorId) return 'A rota selecionada não possui vendedor vinculado. Vincule um vendedor à rota antes de criar empréstimos.';
    if (!valorPrincipal || valorPrincipalNum <= 0) return 'Valor principal é obrigatório';
    if (!numeroParcelas || numParcelasNum <= 0) return 'Número de parcelas é obrigatório';
    if (!taxaJuros) return 'Taxa de juros é obrigatória';
    if (!dataPrimeiroVencimento) return 'Data do primeiro vencimento é obrigatória';
    if (frequencia === 'FLEXIVEL' && diasMesCobranca.length === 0) {
      return 'Selecione pelo menos um dia do mês para cobrança';
    }
    return null;
  };

  // Navegação entre abas
  const irParaEmprestimo = () => {
    if (isNovoCliente) {
      const erro = validarCliente();
      if (erro) {
        setErro(erro);
        return;
      }
    }
    setErro('');
    setActiveTab('emprestimo');
    // Focar no campo de valor principal após renderizar
    setTimeout(() => {
      valorPrincipalRef.current?.focus();
    }, 100);
  };

  const irParaResumo = () => {
    const erro = validarEmprestimo();
    if (erro) {
      setErro(erro);
      return;
    }
    setErro('');
    setActiveTab('resumo');
  };

  // Salvar
  const handleSalvar = async () => {
    setSaving(true);
    setErro('');
    
    try {
      const telefoneCompleto = telefoneCelular ? `${ddiCelular}${telefoneCelular}` : undefined;
      const telefoneFixoCompleto = telefoneFixo ? `${ddiFixo}${telefoneFixo}` : undefined;

      // Determinar qual função usar
      if (isNovoCliente) {
        // Nova venda completa (novo cliente + empréstimo)
        const result = await clientesService.novaVendaCompleta({
          cliente_id: undefined,
          cliente_nome: nome,
          cliente_documento: documento || undefined,
          cliente_telefone: telefoneCompleto,
          cliente_telefone_fixo: telefoneFixoCompleto,
          cliente_email: email || undefined,
          cliente_endereco: endereco || undefined,
          cliente_endereco_comercial: enderecoComercial || undefined,
          cliente_segmento_id: segmentoId || undefined,
          cliente_foto_url: fotoUrl || undefined,
          cliente_observacoes: observacoesCliente || undefined,
          valor_principal: valorPrincipalNum,
          numero_parcelas: numParcelasNum,
          taxa_juros: taxaJurosNum,
          frequencia,
          data_primeiro_vencimento: dataPrimeiroVencimento,
          dia_semana_cobranca: frequencia === 'SEMANAL' ? diaSemanaCobranca : undefined,
          dia_mes_cobranca: frequencia === 'MENSAL' ? diaMesCobranca : undefined,
          dias_mes_cobranca: frequencia === 'FLEXIVEL' ? diasMesCobranca : undefined,
          iniciar_proximo_mes: frequencia === 'FLEXIVEL' ? iniciarProximoMes : false,
          observacoes: observacoesEmprestimo || undefined,
          empresa_id: empresaId,
          rota_id: rotaId,
          vendedor_id: vendedorId,
          user_id: userId,
          latitude: undefined,
          longitude: undefined,
          microseguro_valor: valorMicroseguroNum > 0 ? valorMicroseguroNum : undefined,
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Erro ao criar venda');
        }
      } else if (temEmprestimoAtivo) {
        // Empréstimo adicional
        const result = await clientesService.vendaAdicional({
          cliente_id: cliente!.id,
          valor_principal: valorPrincipalNum,
          numero_parcelas: numParcelasNum,
          taxa_juros: taxaJurosNum,
          frequencia,
          data_primeiro_vencimento: dataPrimeiroVencimento,
          dia_semana_cobranca: frequencia === 'SEMANAL' ? diaSemanaCobranca : undefined,
          dia_mes_cobranca: frequencia === 'MENSAL' ? diaMesCobranca : undefined,
          dias_mes_cobranca: frequencia === 'FLEXIVEL' ? diasMesCobranca : undefined,
          iniciar_proximo_mes: frequencia === 'FLEXIVEL' ? iniciarProximoMes : false,
          observacoes: observacoesEmprestimo || undefined,
          empresa_id: empresaId,
          rota_id: rotaId,
          vendedor_id: vendedorId,
          user_id: userId,
          latitude: undefined,
          longitude: undefined,
          microseguro_valor: valorMicroseguroNum > 0 ? valorMicroseguroNum : undefined,
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Erro ao criar venda adicional');
        }
      } else {
        // Renovação
        const result = await clientesService.renovarEmprestimo({
          cliente_id: cliente!.id,
          valor_principal: valorPrincipalNum,
          numero_parcelas: numParcelasNum,
          taxa_juros: taxaJurosNum,
          frequencia,
          data_primeiro_vencimento: dataPrimeiroVencimento,
          dia_semana_cobranca: frequencia === 'SEMANAL' ? diaSemanaCobranca : undefined,
          dia_mes_cobranca: frequencia === 'MENSAL' ? diaMesCobranca : undefined,
          dias_mes_cobranca: frequencia === 'FLEXIVEL' ? diasMesCobranca : undefined,
          iniciar_proximo_mes: frequencia === 'FLEXIVEL' ? iniciarProximoMes : false,
          observacoes: observacoesEmprestimo || undefined,
          empresa_id: empresaId,
          rota_id: rotaId,
          vendedor_id: vendedorId,
          user_id: userId,
          latitude: undefined,
          longitude: undefined,
          microseguro_valor: valorMicroseguroNum > 0 ? valorMicroseguroNum : undefined,
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Erro ao renovar empréstimo');
        }
      }
      
      onSucesso();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setErro(error.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // Toggle dia flexível
  const toggleDiaFlexivel = (dia: number) => {
    setDiasMesCobranca(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia)
        : [...prev, dia].sort((a, b) => a - b)
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3">
            {fotoUrl ? (
              <img src={fotoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white/30" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-white">
                {isNovoCliente ? 'Novo Cliente' : temEmprestimoAtivo ? 'Venda Adicional' : 'Renovação'}
              </h2>
              {cliente && (
                <div className="flex items-center gap-2 text-blue-100 text-sm">
                  <span className="bg-white/20 px-2 py-0.5 rounded font-mono">#{cliente.codigo_cliente}</span>
                  <span>{cliente.nome}</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => isNovoCliente && setActiveTab('cliente')}
            disabled={!isNovoCliente}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'cliente'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : isNovoCliente 
                  ? 'text-gray-500 hover:text-gray-700' 
                  : 'text-gray-400 cursor-not-allowed'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              activeTab === 'cliente' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
            }`}>1</span>
            Cliente
          </button>
          <button
            onClick={() => setActiveTab('emprestimo')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'emprestimo'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              activeTab === 'emprestimo' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
            }`}>2</span>
            Empréstimo
          </button>
          <button
            onClick={() => setActiveTab('resumo')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'resumo'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              activeTab === 'resumo' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-white'
            }`}>3</span>
            Resumo
          </button>
        </div>

        {/* Erro */}
        {rotaId && liquidacaoAberta === false && !checandoLiquidacao && (
          <div className="mx-6 mt-4 flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Esta rota não tem uma liquidação aberta. É necessário abrir o dia (liquidação) antes de registrar a venda.
            </p>
          </div>
        )}

        {erro && (
          <div className="mx-6 mt-4 flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{erro}</p>
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* === TAB CLIENTE === */}
          {activeTab === 'cliente' && (
            <div className="space-y-5">
              {/* Foto */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className={`w-24 h-24 rounded-full border-4 border-dashed ${fotoUrl ? 'border-blue-300' : 'border-gray-300'} flex items-center justify-center overflow-hidden bg-gray-50`}>
                    {fotoUrl ? (
                      <img src={fotoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFotoUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFoto}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
                  >
                    {uploadingFoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </button>
                  {fotoUrl && (
                    <button
                      onClick={() => setFotoUrl('')}
                      className="absolute top-0 right-0 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Nome */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4 text-gray-500" />
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do cliente"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Documento */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  Documento (CPF/RG)
                </label>
                <input
                  type="text"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Telefones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    Celular *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={ddiCelular}
                      onChange={(e) => setDdiCelular(e.target.value)}
                      className="w-24 flex-shrink-0 px-2 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      {DDIS.map(d => (
                        <option key={d.codigo} value={d.codigo}>{d.bandeira} {d.codigo}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={telefoneCelular}
                      onChange={(e) => setTelefoneCelular(e.target.value)}
                      placeholder="99999-9999"
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white overflow-hidden">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 text-gray-500" />
                    Telefone Fixo
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={ddiFixo}
                      onChange={(e) => setDdiFixo(e.target.value)}
                      className="w-24 flex-shrink-0 px-2 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      {DDIS.map(d => (
                        <option key={d.codigo} value={d.codigo}>{d.bandeira} {d.codigo}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      value={telefoneFixo}
                      onChange={(e) => setTelefoneFixo(e.target.value)}
                      placeholder="3333-4444"
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 text-gray-500" />
                  E-mail
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Endereços */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    Endereço Residencial
                  </label>
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    placeholder="Rua, número, bairro..."
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    placeholder="Rua, número, bairro..."
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Segmento */}
              {segmentos.length > 0 && (
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Segmento</label>
                  <select
                    value={segmentoId}
                    onChange={(e) => setSegmentoId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione um segmento</option>
                    {segmentos.map(s => (
                      <option key={s.id} value={s.id}>{s.nome_pt}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Observações */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea
                  value={observacoesCliente}
                  onChange={(e) => setObservacoesCliente(e.target.value)}
                  rows={2}
                  placeholder="Anotações sobre o cliente..."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* === TAB EMPRÉSTIMO === */}
          {activeTab === 'emprestimo' && (
            <div className="space-y-5">
              {/* Rota */}
              {rotas.length > 1 && (
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    Rota *
                  </label>
                  <select
                    value={rotaId}
                    onChange={(e) => setRotaId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione uma rota</option>
                    {rotas.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.nome} {r.vendedor_nome ? `(${r.vendedor_nome})` : '⚠️ Sem vendedor'}
                      </option>
                    ))}
                  </select>
                  {/* Feedback sobre vendedor */}
                  {rotaId && rotaSelecionada && (
                    <div className={`mt-2 text-sm flex items-center gap-2 ${vendedorId ? 'text-green-600' : 'text-red-600'}`}>
                      {vendedorId ? (
                        <>
                          <Check className="w-4 h-4" />
                          Vendedor: {rotaSelecionada.vendedor_nome}
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          Esta rota não possui vendedor vinculado
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              {rotas.length === 1 && (
                <div className={`p-4 rounded-xl border-2 ${rotas[0].vendedor_id ? 'border-blue-100 bg-blue-50' : 'border-red-100 bg-red-50'}`}>
                  <div className={`flex items-center gap-2 ${rotas[0].vendedor_id ? 'text-blue-700' : 'text-red-700'}`}>
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium">Rota: {rotas[0].nome}</span>
                    {rotas[0].vendedor_nome && (
                      <span className="text-sm">• Vendedor: {rotas[0].vendedor_nome}</span>
                    )}
                  </div>
                  {!rotas[0].vendedor_id && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Esta rota não possui vendedor vinculado. Vincule um vendedor antes de continuar.
                    </p>
                  )}
                </div>
              )}

              {/* Valor e Parcelas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    Valor Principal *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      ref={valorPrincipalRef}
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorPrincipal}
                      onChange={(e) => setValorPrincipal(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Hash className="w-4 h-4 text-gray-500" />
                    Nº Parcelas *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <Percent className="w-4 h-4 text-gray-500" />
                    Taxa Juros (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={taxaJuros}
                    onChange={(e) => setTaxaJuros(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Frequência */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Frequência de Pagamento *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {FREQUENCIAS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setFrequencia(f.value)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        frequencia === f.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-medium text-sm">{f.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Primeiro Vencimento */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  Data do 1º Vencimento *
                </label>
                <input
                  type="date"
                  value={dataPrimeiroVencimento}
                  onChange={(e) => setDataPrimeiroVencimento(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Opções específicas por frequência */}
              {frequencia === 'SEMANAL' && (
                <div className="p-4 rounded-xl border-2 border-blue-100 bg-blue-50">
                  <label className="block text-sm font-medium text-blue-700 mb-3">
                    Dia da Semana para Cobrança
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DIAS_SEMANA.map(dia => (
                      <button
                        key={dia.value}
                        onClick={() => setDiaSemanaCobranca(dia.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          diaSemanaCobranca === dia.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {dia.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {frequencia === 'MENSAL' && (
                <div className="p-4 rounded-xl border-2 border-blue-100 bg-blue-50">
                  <label className="block text-sm font-medium text-blue-700 mb-3">
                    Dia do Mês para Vencimento
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(dia => (
                      <button
                        key={dia}
                        onClick={() => setDiaMesCobranca(dia)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                          diaMesCobranca === dia
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'
                        }`}
                      >
                        {dia}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {frequencia === 'FLEXIVEL' && (
                <div className="p-4 rounded-xl border-2 border-purple-100 bg-purple-50">
                  <label className="block text-sm font-medium text-purple-700 mb-3">
                    Selecione os Dias do Mês para Cobrança
                  </label>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(dia => (
                      <button
                        key={dia}
                        onClick={() => toggleDiaFlexivel(dia)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                          diasMesCobranca.includes(dia)
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-100'
                        }`}
                      >
                        {dia}
                      </button>
                    ))}
                  </div>
                  {diasMesCobranca.length > 0 && (
                    <p className="text-sm text-purple-600 mb-3">
                      Dias selecionados: <strong>{diasMesCobranca.join(', ')}</strong>
                    </p>
                  )}
                  <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-purple-200">
                    <input
                      type="checkbox"
                      checked={iniciarProximoMes}
                      onChange={(e) => setIniciarProximoMes(e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-purple-700">
                      Iniciar cobrança somente a partir do próximo mês
                    </span>
                  </label>
                </div>
              )}

              {/* Microseguro */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                <label className="flex items-center gap-3 mb-3">
                  <input
                    type="checkbox"
                    checked={temMicroseguro}
                    onChange={(e) => setTemMicroseguro(e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Incluir Microseguro</span>
                </label>
                {temMicroseguro && (
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorMicroseguro}
                      onChange={(e) => setValorMicroseguro(e.target.value)}
                      placeholder="Valor do microseguro"
                      className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Observações */}
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
                <label className="block text-sm font-medium text-gray-700 mb-2">Observações do Empréstimo</label>
                <textarea
                  value={observacoesEmprestimo}
                  onChange={(e) => setObservacoesEmprestimo(e.target.value)}
                  rows={2}
                  placeholder="Anotações sobre o empréstimo..."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* === TAB RESUMO === */}
          {activeTab === 'resumo' && (
            <div className="space-y-5">
              {/* Info Cliente */}
              <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  {isNovoCliente ? 'Novo Cliente' : 'Cliente'}
                </h3>
                <div className="space-y-1 text-sm">
                  {cliente && (
                    <p className="text-gray-600">Código: <span className="font-mono font-medium">#{cliente.codigo_cliente}</span></p>
                  )}
                  <p className="text-gray-600">Nome: <span className="font-medium text-gray-900">{nome}</span></p>
                  {documento && <p className="text-gray-600">Documento: <span className="font-medium text-gray-900">{documento}</span></p>}
                  {telefoneCelular && <p className="text-gray-600">Celular: <span className="font-medium text-gray-900">{ddiCelular} {telefoneCelular}</span></p>}
                </div>
              </div>

              {/* Info Empréstimo */}
              <div className="p-5 rounded-xl bg-blue-50 border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Empréstimo
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-600">Valor Principal</p>
                    <p className="font-bold text-blue-900 text-lg">
                      {valorPrincipalNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-600">Juros ({taxaJuros}%)</p>
                    <p className="font-bold text-blue-900 text-lg">
                      {valorJuros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-600">Total a Pagar</p>
                    <p className="font-bold text-blue-900 text-lg">
                      {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-600">Valor da Parcela</p>
                    <p className="font-bold text-blue-900 text-lg">
                      {valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-blue-200 text-sm">
                  <p className="text-blue-700">
                    <strong>{numeroParcelas}x</strong> de <strong>{valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong> • 
                    Frequência: <strong>{FREQUENCIAS.find(f => f.value === frequencia)?.label}</strong>
                  </p>
                  <p className="text-blue-600 mt-1">
                    1º Vencimento: <strong>{new Date(dataPrimeiroVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                  </p>
                  {frequencia === 'SEMANAL' && (
                    <p className="text-blue-600">Dia: <strong>{DIAS_SEMANA.find(d => d.value === diaSemanaCobranca)?.label}</strong></p>
                  )}
                  {frequencia === 'MENSAL' && (
                    <p className="text-blue-600">Dia do mês: <strong>{diaMesCobranca}</strong></p>
                  )}
                  {frequencia === 'FLEXIVEL' && (
                    <p className="text-blue-600">Dias: <strong>{diasMesCobranca.join(', ')}</strong></p>
                  )}
                  {rotaSelecionada && (
                    <p className="text-blue-600">Rota: <strong>{rotaSelecionada.nome}</strong></p>
                  )}
                </div>
              </div>

              {/* Microseguro */}
              {temMicroseguro && valorMicroseguroNum > 0 && (
                <div className="p-5 rounded-xl bg-purple-50 border border-purple-200">
                  <h3 className="font-semibold text-purple-900 mb-2">Microseguro</h3>
                  <p className="text-2xl font-bold text-purple-700">
                    {valorMicroseguroNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              )}

              {/* Total Geral */}
              <div className="p-5 rounded-xl bg-green-50 border border-green-200">
                <h3 className="font-semibold text-green-900 mb-2">Total Geral</h3>
                <p className="text-3xl font-bold text-green-700">
                  {(valorTotal + valorMicroseguroNum).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              if (activeTab === 'emprestimo' && isNovoCliente) setActiveTab('cliente');
              else if (activeTab === 'resumo') setActiveTab('emprestimo');
              else onClose();
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {activeTab === 'cliente' ? 'Cancelar' : 'Voltar'}
          </button>

          {activeTab === 'cliente' && (
            <button
              onClick={irParaEmprestimo}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {activeTab === 'emprestimo' && (
            <button
              onClick={irParaResumo}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {activeTab === 'resumo' && (
            <button
              onClick={handleSalvar}
              disabled={saving || liquidacaoAberta === false}
              title={liquidacaoAberta === false ? 'É necessário ter uma liquidação aberta nesta rota para registrar a venda' : undefined}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirmar Venda
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}