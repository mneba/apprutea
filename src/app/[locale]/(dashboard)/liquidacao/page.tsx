'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Clock,
  Users,
  CheckCircle,
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
  FileText,
  RotateCcw,
  AlertTriangle,
  Search,
  MessageSquare,
  X,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { liquidacaoService } from '@/services/liquidacao';
import { ModalCalendarioLiquidacao } from '@/components/liquidacao/ModalCalendarioLiquidacao';
import { ModalDetalhesCliente } from '@/components/clientes/ModalDetalhesCliente';
import { ModalExtratoLiquidacao } from '@/components/liquidacao/ModalExtratoLiquidacao';
import { FaixaLiquidacaoReaberta } from '@/components/liquidacao/FaixaLiquidacaoReaberta';
import { NotasLiquidacaoCard, ModalNotasCliente } from '@/components/liquidacao/NotasLiquidacao';
import {
  ModalEmprestimos,
  ModalDespesas,
  ModalMicroseguros,
  ModalPagamentos,
  ModalReceitas,
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

// =====================================================
// VALIDAÇÃO DE PERMISSÃO POR TIPO DE USUÁRIO
// =====================================================

function validarPermissaoRota(
  tipoUsuario: string | undefined,
  rotaId: string,
  userProfile: any
): boolean {
  if (!tipoUsuario || !rotaId) return false;

  if (tipoUsuario === 'SUPER_ADMIN') {
    return true;
  }

  if (tipoUsuario === 'ADMIN') {
    const empresasPermitidas = userProfile?.empresas_ids || [];
    return empresasPermitidas.length > 0;
  }

  if (tipoUsuario === 'MONITOR' || tipoUsuario === 'USUARIO_PADRAO') {
    const rotasPermitidas = userProfile?.rotas_ids || [];
    return rotasPermitidas.includes(rotaId);
  }

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
// SKELETONS (placeholders para evitar tela branca)
// =====================================================

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

function SkeletonCardResumo() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-5 w-28" />
        </div>
      </div>
    </div>
  );
}

function TelaSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <SkeletonBlock className="h-8 w-64" />
          <SkeletonBlock className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-24 rounded-lg" />
          <SkeletonBlock className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SkeletonCardResumo />
        <SkeletonCardResumo />
        <SkeletonCardResumo />
        <SkeletonCardResumo />
      </div>

      {/* Grid 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-2 w-full" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <SkeletonBlock className="h-4 w-40" />
          <div className="grid grid-cols-4 gap-2">
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
            <SkeletonBlock className="h-16" />
          </div>
        </div>
      </div>

      {/* Lista de clientes */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="h-10 w-full rounded-lg" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <SkeletonBlock className="h-7 w-7 rounded-full" />
            <SkeletonBlock className="h-4 flex-1" />
            <SkeletonBlock className="h-4 w-20" />
          </div>
        ))}
      </div>
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
            <h2 className="text-lg font-bold text-gray-900">
              {isReaberta ? 'Fechar Liquidação Reaberta' : 'Fechar Liquidação'}
            </h2>
            <p className="text-sm text-gray-500">
              {isReaberta ? 'Finalizar correções e fechar' : 'Encerrar sessão de trabalho'}
            </p>
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
            <span className="text-gray-600">Recebido</span>
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
            placeholder={isReaberta ? "Descreva as correções realizadas..." : "Alguma observação sobre o dia..."}
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
            className={`flex-1 px-4 py-2.5 ${isReaberta ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
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
// MODAL DE REABERTURA
// =====================================================

function ModalReabrirLiquidacao({
  isOpen,
  onClose,
  onConfirmar,
  loading,
  dataLiquidacao,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
  loading: boolean;
  dataLiquidacao: string;
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');

  const handleConfirmar = async () => {
    if (!motivo.trim()) {
      setErro('O motivo da reabertura é obrigatório');
      return;
    }

    if (motivo.trim().length < 10) {
      setErro('O motivo deve ter pelo menos 10 caracteres');
      return;
    }

    setErro('');
    await onConfirmar(motivo);
    setMotivo('');
  };

  const handleClose = () => {
    setMotivo('');
    setErro('');
    onClose();
  };

  if (!isOpen) return null;

  const dataFormatada = dataLiquidacao
    ? new Date(dataLiquidacao + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <RotateCcw className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Reabrir Liquidação</h2>
            <p className="text-sm text-gray-500">Permitir edições nesta liquidação</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 mb-1">Atenção!</p>
              <p className="text-amber-700">
                Você está prestes a reabrir a liquidação do dia:
              </p>
              <p className="font-semibold text-amber-900 mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {dataFormatada}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-600">
          <ul className="space-y-1">
            <li>• A liquidação ficará disponível para edições</li>
            <li>• Apenas você (admin) poderá fazer alterações no web</li>
            <li>• O vendedor continuará trabalhando normalmente no app</li>
            <li>• Após as correções, feche a liquidação novamente</li>
          </ul>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Motivo da Reabertura <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (erro) setErro('');
            }}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none text-sm ${
              erro ? 'border-red-300 bg-red-50' : 'border-gray-300'
            }`}
            rows={3}
            placeholder="Descreva o motivo da reabertura (mínimo 10 caracteres)..."
            disabled={loading}
          />
          {erro && (
            <p className="mt-1 text-sm text-red-600">{erro}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {motivo.length}/10 caracteres mínimos
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading || !motivo.trim()}
            className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reabrindo...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Reabrir
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
  onAbrirCalendario,
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
          onClick={onAbrirCalendario}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <CalendarDays className="w-4 h-4" />
          Calendário
        </button>
      </div>

      <div>
        <div>
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
  const [empresaNome, setEmpresaNome] = useState<string>('');
  const [liquidacao, setLiquidacao] = useState<LiquidacaoDiaria | null>(null);
  const [liquidacaoAtiva, setLiquidacaoAtiva] = useState<LiquidacaoDiaria | null>(null);
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
  const [modalExtrato, setModalExtrato] = useState(false);
  const [modalReabrir, setModalReabrir] = useState(false);

  // State do Modal de Detalhes do Cliente
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteComTotais | null>(null);
  const [modalClienteAberto, setModalClienteAberto] = useState(false);

  // States para busca de clientes
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientesVisiveis, setClientesVisiveis] = useState(20);

  // States para notas
  const [notasClientes, setNotasClientes] = useState<Map<string, { liquidacao: number; outras: boolean }>>(new Map());
  const [modalNotasCliente, setModalNotasCliente] = useState<{ aberto: boolean; clienteId: string; clienteNome: string }>({
    aberto: false,
    clienteId: '',
    clienteNome: '',
  });

  // States para modais financeiros
  const [modalEmprestimos, setModalEmprestimos] = useState(false);
  const [modalDespesas, setModalDespesas] = useState(false);
  const [modalMicroseguros, setModalMicroseguros] = useState(false);
  const [modalPagamentos, setModalPagamentos] = useState(false);
  const [modalReceitas, setModalReceitas] = useState(false);

  // Permissões
  const podeReabrir = profile?.tipo_usuario === 'SUPER_ADMIN' || profile?.tipo_usuario === 'ADMIN';
  const isLiquidacaoReaberta = liquidacao?.status === 'REABERTO';

  // Carregar dados da liquidação
  const carregarDadosLiquidacao = useCallback(async (liq: LiquidacaoDiaria, rotaId: string) => {
    try {
      const dataVencimento = liq.data_abertura.split('T')[0];

      const clientes = await liquidacaoService.buscarClientesDoDia(rotaId, dataVencimento);
      setClientesDia(clientes);

      const stats = liquidacaoService.calcularEstatisticasClientesDia(clientes);
      setEstatisticas(stats);

      const emps = await liquidacaoService.buscarEmprestimosDoDia(liq.id);
      setEmprestimos(emps);

      // Buscar contagem de notas por cliente
      if (clientes.length > 0) {
        const clienteIds = [...new Set(clientes.map(c => c.cliente_id))];
        const supabase = (await import('@/lib/supabase/client')).createClient();

        const { data: notasLiq } = await supabase
          .from('notas')
          .select('cliente_id')
          .eq('liquidacao_id', liq.id)
          .eq('status', 'ATIVA')
          .in('cliente_id', clienteIds);

        const { data: notasOutras } = await supabase
          .from('notas')
          .select('cliente_id')
          .neq('liquidacao_id', liq.id)
          .eq('status', 'ATIVA')
          .in('cliente_id', clienteIds);

        const mapaNotas = new Map<string, { liquidacao: number; outras: boolean }>();

        (notasLiq || []).forEach((n: { cliente_id: string }) => {
          const atual = mapaNotas.get(n.cliente_id) || { liquidacao: 0, outras: false };
          mapaNotas.set(n.cliente_id, { ...atual, liquidacao: atual.liquidacao + 1 });
        });

        (notasOutras || []).forEach((n: { cliente_id: string }) => {
          const atual = mapaNotas.get(n.cliente_id) || { liquidacao: 0, outras: false };
          mapaNotas.set(n.cliente_id, { ...atual, outras: true });
        });

        setNotasClientes(mapaNotas);
      }

      setBuscaCliente('');
      setClientesVisiveis(20);

    } catch (error) {
      console.error('Erro ao carregar dados da liquidação:', error);
    }
  }, []);

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

      if (tipoUsuario === 'VENDEDOR') {
        vendedorData = await liquidacaoService.buscarVendedorPorUserId(userId);
        if (vendedorData) {
          rotaData = await liquidacaoService.buscarRotaVendedor(vendedorData.id);
          rotaId = rotaData?.id || null;
        }
      }

      if (!rotaId && rotaIdContexto) {
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

      if (rotaData?.empresa_id) {
        const supabase = (await import('@/lib/supabase/client')).createClient();
        const { data: empresaData } = await supabase
          .from('empresas')
          .select('nome')
          .eq('id', rotaData.empresa_id)
          .single();
        setEmpresaNome(empresaData?.nome || '');
      }

      const contaData = await liquidacaoService.buscarSaldoContaRota(rotaId);
      setSaldoConta(contaData?.saldo_atual || 0);

      const liquidacaoData = await liquidacaoService.buscarLiquidacaoAberta(rotaId);
      setLiquidacao(liquidacaoData);
      setLiquidacaoAtiva(liquidacaoData);

      if (liquidacaoData) {
        await carregarDadosLiquidacao(liquidacaoData, rotaId);
        const dataLiq = new Date(liquidacaoData.data_abertura);
        setDataSelecionada(dataLiq);
      }

      const meta = await liquidacaoService.buscarMetaRota(rotaId);
      setMetaDia(meta);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, rotaIdContexto, empresaId, profile, carregarDadosLiquidacao]);

  // Carregar dados do calendário
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

  // Quando o mês muda no calendário
  const handleMesChange = useCallback((ano: number, mes: number) => {
    if (rota) {
      carregarDadosCalendario(rota.id, ano, mes);
    }
  }, [rota, carregarDadosCalendario]);

  // Quando uma data é selecionada no calendário (apenas marcação visual no modal)
  // A busca dos dados acontece só no onConfirmar
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
        if (liquidacaoAtiva) {
          await carregarDadosLiquidacao(liquidacaoAtiva, rota.id);
        }
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

  // Quando usuário clica em "Selecionar" no modal calendário
  const handleConfirmarDataCalendario = useCallback(async (data: Date) => {
    if (!rota) return;
    await handleSelecionarData(data);
  }, [rota, handleSelecionarData]);

  // Voltar para liquidação ativa
  const voltarParaLiquidacaoAtiva = useCallback(async () => {
    if (liquidacaoAtiva && rota) {
      const dataLiq = new Date(liquidacaoAtiva.data_abertura);
      setDataSelecionada(dataLiq);
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

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

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
      if (liquidacao.status === 'REABERTO') {
        const resultado = await liquidacaoService.fecharLiquidacaoReaberta({
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
      } else {
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
      }
    } catch (error) {
      console.error('Erro ao fechar liquidação:', error);
      alert('Erro ao fechar liquidação');
    } finally {
      setLoadingAcao(false);
    }
  };

  const handleReabrirLiquidacao = async (motivo: string) => {
    if (!liquidacao || !userId) return;

    setLoadingAcao(true);
    try {
      const resultado = await liquidacaoService.reabrirLiquidacao({
        liquidacao_id: liquidacao.id,
        user_id: userId,
        motivo,
      });

      if (resultado.sucesso) {
        await carregarDados();
        setModalReabrir(false);
      } else {
        alert(resultado.mensagem);
      }
    } catch (error) {
      console.error('Erro ao reabrir liquidação:', error);
      alert('Erro ao reabrir liquidação');
    } finally {
      setLoadingAcao(false);
    }
  };

  const handleAbrirModalCliente = (cliente: ClienteDoDia) => {
    const clienteParaModal: ClienteComTotais = {
      id: cliente.cliente_id,
      codigo_cliente: parseInt(cliente.consecutivo) || 0,
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
      permite_emprestimo_adicional: cliente.permite_emprestimo_adicional ?? false,
    };

    setClienteSelecionado(clienteParaModal);
    setModalClienteAberto(true);
  };

  // Cálculos
  const percentualMeta = liquidacao ? calcularPercentual(liquidacao.valor_recebido_dia || 0, liquidacao.valor_esperado_dia || metaDia) : 0;

  // Loading - usa skeleton em vez de tela branca
  if (loading) {
    return <TelaSkeleton />;
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
          onAbrirCalendario={() => setMostrarCalendario(true)}
        />
        <ModalAbrirLiquidacao
          isOpen={modalAbrir}
          onClose={() => setModalAbrir(false)}
          onConfirmar={handleAbrirLiquidacao}
          loading={loadingAcao}
          saldoSugerido={saldoConta}
        />
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
      </>
    );
  }

  // =====================================================
  // RENDER PRINCIPAL
  // =====================================================

  return (
    <div className="space-y-6">
      {/* Faixa de Liquidação Reaberta */}
      {isLiquidacaoReaberta && liquidacao && (
        <FaixaLiquidacaoReaberta
          dataLiquidacao={liquidacao.data_abertura.split('T')[0]}
          dataReabertura={liquidacao.data_reabertura}
          reabertoPor={liquidacao.reaberto_por_nome}
        />
      )}

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
          {liquidacaoAtiva && (
            <button
              onClick={voltarParaLiquidacaoAtiva}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-sm font-medium transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar para Liquidação Ativa
            </button>
          )}
        </div>
      )}

      {/* Header com Informações da Sessão */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">Liquidação Diária</h1>
              {liquidacao && <BadgeStatus status={liquidacao.status} />}
            </div>
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
            {liquidacao && (
              <button
                onClick={() => setModalExtrato(true)}
                className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Extrato
              </button>
            )}

            <button
              onClick={() => setMostrarCalendario(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <CalendarDays className="w-4 h-4" />
              Calendário
            </button>

            {/* badge movido para o header, junto do título */}

            {liquidacao?.status === 'FECHADO' && podeReabrir && (
              <button
                onClick={() => setModalReabrir(true)}
                className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reabrir
              </button>
            )}

            {(liquidacao?.status === 'ABERTO' || liquidacao?.status === 'REABERTO') && !visualizandoOutroDia && (
              <button
                onClick={() => setModalFechar(true)}
                className={`flex items-center gap-2 px-4 py-2 ${
                  liquidacao?.status === 'REABERTO'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white rounded-lg text-sm font-medium transition-colors`}
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

      {/* Conteúdo Principal */}
      <div>
        <div>
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

          {liquidacao && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Coluna 1 */}
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-1 hover:border-blue-200 group">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 transition-colors duration-300 group-hover:text-blue-700">
                      <Target className="w-4 h-4 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
                      Meta do Dia
                    </h3>

                    <div className="text-center mb-3">
                      <p className="text-3xl font-bold text-gray-900 transition-all duration-300 group-hover:scale-105">{percentualMeta}%</p>
                      <p className="text-xs text-gray-500">de {formatarMoeda(liquidacao.valor_esperado_dia || metaDia)}</p>
                    </div>

                    <ProgressBar percentual={percentualMeta} />

                    <div className="mt-3 pt-3 border-t space-y-1.5">
                      <ItemInfo label="Valor Esperado" valor={formatarMoeda(liquidacao.valor_esperado_dia || metaDia)} />
                      <ItemInfo label="Valor Recebido" valor={formatarMoeda(liquidacao.valor_recebido_dia)} corValor="text-green-600" />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-4 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-1 hover:border-blue-200 group">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 transition-colors duration-300 group-hover:text-blue-700">
                      <Users className="w-4 h-4 text-blue-600 transition-transform duration-300 group-hover:scale-110" />
                      Clientes
                    </h3>

                    <div className="grid grid-cols-5 gap-2">
                      <div className="text-center p-2 bg-gray-50 rounded-lg transition-all duration-300 group-hover:bg-gray-100">
                        <p className="text-xl font-bold text-gray-900">{liquidacao.clientes_iniciais}</p>
                        <p className="text-xs text-gray-500">Iniciais</p>
                      </div>
                      <div className="text-center p-2 bg-green-50 rounded-lg transition-all duration-300 group-hover:bg-green-100">
                        <p className="text-xl font-bold text-green-600">{liquidacao.clientes_novos}</p>
                        <p className="text-xs text-gray-500">Novos</p>
                      </div>
                      <div className="text-center p-2 bg-blue-50 rounded-lg transition-all duration-300 group-hover:bg-blue-100">
                        <p className="text-xl font-bold text-blue-600">{liquidacao.clientes_renovados}</p>
                        <p className="text-xs text-gray-500">Renov.</p>
                      </div>
                      <div className="text-center p-2 bg-purple-50 rounded-lg transition-all duration-300 group-hover:bg-purple-100">
                        <p className="text-xl font-bold text-purple-600">{liquidacao.clientes_renegociados}</p>
                        <p className="text-xs text-gray-500">Reneg.</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded-lg transition-all duration-300 group-hover:bg-red-100">
                        <p className="text-xl font-bold text-red-600">{liquidacao.clientes_cancelados}</p>
                        <p className="text-xs text-gray-500">Canc.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Coluna 2 */}
                <div className="space-y-4">
                  {/* Cards Pagamentos do Dia - Separados: Status + Valores */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Card Status (Pagos / Não Pagos) */}
                    <button
                      onClick={() => setModalPagamentos(true)}
                      className="w-full bg-white rounded-xl border border-gray-200 p-3 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-green-100/50 hover:-translate-y-1 hover:border-green-200 group text-left"
                    >
                      <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5 transition-colors duration-300 group-hover:text-green-700">
                        <CheckCircle className="w-3.5 h-3.5 text-green-600 transition-transform duration-300 group-hover:scale-110" />
                        Status
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 bg-green-50 rounded-lg transition-all duration-300 group-hover:bg-green-100">
                          <p className="text-xl font-bold text-green-600">{liquidacao.pagamentos_pagos}</p>
                          <p className="text-xs text-gray-500">Pagos</p>
                        </div>
                        <div className="text-center p-2 bg-red-50 rounded-lg transition-all duration-300 group-hover:bg-red-100">
                          <p className="text-xl font-bold text-red-600">{liquidacao.pagamentos_nao_pagos}</p>
                          <p className="text-xs text-gray-500">Não Pagos</p>
                        </div>
                      </div>
                    </button>

                    {/* Card Valores (Dinheiro / Transferência) */}
                    <button
                      onClick={() => setModalPagamentos(true)}
                      className="w-full bg-white rounded-xl border border-gray-200 p-3 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-emerald-100/50 hover:-translate-y-1 hover:border-emerald-200 group text-left"
                    >
                      <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5 transition-colors duration-300 group-hover:text-emerald-700">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600 transition-transform duration-300 group-hover:scale-110" />
                        Valores Recebidos
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-center p-2 bg-emerald-50 rounded-lg transition-all duration-300 group-hover:bg-emerald-100">
                          <p className="text-sm font-bold text-emerald-600">{formatarMoeda(liquidacao.valor_dinheiro)}</p>
                          <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                            <Banknote className="w-3 h-3" /> Dinheiro
                          </p>
                        </div>
                        <div className="text-center p-2 bg-sky-50 rounded-lg transition-all duration-300 group-hover:bg-sky-100">
                          <p className="text-sm font-bold text-sky-600">{formatarMoeda(liquidacao.valor_transferencia)}</p>
                          <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                            <CreditCard className="w-3 h-3" /> Transf.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Grid de 3 cards financeiros */}
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setModalEmprestimos(true)}
                      className="bg-white rounded-xl border border-gray-200 p-3 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-green-100/50 hover:-translate-y-1 hover:border-green-200 group text-left"
                    >
                      <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5 transition-colors duration-300 group-hover:text-green-700">
                        <DollarSign className="w-3.5 h-3.5 text-green-600" />
                        Empréstimos
                      </h3>
                      <div className="text-center p-2 bg-green-50 rounded-lg">
                        <p className="text-lg font-bold text-green-600">{formatarMoeda(liquidacao.total_emprestado_dia)}</p>
                        <p className="text-xs text-gray-500">
                          {liquidacao.qtd_emprestimos_dia} emp.
                          {(liquidacao.total_juros_dia ?? 0) > 0 && (
                            <span className="ml-1 text-emerald-600 font-medium">
                              (Juros {formatarMoeda(liquidacao.total_juros_dia)})
                            </span>
                          )}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={() => setModalDespesas(true)}
                      className="bg-white rounded-xl border border-gray-200 p-3 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-red-100/50 hover:-translate-y-1 hover:border-red-200 group text-left"
                    >
                      <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5 transition-colors duration-300 group-hover:text-red-700">
                        <Receipt className="w-3.5 h-3.5 text-red-600" />
                        Despesas
                      </h3>
                      <div className="text-center p-2 bg-red-50 rounded-lg">
                        <p className="text-lg font-bold text-red-600">{formatarMoeda(liquidacao.total_despesas_dia)}</p>
                        <p className="text-xs text-gray-500">{liquidacao.qtd_despesas_dia} lanç.</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setModalMicroseguros(true)}
                      className="bg-white rounded-xl border border-gray-200 p-3 transition-all duration-300 ease-out hover:shadow-lg hover:shadow-teal-100/50 hover:-translate-y-1 hover:border-teal-200 group text-left"
                    >
                      <h3 className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5 transition-colors duration-300 group-hover:text-teal-700">
                        <Shield className="w-3.5 h-3.5 text-teal-600" />
                        Microseguro
                      </h3>
                      <div className="text-center p-2 bg-teal-50 rounded-lg">
                        <p className="text-lg font-bold text-teal-600">{formatarMoeda(liquidacao.total_microseguro_dia)}</p>
                        <p className="text-xs text-gray-500">{liquidacao.qtd_microseguros_dia} cont.</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card de Notas da Liquidação */}
      {liquidacao && rota && vendedor && (
        <NotasLiquidacaoCard
          liquidacaoId={liquidacao.id}
          rotaId={rota.id}
          empresaId={rota.empresa_id}
          vendedorId={vendedor.id}
          autorId={userId || ''}
          autorNome={profile?.nome || 'Administrador'}
          dataReferencia={liquidacao.data_abertura.split('T')[0]}
        />
      )}

      {/* Lista de Clientes do Dia */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Clientes do Dia</h3>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              {clientesDia.length}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={buscaCliente}
              onChange={(e) => {
                setBuscaCliente(e.target.value);
                setClientesVisiveis(20);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {buscaCliente && (
              <button
                onClick={() => setBuscaCliente('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {(() => {
          const clientesFiltrados = buscaCliente
            ? clientesDia.filter(c =>
                c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
                c.consecutivo?.includes(buscaCliente)
              )
            : clientesDia;

          const clientesParaMostrar = clientesFiltrados.slice(0, clientesVisiveis);
          const temMais = clientesFiltrados.length > clientesVisiveis;

          return clientesFiltrados.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Cliente</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Parcela</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Valor</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Pago</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 w-12">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clientesParaMostrar.map((cliente) => {
                      const notasInfo = notasClientes.get(cliente.cliente_id);
                      const temNotasLiquidacao = (notasInfo?.liquidacao || 0) > 0;
                      const temNotasOutras = notasInfo?.outras || false;

                      return (
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
                          <td className="px-4 py-3 text-center">
                            {(temNotasLiquidacao || temNotasOutras) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalNotasCliente({
                                    aberto: true,
                                    clienteId: cliente.cliente_id,
                                    clienteNome: cliente.nome,
                                  });
                                }}
                                className="relative p-1 rounded hover:bg-amber-50 transition-colors"
                                title={`${notasInfo?.liquidacao || 0} nota(s) nesta liquidação`}
                              >
                                <MessageSquare className={`w-4 h-4 ${temNotasLiquidacao ? 'text-amber-600' : 'text-gray-400'}`} />
                                {temNotasLiquidacao && (
                                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {(notasInfo?.liquidacao || 0) > 9 ? '9+' : notasInfo?.liquidacao}
                                  </span>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {temMais && (
                <div className="px-4 py-3 bg-gray-50 border-t">
                  <button
                    onClick={() => setClientesVisiveis(prev => prev + 20)}
                    className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Carregar mais ({clientesFiltrados.length - clientesVisiveis} restantes)
                  </button>
                </div>
              )}

              {buscaCliente && (
                <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500 text-center">
                  {clientesFiltrados.length} de {clientesDia.length} clientes
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center text-gray-500 text-sm">
              {buscaCliente
                ? `Nenhum cliente encontrado para "${buscaCliente}"`
                : 'Nenhum cliente com parcela vencendo hoje'
              }
            </div>
          );
        })()}
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

      <ModalReabrirLiquidacao
        isOpen={modalReabrir}
        onClose={() => setModalReabrir(false)}
        onConfirmar={handleReabrirLiquidacao}
        loading={loadingAcao}
        dataLiquidacao={liquidacao?.data_abertura?.split('T')[0] || ''}
      />

      <ModalExtratoLiquidacao
        isOpen={modalExtrato}
        onClose={() => setModalExtrato(false)}
        liquidacao={liquidacao}
        rotaNome={rota?.nome || ''}
        vendedorNome={vendedor?.nome}
        empresaNome={empresaNome}
      />

      <ModalDetalhesCliente
        isOpen={modalClienteAberto}
        onClose={() => {
          setModalClienteAberto(false);
          setClienteSelecionado(null);
        }}
        cliente={clienteSelecionado}
      />

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
          <ModalEmprestimos
            isOpen={modalEmprestimos}
            onClose={() => setModalEmprestimos(false)}
            liquidacaoId={liquidacao.id}
            totalFallback={liquidacao.total_emprestado_dia}
            qtdFallback={liquidacao.qtd_emprestimos_dia}
          />

          <ModalDespesas
            isOpen={modalDespesas}
            onClose={() => setModalDespesas(false)}
            liquidacaoId={liquidacao.id}
            totalFallback={liquidacao.total_despesas_dia}
            qtdFallback={liquidacao.qtd_despesas_dia}
          />

          <ModalMicroseguros
            isOpen={modalMicroseguros}
            onClose={() => setModalMicroseguros(false)}
            liquidacaoId={liquidacao.id}
            totalFallback={liquidacao.total_microseguro_dia}
            qtdFallback={liquidacao.qtd_microseguros_dia}
          />

          <ModalPagamentos
            isOpen={modalPagamentos}
            onClose={() => setModalPagamentos(false)}
            liquidacaoId={liquidacao.id}
            clientesPagos={liquidacao.pagamentos_pagos}
            clientesNaoPagos={liquidacao.pagamentos_nao_pagos}
            valorRecebido={liquidacao.valor_recebido_dia}
            clientesDia={clientesDia}
          />

          <ModalReceitas
            isOpen={modalReceitas}
            onClose={() => setModalReceitas(false)}
            liquidacaoId={liquidacao.id}
          />
        </>
      )}

      {/* Modal Calendário */}
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