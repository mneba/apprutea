'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Play,
  Square,
  Clock,
  Users,
  AlertCircle,
  Loader2,
  Shield,
  Wallet,
  TrendingUp,
  Calendar,
  Banknote,
  CreditCard,
  Target,
  Receipt,
  DollarSign,
  MapPin,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  RotateCcw,
  AlertTriangle,
  Search,
  MessageSquare,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { liquidacaoService } from '@/services/liquidacao';
import { ModalCalendarioLiquidacao } from '@/components/liquidacao/ModalCalendarioLiquidacao';
import { ModalDetalhesCliente } from '@/components/clientes/ModalDetalhesCliente';
import { ModalExtratoLiquidacao } from '@/components/liquidacao/ModalExtratoLiquidacao';
import { FaixaLiquidacaoReaberta } from '@/components/liquidacao/FaixaLiquidacaoReaberta';
import { ModalNotasCliente } from '@/components/liquidacao/NotasLiquidacao';
import {
  ModalEmprestimos,
  ModalDespesas,
  ModalMicroseguros,
} from '@/components/liquidacao/CardsFinanceiros';
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

function validarPermissaoRota(
  tipoUsuario: string | undefined,
  rotaId: string,
  userProfile: any
): boolean {
  if (!tipoUsuario || !rotaId) return false;
  if (tipoUsuario === 'SUPER_ADMIN') return true;
  if (tipoUsuario === 'ADMIN') {
    const empresasPermitidas = userProfile?.empresas_ids || [];
    return empresasPermitidas.length > 0;
  }
  if (tipoUsuario === 'MONITOR' || tipoUsuario === 'USUARIO_PADRAO') {
    const rotasPermitidas = userProfile?.rotas_ids || [];
    return rotasPermitidas.includes(rotaId);
  }
  if (tipoUsuario === 'VENDEDOR') return true;
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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// Card compacto Caixa ou Carteira
function CardSaldo({
  titulo,
  inicial,
  final,
  icone: Icone,
  corBase,
}: {
  titulo: string;
  inicial: number;
  final: number;
  icone: React.ElementType;
  corBase: 'blue' | 'purple';
}) {
  const delta = final - inicial;
  const percent = inicial !== 0 ? (delta / inicial) * 100 : 0;
  const subiu = delta > 0;
  const desceu = delta < 0;
  const corDelta = subiu ? 'text-green-600' : desceu ? 'text-red-600' : 'text-gray-500';
  const IconDelta = subiu ? ArrowUpRight : desceu ? ArrowDownRight : Minus;

  const corBgIcone = corBase === 'blue' ? 'bg-blue-50' : 'bg-purple-50';
  const corIcone = corBase === 'blue' ? 'text-blue-600' : 'text-purple-600';

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 flex items-center gap-3">
      <div className={`w-9 h-9 ${corBgIcone} rounded-md flex items-center justify-center flex-shrink-0`}>
        <Icone className={`w-4 h-4 ${corIcone}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-0.5">{titulo}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] text-gray-400">Inicial</span>
          <span className="text-xs font-medium text-gray-700 tabular-nums">{formatarMoeda(inicial)}</span>
          <span className="text-gray-300">·</span>
          <span className="text-[10px] text-gray-400">Final</span>
          <span className="text-sm font-bold text-gray-900 tabular-nums">{formatarMoeda(final)}</span>
        </div>
      </div>
      <div className={`flex flex-col items-end text-[11px] font-medium ${corDelta} flex-shrink-0`}>
        <div className="flex items-center gap-0.5">
          <IconDelta className="w-3 h-3" />
          <span className="tabular-nums">{subiu && '+'}{formatarMoeda(delta)}</span>
        </div>
        <span className="tabular-nums text-[10px]">{subiu && '+'}{percent.toFixed(2)}%</span>
      </div>
    </div>
  );
}

function ProgressBar({ percentual, cor }: { percentual: number; cor?: string }) {
  const corBarra = cor || (percentual >= 100 ? 'bg-green-500' : percentual >= 70 ? 'bg-blue-500' : percentual >= 50 ? 'bg-amber-500' : 'bg-red-500');
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${corBarra} transition-all duration-500`} style={{ width: `${Math.min(100, percentual)}%` }} />
    </div>
  );
}

// =====================================================
// SKELETONS
// =====================================================

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

function TelaSkeleton() {
  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col gap-3 p-1">
      <SkeletonBlock className="h-12 w-full" />
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[35%_65%] gap-4">
        <div className="space-y-3">
          <SkeletonBlock className="h-24 rounded-lg" />
          <SkeletonBlock className="h-24 rounded-lg" />
          <SkeletonBlock className="h-32 rounded-lg" />
          <SkeletonBlock className="h-32 rounded-lg" />
        </div>
        <SkeletonBlock className="rounded-lg" />
      </div>
    </div>
  );
}

// =====================================================
// MODAL DE ABERTURA
// =====================================================

function ModalAbrirLiquidacao({
  isOpen, onClose, onConfirmar, loading, saldoSugerido,
}: {
  isOpen: boolean; onClose: () => void; onConfirmar: (caixaInicial: number) => void; loading: boolean; saldoSugerido: number;
}) {
  const [caixaInicial, setCaixaInicial] = useState(saldoSugerido.toString());
  useEffect(() => { setCaixaInicial(saldoSugerido.toString()); }, [saldoSugerido]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center"><Play className="w-5 h-5 text-green-600" /></div>
          <div><h2 className="text-lg font-bold text-gray-900">Abrir Liquidação</h2><p className="text-sm text-gray-500">Iniciar sessão de trabalho</p></div>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Caixa Inicial</label>
          <input type="number" value={caixaInicial} onChange={(e) => setCaixaInicial(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-semibold" placeholder="0,00" />
          <p className="mt-2 text-xs text-gray-500">Saldo sugerido: {formatarMoeda(saldoSugerido)}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">Cancelar</button>
          <button onClick={() => onConfirmar(parseFloat(caixaInicial) || 0)} disabled={loading} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Abrir
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
  isOpen, onClose, onConfirmar, loading, liquidacao,
}: {
  isOpen: boolean; onClose: () => void; onConfirmar: (observacoes: string) => void; loading: boolean; liquidacao: LiquidacaoDiaria | null;
}) {
  const [observacoes, setObservacoes] = useState('');
  if (!isOpen || !liquidacao) return null;
  const isReaberta = liquidacao.status === 'REABERTO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-10 h-10 ${isReaberta ? 'bg-amber-100' : 'bg-blue-100'} rounded-lg flex items-center justify-center`}>
            <Square className={`w-5 h-5 ${isReaberta ? 'text-amber-600' : 'text-blue-600'}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isReaberta ? 'Fechar Liquidação Reaberta' : 'Fechar Liquidação'}</h2>
            <p className="text-sm text-gray-500">{isReaberta ? 'Finalizar correções e fechar' : 'Encerrar sessão de trabalho'}</p>
          </div>
        </div>
        <div className="space-y-2 mb-6 text-sm bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between"><span className="text-gray-600">Caixa Inicial</span><span className="font-medium">{formatarMoeda(liquidacao.caixa_inicial)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Caixa Final</span><span className="font-medium">{formatarMoeda(liquidacao.caixa_final)}</span></div>
          <div className="flex justify-between pt-2 border-t"><span className="text-gray-600">Recebido</span><span className="font-medium text-green-600">{formatarMoeda(liquidacao.valor_recebido_dia)}</span></div>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Observações (opcional)</label>
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm" rows={3} placeholder={isReaberta ? "Descreva as correções realizadas..." : "Alguma observação sobre o dia..."} />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">Cancelar</button>
          <button onClick={() => onConfirmar(observacoes)} disabled={loading} className={`flex-1 px-4 py-2.5 ${isReaberta ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MODAL DE REABERTURA
// =====================================================

function ModalReabrirLiquidacao({
  isOpen, onClose, onConfirmar, loading, dataLiquidacao,
}: {
  isOpen: boolean; onClose: () => void; onConfirmar: (motivo: string) => Promise<void>; loading: boolean; dataLiquidacao: string;
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  const handleConfirmar = async () => {
    if (!motivo.trim()) { setErro('O motivo da reabertura é obrigatório'); return; }
    if (motivo.trim().length < 10) { setErro('O motivo deve ter pelo menos 10 caracteres'); return; }
    setErro('');
    await onConfirmar(motivo);
    setMotivo('');
  };

  const handleClose = () => { setMotivo(''); setErro(''); onClose(); };
  if (!isOpen) return null;

  const dataFormatada = dataLiquidacao
    ? new Date(dataLiquidacao + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center"><RotateCcw className="w-6 h-6 text-amber-600" /></div>
          <div><h2 className="text-lg font-bold text-gray-900">Reabrir Liquidação</h2><p className="text-sm text-gray-500">Permitir edições nesta liquidação</p></div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 mb-1">Atenção!</p>
              <p className="text-amber-700">Você está prestes a reabrir a liquidação do dia:</p>
              <p className="font-semibold text-amber-900 mt-1 flex items-center gap-2"><Calendar className="w-4 h-4" />{dataFormatada}</p>
            </div>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Motivo da Reabertura <span className="text-red-500">*</span></label>
          <textarea value={motivo} onChange={(e) => { setMotivo(e.target.value); if (erro) setErro(''); }} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none text-sm ${erro ? 'border-red-300 bg-red-50' : 'border-gray-300'}`} rows={3} placeholder="Descreva o motivo (mínimo 10 caracteres)..." disabled={loading} />
          {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
          <p className="mt-1 text-xs text-gray-400">{motivo.length}/10 caracteres mínimos</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleClose} disabled={loading} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">Cancelar</button>
          <button onClick={handleConfirmar} disabled={loading || !motivo.trim()} className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Reabrindo...</> : <><RotateCcw className="w-4 h-4" />Reabrir</>}
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
  vendedor, rota, saldoConta, onAbrir, loading, onAbrirCalendario,
}: {
  vendedor: VendedorLiquidacao | null;
  rota: RotaLiquidacao;
  saldoConta: number;
  onAbrir: () => void;
  loading: boolean;
  onAbrirCalendario: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Liquidação Diária</h1>
          <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
            <MapPin className="w-4 h-4" />{rota.nome}
            {vendedor && <><span className="text-gray-300">•</span>{vendedor.nome}</>}
          </p>
        </div>
        <button onClick={onAbrirCalendario} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          <CalendarDays className="w-4 h-4" />Calendário
        </button>
      </div>
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><Play className="w-8 h-8 text-white" /></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Iniciar o Dia</h2>
          <p className="text-gray-500 text-sm mb-6">Nenhuma liquidação aberta. Inicie sua sessão de trabalho.</p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"><span className="text-sm font-bold text-blue-600">{vendedor?.nome?.charAt(0) || rota.nome.charAt(0)}</span></div>
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
          <button onClick={onAbrir} disabled={loading} className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Play className="w-5 h-5" />Abrir Liquidação</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

type FiltroLista = 'TODOS' | 'PAGOS' | 'NAO_PAGOS' | 'NOVOS' | 'RENOVADOS' | 'RENEGOCIADOS' | 'QUITADOS';

interface EventoCliente {
  tipo: 'PAGOU' | 'NAO_PAGOU' | 'NOVO' | 'RENOVACAO' | 'RENEGOCIACAO' | 'QUITADO';
  parcelasPagas?: number;
  totalParcelas?: number;
  numeroParcelaPaga?: number;
  valorPago?: number;
  valorEmprestimo?: number;
  numeroParcelasEmprestimo?: number;
}

export default function LiquidacaoDiariaPage() {
  const { profile, localizacao } = useUser();
  const userId = profile?.user_id;
  const rotaIdContexto = localizacao?.rota_id;
  const empresaId = localizacao?.empresa_id;

  const [vendedor, setVendedor] = useState<VendedorLiquidacao | null>(null);
  const [rota, setRota] = useState<RotaLiquidacao | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string>('');
  const [liquidacao, setLiquidacao] = useState<LiquidacaoDiaria | null>(null);
  const [liquidacaoAtiva, setLiquidacaoAtiva] = useState<LiquidacaoDiaria | null>(null);
  const [saldoConta, setSaldoConta] = useState(0);
  const [clientesDia, setClientesDia] = useState<ClienteDoDia[]>([]);
  const [estatisticas, setEstatisticas] = useState<EstatisticasClientesDia | null>(null);
  const [semRotaSelecionada, setSemRotaSelecionada] = useState(false);

  const [emprestimos, setEmprestimos] = useState({ total: 0, quantidade: 0, novos: 0, renovacoes: 0, juros: 0 });
  const [metaDia, setMetaDia] = useState(0);

  const [emprestimosDoDia, setEmprestimosDoDia] = useState<Array<{
    id: string; cliente_id: string; valor_principal: number; numero_parcelas: number; tipo_emprestimo: string; status: string;
  }>>([]);

  const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
  const [liquidacoesMes, setLiquidacoesMes] = useState<LiquidacaoDiaria[]>([]);
  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [visualizandoOutroDia, setVisualizandoOutroDia] = useState(false);
  const [previsaoDia, setPrevisaoDia] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [loadingCalendario, setLoadingCalendario] = useState(false);
  const [loadingAcao, setLoadingAcao] = useState(false);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalFechar, setModalFechar] = useState(false);
  const [modalExtrato, setModalExtrato] = useState(false);
  const [modalReabrir, setModalReabrir] = useState(false);

  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteComTotais | null>(null);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);

  const [filtroLista, setFiltroLista] = useState<FiltroLista>('TODOS');
  const [buscaCliente, setBuscaCliente] = useState('');

  // Contagem de notas
  const [qtdNotasLiquidacao, setQtdNotasLiquidacao] = useState(0);
  const [notasClientes, setNotasClientes] = useState<Map<string, { liquidacao: number; outras: boolean }>>(new Map());
  const [modalNotasCliente, setModalNotasCliente] = useState<{ aberto: boolean; clienteId: string; clienteNome: string }>({
    aberto: false, clienteId: '', clienteNome: '',
  });

  const [modalEmprestimos, setModalEmprestimos] = useState(false);
  const [modalDespesas, setModalDespesas] = useState(false);
  const [modalMicroseguros, setModalMicroseguros] = useState(false);

  const podeReabrir = profile?.tipo_usuario === 'SUPER_ADMIN' || profile?.tipo_usuario === 'ADMIN';
  const isLiquidacaoReaberta = liquidacao?.status === 'REABERTO';

  const carregarDadosLiquidacao = useCallback(async (liq: LiquidacaoDiaria, rotaId: string) => {
    try {
      const dataVencimento = liq.data_abertura.split('T')[0];
      const clientes = await liquidacaoService.buscarClientesDoDia(rotaId, dataVencimento);
      setClientesDia(clientes);
      const stats = liquidacaoService.calcularEstatisticasClientesDia(clientes);
      setEstatisticas(stats);
      const emps = await liquidacaoService.buscarEmprestimosDoDia(liq.id);
      setEmprestimos(emps);

      const supabase = (await import('@/lib/supabase/client')).createClient();
      const { data: empsLista } = await supabase
        .from('emprestimos')
        .select('id, cliente_id, valor_principal, numero_parcelas, tipo_emprestimo, status')
        .eq('liquidacao_id', liq.id);
      setEmprestimosDoDia((empsLista || []) as any);

      // Contagem total de notas da liquidação
      const { count: countNotasLiq } = await supabase
        .from('notas')
        .select('id', { count: 'exact', head: true })
        .eq('liquidacao_id', liq.id)
        .eq('status', 'ATIVA');
      setQtdNotasLiquidacao(countNotasLiq || 0);

      // Notas por cliente
      if (clientes.length > 0) {
        const clienteIds = [...new Set(clientes.map(c => c.cliente_id))];
        const { data: notasLiq } = await supabase
          .from('notas').select('cliente_id').eq('liquidacao_id', liq.id).eq('status', 'ATIVA').in('cliente_id', clienteIds);
        const { data: notasOutras } = await supabase
          .from('notas').select('cliente_id').neq('liquidacao_id', liq.id).eq('status', 'ATIVA').in('cliente_id', clienteIds);
        const mapaNotas = new Map<string, { liquidacao: number; outras: boolean }>();
        (notasLiq || []).forEach((n: any) => {
          const atual = mapaNotas.get(n.cliente_id) || { liquidacao: 0, outras: false };
          mapaNotas.set(n.cliente_id, { ...atual, liquidacao: atual.liquidacao + 1 });
        });
        (notasOutras || []).forEach((n: any) => {
          const atual = mapaNotas.get(n.cliente_id) || { liquidacao: 0, outras: false };
          mapaNotas.set(n.cliente_id, { ...atual, outras: true });
        });
        setNotasClientes(mapaNotas);
      }

      setBuscaCliente('');
      setFiltroLista('TODOS');
    } catch (error) {
      console.error('Erro ao carregar dados da liquidação:', error);
    }
  }, []);

  const carregarDados = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setSemRotaSelecionada(false);
    const tipoUsuario = profile?.tipo_usuario;
    try {
      let rotaId: string | null = null;
      let vendedorData: VendedorLiquidacao | null = null;
      let rotaData: RotaLiquidacao | null = null;

      if (tipoUsuario === 'VENDEDOR') {
        vendedorData = await liquidacaoService.buscarVendedorPorUserId(userId);
        if (vendedorData) {
          rotaData = await liquidacaoService.buscarRotaVendedor(vendedorData.id);
          rotaId = rotaData?.id || null;
        }
      }

      if (!rotaId && rotaIdContexto) {
        const temPermissao = validarPermissaoRota(tipoUsuario, rotaIdContexto, profile);
        if (!temPermissao) { setSemRotaSelecionada(true); setLoading(false); return; }
        rotaId = rotaIdContexto;
        rotaData = await liquidacaoService.buscarRotaPorId(rotaIdContexto, empresaId || undefined);
        if (rotaData) vendedorData = await liquidacaoService.buscarVendedorDaRota(rotaIdContexto);
      }

      if (!rotaId && profile?.ultima_rota_id) {
        const ultimaRotaId = profile.ultima_rota_id;
        const temPermissao = validarPermissaoRota(tipoUsuario, ultimaRotaId, profile);
        if (temPermissao) {
          rotaId = ultimaRotaId;
          rotaData = await liquidacaoService.buscarRotaPorId(ultimaRotaId, empresaId || undefined);
          if (rotaData) vendedorData = await liquidacaoService.buscarVendedorDaRota(ultimaRotaId);
        }
      }

      if (!rotaId || !rotaData) { setSemRotaSelecionada(true); setLoading(false); return; }

      setVendedor(vendedorData);
      setRota(rotaData);

      if (rotaData?.empresa_id) {
        const supabase = (await import('@/lib/supabase/client')).createClient();
        const { data: empresaData } = await supabase.from('empresas').select('nome').eq('id', rotaData.empresa_id).single();
        setEmpresaNome(empresaData?.nome || '');
      }

      const contaData = await liquidacaoService.buscarSaldoContaRota(rotaId);
      setSaldoConta(contaData?.saldo_atual || 0);

      const liquidacaoData = await liquidacaoService.buscarLiquidacaoAberta(rotaId);
      setLiquidacao(liquidacaoData);
      setLiquidacaoAtiva(liquidacaoData);

      if (liquidacaoData) {
        await carregarDadosLiquidacao(liquidacaoData, rotaId);
        setDataSelecionada(new Date(liquidacaoData.data_abertura));
      }

      const meta = await liquidacaoService.buscarMetaRota(rotaId);
      setMetaDia(meta);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, rotaIdContexto, empresaId, profile, carregarDadosLiquidacao]);

  const carregarDadosCalendario = useCallback(async (rotaId: string, ano: number, mes: number) => {
    setLoadingCalendario(true);
    try {
      const liquidacoes = await liquidacaoService.buscarLiquidacoesMes(rotaId, ano, mes);
      setLiquidacoesMes(liquidacoes);
    } catch (error) {
      console.error('Erro ao carregar dados do calendário:', error);
    } finally {
      setLoadingCalendario(false);
    }
  }, []);

  const handleMesChange = useCallback((ano: number, mes: number) => {
    if (rota) carregarDadosCalendario(rota.id, ano, mes);
  }, [rota, carregarDadosCalendario]);

  const handleSelecionarData = useCallback(async (data: Date) => {
    if (!rota) return;
    setDataSelecionada(data);
    setLoadingCalendario(true);
    const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    const dataLiquidacaoAtiva = liquidacaoAtiva?.data_abertura?.split('T')[0];

    try {
      if (dataLiquidacaoAtiva && dataStr === dataLiquidacaoAtiva) {
        setLiquidacao(liquidacaoAtiva);
        setVisualizandoOutroDia(false);
        setPrevisaoDia(null);
        if (liquidacaoAtiva) await carregarDadosLiquidacao(liquidacaoAtiva, rota.id);
        setLoadingCalendario(false);
        return;
      }

      const liqData = await liquidacaoService.buscarLiquidacaoPorData(rota.id, dataStr);
      if (liqData) {
        setLiquidacao(liqData);
        setVisualizandoOutroDia(true);
        await carregarDadosLiquidacao(liqData, rota.id);
        setPrevisaoDia(null);
      } else {
        setLiquidacao(null);
        setVisualizandoOutroDia(true);
        const previsao = await liquidacaoService.buscarPrevisaoDia(rota.id, dataStr);
        setPrevisaoDia(previsao);
        const clientes = await liquidacaoService.buscarClientesDoDia(rota.id, dataStr);
        setClientesDia(clientes);
      }
    } catch (error) {
      console.error('Erro ao selecionar data:', error);
    } finally {
      setLoadingCalendario(false);
    }
  }, [rota, liquidacaoAtiva, carregarDadosLiquidacao]);

  const handleConfirmarDataCalendario = useCallback(async (data: Date) => {
    if (!rota) return;
    await handleSelecionarData(data);
  }, [rota, handleSelecionarData]);

  const voltarParaLiquidacaoAtiva = useCallback(async () => {
    if (liquidacaoAtiva && rota) {
      setDataSelecionada(new Date(liquidacaoAtiva.data_abertura));
      setLiquidacao(liquidacaoAtiva);
      setVisualizandoOutroDia(false);
      setPrevisaoDia(null);
      await carregarDadosLiquidacao(liquidacaoAtiva, rota.id);
    } else {
      setDataSelecionada(new Date());
      setVisualizandoOutroDia(false);
      setPrevisaoDia(null);
      await carregarDados();
    }
  }, [liquidacaoAtiva, rota, carregarDadosLiquidacao, carregarDados]);

  useEffect(() => { carregarDados(); }, [carregarDados]);
  useEffect(() => {
    if (rota) {
      const agora = new Date();
      carregarDadosCalendario(rota.id, agora.getFullYear(), agora.getMonth() + 1);
    }
  }, [rota, carregarDadosCalendario]);

  const handleAbrirLiquidacao = async (caixaInicial: number) => {
    if (!rota || !userId) return;
    setLoadingAcao(true);
    try {
      const resultado = await liquidacaoService.abrirLiquidacao({ vendedor_id: vendedor?.id || '', rota_id: rota.id, caixa_inicial: caixaInicial, user_id: userId });
      if (resultado.sucesso && resultado.liquidacao_id) { await carregarDados(); setModalAbrir(false); }
      else alert(resultado.mensagem);
    } catch (error) { console.error('Erro ao abrir liquidação:', error); alert('Erro ao abrir liquidação'); }
    finally { setLoadingAcao(false); }
  };

  const handleFecharLiquidacao = async (observacoes: string) => {
    if (!liquidacao || !userId) return;
    setLoadingAcao(true);
    try {
      const resultado = liquidacao.status === 'REABERTO'
        ? await liquidacaoService.fecharLiquidacaoReaberta({ liquidacao_id: liquidacao.id, user_id: userId, observacoes })
        : await liquidacaoService.fecharLiquidacao({ liquidacao_id: liquidacao.id, user_id: userId, observacoes });
      if (resultado.sucesso) { await carregarDados(); setModalFechar(false); }
      else alert(resultado.mensagem);
    } catch (error) { console.error('Erro ao fechar liquidação:', error); alert('Erro ao fechar liquidação'); }
    finally { setLoadingAcao(false); }
  };

  const handleReabrirLiquidacao = async (motivo: string) => {
    if (!liquidacao || !userId) return;
    setLoadingAcao(true);
    try {
      const resultado = await liquidacaoService.reabrirLiquidacao({ liquidacao_id: liquidacao.id, user_id: userId, motivo });
      if (resultado.sucesso) { await carregarDados(); setModalReabrir(false); }
      else alert(resultado.mensagem);
    } catch (error) { console.error('Erro ao reabrir liquidação:', error); alert('Erro ao reabrir liquidação'); }
    finally { setLoadingAcao(false); }
  };

  const handleAbrirModalCliente = (cliente: ClienteDoDia) => {
    const clienteParaModal: ClienteComTotais = {
      id: cliente.cliente_id,
      codigo_cliente: parseInt(cliente.consecutivo) || 0,
      nome: cliente.nome,
      documento: '', telefone_celular: cliente.telefone_celular || '', telefone_fixo: '',
      email: '', endereco: cliente.endereco || '', endereco_comercial: '', foto_url: '',
      empresa_id: '', status: 'ATIVO', created_at: '', updated_at: '',
      qtd_emprestimos_ativos: 1, qtd_emprestimos_total: 0,
      valor_total_emprestimos: cliente.valor_principal || 0, valor_total_pago: 0,
      valor_saldo_devedor: cliente.saldo_emprestimo || 0,
      parcelas_atrasadas: cliente.total_parcelas_vencidas || 0, parcelas_pendentes: 0,
      data_cadastro: '', rotas_ids: [cliente.rota_id],
      permite_emprestimo_adicional: cliente.permite_emprestimo_adicional ?? false,
    };
    setClienteSelecionado(clienteParaModal);
    setModalClienteAberto(true);
  };

  const handleAbrirNotas = () => {
    console.log('TODO: abrir modal de notas da liquidação', { liquidacaoId: liquidacao?.id, qtdNotasLiquidacao });
  };

  // Máscara de evento por cliente
  const eventosPorCliente = useMemo(() => {
    const mapa = new Map<string, EventoCliente>();
    if (!clientesDia.length && !emprestimosDoDia.length) return mapa;

    const empPorCliente = new Map<string, typeof emprestimosDoDia[number]>();
    for (const emp of emprestimosDoDia) {
      const existente = empPorCliente.get(emp.cliente_id);
      const prioridade: Record<string, number> = { QUITADO: 4, NOVO: 3, RENOVACAO: 2, RENEGOCIACAO: 1 };
      const pAtual = prioridade[existente?.tipo_emprestimo || ''] || 0;
      const pNovo = emp.status === 'QUITADO' ? 4 : (prioridade[emp.tipo_emprestimo] || 0);
      if (!existente || pNovo > pAtual) empPorCliente.set(emp.cliente_id, emp);
    }

    const pagosPorCliente = new Map<string, { somaValor: number; parcelas: number[]; totalParcelas: number }>();
    const naoPagosPorCliente = new Map<string, { numero: number; total: number }>();

    for (const c of clientesDia) {
      if (c.status_dia === 'PAGO' || c.status_dia === 'PARCIAL') {
        const atual = pagosPorCliente.get(c.cliente_id) || { somaValor: 0, parcelas: [], totalParcelas: c.numero_parcelas };
        atual.somaValor += Number(c.valor_pago_parcela || 0);
        atual.parcelas.push(c.numero_parcela);
        atual.totalParcelas = c.numero_parcelas;
        pagosPorCliente.set(c.cliente_id, atual);
      } else {
        if (!naoPagosPorCliente.has(c.cliente_id)) {
          naoPagosPorCliente.set(c.cliente_id, { numero: c.numero_parcela, total: c.numero_parcelas });
        }
      }
    }

    const todosClienteIds = new Set([
      ...clientesDia.map(c => c.cliente_id),
      ...emprestimosDoDia.map(e => e.cliente_id),
    ]);

    for (const cid of todosClienteIds) {
      const emp = empPorCliente.get(cid);
      if (emp?.status === 'QUITADO') { mapa.set(cid, { tipo: 'QUITADO', valorEmprestimo: Number(emp.valor_principal || 0) }); continue; }
      if (emp?.tipo_emprestimo === 'NOVO') { mapa.set(cid, { tipo: 'NOVO', valorEmprestimo: Number(emp.valor_principal || 0), numeroParcelasEmprestimo: emp.numero_parcelas }); continue; }
      if (emp?.tipo_emprestimo === 'RENOVACAO') { mapa.set(cid, { tipo: 'RENOVACAO', valorEmprestimo: Number(emp.valor_principal || 0), numeroParcelasEmprestimo: emp.numero_parcelas }); continue; }
      if (emp?.tipo_emprestimo === 'RENEGOCIACAO') { mapa.set(cid, { tipo: 'RENEGOCIACAO', valorEmprestimo: Number(emp.valor_principal || 0), numeroParcelasEmprestimo: emp.numero_parcelas }); continue; }
      const pag = pagosPorCliente.get(cid);
      if (pag && pag.somaValor > 0) { mapa.set(cid, { tipo: 'PAGOU', parcelasPagas: pag.parcelas.length, totalParcelas: pag.totalParcelas, numeroParcelaPaga: pag.parcelas[0], valorPago: pag.somaValor }); continue; }
      const np = naoPagosPorCliente.get(cid);
      if (np) mapa.set(cid, { tipo: 'NAO_PAGOU', numeroParcelaPaga: np.numero, totalParcelas: np.total });
    }

    return mapa;
  }, [clientesDia, emprestimosDoDia]);

  const contagens = useMemo(() => {
    let pagos = 0, naoPagos = 0, novos = 0, renovados = 0, renegociados = 0, quitados = 0;
    for (const ev of eventosPorCliente.values()) {
      if (ev.tipo === 'PAGOU') pagos++;
      else if (ev.tipo === 'NAO_PAGOU') naoPagos++;
      else if (ev.tipo === 'NOVO') novos++;
      else if (ev.tipo === 'RENOVACAO') renovados++;
      else if (ev.tipo === 'RENEGOCIACAO') renegociados++;
      else if (ev.tipo === 'QUITADO') quitados++;
    }
    return { todos: eventosPorCliente.size, pagos, naoPagos, novos, renovados, renegociados, quitados };
  }, [eventosPorCliente]);

  const clientesComEvento = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ cliente: ClienteDoDia; evento?: EventoCliente }> = [];
    for (const c of clientesDia) {
      if (seen.has(c.cliente_id)) continue;
      seen.add(c.cliente_id);
      items.push({ cliente: c, evento: eventosPorCliente.get(c.cliente_id) });
    }
    for (const emp of emprestimosDoDia) {
      if (seen.has(emp.cliente_id)) continue;
      const ev = eventosPorCliente.get(emp.cliente_id);
      if (!ev) continue;
      const fake = {
        cliente_id: emp.cliente_id, nome: '(cliente do empréstimo)', consecutivo: '',
        telefone_celular: '', endereco: '', rota_id: rota?.id || '', parcela_id: emp.id,
        numero_parcela: 0, numero_parcelas: emp.numero_parcelas, valor_parcela: 0,
        valor_pago_parcela: 0, valor_principal: emp.valor_principal, saldo_emprestimo: 0,
        status_dia: 'PENDENTE', tem_parcelas_vencidas: false, total_parcelas_vencidas: 0,
        permite_emprestimo_adicional: false,
      } as any;
      seen.add(emp.cliente_id);
      items.push({ cliente: fake, evento: ev });
    }
    return items;
  }, [clientesDia, emprestimosDoDia, eventosPorCliente, rota]);

  const clientesFiltrados = useMemo(() => {
    return clientesComEvento.filter(({ cliente, evento }) => {
      if (filtroLista !== 'TODOS') {
        if (!evento) return false;
        if (filtroLista === 'PAGOS' && evento.tipo !== 'PAGOU') return false;
        if (filtroLista === 'NAO_PAGOS' && evento.tipo !== 'NAO_PAGOU') return false;
        if (filtroLista === 'NOVOS' && evento.tipo !== 'NOVO') return false;
        if (filtroLista === 'RENOVADOS' && evento.tipo !== 'RENOVACAO') return false;
        if (filtroLista === 'RENEGOCIADOS' && evento.tipo !== 'RENEGOCIACAO') return false;
        if (filtroLista === 'QUITADOS' && evento.tipo !== 'QUITADO') return false;
      }
      if (buscaCliente) {
        const busca = buscaCliente.toLowerCase();
        const bateNome = cliente.nome?.toLowerCase().includes(busca);
        const bateCod = cliente.consecutivo?.includes(buscaCliente);
        if (!bateNome && !bateCod) return false;
      }
      return true;
    });
  }, [clientesComEvento, filtroLista, buscaCliente]);

  const percentualMeta = liquidacao ? calcularPercentual(liquidacao.valor_recebido_dia || 0, liquidacao.valor_esperado_dia || metaDia) : 0;

  if (loading) return <TelaSkeleton />;

  if (semRotaSelecionada || !rota) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="bg-white rounded-xl border border-amber-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Selecione uma Rota Específica</h2>
          <p className="text-gray-500 text-sm mb-4">O módulo de Liquidação Diária requer uma rota específica selecionada.</p>
          <p className="text-gray-400 text-xs">Use o seletor no topo da página para escolher uma rota.<br />A opção "Todas as rotas" não é permitida neste módulo.</p>
        </div>
      </div>
    );
  }

  if (!liquidacao && !visualizandoOutroDia) {
    return (
      <>
        <TelaIniciarDia vendedor={vendedor} rota={rota} saldoConta={saldoConta} onAbrir={() => setModalAbrir(true)} loading={loadingAcao} onAbrirCalendario={() => setMostrarCalendario(true)} />
        <ModalAbrirLiquidacao isOpen={modalAbrir} onClose={() => setModalAbrir(false)} onConfirmar={handleAbrirLiquidacao} loading={loadingAcao} saldoSugerido={saldoConta} />
        <ModalCalendarioLiquidacao isOpen={mostrarCalendario} onClose={() => setMostrarCalendario(false)} rotaId={rota.id} liquidacoesMes={liquidacoesMes} dataSelecionada={dataSelecionada} onSelecionarData={(d) => setDataSelecionada(d)} onMesChange={handleMesChange} onConfirmar={handleConfirmarDataCalendario} loading={loadingCalendario} />
      </>
    );
  }

  // =====================================================
  // RENDER PRINCIPAL — Layout 2 colunas
  // =====================================================
  // Container principal: ocupa toda a viewport menos espaço do shell/header global (estimado ~7rem)
  // page-content já tem padding do layout pai. Aqui criamos altura calculada e overflow-hidden.

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col gap-3 overflow-hidden">

      {/* Faixa de reabertura */}
      {isLiquidacaoReaberta && liquidacao && (
        <FaixaLiquidacaoReaberta
          dataLiquidacao={liquidacao.data_abertura.split('T')[0]}
          dataReabertura={liquidacao.data_reabertura}
          reabertoPor={liquidacao.reaberto_por_nome}
        />
      )}

      {/* Banner visualizando outro dia */}
      {visualizandoOutroDia && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-600" />
            <div className="text-xs">
              <span className="font-medium text-amber-800">
                Visualizando {dataSelecionada.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
              <span className="text-amber-600 ml-2">· {liquidacao ? `Liquidação ${liquidacao.status}` : 'Sem liquidação'}</span>
            </div>
          </div>
          {liquidacaoAtiva && (
            <button onClick={voltarParaLiquidacaoAtiva} className="flex items-center gap-1 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded text-xs font-medium">
              <ChevronLeft className="w-3 h-3" />Voltar
            </button>
          )}
        </div>
      )}

      {/* HEADER COMPACTO */}
      <div className="flex items-center justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900">Liquidação Diária</h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mt-0.5">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{rota.nome}</span>
            {vendedor && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{vendedor.nome}{vendedor.codigo_vendedor && ` (${vendedor.codigo_vendedor})`}</span>}
            {liquidacao && (
              <>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-green-600" />Abertura: {formatarDataHora(liquidacao.data_abertura)}</span>
                {liquidacao.data_fechamento && <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-600" />Fechamento: {formatarDataHora(liquidacao.data_fechamento)}</span>}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {liquidacao && (
            <button onClick={() => setModalExtrato(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors">
              <FileText className="w-3.5 h-3.5" />Extrato
            </button>
          )}
          {(() => {
            // Botão calendário com data da liquidação + cor por status
            const status = liquidacao?.status;
            const isAberto = status === 'ABERTO' || status === 'REABERTO';
            const isFechado = status === 'FECHADO' || status === 'APROVADO';
            const dataLiq = (liquidacao as any)?.data_liquidacao || liquidacao?.data_abertura?.split('T')[0];
            const dataFormatada = dataLiq
              ? new Date(dataLiq + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : 'Calendário';

            let classes = 'bg-gray-100 text-gray-700 hover:bg-gray-200';
            if (isAberto) classes = 'bg-green-100 text-green-700 hover:bg-green-200';
            else if (isFechado) classes = 'bg-blue-100 text-blue-700 hover:bg-blue-200';

            return (
              <button
                onClick={() => setMostrarCalendario(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${classes}`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {dataFormatada}
              </button>
            );
          })()}
          <button onClick={handleAbrirNotas} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors">
            <MessageSquare className="w-3.5 h-3.5" />Notas
            {qtdNotasLiquidacao > 0 && (
              <span className="bg-yellow-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {qtdNotasLiquidacao > 99 ? '99+' : qtdNotasLiquidacao}
              </span>
            )}
          </button>
          {liquidacao?.status === 'FECHADO' && podeReabrir && (
            <button onClick={() => setModalReabrir(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />Reabrir
            </button>
          )}
          {(liquidacao?.status === 'ABERTO' || liquidacao?.status === 'REABERTO') && !visualizandoOutroDia && (
            <button onClick={() => setModalFechar(true)} className={`flex items-center gap-1.5 px-3 py-1.5 ${liquidacao?.status === 'REABERTO' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg text-xs font-medium transition-colors`}>
              <Square className="w-3.5 h-3.5" />Fechar Dia
            </button>
          )}
        </div>
      </div>

      {/* LAYOUT 2 COLUNAS: 35% / 65% */}
      {liquidacao && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[35%_1fr] gap-3 min-h-0">

          {/* COLUNA ESQUERDA — 4 cards distribuídos */}
          <div className="flex flex-col gap-3 min-h-0">

            {/* Caixa */}
            <CardSaldo titulo="Caixa" inicial={liquidacao.caixa_inicial} final={liquidacao.caixa_final} icone={Wallet} corBase="blue" />

            {/* Carteira */}
            <CardSaldo titulo="Carteira (A Receber)" inicial={liquidacao.carteira_inicial} final={liquidacao.carteira_final} icone={TrendingUp} corBase="purple" />

            {/* Meta do dia */}
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Meta do Dia</h3>
                <span className="ml-auto text-lg font-bold text-gray-900 tabular-nums">{percentualMeta}%</span>
              </div>
              <ProgressBar percentual={percentualMeta} />
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 pt-2 border-t border-gray-100 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Esperado</span>
                  <span className="font-semibold tabular-nums">{formatarMoeda(liquidacao.valor_esperado_dia || metaDia)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Recebido</span>
                  <span className="font-semibold text-green-600 tabular-nums">{formatarMoeda(liquidacao.valor_recebido_dia)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Parcelas</span>
                  <span className="font-semibold">
                    <span className="text-green-600">{liquidacao.pagamentos_pagos}</span>
                    <span className="text-gray-400">/</span>
                    <span className="text-red-600">{liquidacao.pagamentos_nao_pagos}</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1"><Banknote className="w-3 h-3" />Dinheiro</span>
                  <span className="font-semibold text-emerald-600 tabular-nums">{formatarMoeda(liquidacao.valor_dinheiro)}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-gray-500 flex items-center gap-1"><CreditCard className="w-3 h-3" />Transferência</span>
                  <span className="font-semibold text-sky-600 tabular-nums">{formatarMoeda(liquidacao.valor_transferencia)}</span>
                </div>
              </div>
            </div>

            {/* Card Movimentos (Empréstimos + Despesas + Microseguro) */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2">
                <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Movimentos do Dia</h3>
              </div>
              <div className="divide-y divide-gray-100">
                <button onClick={() => setModalEmprestimos(true)} className="w-full px-3 py-2.5 hover:bg-green-50/50 transition-colors flex items-center gap-2 text-left">
                  <div className="w-7 h-7 bg-green-50 rounded-md flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Empréstimos</p>
                    <p className="text-[10px] text-gray-400">{liquidacao.qtd_emprestimos_dia} emp.{(liquidacao.total_juros_dia ?? 0) > 0 && ` · juros ${formatarMoeda(liquidacao.total_juros_dia)}`}</p>
                  </div>
                  <span className="text-sm font-bold text-green-700 tabular-nums">{formatarMoeda(liquidacao.total_emprestado_dia)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
                <button onClick={() => setModalDespesas(true)} className="w-full px-3 py-2.5 hover:bg-red-50/50 transition-colors flex items-center gap-2 text-left">
                  <div className="w-7 h-7 bg-red-50 rounded-md flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-3.5 h-3.5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Despesas</p>
                    <p className="text-[10px] text-gray-400">{liquidacao.qtd_despesas_dia} lanç.</p>
                  </div>
                  <span className="text-sm font-bold text-red-700 tabular-nums">{formatarMoeda(liquidacao.total_despesas_dia)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
                <button onClick={() => setModalMicroseguros(true)} className="w-full px-3 py-2.5 hover:bg-teal-50/50 transition-colors flex items-center gap-2 text-left">
                  <div className="w-7 h-7 bg-teal-50 rounded-md flex items-center justify-center flex-shrink-0">
                    <Shield className="w-3.5 h-3.5 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Microseguro</p>
                    <p className="text-[10px] text-gray-400">{liquidacao.qtd_microseguros_dia} cont.</p>
                  </div>
                  <span className="text-sm font-bold text-teal-700 tabular-nums">{formatarMoeda(liquidacao.total_microseguro_dia)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA — CLIENTES */}
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col min-h-0 overflow-hidden">
            {/* Cabeçalho com filtros + busca */}
            <div className="px-3 py-2.5 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Clientes do Dia</h3>
                <span className="text-xs text-gray-500">{clientesFiltrados.length} de {contagens.todos}</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                <ChipFiltro label="Todos" qtd={contagens.todos} ativo={filtroLista === 'TODOS'} onClick={() => setFiltroLista('TODOS')} cor="blue" />
                <ChipFiltro label="Pagos" qtd={contagens.pagos} ativo={filtroLista === 'PAGOS'} onClick={() => setFiltroLista('PAGOS')} cor="green" />
                <ChipFiltro label="Não Pagos" qtd={contagens.naoPagos} ativo={filtroLista === 'NAO_PAGOS'} onClick={() => setFiltroLista('NAO_PAGOS')} cor="red" />
                <ChipFiltro label="Novos" qtd={contagens.novos} ativo={filtroLista === 'NOVOS'} onClick={() => setFiltroLista('NOVOS')} cor="emerald" />
                <ChipFiltro label="Renov." qtd={contagens.renovados} ativo={filtroLista === 'RENOVADOS'} onClick={() => setFiltroLista('RENOVADOS')} cor="blue2" />
                <ChipFiltro label="Reneg." qtd={contagens.renegociados} ativo={filtroLista === 'RENEGOCIADOS'} onClick={() => setFiltroLista('RENEGOCIADOS')} cor="purple" />
                <ChipFiltro label="Quitados" qtd={contagens.quitados} ativo={filtroLista === 'QUITADOS'} onClick={() => setFiltroLista('QUITADOS')} cor="teal" />
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {buscaCliente && (
                  <button onClick={() => setBuscaCliente('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Lista scrollável */}
            <div className="flex-1 overflow-y-auto">
              {clientesFiltrados.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {clientesFiltrados.map(({ cliente, evento }) => {
                    const notasInfo = notasClientes.get(cliente.cliente_id);
                    const temNotasLiquidacao = (notasInfo?.liquidacao || 0) > 0;
                    return (
                      <div
                        key={cliente.cliente_id}
                        className="px-3 py-2 hover:bg-blue-50/50 transition-colors cursor-pointer"
                        onClick={() => handleAbrirModalCliente(cliente)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${getCorAvatar(evento)}`}>
                            {cliente.nome?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">{cliente.nome}</span>
                              {temNotasLiquidacao && (
                                <button onClick={(e) => { e.stopPropagation(); setModalNotasCliente({ aberto: true, clienteId: cliente.cliente_id, clienteNome: cliente.nome }); }} className="text-[10px] flex items-center gap-0.5 text-amber-600 hover:text-amber-700 flex-shrink-0">
                                  <MessageSquare className="w-3 h-3" />
                                  {notasInfo?.liquidacao}
                                </button>
                              )}
                            </div>
                            <div className="text-[11px] mt-0.5">
                              <MascaraEvento evento={evento} cliente={cliente} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">
                  {buscaCliente ? `Nenhum cliente encontrado para "${buscaCliente}"` : 'Nenhum cliente nesta categoria'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAIS */}
      <ModalAbrirLiquidacao isOpen={modalAbrir} onClose={() => setModalAbrir(false)} onConfirmar={handleAbrirLiquidacao} loading={loadingAcao} saldoSugerido={saldoConta} />
      <ModalFecharLiquidacao isOpen={modalFechar} onClose={() => setModalFechar(false)} onConfirmar={handleFecharLiquidacao} loading={loadingAcao} liquidacao={liquidacao} />
      <ModalReabrirLiquidacao isOpen={modalReabrir} onClose={() => setModalReabrir(false)} onConfirmar={handleReabrirLiquidacao} loading={loadingAcao} dataLiquidacao={liquidacao?.data_abertura?.split('T')[0] || ''} />
      <ModalExtratoLiquidacao isOpen={modalExtrato} onClose={() => setModalExtrato(false)} liquidacao={liquidacao} rotaNome={rota?.nome || ''} vendedorNome={vendedor?.nome} empresaNome={empresaNome} />
      <ModalDetalhesCliente isOpen={modalClienteAberto} onClose={() => { setModalClienteAberto(false); setClienteSelecionado(null); }} cliente={clienteSelecionado} />

      {liquidacao && rota && vendedor && (
        <ModalNotasCliente
          isOpen={modalNotasCliente.aberto}
          onClose={() => setModalNotasCliente({ aberto: false, clienteId: '', clienteNome: '' })}
          clienteId={modalNotasCliente.clienteId}
          clienteNome={modalNotasCliente.clienteNome}
          rotaId={rota.id}
          empresaId={rota.empresa_id}
          vendedorId={vendedor.id}
          liquidacaoId={liquidacao.id}
          autorId={userId || ''}
          autorNome={profile?.nome || 'Administrador'}
          dataReferencia={liquidacao.data_abertura.split('T')[0]}
        />
      )}

      {liquidacao && (
        <>
          <ModalEmprestimos isOpen={modalEmprestimos} onClose={() => setModalEmprestimos(false)} liquidacaoId={liquidacao.id} totalFallback={liquidacao.total_emprestado_dia} qtdFallback={liquidacao.qtd_emprestimos_dia} />
          <ModalDespesas isOpen={modalDespesas} onClose={() => setModalDespesas(false)} liquidacaoId={liquidacao.id} totalFallback={liquidacao.total_despesas_dia} qtdFallback={liquidacao.qtd_despesas_dia} />
          <ModalMicroseguros isOpen={modalMicroseguros} onClose={() => setModalMicroseguros(false)} liquidacaoId={liquidacao.id} totalFallback={liquidacao.total_microseguro_dia} qtdFallback={liquidacao.qtd_microseguros_dia} />
        </>
      )}

      {rota && (
        <ModalCalendarioLiquidacao
          isOpen={mostrarCalendario}
          onClose={() => setMostrarCalendario(false)}
          rotaId={rota.id}
          liquidacoesMes={liquidacoesMes}
          dataSelecionada={dataSelecionada}
          onSelecionarData={(data) => setDataSelecionada(data)}
          onMesChange={handleMesChange}
          onConfirmar={handleConfirmarDataCalendario}
          loading={loadingCalendario}
        />
      )}
    </div>
  );
}

// =====================================================
// COMPONENTES AUXILIARES DE RENDER
// =====================================================

function ChipFiltro({
  label, qtd, ativo, onClick, cor,
}: {
  label: string;
  qtd: number;
  ativo: boolean;
  onClick: () => void;
  cor: 'blue' | 'green' | 'red' | 'emerald' | 'blue2' | 'purple' | 'teal';
}) {
  const desabilitado = qtd === 0;
  const coresAtivas: Record<string, string> = {
    blue: 'bg-blue-600 text-white border-blue-600',
    green: 'bg-green-600 text-white border-green-600',
    red: 'bg-red-600 text-white border-red-600',
    emerald: 'bg-emerald-600 text-white border-emerald-600',
    blue2: 'bg-blue-500 text-white border-blue-500',
    purple: 'bg-purple-600 text-white border-purple-600',
    teal: 'bg-teal-600 text-white border-teal-600',
  };
  const coresInativas: Record<string, string> = {
    blue: 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',
    green: 'bg-white text-green-700 border-green-200 hover:bg-green-50',
    red: 'bg-white text-red-700 border-red-200 hover:bg-red-50',
    emerald: 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    blue2: 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',
    purple: 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50',
    teal: 'bg-white text-teal-700 border-teal-200 hover:bg-teal-50',
  };
  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      className={`px-2 py-0.5 rounded-md border text-[10px] font-medium transition-colors flex items-center gap-1 ${
        desabilitado
          ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
          : ativo
            ? coresAtivas[cor]
            : coresInativas[cor]
      }`}
    >
      <span>{label}</span>
      <span className={`px-1 rounded-full text-[9px] font-bold ${
        desabilitado ? 'bg-gray-100' : ativo ? 'bg-white/20' : 'bg-gray-100'
      }`}>
        {qtd}
      </span>
    </button>
  );
}

function MascaraEvento({ evento, cliente }: { evento?: EventoCliente; cliente: ClienteDoDia }) {
  if (!evento) {
    return (
      <span className="text-gray-400">
        Parcela {cliente.numero_parcela}/{cliente.numero_parcelas} · {formatarMoeda(cliente.valor_parcela)}
      </span>
    );
  }
  if (evento.tipo === 'QUITADO') return <span className="text-emerald-700 font-medium">✅ Quitou empréstimo · {formatarMoeda(evento.valorEmprestimo || 0)}</span>;
  if (evento.tipo === 'NOVO') return <span className="text-green-700 font-medium">🆕 Novo empréstimo · {formatarMoeda(evento.valorEmprestimo || 0)} em {evento.numeroParcelasEmprestimo}x</span>;
  if (evento.tipo === 'RENOVACAO') return <span className="text-blue-700 font-medium">🔄 Renovação · {formatarMoeda(evento.valorEmprestimo || 0)} em {evento.numeroParcelasEmprestimo}x</span>;
  if (evento.tipo === 'RENEGOCIACAO') return <span className="text-purple-700 font-medium">↩ Renegociação · {formatarMoeda(evento.valorEmprestimo || 0)} em {evento.numeroParcelasEmprestimo}x</span>;
  if (evento.tipo === 'PAGOU') {
    const qtdParc = evento.parcelasPagas || 1;
    const txt = qtdParc > 1
      ? `${qtdParc} parcelas pagas · ${formatarMoeda(evento.valorPago || 0)}`
      : `Pagou parcela ${evento.numeroParcelaPaga}/${evento.totalParcelas} · ${formatarMoeda(evento.valorPago || 0)}`;
    return <span className="text-green-700 font-medium">💚 {txt}</span>;
  }
  if (evento.tipo === 'NAO_PAGOU') return <span className="text-red-600 font-medium">❌ Não pagou parcela {evento.numeroParcelaPaga}/{evento.totalParcelas}</span>;
  return null;
}

function getCorAvatar(evento?: EventoCliente): string {
  if (!evento) return 'bg-gray-100 text-gray-600';
  switch (evento.tipo) {
    case 'PAGOU': return 'bg-green-100 text-green-700';
    case 'NAO_PAGOU': return 'bg-red-100 text-red-700';
    case 'NOVO': return 'bg-emerald-100 text-emerald-700';
    case 'RENOVACAO': return 'bg-blue-100 text-blue-700';
    case 'RENEGOCIACAO': return 'bg-purple-100 text-purple-700';
    case 'QUITADO': return 'bg-teal-100 text-teal-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}