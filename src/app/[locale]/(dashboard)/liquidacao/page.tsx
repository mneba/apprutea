'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Shield,
  Settings,
  FileText,
  List,
  Lock,
  Percent,
  TrendingUp,
  Calendar,
  Smartphone,
  Wallet,
  PiggyBank,
  ArrowUpCircle,
  ArrowDownCircle,
  Receipt,
  DollarSign,
  RefreshCw,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { liquidacaoService } from '@/services/liquidacao';
import type {
  LiquidacaoDiaria,
  VendedorLiquidacao,
  RotaLiquidacao,
  ClienteDoDia,
  EstatisticasClientesDia,
} from '@/types/liquidacao';

// =====================================================
// HELPERS
// =====================================================

function formatarMoeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

function formatarData(data: string | null | undefined): string {
  if (!data) return '-';
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarDataHora(data: string | null | undefined): string {
  if (!data) return '-';
  return new Date(data).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function calcularPercentual(atual: number, meta: number): number {
  if (meta === 0) return 0;
  return Math.round((atual / meta) * 100);
}

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

// Linha de informação no estilo do SmartPay
function LinhaInfo({
  label,
  children,
  destaque = false,
  corValor,
}: {
  label: string;
  children: React.ReactNode;
  destaque?: boolean;
  corValor?: string;
}) {
  return (
    <div className={`flex items-center py-2 px-3 ${destaque ? 'bg-gray-50' : ''} border-b border-gray-100`}>
      <span className={`text-sm ${destaque ? 'font-medium text-gray-900' : 'text-gray-600'} w-48 flex-shrink-0`}>
        {label}
      </span>
      <span className={`text-sm font-medium ${corValor || 'text-gray-900'}`}>
        {children}
      </span>
    </div>
  );
}

// Botão lateral no estilo do SmartPay
function BotaoLateral({
  icone: Icone,
  label,
  onClick,
  cor = 'bg-gray-700',
  disabled = false,
}: {
  icone: React.ElementType;
  label: string;
  onClick?: () => void;
  cor?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 ${cor} text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <Icone className="w-4 h-4" />
      {label}
    </button>
  );
}

// Card de Microseguro
function CardMicroseguro({ liquidacao }: { liquidacao: LiquidacaoDiaria }) {
  return (
    <div className="bg-red-600 text-white rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
        <Shield className="w-4 h-4" />
        MICRO SEGURO
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Ingreso Seguros:</span>
          <span>{formatarMoeda(liquidacao.total_microseguro_dia)}</span>
        </div>
        <div className="flex justify-between">
          <span>Retiros Seguros:</span>
          <span>R$ 0,00</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Caja Seguros:</span>
          <span>({formatarMoeda(liquidacao.total_microseguro_dia)})</span>
        </div>
      </div>
    </div>
  );
}

// Badge de Status
function BadgeStatus({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ABERTO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aberto' },
    FECHADO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Fechado' },
    APROVADO: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Aprovado' },
    REABERTO: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Reaberto' },
  };
  const cfg = config[status] || config.ABERTO;
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
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
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Play className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Abrir Liquidação</h2>
            <p className="text-sm text-gray-500">Iniciar sessão de trabalho</p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Caixa Inicial
          </label>
          <input
            type="number"
            value={caixaInicial}
            onChange={(e) => setCaixaInicial(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-semibold"
            placeholder="0,00"
          />
          <p className="mt-2 text-xs text-gray-500">
            Saldo sugerido: {formatarMoeda(saldoSugerido)}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(parseFloat(caixaInicial) || 0)}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Abrir
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
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Square className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Fechar Liquidação</h2>
            <p className="text-sm text-gray-500">Encerrar sessão de trabalho</p>
          </div>
        </div>

        <div className="space-y-2 mb-6 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Caixa Inicial</span>
            <span className="font-medium">{formatarMoeda(liquidacao.caixa_inicial)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Caixa Final</span>
            <span className="font-medium">{formatarMoeda(liquidacao.caixa_final)}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Recebido no Dia</span>
            <span className="font-medium text-green-600">{formatarMoeda(liquidacao.valor_recebido_dia)}</span>
          </div>
          <div className="flex justify-between py-2">
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
            rows={3}
            placeholder="Alguma observação sobre o dia..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(observacoes)}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            Fechar
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
  vendedor: VendedorLiquidacao | null;
  rota: RotaLiquidacao;
  saldoConta: number;
  onAbrir: () => void;
  loading: boolean;
}) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Play className="w-8 h-8 text-white" />
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">Iniciar o Dia</h2>
        <p className="text-gray-500 text-sm mb-6">
          Nenhuma liquidação aberta. Inicie sua sessão de trabalho.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-blue-600">
                {vendedor?.nome?.charAt(0) || rota.nome.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{vendedor?.nome || 'Vendedor não vinculado'}</p>
              <p className="text-xs text-gray-500">{rota.nome}</p>
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
          className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Play className="w-5 h-5" />
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
  const [emprestimos, setEmprestimos] = useState({ total: 0, quantidade: 0, novos: 0, renovacoes: 0, juros: 0 });
  const [metaDia, setMetaDia] = useState(0);
  
  // States de UI
  const [loading, setLoading] = useState(true);
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalFechar, setModalFechar] = useState(false);

  // Carregar dados iniciais
  const carregarDados = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setSemRotaSelecionada(false);
    
    const tipoUsuario = profile?.tipo_usuario;
    
    try {
      let rotaId: string | null = null;
      let vendedorData: VendedorLiquidacao | null = null;
      let rotaData: RotaLiquidacao | null = null;

      // Se é vendedor, buscar sua rota
      if (tipoUsuario === 'VENDEDOR') {
        vendedorData = await liquidacaoService.buscarVendedorPorUserId(userId);
        
        if (vendedorData) {
          rotaData = await liquidacaoService.buscarRotaVendedor(vendedorData.id);
          rotaId = rotaData?.id || null;
        }
      }
      
      // Se não é vendedor ou não achou rota, usar contexto
      if (!rotaId && rotaIdContexto) {
        rotaId = rotaIdContexto;
        rotaData = await liquidacaoService.buscarRotaPorId(rotaIdContexto, empresaId || undefined);
        
        if (rotaData) {
          vendedorData = await liquidacaoService.buscarVendedorDaRota(rotaIdContexto);
        }
      }

      if (!rotaId || !rotaData) {
        setSemRotaSelecionada(true);
        setLoading(false);
        return;
      }

      setVendedor(vendedorData);
      setRota(rotaData);

      const contaData = await liquidacaoService.buscarSaldoContaRota(rotaId);
      setSaldoConta(contaData?.saldo_atual || 0);

      const liquidacaoData = await liquidacaoService.buscarLiquidacaoAberta(rotaId);
      setLiquidacao(liquidacaoData);

      if (liquidacaoData) {
        await carregarDadosLiquidacao(liquidacaoData, rotaId);
      }

      const meta = await liquidacaoService.buscarMetaRota(rotaId);
      setMetaDia(meta);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, rotaIdContexto, empresaId, profile?.tipo_usuario]);

  // Carregar dados específicos da liquidação
  const carregarDadosLiquidacao = async (liq: LiquidacaoDiaria, rotaId: string) => {
    try {
      const dataVencimento = liq.data_abertura.split('T')[0];
      
      const clientes = await liquidacaoService.buscarClientesDoDia(rotaId, dataVencimento);
      setClientesDia(clientes);
      
      const stats = liquidacaoService.calcularEstatisticasClientesDia(clientes);
      setEstatisticas(stats);

      const movs = await liquidacaoService.buscarMovimentacoesDoDia(liq.id);
      setMovimentacoes(movs);

      const emps = await liquidacaoService.buscarEmprestimosDoDia(liq.id);
      setEmprestimos(emps);

    } catch (error) {
      console.error('Erro ao carregar dados da liquidação:', error);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Handlers
  const handleAbrirLiquidacao = async (caixaInicial: number) => {
    if (!rota || !userId) return;
    
    setLoadingAcao(true);
    try {
      const resultado = await liquidacaoService.abrirLiquidacao({
        vendedor_id: vendedor?.id || '',
        rota_id: rota.id,
        caixa_inicial: caixaInicial,
        user_id: userId,
      });

      if (resultado.sucesso && resultado.liquidacao_id) {
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

  // Cálculos
  const percentualMeta = liquidacao ? calcularPercentual(liquidacao.valor_recebido_dia || 0, metaDia) : 0;
  const carteiraCrescimento = liquidacao ? (liquidacao.carteira_final || 0) - (liquidacao.carteira_inicial || 0) : 0;
  const ganancia = liquidacao ? (liquidacao.valor_recebido_dia || 0) - (liquidacao.total_emprestado_dia || 0) : 0;

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Sem rota selecionada
  if (semRotaSelecionada || !rota) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Selecione uma Rota</h2>
        <p className="text-gray-500 text-center text-sm max-w-md">
          Selecione uma rota no menu superior para visualizar a liquidação diária.
        </p>
      </div>
    );
  }

  // Sem liquidação aberta - mostrar tela de iniciar
  if (!liquidacao) {
    return (
      <>
        <TelaIniciarDia
          vendedor={vendedor}
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

  // =====================================================
  // RENDER PRINCIPAL - Estilo SmartPay
  // =====================================================

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Liquidação Diária</h1>
        <BadgeStatus status={liquidacao.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Coluna Principal - Informações */}
        <div className="lg:col-span-3 space-y-4">
          {/* Card do Vendedor */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-700 text-white px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="font-medium text-sm">Vendedor:</span>
                <span className="text-sm">
                  {vendedor?.nome || 'Não vinculado'} 
                  {vendedor?.codigo_vendedor && ` - Cód: ${vendedor.codigo_vendedor}`}
                </span>
              </div>
            </div>

            {/* Informações de Data/Hora */}
            <div className="divide-y divide-gray-100">
              <LinhaInfo label="Data de Início de Cobrança:" destaque>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                  {formatarDataHora(liquidacao.data_abertura)}
                </span>
              </LinhaInfo>
              <LinhaInfo label="Data de Fechamento:">
                {liquidacao.data_fechamento ? formatarDataHora(liquidacao.data_fechamento) : 'Sistema sem Fechar'}
              </LinhaInfo>
              <LinhaInfo label="Último Acesso Móvel:">
                <span className="flex items-center gap-1">
                  <Smartphone className="w-3 h-3" />
                  {formatarDataHora(liquidacao.updated_at)}
                </span>
              </LinhaInfo>
            </div>

            {/* Informações de Clientes */}
            <div className="divide-y divide-gray-100">
              <LinhaInfo label="Clientes Iniciais:" destaque>
                <span className="flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  {liquidacao.clientes_iniciais || clientesDia.length}
                  <span className="text-gray-500">
                    ( {estatisticas?.sincronizados || 0} Sincronizados / {clientesDia.length} )
                  </span>
                </span>
              </LinhaInfo>
              <LinhaInfo label="Clientes Novos/Renovados:">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {liquidacao.clientes_novos || 0} ({estatisticas?.novos || 0}/{estatisticas?.renovados || 0})
                </span>
              </LinhaInfo>
              <LinhaInfo label="Pagamento Adiado Próx. Dia:">
                {liquidacao.pagamentos_adiados || 0}
              </LinhaInfo>
              <LinhaInfo label="Clientes Cancelados:">
                {estatisticas?.cancelados || 0}
              </LinhaInfo>
              <LinhaInfo label="Total de Clientes:" destaque>
                <Users className="w-3 h-3 inline mr-1" />
                {clientesDia.length}
              </LinhaInfo>
            </div>

            {/* Informações Financeiras */}
            <div className="divide-y divide-gray-100">
              <LinhaInfo label="Caixa Inicial:" destaque>
                <Wallet className="w-3 h-3 inline mr-1" />
                {formatarMoeda(liquidacao.caixa_inicial)}
              </LinhaInfo>
              <LinhaInfo label="Carteira Inicial:" destaque>
                <PiggyBank className="w-3 h-3 inline mr-1" />
                {formatarMoeda(liquidacao.carteira_inicial)}
              </LinhaInfo>
              <LinhaInfo label="Recaudo Pretendido do Dia:">
                <span className="flex items-center gap-2">
                  {formatarMoeda(metaDia)}
                  <span className="text-green-600">( {percentualMeta}% )</span>
                </span>
              </LinhaInfo>
              <LinhaInfo label="Recaudo Atual do Dia:">
                <span className="flex items-center gap-2">
                  <span className={percentualMeta >= 100 ? 'text-green-600' : 'text-amber-600'}>
                    {formatarMoeda(liquidacao.valor_recebido_dia)}
                  </span>
                  <span className="text-gray-500">
                    ( {percentualMeta}% )
                  </span>
                  <span className="text-green-600">
                    Pagos: {liquidacao.pagamentos_pagos}
                  </span>
                  <span className="text-red-600">
                    Não Pagos: {liquidacao.pagamentos_nao_pagos}
                  </span>
                </span>
              </LinhaInfo>
              <LinhaInfo label="Recaudo por Tipo de Pagamento:">
                <span className="flex items-center gap-3">
                  <span>Dinheiro: <span className="text-green-600">( {formatarMoeda(liquidacao.valor_recebido_dinheiro || 0)} )</span></span>
                  <span>Transferência: <span className="text-blue-600">( {formatarMoeda(liquidacao.valor_recebido_transferencia || 0)} )</span></span>
                </span>
              </LinhaInfo>
            </div>

            {/* Movimentações */}
            <div className="divide-y divide-gray-100">
              <LinhaInfo label="Vendas:">
                <span className="flex items-center gap-2">
                  {formatarMoeda(emprestimos.total)}
                  <span className="text-gray-500">( Juros {formatarMoeda(emprestimos.juros)} )</span>
                </span>
              </LinhaInfo>
              <LinhaInfo label="Receitas (Ingresos):">
                <span className="text-green-600">+ {formatarMoeda(movimentacoes.receitas)}</span>
              </LinhaInfo>
              <LinhaInfo label="Retiradas (Retiros):">
                <span className="text-amber-600">- {formatarMoeda(movimentacoes.retiradas)}</span>
              </LinhaInfo>
              <LinhaInfo label="Despesas (Egresos):">
                <span className="text-red-600">- {formatarMoeda(movimentacoes.despesas)}</span>
              </LinhaInfo>
            </div>

            {/* Totais Finais */}
            <div className="divide-y divide-gray-100 bg-gray-50">
              <LinhaInfo label="Caixa Final:" destaque corValor="text-red-600">
                <Wallet className="w-3 h-3 inline mr-1" />
                {formatarMoeda(liquidacao.caixa_final)}
              </LinhaInfo>
              <LinhaInfo label="Carteira Final:" destaque corValor="text-red-600">
                <span className="flex items-center gap-2">
                  <PiggyBank className="w-3 h-3" />
                  {formatarMoeda(liquidacao.carteira_final)}
                  {liquidacao.valor_sancao && liquidacao.valor_sancao > 0 && (
                    <span className="text-gray-500">( Sanção {formatarMoeda(liquidacao.valor_sancao)} )</span>
                  )}
                </span>
              </LinhaInfo>
            </div>
          </div>

          {/* Lista de Clientes do Dia */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center justify-between border-b">
              <span className="font-medium text-sm text-gray-700">Clientes do Dia</span>
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                {clientesDia.length}
              </span>
            </div>
            
            {clientesDia.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Cliente</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Parcela</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Valor</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Pago</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clientesDia.slice(0, 10).map((cliente) => (
                      <tr key={cliente.parcela_id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                              cliente.status_dia === 'PAGO' ? 'bg-green-100 text-green-700' : 
                              cliente.status_dia === 'VENCIDO' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {cliente.cliente_nome?.charAt(0)}
                            </div>
                            <span className="text-gray-900">{cliente.cliente_nome}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{cliente.numero_parcela}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatarMoeda(cliente.valor_parcela)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={cliente.valor_pago > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                            {cliente.valor_pago > 0 ? formatarMoeda(cliente.valor_pago) : '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                            cliente.status_dia === 'PAGO' ? 'bg-green-100 text-green-700' : 
                            cliente.status_dia === 'VENCIDO' ? 'bg-red-100 text-red-700' : 
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {cliente.status_dia === 'PAGO' && <CheckCircle className="w-3 h-3" />}
                            {cliente.status_dia === 'VENCIDO' && <XCircle className="w-3 h-3" />}
                            {cliente.status_dia === 'PENDENTE' && <Clock className="w-3 h-3" />}
                            {cliente.status_dia}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clientesDia.length > 10 && (
                  <div className="px-3 py-2 bg-gray-50 text-center text-xs text-gray-500 border-t">
                    Mostrando 10 de {clientesDia.length} clientes
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500 text-sm">
                Nenhum cliente com parcela vencendo hoje
              </div>
            )}
          </div>
        </div>

        {/* Coluna Lateral - Botões e Microseguro */}
        <div className="space-y-3">
          {/* Botões de Ação */}
          <div className="space-y-2">
            <BotaoLateral icone={Settings} label="Configurações" cor="bg-blue-600" />
            <BotaoLateral icone={FileText} label="Reporte Monitor" cor="bg-gray-600" />
            <BotaoLateral icone={List} label="Lista Clientes" cor="bg-green-600" />
            <BotaoLateral icone={Lock} label="Bloquear Unidade" cor="bg-amber-600" />
            <BotaoLateral icone={Percent} label="M. Interesses" cor="bg-gray-600" />
          </div>

          {/* Card de Ganância */}
          <div className="bg-green-600 text-white rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="font-medium text-sm">Ganância</span>
            </div>
            <span className="font-bold">( {formatarMoeda(ganancia)} )</span>
          </div>

          {/* Card de Microseguro */}
          <CardMicroseguro liquidacao={liquidacao} />

          {/* Botão Fechar Dia */}
          {liquidacao.status === 'ABERTO' && (
            <button
              onClick={() => setModalFechar(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              <Square className="w-4 h-4" />
              Fechar Dia
            </button>
          )}
        </div>
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