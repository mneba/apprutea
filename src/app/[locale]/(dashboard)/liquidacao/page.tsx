'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Clock,
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  CreditCard,
  Receipt,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Calendar,
  MapPin,
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  Shield,
  Banknote,
  ArrowRightLeft,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { liquidacaoService } from '@/services/liquidacao';
import type {
  LiquidacaoDiaria,
  VendedorLiquidacao,
  RotaLiquidacao,
  ClienteDoDia,
  EstatisticasClientesDia,
  STATUS_LIQUIDACAO_COLORS,
} from '@/types/liquidacao';

// =====================================================
// HELPERS
// =====================================================

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

function formatarDataHora(dataISO: string): string {
  if (!dataISO) return '-';
  return new Date(dataISO).toLocaleString('pt-BR');
}

function formatarHora(dataISO: string): string {
  if (!dataISO) return '-';
  return new Date(dataISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

function BadgeStatus({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    ABERTO: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Aberto' },
    FECHADO: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Fechado' },
    APROVADO: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Aprovado' },
    REABERTO: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Reaberto' },
  };

  const statusConfig = config[status] || config.FECHADO;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.text}`}>
      <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
      {statusConfig.label}
    </span>
  );
}

function CardFinanceiro({
  titulo,
  valor,
  subtitulo,
  icone: Icone,
  corBorda,
}: {
  titulo: string;
  valor: string;
  subtitulo: string;
  icone: React.ElementType;
  corBorda: string;
}) {
  return (
    <div className={`bg-white rounded-xl border-l-4 ${corBorda} p-4 shadow-sm`}>
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
        <Icone className="w-4 h-4" />
        <span>{titulo}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{valor}</p>
      <p className="text-xs text-gray-500 mt-1">{subtitulo}</p>
    </div>
  );
}

function CardOperacao({
  titulo,
  valor,
  icone: Icone,
  corFundo,
  corTexto,
  prefixo = '',
}: {
  titulo: string;
  valor: number;
  icone: React.ElementType;
  corFundo: string;
  corTexto: string;
  prefixo?: string;
}) {
  return (
    <div className={`${corFundo} rounded-xl p-3 flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        <Icone className={`w-4 h-4 ${corTexto}`} />
        <span className={`text-sm font-medium ${corTexto}`}>{titulo}</span>
      </div>
      <span className={`font-semibold ${corTexto}`}>
        {prefixo}{formatarMoeda(valor)}
      </span>
    </div>
  );
}

function ProgressBar({ percentual }: { percentual: number }) {
  const cor = percentual >= 100 ? 'bg-green-500' : percentual >= 70 ? 'bg-blue-500' : percentual >= 50 ? 'bg-amber-500' : 'bg-red-500';
  
  return (
    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
      <div 
        className={`h-full ${cor} transition-all duration-500`}
        style={{ width: `${Math.min(100, percentual)}%` }}
      />
    </div>
  );
}

function BadgeClienteStatus({ 
  icone: Icone, 
  label, 
  valor, 
  corIcone,
  ativo,
  onClick,
}: { 
  icone: React.ElementType; 
  label: string; 
  valor: number;
  corIcone: string;
  ativo?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors ${
        ativo ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-600'
      }`}
    >
      <Icone className={`w-3.5 h-3.5 ${corIcone}`} />
      <span>{label}</span>
      <span className="font-medium">({valor})</span>
    </button>
  );
}

// =====================================================
// MODAL DE ABERTURA
// =====================================================

function ModalAbrirLiquidacao({
  isOpen,
  onClose,
  onConfirmar,
  loading,
  saldoSugerido,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (caixaInicial: number) => void;
  loading: boolean;
  saldoSugerido: number;
}) {
  const [caixaInicial, setCaixaInicial] = useState(saldoSugerido.toString());

  useEffect(() => {
    setCaixaInicial(saldoSugerido.toString());
  }, [saldoSugerido]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Play className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Abrir Liquidação</h2>
            <p className="text-sm text-gray-500">Iniciar sessão de trabalho</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Caixa Inicial (R$)
            </label>
            <input
              type="number"
              value={caixaInicial}
              onChange={(e) => setCaixaInicial(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-semibold"
              placeholder="0,00"
              step="0.01"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Saldo sugerido da conta: {formatarMoeda(saldoSugerido)}
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">
                Certifique-se de que o valor do caixa inicial corresponde ao dinheiro físico que você possui.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(Number(caixaInicial) || 0)}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Play className="w-5 h-5" />
                Abrir Dia
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MODAL DE FECHAMENTO
// =====================================================

function ModalFecharLiquidacao({
  isOpen,
  onClose,
  onConfirmar,
  loading,
  liquidacao,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (observacoes: string) => void;
  loading: boolean;
  liquidacao: LiquidacaoDiaria | null;
}) {
  const [observacoes, setObservacoes] = useState('');

  if (!isOpen || !liquidacao) return null;

  const diferenca = (liquidacao.caixa_final || 0) - (liquidacao.caixa_inicial || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Square className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Fechar Liquidação</h2>
            <p className="text-sm text-gray-500">Encerrar sessão de trabalho</p>
          </div>
        </div>

        {/* Resumo */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">Caixa Inicial</span>
            <span className="font-semibold">{formatarMoeda(liquidacao.caixa_inicial)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">Caixa Final</span>
            <span className="font-semibold">{formatarMoeda(liquidacao.caixa_final)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">Recebido no Dia</span>
            <span className="font-semibold text-green-600">{formatarMoeda(liquidacao.valor_recebido_dia)}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b">
            <span className="text-gray-600">Emprestado no Dia</span>
            <span className="font-semibold text-blue-600">{formatarMoeda(liquidacao.total_emprestado_dia)}</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600 font-medium">Diferença</span>
            <span className={`font-bold ${diferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {diferenca >= 0 ? '+' : ''}{formatarMoeda(diferenca)}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observações (opcional)
          </label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
            placeholder="Alguma observação sobre o dia..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(observacoes)}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Square className="w-5 h-5" />
                Fechar Dia
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// TELA SEM LIQUIDAÇÃO ABERTA
// =====================================================

function TelaIniciarDia({
  vendedor,
  rota,
  saldoConta,
  onAbrir,
  loading,
}: {
  vendedor: VendedorLiquidacao;
  rota: RotaLiquidacao;
  saldoConta: number;
  onAbrir: () => void;
  loading: boolean;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Play className="w-10 h-10 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Iniciar o Dia</h2>
        <p className="text-gray-500 mb-6">
          Nenhuma liquidação aberta encontrada. Inicie sua sessão de trabalho.
        </p>

        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-blue-600">
                {vendedor.nome.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{vendedor.nome}</p>
              <p className="text-sm text-gray-500">{rota.nome}</p>
            </div>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Saldo disponível:</span>
            <span className="font-semibold text-green-600">{formatarMoeda(saldoConta)}</span>
          </div>
        </div>

        <button
          onClick={onAbrir}
          disabled={loading}
          className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Play className="w-6 h-6" />
              Abrir Liquidação
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

export default function LiquidacaoDiariaPage() {
  const { profile, localizacao } = useUser();
  const userId = profile?.user_id;
  const rotaIdContexto = localizacao?.rota_id;
  const empresaId = localizacao?.empresa_id;
  
  // DEBUG: Ver estrutura completa do contexto
  console.log('=== DEBUG CONTEXTO ===');
  console.log('profile:', profile);
  console.log('localizacao completo:', localizacao);
  console.log('rotaIdContexto:', rotaIdContexto);
  console.log('empresaId:', empresaId);

  // States principais
  const [vendedor, setVendedor] = useState<VendedorLiquidacao | null>(null);
  const [rota, setRota] = useState<RotaLiquidacao | null>(null);
  const [liquidacao, setLiquidacao] = useState<LiquidacaoDiaria | null>(null);
  const [saldoConta, setSaldoConta] = useState(0);
  const [clientesDia, setClientesDia] = useState<ClienteDoDia[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasClientesDia | null>(null);
  const [semRotaSelecionada, setSemRotaSelecionada] = useState(false);
  
  // States de operações
  const [movimentacoes, setMovimentacoes] = useState({ receitas: 0, despesas: 0, retiradas: 0 });
  const [emprestimos, setEmprestimos] = useState({ total: 0, quantidade: 0, novos: 0, renovacoes: 0 });
  const [metaDia, setMetaDia] = useState(0);
  
  // States de UI
  const [loading, setLoading] = useState(true);
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalFechar, setModalFechar] = useState(false);
  const [filtroCliente, setFiltroCliente] = useState<string | null>(null);

  // Carregar dados iniciais
  const carregarDados = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setSemRotaSelecionada(false);
    
    const tipoUsuario = profile?.tipo_usuario;
    console.log('=== carregarDados ===');
    console.log('userId:', userId);
    console.log('tipoUsuario:', tipoUsuario);
    console.log('rotaIdContexto:', rotaIdContexto);
    
    try {
      let rotaId: string | null = null;
      let vendedorData: VendedorLiquidacao | null = null;
      let rotaData: RotaLiquidacao | null = null;

      // Se é vendedor, buscar sua rota
      if (tipoUsuario === 'VENDEDOR') {
        vendedorData = await liquidacaoService.buscarVendedorPorUserId(userId);
        console.log('vendedorData:', vendedorData);
        
        if (vendedorData) {
          rotaData = await liquidacaoService.buscarRotaVendedor(vendedorData.id);
          rotaId = rotaData?.id || null;
          console.log('Rota do vendedor:', rotaData);
        }
      }
      
      // Se não é vendedor ou não achou rota, usar contexto
      if (!rotaId && rotaIdContexto) {
        rotaId = rotaIdContexto;
        console.log('Usando rota do contexto:', rotaIdContexto);
        
        // Buscar dados da rota pelo ID do contexto (passando empresa_id para RLS)
        rotaData = await liquidacaoService.buscarRotaPorId(rotaIdContexto, empresaId || undefined);
        console.log('rotaData via buscarRotaPorId:', rotaData);
        
        // Buscar vendedor vinculado a essa rota (se existir)
        if (rotaData) {
          vendedorData = await liquidacaoService.buscarVendedorDaRota(rotaIdContexto);
          console.log('vendedorData da rota:', vendedorData);
        }
      }

      // Se não tem rota de nenhuma forma
      if (!rotaId || !rotaData) {
        console.log('Nenhuma rota encontrada - rotaId:', rotaId, 'rotaData:', rotaData);
        setSemRotaSelecionada(true);
        setLoading(false);
        return;
      }

      setVendedor(vendedorData);
      setRota(rotaData);

      // Buscar saldo da conta
      const contaData = await liquidacaoService.buscarSaldoContaRota(rotaId);
      setSaldoConta(contaData?.saldo_atual || 0);

      // Buscar liquidação aberta
      const liquidacaoData = await liquidacaoService.buscarLiquidacaoAberta(rotaId);
      setLiquidacao(liquidacaoData);
      console.log('liquidacaoData:', liquidacaoData);

      if (liquidacaoData) {
        // Buscar dados complementares
        await carregarDadosLiquidacao(liquidacaoData, rotaId);
      }

      // Buscar meta
      const meta = await liquidacaoService.buscarMetaRota(rotaId);
      setMetaDia(meta);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, rotaIdContexto, profile?.tipo_usuario]);

  // Carregar dados específicos da liquidação
  const carregarDadosLiquidacao = async (liq: LiquidacaoDiaria, rotaId: string) => {
    try {
      // Data de vencimento = data de abertura da liquidação
      const dataVencimento = liq.data_abertura.split('T')[0];
      
      // Clientes do dia
      const clientes = await liquidacaoService.buscarClientesDoDia(rotaId, dataVencimento);
      setClientesDia(clientes);
      setEstatisticas(liquidacaoService.calcularEstatisticasClientesDia(clientes));

      // Movimentações
      const mov = await liquidacaoService.buscarMovimentacoesDoDia(liq.id);
      setMovimentacoes(mov);

      // Empréstimos
      const emp = await liquidacaoService.buscarEmprestimosDoDia(liq.id);
      setEmprestimos(emp);

    } catch (error) {
      console.error('Erro ao carregar dados da liquidação:', error);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Abrir liquidação
  const handleAbrirLiquidacao = async (caixaInicial: number) => {
    if (!rota || !userId) return;
    
    setLoadingAcao(true);
    try {
      const resultado = await liquidacaoService.abrirLiquidacao({
        vendedor_id: vendedor?.id || '', // Pode ser vazio se admin está abrindo
        rota_id: rota.id,
        caixa_inicial: caixaInicial,
        user_id: userId,
      });

      if (resultado.sucesso && resultado.liquidacao_id) {
        // Recarregar dados
        await carregarDados();
        setModalAbrir(false);
      } else {
        alert(resultado.mensagem);
      }
    } catch (error) {
      console.error('Erro ao abrir liquidação:', error);
      alert('Erro ao abrir liquidação');
    } finally {
      setLoadingAcao(false);
    }
  };

  // Fechar liquidação
  const handleFecharLiquidacao = async (observacoes: string) => {
    if (!liquidacao || !userId) return;
    
    setLoadingAcao(true);
    try {
      const resultado = await liquidacaoService.fecharLiquidacao({
        liquidacao_id: liquidacao.id,
        user_id: userId,
        observacoes,
      });

      if (resultado.sucesso) {
        // Recarregar dados
        await carregarDados();
        setModalFechar(false);
      } else {
        alert(resultado.mensagem);
      }
    } catch (error) {
      console.error('Erro ao fechar liquidação:', error);
      alert('Erro ao fechar liquidação');
    } finally {
      setLoadingAcao(false);
    }
  };

  // Loading inicial
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  // Sem rota selecionada
  if (semRotaSelecionada || !rota) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Selecione uma Rota</h2>
        <p className="text-gray-500 text-center max-w-md">
          Selecione uma rota no menu superior para visualizar a liquidação diária.
        </p>
      </div>
    );
  }

  // Sem liquidação aberta - mostrar tela de iniciar
  if (!liquidacao) {
    // Se não tem vendedor, criar um placeholder
    const vendedorExibicao = vendedor || {
      id: '',
      nome: 'Sem vendedor vinculado',
      codigo_vendedor: '-',
      status: 'INATIVO',
    };
    
    return (
      <>
        <TelaIniciarDia
          vendedor={vendedorExibicao}
          rota={rota}
          saldoConta={saldoConta}
          onAbrir={() => setModalAbrir(true)}
          loading={loadingAcao}
        />
        
        <ModalAbrirLiquidacao
          isOpen={modalAbrir}
          onClose={() => setModalAbrir(false)}
          onConfirmar={handleAbrirLiquidacao}
          loading={loadingAcao}
          saldoSugerido={saldoConta}
        />
      </>
    );
  }

  // Calcular valores derivados
  const percentualMeta = metaDia > 0 
    ? Math.round((liquidacao.valor_recebido_dia / metaDia) * 100) 
    : 0;
  
  const efetividade = (liquidacao.pagamentos_pagos + liquidacao.pagamentos_nao_pagos) > 0
    ? Math.round((liquidacao.pagamentos_pagos / (liquidacao.pagamentos_pagos + liquidacao.pagamentos_nao_pagos)) * 100)
    : 0;

  const carteiraCrescimento = (liquidacao.carteira_final || 0) - (liquidacao.carteira_inicial || 0);

  // =====================================================
  // RENDER PRINCIPAL
  // =====================================================

  return (
    <div className="space-y-6">
      {/* HEADER - Vendedor e Meta */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card do Vendedor */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {vendedor?.nome?.charAt(0) || rota.nome.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{vendedor?.nome || 'Vendedor não vinculado'}</h2>
                <p className="text-gray-500 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {rota.nome}
                  {vendedor?.telefone && (
                    <>
                      <Phone className="w-4 h-4 ml-2" />
                      {vendedor.telefone}
                    </>
                  )}
                </p>
              </div>
            </div>
            
            {/* Botão Fechar Dia */}
            {liquidacao.status === 'ABERTO' && (
              <button
                onClick={() => setModalFechar(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                <Square className="w-4 h-4" />
                Fechar Dia
              </button>
            )}
          </div>

          {/* Meta e Progresso */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">META</p>
              <p className="text-2xl font-bold text-gray-900">{formatarMoeda(metaDia)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">ATUAL</p>
              <p className="text-2xl font-bold text-blue-600">{formatarMoeda(liquidacao.valor_recebido_dia)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-500">PROGRESSO</p>
              <p className="text-2xl font-bold text-gray-900">{percentualMeta}%</p>
            </div>
          </div>

          <ProgressBar percentual={percentualMeta} />
        </div>

        {/* Card Horários da Sessão */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Horários da Sessão
          </h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Data de início</span>
              <span className="font-medium">{formatarDataHora(liquidacao.data_abertura)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Data de término</span>
              <span className="font-medium">{liquidacao.data_fechamento ? formatarDataHora(liquidacao.data_fechamento) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Última atualização</span>
              <span className="font-medium">{formatarDataHora(liquidacao.updated_at)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-gray-500">Status da Sessão</span>
              <BadgeStatus status={liquidacao.status} />
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLES FINANCEIROS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cards Financeiros (2 colunas) */}
        <div className="lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Controles Financeiros</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardFinanceiro
              titulo="Caixa"
              valor={formatarMoeda(liquidacao.caixa_final)}
              subtitulo={`Inicial: ${formatarMoeda(liquidacao.caixa_inicial)} | Final: ${formatarMoeda(liquidacao.caixa_final)}`}
              icone={Wallet}
              corBorda="border-blue-500"
            />
            <CardFinanceiro
              titulo="Carteira"
              valor={formatarMoeda(liquidacao.carteira_final)}
              subtitulo={`Inicial: ${formatarMoeda(liquidacao.carteira_inicial)} | Crescimento: ${carteiraCrescimento >= 0 ? '+' : ''}${formatarMoeda(carteiraCrescimento)}`}
              icone={TrendingUp}
              corBorda="border-green-500"
            />
            <CardFinanceiro
              titulo="Recaudo do dia"
              valor={formatarMoeda(liquidacao.valor_recebido_dia)}
              subtitulo={`Dinheiro: ${formatarMoeda(liquidacao.valor_recebido_dinheiro || 0)} | Transferência: ${formatarMoeda(liquidacao.valor_recebido_transferencia || 0)}`}
              icone={DollarSign}
              corBorda="border-emerald-500"
            />
            <CardFinanceiro
              titulo="Pagamentos"
              valor={`${liquidacao.pagamentos_pagos} Pagos`}
              subtitulo={`Não pagos: ${liquidacao.pagamentos_nao_pagos} | Efetividade ${efetividade}%`}
              icone={CheckCircle}
              corBorda="border-purple-500"
            />
          </div>
        </div>

        {/* Outras Operações (1 coluna) */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Outras Operações</h3>
          <div className="space-y-3">
            <CardOperacao
              titulo="Vendas"
              valor={emprestimos.total}
              icone={CreditCard}
              corFundo="bg-green-50"
              corTexto="text-green-700"
            />
            <CardOperacao
              titulo="Receitas"
              valor={movimentacoes.receitas}
              icone={ArrowUpRight}
              corFundo="bg-amber-50"
              corTexto="text-amber-700"
              prefixo="+ "
            />
            <CardOperacao
              titulo="Retiradas"
              valor={movimentacoes.retiradas}
              icone={ArrowDownRight}
              corFundo="bg-amber-50"
              corTexto="text-amber-700"
              prefixo="- "
            />
            <CardOperacao
              titulo="Despesas"
              valor={movimentacoes.despesas}
              icone={Receipt}
              corFundo="bg-red-50"
              corTexto="text-red-700"
              prefixo="- "
            />
          </div>
          
          <div className="mt-3 p-3 bg-gray-50 rounded-xl">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Empréstimos:</span>
              <span className="font-semibold">{formatarMoeda(liquidacao.total_emprestado_dia)}</span>
            </div>
          </div>

          {/* Microseguro */}
          <div className="mt-4 bg-teal-50 rounded-xl p-4 border border-teal-200">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-teal-600" />
              <span className="font-semibold text-teal-800">MICRO SEGURO</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-teal-600">Receitas Seguro</p>
                <p className="font-semibold text-teal-800">{formatarMoeda(liquidacao.total_microseguro_dia)}</p>
              </div>
              <div>
                <p className="text-teal-600">Retiros Seguros</p>
                <p className="font-semibold text-teal-800">- R$ 0,00</p>
              </div>
              <div>
                <p className="text-teal-600">Caixa Seguro</p>
                <p className="font-semibold text-teal-800">{formatarMoeda(liquidacao.total_microseguro_dia)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LISTA DE CLIENTES */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Lista de Clientes</h3>
          <span className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
            {clientesDia.length} Clientes
          </span>
        </div>

        {/* Filtros de Status */}
        <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b">
          <span className="text-sm text-gray-500">Status:</span>
          <BadgeClienteStatus
            icone={CheckCircle}
            label="Sincronizados"
            valor={estatisticas?.sincronizados || 0}
            corIcone="text-green-500"
            ativo={filtroCliente === 'SINCRONIZADOS'}
            onClick={() => setFiltroCliente(filtroCliente === 'SINCRONIZADOS' ? null : 'SINCRONIZADOS')}
          />
          <BadgeClienteStatus
            icone={Users}
            label="Novos"
            valor={estatisticas?.novos || 0}
            corIcone="text-blue-500"
            ativo={filtroCliente === 'NOVOS'}
            onClick={() => setFiltroCliente(filtroCliente === 'NOVOS' ? null : 'NOVOS')}
          />
          <BadgeClienteStatus
            icone={RefreshCw}
            label="Renovados"
            valor={estatisticas?.renovados || 0}
            corIcone="text-purple-500"
            ativo={filtroCliente === 'RENOVADOS'}
            onClick={() => setFiltroCliente(filtroCliente === 'RENOVADOS' ? null : 'RENOVADOS')}
          />
          <BadgeClienteStatus
            icone={XCircle}
            label="Cancelado"
            valor={estatisticas?.cancelados || 0}
            corIcone="text-red-500"
            ativo={filtroCliente === 'CANCELADOS'}
            onClick={() => setFiltroCliente(filtroCliente === 'CANCELADOS' ? null : 'CANCELADOS')}
          />
          <BadgeClienteStatus
            icone={Banknote}
            label="Dinheiro"
            valor={estatisticas?.pagos_dinheiro || 0}
            corIcone="text-green-600"
            ativo={filtroCliente === 'DINHEIRO'}
            onClick={() => setFiltroCliente(filtroCliente === 'DINHEIRO' ? null : 'DINHEIRO')}
          />
          <BadgeClienteStatus
            icone={ArrowRightLeft}
            label="Transferência"
            valor={estatisticas?.pagos_transferencia || 0}
            corIcone="text-blue-600"
            ativo={filtroCliente === 'TRANSFERENCIA'}
            onClick={() => setFiltroCliente(filtroCliente === 'TRANSFERENCIA' ? null : 'TRANSFERENCIA')}
          />
        </div>

        {/* Lista de Clientes */}
        {clientesDia.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {clientesDia.map((cliente) => (
              <div
                key={cliente.parcela_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    cliente.status_dia === 'PAGO' ? 'bg-green-100' : 
                    cliente.status_dia === 'VENCIDO' ? 'bg-red-100' : 'bg-gray-200'
                  }`}>
                    {cliente.status_dia === 'PAGO' ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : cliente.status_dia === 'VENCIDO' ? (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{cliente.cliente_nome}</p>
                    <p className="text-sm text-gray-500">Parcela {cliente.numero_parcela}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatarMoeda(cliente.valor_parcela)}</p>
                  {cliente.valor_pago > 0 && (
                    <p className="text-sm text-green-600">Pago: {formatarMoeda(cliente.valor_pago)}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nenhum cliente com parcela vencendo hoje
          </div>
        )}
      </div>

      {/* MODAIS */}
      <ModalAbrirLiquidacao
        isOpen={modalAbrir}
        onClose={() => setModalAbrir(false)}
        onConfirmar={handleAbrirLiquidacao}
        loading={loadingAcao}
        saldoSugerido={saldoConta}
      />

      <ModalFecharLiquidacao
        isOpen={modalFechar}
        onClose={() => setModalFechar(false)}
        onConfirmar={handleFecharLiquidacao}
        loading={loadingAcao}
        liquidacao={liquidacao}
      />
    </div>
  );
}