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
  Wallet,
  TrendingUp,
  Calendar,
  Banknote,
  CreditCard,
  RefreshCw,
  Target,
  Receipt,
  DollarSign,
  MapPin,
  CalendarDays,
  ChevronLeft,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { liquidacaoService } from '@/services/liquidacao';
import { CalendarioLiquidacao } from '@/components/liquidacao/CalendarioLiquidacao';
import { ModalDetalhesCliente } from '@/components/clientes/ModalDetalhesCliente';
import type {
  LiquidacaoDiaria,
  VendedorLiquidacao,
  RotaLiquidacao,
  ClienteDoDia,
  EstatisticasClientesDia,
} from '@/types/liquidacao';
import type { ClienteComTotais } from '@/types/clientes';

// =====================================================
// HELPERS
// =====================================================

function formatarMoeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
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
// VALIDAÇÃO DE PERMISSÃO POR TIPO DE USUÁRIO
// =====================================================

function validarPermissaoRota(
  tipoUsuario: string | undefined,
  rotaId: string,
  userProfile: any
): boolean {
  if (!tipoUsuario || !rotaId) return false;
  
  // SUPER_ADMIN: acesso total
  if (tipoUsuario === 'SUPER_ADMIN') {
    return true;
  }
  
  // ADMIN: verifica se tem empresas permitidas
  if (tipoUsuario === 'ADMIN') {
    const empresasPermitidas = userProfile?.empresas_ids || [];
    return empresasPermitidas.length > 0;
  }
  
  // MONITOR e USUARIO_PADRAO: verifica se rota está no array rotas_ids
  if (tipoUsuario === 'MONITOR' || tipoUsuario === 'USUARIO_PADRAO') {
    const rotasPermitidas = userProfile?.rotas_ids || [];
    return rotasPermitidas.includes(rotaId);
  }
  
  // VENDEDOR: não usa este fluxo (tem rota própria)
  if (tipoUsuario === 'VENDEDOR') {
    return true;
  }
  
  return false;
}

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

function BadgeStatus({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    ABERTO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aberto' },
    FECHADO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Fechado' },
    APROVADO: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Aprovado' },
    REABERTO: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Reaberto' },
  };
  const cfg = config[status] || config.ABERTO;
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function CardResumo({
  titulo,
  valor,
  subtitulo,
  icone: Icone,
  corIcone = 'text-blue-600',
  corFundo = 'bg-blue-50',
}: {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icone: React.ElementType;
  corIcone?: string;
  corFundo?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-1 hover:border-gray-300 cursor-default group">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${corFundo} rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
          <Icone className={`w-5 h-5 ${corIcone} transition-transform duration-300 group-hover:scale-110`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 truncate transition-colors duration-300 group-hover:text-gray-600">{titulo}</p>
          <p className="text-lg font-bold text-gray-900 transition-colors duration-300 group-hover:text-gray-800">{valor}</p>
          {subtitulo && <p className="text-xs text-gray-400 transition-colors duration-300 group-hover:text-gray-500">{subtitulo}</p>}
        </div>
      </div>
    </div>
  );
}

function ItemInfo({
  label,
  valor,
  corValor,
}: {
  label: string;
  valor: string | number;
  corValor?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${corValor || 'text-gray-900'}`}>{valor}</span>
    </div>
  );
}

function ProgressBar({ percentual, cor }: { percentual: number; cor?: string }) {
  const corBarra = cor || (percentual >= 100 ? 'bg-green-500' : percentual >= 70 ? 'bg-blue-500' : percentual >= 50 ? 'bg-amber-500' : 'bg-red-500');
  
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div 
        className={`h-full ${corBarra} transition-all duration-500`}
        style={{ width: `${Math.min(100, percentual)}%` }}
      />
    </div>
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

        <div className="space-y-2 mb-6 text-sm bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Caixa Inicial</span>
            <span className="font-medium">{formatarMoeda(liquidacao.caixa_inicial)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Caixa Final</span>
            <span className="font-medium">{formatarMoeda(liquidacao.caixa_final)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600">Recebido Hoje</span>
            <span className="font-medium text-green-600">{formatarMoeda(liquidacao.valor_recebido_dia)}</span>
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
  mostrarCalendario,
  onToggleCalendario,
  calendarioProps,
}: {
  vendedor: VendedorLiquidacao | null;
  rota: RotaLiquidacao;
  saldoConta: number;
  onAbrir: () => void;
  loading: boolean;
  mostrarCalendario: boolean;
  onToggleCalendario: () => void;
  calendarioProps: {
    liquidacoesMes: LiquidacaoDiaria[];
    resumoParcelas: Map<string, { quantidade: number; valor: number }>;
    dataSelecionada: Date;
    onSelecionarData: (data: Date) => void;
    onMesChange: (ano: number, mes: number) => void;
    loadingCalendario: boolean;
  };
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidação Diária</h1>
          <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
            <MapPin className="w-4 h-4" />
            {rota.nome}
            {vendedor && (
              <>
                <span className="text-gray-300">•</span>
                {vendedor.nome}
              </>
            )}
          </p>
        </div>
        <button
          onClick={onToggleCalendario}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            mostrarCalendario 
              ? 'bg-blue-100 text-blue-700' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Calendário
        </button>
      </div>

      {/* Layout com ou sem calendário */}
      <div className={`grid gap-6 ${mostrarCalendario ? 'lg:grid-cols-3' : ''}`}>
        {/* Calendário */}
        {mostrarCalendario && (
          <div className="lg:col-span-1">
            <CalendarioLiquidacao
              rotaId={rota.id}
              liquidacoesMes={calendarioProps.liquidacoesMes}
              resumoParcelas={calendarioProps.resumoParcelas}
              dataSelecionada={calendarioProps.dataSelecionada}
              onSelecionarData={calendarioProps.onSelecionarData}
              onMesChange={calendarioProps.onMesChange}
              loading={calendarioProps.loadingCalendario}
            />
          </div>
        )}

        {/* Card Iniciar Dia */}
        <div className={mostrarCalendario ? 'lg:col-span-2' : ''}>
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
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
        </div>
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
  const [emprestimos, setEmprestimos] = useState({ total: 0, quantidade: 0, novos: 0, renovacoes: 0, juros: 0 });
  const [metaDia, setMetaDia] = useState(0);
  
  // States do calendário
  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [liquidacoesMes, setLiquidacoesMes] = useState<LiquidacaoDiaria[]>([]);
  const [resumoParcelas, setResumoParcelas] = useState<Map<string, { quantidade: number; valor: number }>>(new Map());
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [visualizandoOutroDia, setVisualizandoOutroDia] = useState(false);
  const [previsaoDia, setPrevisaoDia] = useState<{
    totalClientes: number;
    totalParcelas: number;
    valorEsperado: number;
    parcelasVencidas: number;
    valorVencido: number;
  } | null>(null);
  
  // States de UI
  const [loading, setLoading] = useState(true);
  const [loadingCalendario, setLoadingCalendario] = useState(false);
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalFechar, setModalFechar] = useState(false);
  
  // State do Modal de Detalhes do Cliente
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteComTotais | null>(null);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);

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

      // ==============================================
      // VENDEDOR: Buscar sua rota diretamente
      // ==============================================
      if (tipoUsuario === 'VENDEDOR') {
        vendedorData = await liquidacaoService.buscarVendedorPorUserId(userId);
        if (vendedorData) {
          rotaData = await liquidacaoService.buscarRotaVendedor(vendedorData.id);
          rotaId = rotaData?.id || null;
        }
      }
      
      // ==============================================
      // ADMIN/MONITOR/USUARIO_PADRAO: Usar contexto
      // ==============================================
      if (!rotaId && rotaIdContexto) {
        // Validar se o usuário tem permissão para esta rota
        const temPermissao = validarPermissaoRota(tipoUsuario, rotaIdContexto, profile);
        
        if (!temPermissao) {
          console.warn('Usuário não tem permissão para acessar esta rota');
          setSemRotaSelecionada(true);
          setLoading(false);
          return;
        }
        
        rotaId = rotaIdContexto;
        rotaData = await liquidacaoService.buscarRotaPorId(rotaIdContexto, empresaId || undefined);
        
        if (rotaData) {
          vendedorData = await liquidacaoService.buscarVendedorDaRota(rotaIdContexto);
        }
      }
      
      // ==============================================
      // FALLBACK: Usar última rota selecionada
      // ==============================================
      if (!rotaId && profile?.ultima_rota_id) {
        const ultimaRotaId = profile.ultima_rota_id;
        const temPermissao = validarPermissaoRota(tipoUsuario, ultimaRotaId, profile);
        
        if (temPermissao) {
          rotaId = ultimaRotaId;
          rotaData = await liquidacaoService.buscarRotaPorId(ultimaRotaId, empresaId || undefined);
          
          if (rotaData) {
            vendedorData = await liquidacaoService.buscarVendedorDaRota(ultimaRotaId);
          }
        }
      }

      if (!rotaId || !rotaData) {
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

      if (liquidacaoData) {
        await carregarDadosLiquidacao(liquidacaoData, rotaId);
      }

      // Buscar meta da rota
      const meta = await liquidacaoService.buscarMetaRota(rotaId);
      setMetaDia(meta);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, rotaIdContexto, empresaId, profile]);

  const carregarDadosLiquidacao = async (liq: LiquidacaoDiaria, rotaId: string) => {
    try {
      const dataVencimento = liq.data_abertura.split('T')[0];
      
      // Buscar clientes do dia
      const clientes = await liquidacaoService.buscarClientesDoDia(rotaId, dataVencimento);
      setClientesDia(clientes);
      
      // Calcular estatísticas
      const stats = liquidacaoService.calcularEstatisticasClientesDia(clientes);
      setEstatisticas(stats);

      // Buscar empréstimos do dia
      const emps = await liquidacaoService.buscarEmprestimosDoDia(liq.id);
      setEmprestimos(emps);

    } catch (error) {
      console.error('Erro ao carregar dados da liquidação:', error);
    }
  };

  // Carregar dados do calendário (liquidações e parcelas do mês)
  const carregarDadosCalendario = useCallback(async (rotaId: string, ano: number, mes: number) => {
    setLoadingCalendario(true);
    try {
      const [liquidacoes, resumo] = await Promise.all([
        liquidacaoService.buscarLiquidacoesMes(rotaId, ano, mes),
        liquidacaoService.buscarResumoParcelasMes(rotaId, ano, mes),
      ]);
      
      setLiquidacoesMes(liquidacoes);
      setResumoParcelas(resumo);
    } catch (error) {
      console.error('Erro ao carregar dados do calendário:', error);
    } finally {
      setLoadingCalendario(false);
    }
  }, []);

  // Quando o mês muda no calendário
  const handleMesChange = useCallback((ano: number, mes: number) => {
    if (rota) {
      carregarDadosCalendario(rota.id, ano, mes);
    }
  }, [rota, carregarDadosCalendario]);

  // Quando uma data é selecionada no calendário
  const handleSelecionarData = useCallback(async (data: Date) => {
    if (!rota) return;
    
    setDataSelecionada(data);
    setLoadingCalendario(true);
    
    const dataStr = data.toISOString().split('T')[0];
    const hoje = new Date().toISOString().split('T')[0];
    
    try {
      // Verificar se é hoje
      if (dataStr === hoje) {
        setVisualizandoOutroDia(false);
        setPrevisaoDia(null);
        await carregarDados();
        return;
      }
      
      // Buscar liquidação para esta data
      const liqData = await liquidacaoService.buscarLiquidacaoPorData(rota.id, dataStr);
      
      if (liqData) {
        // Tem liquidação - carregar dados dela
        setLiquidacao(liqData);
        setVisualizandoOutroDia(true);
        await carregarDadosLiquidacao(liqData, rota.id);
        setPrevisaoDia(null);
      } else {
        // Não tem liquidação - carregar previsão
        setLiquidacao(null);
        setVisualizandoOutroDia(true);
        
        const previsao = await liquidacaoService.buscarPrevisaoDia(rota.id, dataStr);
        setPrevisaoDia(previsao);
        
        // Buscar clientes do dia para a tabela
        const clientes = await liquidacaoService.buscarClientesDoDia(rota.id, dataStr);
        setClientesDia(clientes);
      }
      
      setMostrarCalendario(false);
    } catch (error) {
      console.error('Erro ao selecionar data:', error);
    } finally {
      setLoadingCalendario(false);
    }
  }, [rota, carregarDados]);

  // Voltar para hoje
  const voltarParaHoje = useCallback(async () => {
    setDataSelecionada(new Date());
    setVisualizandoOutroDia(false);
    setPrevisaoDia(null);
    await carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Carregar dados do calendário quando rota mudar
  useEffect(() => {
    if (rota) {
      const agora = new Date();
      carregarDadosCalendario(rota.id, agora.getFullYear(), agora.getMonth() + 1);
    }
  }, [rota, carregarDadosCalendario]);

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

  // Handler para abrir modal de detalhes do cliente
  const handleAbrirModalCliente = (cliente: ClienteDoDia) => {
    // Converter ClienteDoDia para ClienteComTotais (parcial)
    const clienteParaModal: ClienteComTotais = {
      id: cliente.cliente_id,
      codigo_cliente: parseInt(cliente.consecutivo) || 0, // Usar consecutivo como código
      nome: cliente.nome,
      documento: '',
      telefone_celular: cliente.telefone_celular || '',
      telefone_fixo: '',
      email: '',
      endereco: cliente.endereco || '',
      endereco_comercial: '',
      foto_url: '',
      empresa_id: '',
      status: 'ATIVO',
      created_at: '',
      updated_at: '',
      qtd_emprestimos_ativos: 1,
      qtd_emprestimos_total: 0,
      valor_total_emprestimos: cliente.valor_principal || 0,
      valor_total_pago: 0,
      valor_saldo_devedor: cliente.saldo_emprestimo || 0,
      parcelas_atrasadas: cliente.total_parcelas_vencidas || 0,
      parcelas_pendentes: 0,
      data_cadastro: '',
      rotas_ids: [cliente.rota_id],
      permite_emprestimo_adicional: cliente.permite_emprestimo_adicional,
    };
    
    setClienteSelecionado(clienteParaModal);
    setModalClienteAberto(true);
  };

  // Cálculos
  const percentualMeta = liquidacao ? calcularPercentual(liquidacao.valor_recebido_dia || 0, liquidacao.valor_esperado_dia || metaDia) : 0;

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Sem rota
  if (semRotaSelecionada || !rota) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="bg-white rounded-xl border border-amber-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Selecione uma Rota Específica</h2>
          <p className="text-gray-500 text-sm mb-4">
            O módulo de Liquidação Diária requer uma rota específica selecionada.
          </p>
          <p className="text-gray-400 text-xs">
            Use o seletor no topo da página para escolher uma rota.
            <br />
            A opção "Todas as rotas" não é permitida neste módulo.
          </p>
        </div>
      </div>
    );
  }

  // Sem liquidação
  if (!liquidacao && !visualizandoOutroDia) {
    return (
      <>
        <TelaIniciarDia
          vendedor={vendedor}
          rota={rota}
          saldoConta={saldoConta}
          onAbrir={() => setModalAbrir(true)}
          loading={loadingAcao}
          mostrarCalendario={mostrarCalendario}
          onToggleCalendario={() => setMostrarCalendario(!mostrarCalendario)}
          calendarioProps={{
            liquidacoesMes,
            resumoParcelas,
            dataSelecionada,
            onSelecionarData: handleSelecionarData,
            onMesChange: handleMesChange,
            loadingCalendario,
          }}
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
  // RENDER PRINCIPAL
  // =====================================================

  return (
    <div className="space-y-6">
      {/* Banner - Visualizando outro dia */}
      {visualizandoOutroDia && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarDays className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Visualizando {dataSelecionada.toLocaleDateString('pt-BR', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
              <p className="text-xs text-amber-600">
                {liquidacao ? `Liquidação ${liquidacao.status}` : 'Sem liquidação neste dia'}
              </p>
            </div>
          </div>
          <button
            onClick={voltarParaHoje}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar para Hoje
          </button>
        </div>
      )}

      {/* Header com Informações da Sessão integradas */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Liquidação Diária</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {rota.nome}
              </span>
              {vendedor && (
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {vendedor.nome}
                  {vendedor.codigo_vendedor && ` (${vendedor.codigo_vendedor})`}
                </span>
              )}
              {liquidacao && (
                <>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-green-600" />
                    Abertura: {formatarDataHora(liquidacao.data_abertura)}
                  </span>
                  {liquidacao.data_fechamento && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Fechamento: {formatarDataHora(liquidacao.data_fechamento)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                    Atualizado: {formatarDataHora(liquidacao.updated_at)}
                  </span>
                </>
              )}
            </div>
            {liquidacao?.observacoes && (
              <p className="text-xs text-gray-400 mt-1 italic">
                Obs: {liquidacao.observacoes}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle Calendário */}
            <button
              onClick={() => setMostrarCalendario(!mostrarCalendario)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                mostrarCalendario 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Calendário
            </button>
            
            {liquidacao && <BadgeStatus status={liquidacao.status} />}
            
            {liquidacao?.status === 'ABERTO' && !visualizandoOutroDia && (
              <button
                onClick={() => setModalFechar(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Square className="w-4 h-4" />
                Fechar Dia
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards de Resumo - Linha 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <CardResumo
          titulo="Caixa Inicial"
          valor={liquidacao ? formatarMoeda(liquidacao.caixa_inicial) : '-'}
          icone={Wallet}
          corIcone="text-blue-600"
          corFundo="bg-blue-50"
        />
        <CardResumo
          titulo="Caixa Final"
          valor={liquidacao ? formatarMoeda(liquidacao.caixa_final) : '-'}
          icone={Wallet}
          corIcone="text-green-600"
          corFundo="bg-green-50"
        />
        <CardResumo
          titulo="Carteira Inicial"
          valor={liquidacao ? formatarMoeda(liquidacao.carteira_inicial) : '-'}
          icone={TrendingUp}
          corIcone="text-purple-600"
          corFundo="bg-purple-50"
        />
        <CardResumo
          titulo="Carteira Final"
          valor={liquidacao ? formatarMoeda(liquidacao.carteira_final) : '-'}
          icone={TrendingUp}
          corIcone="text-indigo-600"
          corFundo="bg-indigo-50"
        />
      </div>

      {/* Layout com Calendário */}
      <div className={`grid gap-6 ${mostrarCalendario ? 'lg:grid-cols-4' : ''}`}>
        {/* Calendário */}
        {mostrarCalendario && rota && (
          <div className="lg:col-span-1">
            <CalendarioLiquidacao
              rotaId={rota.id}
              liquidacoesMes={liquidacoesMes}
              resumoParcelas={resumoParcelas}
              dataSelecionada={dataSelecionada}
              onSelecionarData={handleSelecionarData}
              onMesChange={handleMesChange}
              loading={loadingCalendario}
            />
          </div>
        )}

        {/* Conteúdo Principal */}
        <div className={mostrarCalendario ? 'lg:col-span-3' : ''}>
          {/* Previsão do Dia (quando não tem liquidação) */}
          {!liquidacao && previsaoDia && (
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Previsão do Dia</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/70 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{previsaoDia.totalClientes}</p>
                  <p className="text-sm text-gray-600">Clientes</p>
                </div>
                <div className="bg-white/70 rounded-lg p-4 text-center">
                  <p className="text-3xl font-bold text-indigo-600">{previsaoDia.totalParcelas}</p>
                  <p className="text-sm text-gray-600">Parcelas</p>
                </div>
                <div className="bg-white/70 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{formatarMoeda(previsaoDia.valorEsperado)}</p>
                  <p className="text-sm text-gray-600">A Receber</p>
                </div>
                {previsaoDia.parcelasVencidas > 0 && (
                  <div className="bg-white/70 rounded-lg p-4 text-center border border-red-200">
                    <p className="text-2xl font-bold text-red-600">{previsaoDia.parcelasVencidas}</p>
                    <p className="text-sm text-red-600">Em Atraso</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Grid Principal - só mostra se tem liquidação */}
          {liquidacao && (
            <>
              {/* Grid de 2 colunas balanceadas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Coluna 1 - Meta, Clientes e Pagamentos */}
                <div className="space-y-4">
                  {/* Card Meta/Recaudo */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-1 hover:border-blue-200 group">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2 transition-colors duration-300 group-hover:text-blue-700">
                      <Target className="w-4 h-4 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
                      Meta do Dia
                    </h3>
                    
                    <div className="text-center mb-4">
                      <p className="text-3xl font-bold text-gray-900 transition-all duration-300 group-hover:scale-105">{percentualMeta}%</p>
                      <p className="text-xs text-gray-500">de {formatarMoeda(liquidacao.valor_esperado_dia || metaDia)}</p>
                    </div>
                    
                    <ProgressBar percentual={percentualMeta} />
                    
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <ItemInfo label="Valor Esperado" valor={formatarMoeda(liquidacao.valor_esperado_dia || metaDia)} />
                      <ItemInfo label="Valor Recebido" valor={formatarMoeda(liquidacao.valor_recebido_dia)} corValor="text-green-600" />
                      <ItemInfo label="Percentual" valor={`${liquidacao.percentual_recebimento || percentualMeta}%`} />
                    </div>
                  </div>

                  {/* Card Clientes */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-1 hover:border-blue-200 group">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2 transition-colors duration-300 group-hover:text-blue-700">
                      <Users className="w-4 h-4 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
                      Clientes
                    </h3>
                    
                    <div className="grid grid-cols-4 gap-3">
                      <div className="text-center p-3 bg-gray-50 rounded-lg transition-all duration-300 group-hover:bg-gray-100">
                        <p className="text-2xl font-bold text-gray-900">{liquidacao.clientes_iniciais}</p>
                        <p className="text-xs text-gray-500">Iniciais</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg transition-all duration-300 group-hover:bg-green-100">
                        <p className="text-2xl font-bold text-green-600">{liquidacao.clientes_novos}</p>
                        <p className="text-xs text-gray-500">Novos</p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg transition-all duration-300 group-hover:bg-blue-100">
                        <p className="text-2xl font-bold text-blue-600">{liquidacao.clientes_renovados}</p>
                        <p className="text-xs text-gray-500">Renovados</p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg transition-all duration-300 group-hover:bg-purple-100">
                        <p className="text-2xl font-bold text-purple-600">{liquidacao.clientes_renegociados}</p>
                        <p className="text-xs text-gray-500">Renegociados</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                          Cancelados
                        </span>
                        <span className="font-medium text-red-600">{liquidacao.clientes_cancelados}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna 2 - Pagamentos e Operações Financeiras */}
                <div className="space-y-4">
                  {/* Card Pagamentos do Dia (UNIFICADO com Recebimentos por Tipo) */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-green-100/50 hover:-translate-y-1 hover:border-green-200 group">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2 transition-colors duration-300 group-hover:text-green-700">
                      <CheckCircle className="w-4 h-4 text-green-600 transition-transform duration-300 group-hover:scale-110" />
                      Pagamentos do Dia
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-green-50 rounded-lg transition-all duration-300 group-hover:bg-green-100">
                        <p className="text-2xl font-bold text-green-600">{liquidacao.pagamentos_pagos}</p>
                        <p className="text-xs text-gray-500">Pagos</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg transition-all duration-300 group-hover:bg-red-100">
                        <p className="text-2xl font-bold text-red-600">{liquidacao.pagamentos_nao_pagos}</p>
                        <p className="text-xs text-gray-500">Não Pagos</p>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Efetividade</span>
                        <span>
                          {liquidacao.pagamentos_pagos + liquidacao.pagamentos_nao_pagos > 0
                            ? Math.round((liquidacao.pagamentos_pagos / (liquidacao.pagamentos_pagos + liquidacao.pagamentos_nao_pagos)) * 100)
                            : 0}%
                        </span>
                      </div>
                      <ProgressBar 
                        percentual={
                          liquidacao.pagamentos_pagos + liquidacao.pagamentos_nao_pagos > 0
                            ? (liquidacao.pagamentos_pagos / (liquidacao.pagamentos_pagos + liquidacao.pagamentos_nao_pagos)) * 100
                            : 0
                        } 
                      />
                    </div>

                    {/* Recebimentos por Tipo (integrado) */}
                    <div className="mt-4 pt-4 border-t space-y-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Por Tipo de Recebimento</p>
                      <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Banknote className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-700">Dinheiro</span>
                        </div>
                        <span className="font-semibold text-green-700">{formatarMoeda(liquidacao.valor_dinheiro)}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          <span className="text-sm text-blue-700">Transferência</span>
                        </div>
                        <span className="font-semibold text-blue-700">{formatarMoeda(liquidacao.valor_transferencia)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Grid de 3 cards financeiros na mesma linha */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Card Empréstimos */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-green-100/50 hover:-translate-y-1 hover:border-green-200 group">
                      <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5 transition-colors duration-300 group-hover:text-green-700">
                        <DollarSign className="w-3.5 h-3.5 text-green-600 transition-transform duration-300 group-hover:scale-110" />
                        Empréstimos
                      </h3>
                      
                      <div className="text-center p-2 bg-green-50 rounded-lg transition-all duration-300 group-hover:bg-green-100">
                        <p className="text-lg font-bold text-green-600 transition-transform duration-300 group-hover:scale-105">{formatarMoeda(liquidacao.total_emprestado_dia)}</p>
                        <p className="text-xs text-gray-500">{liquidacao.qtd_emprestimos_dia} emp.</p>
                      </div>
                    </div>

                    {/* Card Despesas */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-red-100/50 hover:-translate-y-1 hover:border-red-200 group">
                      <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5 transition-colors duration-300 group-hover:text-red-700">
                        <Receipt className="w-3.5 h-3.5 text-red-600 transition-transform duration-300 group-hover:scale-110" />
                        Despesas
                      </h3>
                      
                      <div className="text-center p-2 bg-red-50 rounded-lg transition-all duration-300 group-hover:bg-red-100">
                        <p className="text-lg font-bold text-red-600 transition-transform duration-300 group-hover:scale-105">{formatarMoeda(liquidacao.total_despesas_dia)}</p>
                        <p className="text-xs text-gray-500">{liquidacao.qtd_despesas_dia} lanç.</p>
                      </div>
                    </div>

                    {/* Card Microseguro */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-teal-100/50 hover:-translate-y-1 hover:border-teal-200 group">
                      <h3 className="text-xs font-semibold text-gray-900 mb-3 flex items-center gap-1.5 transition-colors duration-300 group-hover:text-teal-700">
                        <Shield className="w-3.5 h-3.5 text-teal-600 transition-transform duration-300 group-hover:scale-110" />
                        Microseguro
                      </h3>
                      
                      <div className="text-center p-2 bg-teal-50 rounded-lg transition-all duration-300 group-hover:bg-teal-100">
                        <p className="text-lg font-bold text-teal-600 transition-transform duration-300 group-hover:scale-105">{formatarMoeda(liquidacao.total_microseguro_dia)}</p>
                        <p className="text-xs text-gray-500">{liquidacao.qtd_microseguros_dia} cont.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lista de Clientes do Dia */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all duration-300 ease-out hover:shadow-lg hover:shadow-gray-200/50 hover:border-gray-300">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Clientes do Dia</h3>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full transition-all duration-300 hover:bg-blue-200 hover:scale-105">
            {clientesDia.length}
          </span>
        </div>
        
        {clientesDia.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Cliente</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Parcela</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Valor</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Pago</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clientesDia.slice(0, 10).map((cliente) => (
                  <tr 
                    key={cliente.parcela_id} 
                    className="hover:bg-blue-50/50 transition-colors duration-200 cursor-pointer"
                    onClick={() => handleAbrirModalCliente(cliente)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                          cliente.status_dia === 'PAGO' ? 'bg-green-100 text-green-700' : 
                          cliente.status_dia === 'EM_ATRASO' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {cliente.nome?.charAt(0)}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900 hover:text-blue-600 transition-colors">{cliente.nome}</span>
                          {cliente.tem_parcelas_vencidas && (
                            <span className="ml-2 text-xs text-red-500">({cliente.total_parcelas_vencidas} vencida(s))</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">
                      {cliente.numero_parcela}/{cliente.numero_parcelas}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatarMoeda(cliente.valor_parcela)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cliente.valor_pago_parcela > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                        {cliente.valor_pago_parcela > 0 ? formatarMoeda(cliente.valor_pago_parcela) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        cliente.status_dia === 'PAGO' ? 'bg-green-100 text-green-700' : 
                        cliente.status_dia === 'EM_ATRASO' ? 'bg-red-100 text-red-700' : 
                        cliente.status_dia === 'PARCIAL' ? 'bg-amber-100 text-amber-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {cliente.status_dia === 'EM_ATRASO' ? 'ATRASADO' : cliente.status_dia}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clientesDia.length > 10 && (
              <div className="px-4 py-3 bg-gray-50 text-center text-xs text-gray-500 border-t">
                Mostrando 10 de {clientesDia.length} clientes
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 text-sm">
            Nenhum cliente com parcela vencendo hoje
          </div>
        )}
      </div>

      {/* Modais */}
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

      {/* Modal de Detalhes do Cliente */}
      <ModalDetalhesCliente
        isOpen={modalClienteAberto}
        onClose={() => {
          setModalClienteAberto(false);
          setClienteSelecionado(null);
        }}
        cliente={clienteSelecionado}
      />
    </div>
  );
}