'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, 
  Building2, 
  MapPin, 
  Shield,
  TrendingDown,
  ArrowRightLeft,
  Plus,
  CheckSquare,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Tag,
  ChevronRight,
  ChevronLeft,
  FileText,
  AlertCircle,
  X,
  Eye,
  Search,
  Ban
} from 'lucide-react';
import {
} from 'recharts';
import { useUser } from '@/contexts/UserContext';
import { financeiroService } from '@/services/financeiro';
import { liquidacaoService } from '@/services/liquidacao';
import { ModalCalendarioLiquidacao } from '@/components/liquidacao/ModalCalendarioLiquidacao';
import { 
  ModalNovaMovimentacao, 
  ModalTransferencia, 
  ModalAjusteSaldo 
} from '@/components/financeiro';
import { LightboxImagem, BotaoVerComprovante } from '@/components/liquidacao/CardsFinanceiros';
import type {
  SaldosContas,
  MovimentoFinanceiro,
  CategoriaFinanceira,
  ContaComDetalhes,
  RotaDetalhe,
  MicroseguroDetalhe,
} from '@/types/financeiro';

// =====================================================
// TIPOS LOCAIS
// =====================================================
type TipoFiltro = 'hoje' | 'ontem' | 'periodo';

interface FiltroData {
  tipo: TipoFiltro;
  dataInicio: string;
  dataFim: string;
}

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

function LinhaExtrato({ 
  movimento, 
  categorias,
  podeAnular,
  onAnular,
  onVerComprovante,
}: { 
  movimento: MovimentoFinanceiro; 
  categorias: CategoriaFinanceira[];
  podeAnular?: boolean;
  onAnular?: (movimento: MovimentoFinanceiro) => void;
  onVerComprovante?: (url: string) => void;
}) {
  const categoria = categorias.find(c => c.codigo === movimento.categoria);
  const isEntrada = movimento.tipo === 'RECEBER';
  const isTransferencia = movimento.tipo === 'TRANSFERENCIA';
  const isSaida = movimento.tipo === 'PAGAR';
  const isAnulado = movimento.status === 'ANULADO';

  // Só é anulável por aqui: transferência avulsa, OU receita/despesa DIRETA.
  // Lançamentos que são reflexo de outra operação (cobrança de parcela,
  // empréstimo, estorno, microseguro) NÃO podem ser anulados aqui — cada um
  // tem sua própria reversão (estorno de pagamento, cancelamento de empréstimo, etc.).
  const CATEGORIAS_REFLEXO = [
    'COBRANCA_PARCELAS', 'EMPRESTIMO', 'ESTORNO_PAGAMENTO',
    'VENDA_MICROSEGURO', 'RETIRO_MICROSEGURO', 'SAIDA_MICROSEGURO',
  ];
  const anulavel =
    movimento.tipo === 'TRANSFERENCIA' ||
    ((movimento.tipo === 'RECEBER' || movimento.tipo === 'PAGAR') &&
      !CATEGORIAS_REFLEXO.includes(movimento.categoria));
  
  const getContaDisplay = () => {
    if (isTransferencia) {
      return (
        <span className="text-xs text-gray-500">
          {movimento.conta_origem_nome || '-'} → {movimento.conta_destino_nome || '-'}
        </span>
      );
    }
    if (isEntrada && movimento.conta_destino_nome) {
      return <span className="text-xs text-gray-500">→ {movimento.conta_destino_nome}</span>;
    }
    if (isSaida && movimento.conta_origem_nome) {
      return <span className="text-xs text-gray-500">← {movimento.conta_origem_nome}</span>;
    }
    return null;
  };
  // Formatar data sem timezone bug
  const formatarData = (dataStr: string) => {
    if (!dataStr) return '-';
    const [ano, mes, dia] = dataStr.split('T')[0].split('-');
    return `${dia}/${mes}/${ano}`;
  };

  // Formatar data curta (DD/MM/AA)
  const formatarDataCurta = (dataStr: string) => {
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('T')[0].split('-');
    return `${dia}/${mes}/${ano.slice(2)}`;
  };

  // Observações sem o prefixo automático "[APROVADO aaaa-mm-dd] "
  const observacoesLimpa = (movimento.observacoes || '')
    .replace(/\[APROVADO[^\]]*\]\s*/gi, '')
    .trim();

  // Verificar se data_lancamento é diferente de data_liquidacao
  const dataLancStr = movimento.data_lancamento?.split('T')[0];
  const dataLiqStr = (movimento as any).data_liquidacao?.split('T')[0];
  const temDataLiqDiferente = dataLiqStr && dataLancStr && dataLancStr !== dataLiqStr;
  
  return (
    <tr className={`hover:bg-gray-50 transition-colors ${isAnulado ? 'bg-gray-50/50' : ''}`}>
      <td className="px-3 py-2.5 align-top">
        <div className={`text-sm tabular-nums ${isAnulado ? 'text-gray-400' : 'text-gray-600'}`}>
          {formatarData(movimento.data_lancamento)}
        </div>
        {temDataLiqDiferente && (
          <span
            className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-medium whitespace-nowrap"
            title={`Lançamento registrado em outra data. Liquidação: ${formatarDataCurta(dataLiqStr)}`}
          >
            <Calendar className="w-3 h-3" />
            liq {formatarDataCurta(dataLiqStr)}
          </span>
        )}
      </td>

      <td className="px-3 py-2.5 align-top">
        <p className={`text-sm font-medium ${isAnulado ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {movimento.descricao}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${isAnulado ? 'opacity-50' : ''}`}
            style={{
              backgroundColor: categoria?.cor_hex ? `${categoria.cor_hex}20` : '#f3f4f6',
              color: categoria?.cor_hex || '#374151'
            }}
          >
            {categoria?.nome_pt || movimento.categoria}
          </span>
          {movimento.status !== 'PAGO' && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
              movimento.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-700' :
              movimento.status === 'ANULADO' ? 'bg-red-50 text-red-600 border border-red-200' :
              movimento.status === 'VENCIDO' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {movimento.status}
            </span>
          )}
        </div>
        {getContaDisplay()}
        {observacoesLimpa && (
          <p className="text-xs mt-0.5 text-gray-400">{observacoesLimpa}</p>
        )}
      </td>

      <td className="px-3 py-2.5 text-right align-top whitespace-nowrap">
        <span className={`text-sm font-semibold tabular-nums ${
          isAnulado ? 'text-gray-400 line-through' :
          isTransferencia ? 'text-blue-600' : isEntrada ? 'text-green-600' : 'text-red-600'
        }`}>
          {isTransferencia ? '↔' : isEntrada ? '+' : '-'}
          {movimento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
        <div className="flex items-center justify-end gap-1.5 mt-1">
          {(movimento as any).foto_url && (
            <BotaoVerComprovante onClick={() => onVerComprovante?.((movimento as any).foto_url)} />
          )}
          {podeAnular && anulavel && !isAnulado && movimento.status !== 'CANCELADO' && (
            <button
              onClick={() => onAnular?.(movimento)}
              title="Anular movimentação"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            >
              <Ban className="w-3 h-3" />
              Anular
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AvisoSelecioneEmpresa() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-amber-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecione uma Empresa</h3>
      <p className="text-gray-500 text-center max-w-md">
        Para visualizar as informações financeiras, selecione uma empresa no menu superior.
      </p>
    </div>
  );
}

// Modal Ver Todas Rotas/Microseguros
function ModalVerTodas({
  isOpen,
  onClose,
  titulo,
  itens,
  icone: Icone,
  corIcone,
}: {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  itens: { nome: string; valor: number }[];
  icone: React.ElementType;
  corIcone: string;
}) {
  if (!isOpen) return null;

  const total = itens.reduce((acc, item) => acc + item.valor, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center`}>
              <Icone className={`w-5 h-5 ${corIcone}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{titulo}</h3>
              <p className="text-sm text-gray-500">{itens.length} itens</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {itens.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700 font-medium">{item.nome}</span>
                <span className="text-sm font-semibold text-gray-900">
                  {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer com total */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Total</span>
            <span className="text-lg font-bold text-gray-900">
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

function FiltroPeriodoCompacto({
  filtro,
  onChange,
}: {
  filtro: FiltroData;
  onChange: (filtro: FiltroData) => void;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [tempInicio, setTempInicio] = useState(filtro.dataInicio);
  const [tempFim, setTempFim] = useState(filtro.dataFim);

  const ativo = filtro.tipo === 'periodo';
  const label = ativo
    ? (filtro.dataInicio === filtro.dataFim
        ? new Date(filtro.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')
        : `${new Date(filtro.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} – ${new Date(filtro.dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`)
    : 'Período';

  return (
    <div className="relative">
      <button
        onClick={() => setShowCalendar((v) => !v)}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${
          ativo ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        }`}
        title="Selecionar período"
      >
        <Calendar className="w-3.5 h-3.5" />
        <span className="truncate max-w-[130px]">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {showCalendar && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowCalendar(false)} />
          <div className="absolute top-full right-0 mt-1 z-20 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[260px] max-w-[calc(100vw-2rem)]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Início</label>
            <input type="date" value={tempInicio} onChange={(e) => setTempInicio(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-blue-500" />
            <label className="block text-xs font-medium text-gray-600 mb-1">Fim</label>
            <input type="date" value={tempFim} onChange={(e) => setTempFim(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm mb-3 focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <button onClick={() => setShowCalendar(false)}
                className="flex-1 px-3 py-1.5 text-gray-700 text-sm font-medium hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button
                onClick={() => { onChange({ tipo: 'periodo', dataInicio: tempInicio, dataFim: tempFim }); setShowCalendar(false); }}
                className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Aplicar</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function rotuloDataLiquidacao(dataStr: string): string {
  if (!dataStr) return 'Selecionar dia';
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  const ontemStr = `${ontem.getFullYear()}-${String(ontem.getMonth() + 1).padStart(2, '0')}-${String(ontem.getDate()).padStart(2, '0')}`;
  const d = dataStr.slice(0, 10);
  if (d === hojeStr) return 'Hoje';
  if (d === ontemStr) return 'Ontem';
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}

export default function FinanceiroPage() {
  const { localizacao, profile, isSuperAdmin, permissoes } = useUser();
  const podeAnular = isSuperAdmin || permissoes?.['FINANCEIRO']?.pode_eliminar === true;
  const empresaId = localizacao?.empresa_id;
  const rotaId = localizacao?.rota_id;
  const rotaNome = localizacao?.rota?.nome;

  const [modalEscolhaTransacao, setModalEscolhaTransacao] = useState(false);
  const [filtroResumo, setFiltroResumo] = useState<FiltroData>({
    tipo: 'hoje',
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
  });
  const [filtroExtrato, setFiltroExtrato] = useState<FiltroData>({
    tipo: 'hoje',
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
  });
  const [contaFiltro, setContaFiltro] = useState<string>('');
  const [seletorContaAberto, setSeletorContaAberto] = useState(false);
  const [maisFiltrosAberto, setMaisFiltrosAberto] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [buscaExtrato, setBuscaExtrato] = useState<string>('');
  const [tipoMovimento, setTipoMovimento] = useState<string>(''); // '', 'ENTRADA', 'SAIDA'
  const [statusFiltro, setStatusFiltro] = useState<string>('PAGO'); // '', 'PAGO', 'PENDENTE', 'ANULADO', 'TODOS'
  const [modoFiltroTemporal, setModoFiltroTemporal] = useState<'periodo' | 'liquidacao'>('liquidacao');
  const [dataLiquidacao, setDataLiquidacao] = useState<string>(''); // YYYY-MM-DD
  const [loadingUltimaLiquidacao, setLoadingUltimaLiquidacao] = useState(false);
  // Calendário de liquidações (reaproveita o modal da tela de Liquidação)
  const [calendarioAberto, setCalendarioAberto] = useState(false);
  const [liquidacoesMes, setLiquidacoesMes] = useState<any[]>([]);
  const [loadingCalendario, setLoadingCalendario] = useState(false);
  const [mesCalendario, setMesCalendario] = useState<{ ano: number; mes: number }>(() => {
    const h = new Date();
    return { ano: h.getFullYear(), mes: h.getMonth() + 1 };
  });
  // Data temporária enquanto o calendário está aberto (só comita no "Selecionar")
  const [dataTempCalendario, setDataTempCalendario] = useState<Date | null>(null);
  // Dropdown "Ver por liquidação" (dentro do Mais) + histórico da rota
  const [dropdownLiquidacaoAberto, setDropdownLiquidacaoAberto] = useState(false);
  const [historicoLiquidacoes, setHistoricoLiquidacoes] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [mesMiniCal, setMesMiniCal] = useState<{ ano: number; mes: number } | null>(null);
  
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [loadingExtrato, setLoadingExtrato] = useState(false);
  const [loadingContas, setLoadingContas] = useState(false);
  
  const [modalMovimentacao, setModalMovimentacao] = useState(false);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [modalAjuste, setModalAjuste] = useState(false);
  const [modalVerRotas, setModalVerRotas] = useState(false);
  const [modalVerMicroseguros, setModalVerMicroseguros] = useState(false);

  const [saldos, setSaldos] = useState<SaldosContas>({
    modo: 'empresa',
    total_consolidado: 0,
    saldo_empresa: 0,
    saldo_rotas: 0,
    saldo_microseguros: 0,
    contas: [],
    rotas_detalhe: [],
    microseguros_detalhe: [],
  });
  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([]);
  const [contas, setContas] = useState<ContaComDetalhes[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [comprovante, setComprovante] = useState<string | null>(null);

  const carregarSaldos = useCallback(async () => {
    if (!empresaId) return;
    setLoadingSaldos(true);
    try {
      const data = await financeiroService.buscarSaldosContas(empresaId, rotaId);
      setSaldos(data);
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
    } finally {
      setLoadingSaldos(false);
    }
  }, [empresaId, rotaId]);

  const carregarContas = useCallback(async () => {
    if (!empresaId) return;
    setLoadingContas(true);
    try {
      const data = await financeiroService.buscarContas(empresaId);
      setContas(data);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoadingContas(false);
    }
  }, [empresaId]);

  const carregarCategorias = useCallback(async () => {
    try {
      const data = await financeiroService.buscarCategorias();
      setCategorias(data);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  }, []);

  const carregarExtrato = useCallback(async () => {
    if (!empresaId) return;
    
    // No modo liquidação, só carrega se tiver data selecionada
    if (modoFiltroTemporal === 'liquidacao' && !dataLiquidacao) {
      setMovimentos([]);
      return;
    }

    setLoadingExtrato(true);
    try {
      const params: any = {
        conta_id: contaFiltro || undefined,
        // categoria NÃO vai ao backend: filtramos no front para o resumo
        // por categoria refletir todas as categorias da conta/período.
        rota_id: rotaId,
        // Passar status para o backend (se não for TODOS, filtra)
        status: statusFiltro === 'TODOS' ? undefined : (statusFiltro || undefined),
        incluir_anulados: statusFiltro === 'TODOS' || statusFiltro === 'ANULADO',
      };

      if (modoFiltroTemporal === 'liquidacao') {
        // Busca apenas a data específica da liquidação
        params.data_inicio = dataLiquidacao;
        params.data_fim = dataLiquidacao;
      } else {
        // Usa os filtros de período normais
        params.periodo = filtroExtrato.tipo === 'periodo' ? undefined : filtroExtrato.tipo;
        params.data_inicio = filtroExtrato.tipo === 'periodo' ? filtroExtrato.dataInicio : undefined;
        params.data_fim = filtroExtrato.tipo === 'periodo' ? filtroExtrato.dataFim : undefined;
      }

      console.log('Buscando extrato com params:', params); // Debug

      const data = await financeiroService.buscarExtrato(empresaId, params);
      setMovimentos(data);
    } catch (error) {
      console.error('Erro ao carregar extrato:', error);
    } finally {
      setLoadingExtrato(false);
    }
  }, [empresaId, filtroExtrato, contaFiltro, rotaId, modoFiltroTemporal, dataLiquidacao, statusFiltro]);

  useEffect(() => {
    if (empresaId) {
      carregarSaldos();
      carregarContas();
      carregarCategorias();
    }
  }, [empresaId, rotaId, carregarSaldos, carregarContas, carregarCategorias]);

  // Buscar última liquidação quando mudar para modo liquidação
  useEffect(() => {
    const buscarUltimaLiquidacao = async () => {
      if (modoFiltroTemporal !== 'liquidacao' || !rotaId) return;
      if (dataLiquidacao) return; // Já tem data selecionada
      
      setLoadingUltimaLiquidacao(true);
      try {
        const supabase = (await import('@/lib/supabase/client')).createClient();
        
        // Buscar última liquidação (ABERTO primeiro, depois FECHADO)
        // Usar data_liquidacao, não data_abertura
        const { data, error } = await supabase
          .from('liquidacoes_diarias')
          .select('id, data_liquidacao, status')
          .eq('rota_id', rotaId)
          .in('status', ['ABERTO', 'REABERTO', 'FECHADO'])
          .order('data_liquidacao', { ascending: false })
          .limit(10);
        
        if (!error && data && data.length > 0) {
          // Priorizar ABERTO/REABERTO
          const aberta = data.find(l => l.status === 'ABERTO' || l.status === 'REABERTO');
          const liquidacao = aberta || data[0];
          
          // Usar data_liquidacao diretamente (já é DATE, formato YYYY-MM-DD)
          setDataLiquidacao(liquidacao.data_liquidacao);
        }
      } catch (error) {
        console.error('Erro ao buscar última liquidação:', error);
      } finally {
        setLoadingUltimaLiquidacao(false);
      }
    };
    
    buscarUltimaLiquidacao();
  }, [modoFiltroTemporal, rotaId, dataLiquidacao]);

  // Carregar liquidações do mês exibido no calendário
  const carregarLiquidacoesMes = useCallback(async (ano: number, mes: number) => {
    if (!rotaId) return;
    setLoadingCalendario(true);
    try {
      const data = await liquidacaoService.buscarLiquidacoesMes(rotaId, ano, mes);
      setLiquidacoesMes(data || []);
    } catch (e) {
      console.error('Erro ao carregar liquidações do mês:', e);
      setLiquidacoesMes([]);
    } finally {
      setLoadingCalendario(false);
    }
  }, [rotaId]);

  // Carregar histórico de liquidações da rota (para o dropdown "Ver por liquidação")
  // Set de dias (YYYY-MM-DD) com liquidação + mapa dia->liquidação, para o mini-calendário
  const { diasComLiq, mapaDiaLiq, ultimaLiqYmd } = React.useMemo(() => {
    const ymd = (l: any) => (l.data_liquidacao?.split('T')[0] || l.data_abertura?.split('T')[0] || '');
    const set = new Set<string>();
    const mapa: Record<string, any> = {};
    historicoLiquidacoes.forEach(l => { const d = ymd(l); if (d) { set.add(d); if (!mapa[d]) mapa[d] = l; } });
    const ultima = [...set].sort((a, b) => (a < b ? 1 : -1))[0] || '';
    return { diasComLiq: set, mapaDiaLiq: mapa, ultimaLiqYmd: ultima };
  }, [historicoLiquidacoes]);

  const carregarHistoricoLiquidacoes = useCallback(async () => {
    if (!rotaId) { setHistoricoLiquidacoes([]); return; }
    setLoadingHistorico(true);
    try {
      const data = await liquidacaoService.listarHistoricoLiquidacoes(rotaId);
      setHistoricoLiquidacoes(data || []);
    } catch (e) {
      console.error('Erro ao carregar histórico de liquidações:', e);
      setHistoricoLiquidacoes([]);
    } finally {
      setLoadingHistorico(false);
    }
  }, [rotaId]);

  useEffect(() => {
    if (dropdownLiquidacaoAberto) {
      carregarHistoricoLiquidacoes();
      // posiciona o mini-calendário no mês da data selecionada, ou da última liquidação, ou hoje
      const base = dataLiquidacao || ultimaLiqYmd;
      if (base) {
        const [a, m] = base.split('-').map(Number);
        setMesMiniCal({ ano: a, mes: m });
      } else {
        const h = new Date();
        setMesMiniCal({ ano: h.getFullYear(), mes: h.getMonth() + 1 });
      }
    }
  }, [dropdownLiquidacaoAberto, carregarHistoricoLiquidacoes, dataLiquidacao, ultimaLiqYmd]);

  // Ao abrir o calendário, carrega o mês da data selecionada (ou o atual)
  useEffect(() => {
    if (calendarioAberto) {
      carregarLiquidacoesMes(mesCalendario.ano, mesCalendario.mes);
    }
  }, [calendarioAberto, mesCalendario, carregarLiquidacoesMes]);

  useEffect(() => {
    if (empresaId) {
      carregarExtrato();
    }
  }, [empresaId, filtroExtrato, contaFiltro, rotaId, modoFiltroTemporal, dataLiquidacao, carregarExtrato]);

  const handleAnularMovimentacao = async (movimento: MovimentoFinanceiro) => {
    if (!podeAnular) return;
    const confirmar = window.confirm(
      `Anular esta movimentação de ${movimento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}?\n\n` +
      `Isto reverte o saldo da conta e o caixa da liquidação. O registro é mantido como ANULADO (histórico).`
    );
    if (!confirmar) return;

    // Motivo é opcional — se o usuário cancelar o prompt, aborta; se deixar vazio, segue sem motivo.
    const motivo = window.prompt('Motivo da anulação (opcional):', '');
    if (motivo === null) return; // cancelou

    try {
      await financeiroService.anularMovimentacao(movimento.id, motivo || null, profile?.user_id || null);
      await Promise.all([carregarSaldos(), carregarContas(), carregarExtrato()]);
    } catch (e) {
      console.error('Erro ao anular movimentação:', e);
      alert('Erro ao anular a movimentação. Tente novamente.');
    }
  };

  const handleSalvarMovimentacao = async (dados: any) => {
    const result = await financeiroService.criarMovimentacao(
      dados,
      profile?.user_id,
      profile?.nome
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    await Promise.all([carregarSaldos(), carregarContas(), carregarExtrato()]);
  };

  const handleSalvarTransferencia = async (dados: any) => {
    const result = await financeiroService.criarTransferencia(
      dados,
      profile?.user_id,
      profile?.nome
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    await Promise.all([carregarSaldos(), carregarContas(), carregarExtrato()]);
  };

  const handleSalvarAjuste = async (dados: any) => {
    const result = await financeiroService.criarAjusteSaldo(
      dados,
      profile?.user_id,
      profile?.nome
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    await Promise.all([carregarSaldos(), carregarContas(), carregarExtrato()]);
  };

  if (!empresaId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          </div>
          <AvisoSelecioneEmpresa />
        </div>
      </div>
    );
  }

  const totalEntradas = movimentos.filter(m => m.tipo === 'RECEBER').reduce((acc, m) => acc + m.valor, 0);
  const totalSaidas = movimentos.filter(m => m.tipo === 'PAGAR').reduce((acc, m) => acc + m.valor, 0);

  // Filtrar movimentos localmente (busca, tipo, data liquidação, status)
  const movimentosFiltrados = React.useMemo(() => {
    return movimentos.filter(m => {
      // Filtro por tipo (ENTRADA/SAIDA)
      if (tipoMovimento === 'ENTRADA' && m.tipo !== 'RECEBER') return false;
      if (tipoMovimento === 'SAIDA' && m.tipo !== 'PAGAR') return false;

      // Filtro por categoria (local, para o resumo por categoria ficar completo)
      if (categoriaFiltro && m.categoria !== categoriaFiltro) return false;

      // Filtro por status (local, já que o backend pode não suportar)
      if (statusFiltro && statusFiltro !== 'TODOS') {
        if (m.status !== statusFiltro) return false;
      }

      // No modo liquidação, o backend já filtrou por liquidacao_id
      // Não precisa filtrar por data aqui

      // Filtro por busca (descrição, observações, contas e VALOR)
      if (buscaExtrato) {
        const termo = buscaExtrato.toLowerCase().trim();
        const descricao = (m.descricao || '').toLowerCase();
        const observacoes = (m.observacoes || '').toLowerCase();
        const contaOrigem = (m.conta_origem_nome || '').toLowerCase();
        const contaDestino = (m.conta_destino_nome || '').toLowerCase();

        // Valor: aceita "500", "500,00", "500.00", "1.234,56"
        const valorNum = Number(m.valor) || 0;
        const termoNumerico = termo.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
        const valorFormatado = valorNum.toFixed(2);              // 500.00
        const valorPtBr = valorNum.toLocaleString('pt-BR', {     // 1.234,56
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const casaValor =
          termoNumerico !== '' &&
          (valorFormatado.startsWith(termoNumerico) ||
            valorFormatado.includes(termoNumerico) ||
            valorPtBr.includes(termo) ||
            String(valorNum).includes(termoNumerico));

        if (!descricao.includes(termo) &&
            !observacoes.includes(termo) &&
            !contaOrigem.includes(termo) &&
            !contaDestino.includes(termo) &&
            !casaValor) {
          return false;
        }
      }

      return true;
    });
  }, [movimentos, tipoMovimento, categoriaFiltro, buscaExtrato, statusFiltro]);

  // Recalcular totais com base nos filtrados (excluindo ANULADOS)
  const totalEntradasFiltrado = movimentosFiltrados
    .filter(m => m.tipo === 'RECEBER' && m.status !== 'ANULADO')
    .reduce((acc, m) => acc + m.valor, 0);
  const totalSaidasFiltrado = movimentosFiltrados
    .filter(m => m.tipo === 'PAGAR' && m.status !== 'ANULADO')
    .reduce((acc, m) => acc + m.valor, 0);

  // Preparar itens para os cards detalhados
  const rotasItens = saldos.rotas_detalhe?.map(r => ({ nome: r.rota_nome, valor: r.saldo })) || [];
  const microsegurosItens = saldos.microseguros_detalhe?.map(m => ({ 
    nome: m.rota_nome ? `${m.microseguro_nome} (${m.rota_nome})` : m.microseguro_nome, 
    valor: m.saldo 
  })) || [];

  // Determinar se está no modo rota
  const modoRota = saldos.modo === 'rota' || !!rotaId;

  // ---------------------------------------------------------------
  // PARTE 1 — Seletor de conta no topo (respeita acesso do usuário)
  // ---------------------------------------------------------------
  // Regras de acesso (espelham o UserContext):
  //  - SUPER_ADMIN: todas as contas
  //  - rotas_ids preenchido: só as rotas permitidas (+ microseguro delas)
  //  - rotas_ids vazio: acesso amplo às rotas da empresa
  //  - conta EMPRESA: visível para quem tem a empresa (flag futura refina)
  const rotasPermitidas: string[] = (profile as any)?.rotas_ids || [];
  const temAcessoRota = (rId: string | null | undefined): boolean => {
    if (isSuperAdmin) return true;
    if (rotasPermitidas.length === 0) return true; // vazio = todas
    return !!rId && rotasPermitidas.includes(rId);
  };

  const contasAcessiveis = React.useMemo(() => {
    return contas.filter((c) => {
      if (c.tipo_conta === 'EMPRESA') return true; // tem a empresa (flag futura)
      // ROTA e MICROSEGURO seguem o acesso da rota
      return temAcessoRota((c as any).rota_id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contas, isSuperAdmin, profile]);

  // Se a rota do contexto define uma conta-rota, ela é o default do seletor
  const contaSelecionada = contas.find((c) => c.id === contaFiltro) || null;
  const nomeContaSelecionada = contaSelecionada?.nome || (modoRota && rotaNome ? rotaNome : 'Todas as contas');

  // A conta selecionada permite ver por liquidação? (só ROTA tem liquidação)
  // "Todas as contas" mantém habilitado (usa a rota do contexto).
  const contaPermiteLiquidacao = !contaSelecionada || contaSelecionada.tipo_conta === 'ROTA';

  // Mês exibido no mini-calendário do dropdown
  const NOMES_MES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const selecionarDiaLiquidacao = (dataStr: string) => {
    setDataLiquidacao(dataStr);
    setModoFiltroTemporal('liquidacao');
    setDropdownLiquidacaoAberto(false);
    setMaisFiltrosAberto(false);
  };

  // Troca de conta com regras de liquidação:
  //  - se estava em modo liquidação e a nova conta É de rota -> abre o calendário
  //    para escolher a liquidação da nova rota (cancelar cai para período)
  //  - se a nova conta NÃO tem liquidação (empresa/microseguro) -> cai para período
  const handleTrocarConta = (conta: any | null) => {
    setContaFiltro(conta?.id || '');
    setSeletorContaAberto(false);

    const novaPermiteLiq = !conta || conta.tipo_conta === 'ROTA';

    if (modoFiltroTemporal === 'liquidacao') {
      if (novaPermiteLiq) {
        // abre o calendário para escolher a liquidação da nova conta;
        // limpa a data antiga (era de outra rota) para que cancelar caia em período
        setDataLiquidacao('');
        setDataTempCalendario(null);
        setCalendarioAberto(true);
      } else {
        // empresa/microseguro não têm liquidação -> período
        setModoFiltroTemporal('periodo');
        setDataLiquidacao('');
      }
    }
  };

  // Categorias que têm lançamento na tela, com contagem — para o dropdown "Categoria"
  const categoriasComContagem = React.useMemo(() => {
    const agg: Record<string, { count: number; total: number; nome: string; cor: string | null }> = {};
    (movimentos || []).forEach((m: any) => {
      const cod = m.categoria;
      if (!cod) return;
      if (!agg[cod]) {
        // Enriquece com nome/cor da tabela de categorias, se houver match;
        // senão usa o próprio código como rótulo (garante que apareça).
        const catRef = categorias.find((c: any) => c.codigo === cod || c.nome_pt === cod || c.nome === cod);
        agg[cod] = {
          count: 0,
          total: 0,
          nome: (catRef as any)?.nome_pt || (catRef as any)?.nome || (m.categoria_nome) || cod,
          cor: (catRef as any)?.cor_hex || null,
        };
      }
      agg[cod].count += 1;
      agg[cod].total += Number(m.valor) || 0;
    });
    return Object.entries(agg)
      .map(([codigo, v]) => ({ codigo, nome: v.nome, cor: v.cor, count: v.count, total: v.total }))
      .sort((a, b) => b.total - a.total);
  }, [movimentos, categorias]);


  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-3">
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          {/* Exibindo: seletor de conta (filtro local, respeita acesso) */}
          <div className="relative mt-1">
            <button
              onClick={() => setSeletorContaAberto((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium max-w-[280px]"
            >
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="text-gray-500">Exibindo:</span>
              <span className="truncate">{nomeContaSelecionada}</span>
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
            {seletorContaAberto && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSeletorContaAberto(false)} />
                <div className="absolute left-0 mt-1 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-80 overflow-y-auto">
                  <button
                    onClick={() => handleTrocarConta(null)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${contaFiltro === '' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
                  >
                    <Wallet className="w-4 h-4 text-gray-400" />
                    Todas as contas
                  </button>

                  {contasAcessiveis.filter(c => c.tipo_conta === 'EMPRESA').length > 0 && (
                    <>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Empresa</p>
                      {contasAcessiveis.filter(c => c.tipo_conta === 'EMPRESA').map(c => (
                        <button key={c.id} onClick={() => handleTrocarConta(c)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${contaFiltro === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <span className="truncate">{c.nome}</span>
                        </button>
                      ))}
                    </>
                  )}

                  {contasAcessiveis.filter(c => c.tipo_conta === 'ROTA').length > 0 && (
                    <>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Rotas</p>
                      {contasAcessiveis.filter(c => c.tipo_conta === 'ROTA').map(c => (
                        <button key={c.id} onClick={() => handleTrocarConta(c)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${contaFiltro === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                          <MapPin className="w-4 h-4 text-emerald-600" />
                          <span className="truncate">{c.nome}</span>
                        </button>
                      ))}
                    </>
                  )}

                  {contasAcessiveis.filter(c => c.tipo_conta === 'MICROSEGURO').length > 0 && (
                    <>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Microseguros</p>
                      {contasAcessiveis.filter(c => c.tipo_conta === 'MICROSEGURO').map(c => (
                        <button key={c.id} onClick={() => handleTrocarConta(c)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${contaFiltro === c.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}>
                          <Shield className="w-4 h-4 text-amber-600" />
                          <span className="truncate">{c.nome}</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={() => setModalEscolhaTransacao(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm transition-colors whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Adicionar transação
        </button>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_34%] gap-3 min-h-0">

        {/* COLUNA ESQUERDA — LANÇAMENTOS (detalhe) */}
        <div className="bg-white rounded-lg border border-gray-200 flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-200 flex-shrink-0 space-y-2">
            {/* Linha 1: busca + tempo + Mais */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-[120px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={buscaExtrato}
                  onChange={(e) => setBuscaExtrato(e.target.value)}
                  placeholder="Buscar descrição, conta ou valor..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-md border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                />
              </div>

              {/* Controle de tempo: chip quando liquidação selecionada; senão botões */}
              {modoFiltroTemporal === 'liquidacao' && dataLiquidacao ? (
                <div className="flex items-center gap-1.5 pl-2.5 pr-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                  <button
                    onClick={() => {
                      const [a, m] = dataLiquidacao.split('-');
                      setMesCalendario({ ano: Number(a), mes: Number(m) });
                      setCalendarioAberto(true);
                    }}
                    className="hover:underline"
                    title="Trocar dia de liquidação"
                  >
                    Liquidação {rotuloDataLiquidacao(dataLiquidacao)}
                  </button>
                  <span className="text-indigo-300">|</span>
                  <button
                    onClick={() => { setDataLiquidacao(''); setModoFiltroTemporal('periodo'); }}
                    title="Voltar a filtrar por período"
                    className="hover:underline text-indigo-600"
                  >
                    Ver por período
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
                    <button
                      onClick={() => {
                        const hoje = new Date().toISOString().split('T')[0];
                        setModoFiltroTemporal('periodo');
                        setFiltroResumo({ tipo: 'hoje', dataInicio: hoje, dataFim: hoje });
                        setFiltroExtrato({ tipo: 'hoje', dataInicio: hoje, dataFim: hoje });
                      }}
                      className={`px-2 py-1 text-xs font-semibold rounded transition-all ${modoFiltroTemporal === 'periodo' && filtroExtrato.tipo === 'hoje' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                    >Hoje</button>
                    <button
                      onClick={() => {
                        const o = new Date(); o.setDate(o.getDate() - 1);
                        const os = o.toISOString().split('T')[0];
                        setModoFiltroTemporal('periodo');
                        setFiltroResumo({ tipo: 'ontem', dataInicio: os, dataFim: os });
                        setFiltroExtrato({ tipo: 'ontem', dataInicio: os, dataFim: os });
                      }}
                      className={`px-2 py-1 text-xs font-semibold rounded transition-all ${modoFiltroTemporal === 'periodo' && filtroExtrato.tipo === 'ontem' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                    >Ontem</button>
                  </div>

                  <FiltroPeriodoCompacto
                    filtro={filtroExtrato}
                    onChange={(f) => { setModoFiltroTemporal('periodo'); setFiltroResumo(f); setFiltroExtrato(f); }}
                  />
                </div>
              )}

              {/* Botão Mais (acordeão) */}
              <button
                onClick={() => setMaisFiltrosAberto((v) => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-medium flex-shrink-0 transition-colors ${
                  maisFiltrosAberto || tipoMovimento || categoriaFiltro || statusFiltro !== 'PAGO'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Mais
                {maisFiltrosAberto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Acordeão Mais: Tipo + Status + Categoria */}
            {maisFiltrosAberto && (
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-16 flex-shrink-0">Tipo</span>
                  <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
                    <button onClick={() => setTipoMovimento('')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${tipoMovimento === '' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>Tudo</button>
                    <button onClick={() => setTipoMovimento('ENTRADA')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${tipoMovimento === 'ENTRADA' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>Entradas</button>
                    <button onClick={() => setTipoMovimento('SAIDA')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${tipoMovimento === 'SAIDA' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>Saídas</button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-16 flex-shrink-0">Status</span>
                  <div className="flex items-center gap-0.5 bg-gray-100 rounded-md p-0.5">
                    {[['PAGO','Pagos'],['PENDENTE','Pendentes'],['ANULADO','Anulados'],['TODOS','Todos']].map(([v, label]) => (
                      <button key={v} onClick={() => setStatusFiltro(v)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${statusFiltro === v ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>{label}</button>
                    ))}
                  </div>

                  {(tipoMovimento || categoriaFiltro || statusFiltro !== 'PAGO') && (
                    <button
                      onClick={() => { setTipoMovimento(''); setCategoriaFiltro(''); setStatusFiltro('PAGO'); }}
                      className="ml-auto px-2 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md text-xs flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      Limpar
                    </button>
                  )}
                </div>

                {/* Ver por liquidação — dropdown inteligente */}
                <div className="flex items-start gap-3 pt-2.5 border-t border-gray-200">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-16 flex-shrink-0 mt-1.5">Liquidação</span>
                  <div className="relative">
                    <button
                      onClick={() => { if (contaPermiteLiquidacao) setDropdownLiquidacaoAberto(v => !v); }}
                      disabled={!contaPermiteLiquidacao}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        !contaPermiteLiquidacao ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : modoFiltroTemporal === 'liquidacao' ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                      }`}
                      title={contaPermiteLiquidacao ? 'Ver por liquidação' : 'Esta conta não possui liquidação'}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {modoFiltroTemporal === 'liquidacao' && dataLiquidacao
                        ? `Liquidação · ${rotuloDataLiquidacao(dataLiquidacao)}`
                        : 'Ver por liquidação'}
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {dropdownLiquidacaoAberto && contaPermiteLiquidacao && mesMiniCal && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setDropdownLiquidacaoAberto(false)} />
                        <div className="absolute left-0 mt-1 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden p-2">
                          {loadingHistorico ? (
                            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                          ) : (
                            <>
                              {/* Navegação de mês */}
                              <div className="flex items-center justify-between px-1 py-1">
                                <button
                                  onClick={() => setMesMiniCal(mc => { if (!mc) return mc; const d = new Date(mc.ano, mc.mes - 2, 1); return { ano: d.getFullYear(), mes: d.getMonth() + 1 }; })}
                                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                                ><ChevronLeft className="w-4 h-4" /></button>
                                <span className="text-xs font-semibold text-gray-700">
                                  {NOMES_MES[mesMiniCal.mes - 1]} {mesMiniCal.ano}
                                </span>
                                <button
                                  onClick={() => setMesMiniCal(mc => { if (!mc) return mc; const d = new Date(mc.ano, mc.mes, 1); return { ano: d.getFullYear(), mes: d.getMonth() + 1 }; })}
                                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                                ><ChevronRight className="w-4 h-4" /></button>
                              </div>

                              {/* Cabeçalho dos dias da semana */}
                              <div className="grid grid-cols-7 gap-0.5 px-1 mb-0.5">
                                {['D','S','T','Q','Q','S','S'].map((d, i) => (
                                  <div key={i} className="text-center text-[9px] font-semibold text-gray-400 py-0.5">{d}</div>
                                ))}
                              </div>

                              {/* Grade de dias */}
                              <div className="grid grid-cols-7 gap-0.5 px-1">
                                {(() => {
                                  const { ano, mes } = mesMiniCal;
                                  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
                                  const diasNoMes = new Date(ano, mes, 0).getDate();
                                  const celulas: React.ReactNode[] = [];
                                  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(<div key={`v${i}`} />);
                                  for (let dia = 1; dia <= diasNoMes; dia++) {
                                    const ds = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                                    const temLiq = diasComLiq.has(ds);
                                    const liq = mapaDiaLiq[ds];
                                    const selecionado = dataLiquidacao === ds;
                                    const aberta = liq && ['ABERTO', 'REABERTO'].includes(liq.status);
                                    celulas.push(
                                      <button
                                        key={ds}
                                        disabled={!temLiq}
                                        onClick={() => temLiq && selecionarDiaLiquidacao(ds)}
                                        title={temLiq ? `Liquidação ${liq?.status || ''}` : 'Sem liquidação'}
                                        className={`aspect-square flex items-center justify-center text-[11px] rounded-md transition-colors relative ${
                                          selecionado ? 'bg-green-600 text-white font-semibold'
                                            : !temLiq ? 'text-gray-300 cursor-default'
                                            : aberta ? 'text-green-700 font-semibold hover:bg-green-50'
                                            : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                      >
                                        {dia}
                                        {temLiq && !selecionado && (
                                          <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${aberta ? 'bg-green-500' : 'bg-gray-400'}`} />
                                        )}
                                      </button>
                                    );
                                  }
                                  return celulas;
                                })()}
                              </div>

                              <div className="flex items-center gap-3 px-2 pt-2 mt-1 border-t border-gray-100 text-[9px] text-gray-400">
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> aberta</span>
                                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> fechada</span>
                              </div>

                              {modoFiltroTemporal === 'liquidacao' && (
                                <button
                                  onClick={() => { setDataLiquidacao(''); setModoFiltroTemporal('periodo'); setDropdownLiquidacaoAberto(false); }}
                                  className="w-full px-2 py-1.5 mt-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded-md text-left font-medium"
                                >
                                  ← Voltar a ver por período
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full">
              <tbody className="divide-y divide-gray-100">
                {loadingExtrato ? (
                  <tr><td colSpan={3} className="px-4 py-12 text-center"><Loader2 className="w-7 h-7 animate-spin text-gray-400 mx-auto" /></td></tr>
                ) : movimentosFiltrados.length > 0 ? (
                  movimentosFiltrados.map(m => (
                    <LinhaExtrato key={m.id} movimento={m} categorias={categorias} podeAnular={podeAnular} onAnular={handleAnularMovimentacao} onVerComprovante={(url) => setComprovante(url)} />
                  ))
                ) : modoFiltroTemporal === 'liquidacao' && !dataLiquidacao ? (
                  <tr><td colSpan={3} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Calendar className="w-10 h-10 text-blue-300 mb-2" />
                      <p className="text-gray-600 text-sm font-medium">Selecione uma data de liquidação</p>
                    </div>
                  </td></tr>
                ) : (
                  <tr><td colSpan={3} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <FileText className="w-10 h-10 text-gray-300 mb-2" />
                      <p className="text-gray-500 text-sm">Nenhuma movimentação encontrada</p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 flex-shrink-0 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-gray-600">{movimentosFiltrados.length} registro(s)</span>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-green-600 font-semibold tabular-nums">
                entradas {totalEntradasFiltrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <span className="text-red-600 font-semibold tabular-nums">
                saídas {totalSaidasFiltrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA — SALDOS + POR CATEGORIA */}
        <div className="flex flex-col gap-3 min-h-0 overflow-y-auto">
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide truncate">
              {contaSelecionada ? `Saldos · ${contaSelecionada.nome}` : 'Saldos'}
            </h3>
          </div>

          <div className="divide-y divide-gray-100 flex-shrink-0">
            {loadingSaldos ? (
              <div className="p-3 space-y-2">
                <div className="h-8 bg-gray-100 animate-pulse rounded" />
                <div className="h-8 bg-gray-100 animate-pulse rounded" />
              </div>
            ) : contaSelecionada ? (
              // Conta específica selecionada: mostra só ela
              <button
                onClick={() => setModalAjuste(true)}
                className="w-full px-3 py-3 hover:bg-gray-50 transition-colors flex items-center gap-2 text-left"
              >
                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                  contaSelecionada.tipo_conta === 'EMPRESA' ? 'bg-blue-50' :
                  contaSelecionada.tipo_conta === 'MICROSEGURO' ? 'bg-amber-50' : 'bg-emerald-50'
                }`}>
                  {contaSelecionada.tipo_conta === 'EMPRESA' ? <Building2 className="w-3.5 h-3.5 text-blue-600" /> :
                   contaSelecionada.tipo_conta === 'MICROSEGURO' ? <Shield className="w-3.5 h-3.5 text-amber-600" /> :
                   <MapPin className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase font-semibold truncate">{contaSelecionada.nome}</p>
                  <p className="text-[10px] text-gray-400">ajustar saldo</p>
                </div>
                <span className={`text-base font-bold tabular-nums ${((contaSelecionada as any).saldo_atual ?? 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {((contaSelecionada as any).saldo_atual ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </button>
            ) : (
              <>
                {!modoRota && (
                  <button
                    onClick={() => setModalAjuste(true)}
                    className="w-full px-3 py-2.5 hover:bg-blue-50/50 transition-colors flex items-center gap-2 text-left"
                  >
                    <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-500 uppercase font-semibold">Empresa</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${saldos.saldo_empresa < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {saldos.saldo_empresa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                )}

                {(modoRota ? [{ nome: rotaNome || 'Rota', valor: saldos.saldo_rotas }] : rotasItens).slice(0, modoRota ? 1 : 3).map((r, i) => (
                  <button
                    key={i}
                    onClick={() => setModalAjuste(true)}
                    className="w-full px-3 py-2.5 hover:bg-emerald-50/50 transition-colors flex items-center gap-2 text-left"
                  >
                    <div className="w-7 h-7 bg-emerald-50 rounded-md flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-500 uppercase font-semibold truncate">{r.nome}</p>
                      <p className="text-[10px] text-gray-400">ajustar saldo</p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${r.valor < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}

                {!modoRota && rotasItens.length > 3 && (
                  <button
                    onClick={() => setModalVerRotas(true)}
                    className="w-full px-3 py-1.5 text-[11px] text-blue-600 hover:bg-blue-50/50 font-medium text-left"
                  >
                    ver todas as {rotasItens.length} rotas
                  </button>
                )}

                <button
                  onClick={() => modoRota ? undefined : setModalVerMicroseguros(true)}
                  className="w-full px-3 py-2.5 hover:bg-amber-50/50 transition-colors flex items-center gap-2 text-left"
                >
                  <div className="w-7 h-7 bg-amber-50 rounded-md flex items-center justify-center flex-shrink-0">
                    <Shield className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Microseguros</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${saldos.saldo_microseguros < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {saldos.saldo_microseguros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  {!modoRota && <ChevronRight className="w-4 h-4 text-gray-300" />}
                </button>

                {!modoRota && (
                  <div className="px-3 py-2.5 bg-gray-50/60 flex items-center gap-2">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold flex-1">Total consolidado</p>
                    <span className={`text-base font-bold tabular-nums ${saldos.total_consolidado < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {saldos.total_consolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Resumo por categoria — clicável, filtra a lista (combina com a conta) */}
        <div className="bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-50 rounded-md flex items-center justify-center">
                <Tag className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Por categoria</h3>
            </div>
            {categoriaFiltro && (
              <button
                onClick={() => setCategoriaFiltro('')}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
              >
                <X className="w-3 h-3" /> limpar
              </button>
            )}
          </div>

          <div className="divide-y divide-gray-50 max-h-[40vh] overflow-y-auto">
            {loadingExtrato ? (
              <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : categoriasComContagem.length === 0 ? (
              <p className="px-3 py-6 text-xs text-gray-400 text-center">Nenhum lançamento no período</p>
            ) : (
              categoriasComContagem.map((c) => {
                const ativa = categoriaFiltro === c.codigo;
                return (
                  <button
                    key={c.codigo}
                    onClick={() => setCategoriaFiltro(ativa ? '' : c.codigo)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${ativa ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: c.cor || '#9ca3af' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${ativa ? 'text-purple-700' : 'text-gray-700'}`}>{c.nome}</p>
                      <p className="text-[10px] text-gray-400">{c.count} lançamento{c.count > 1 ? 's' : ''}</p>
                    </div>
                    <span className={`text-xs font-semibold tabular-nums ${ativa ? 'text-purple-700' : 'text-gray-900'}`}>
                      {c.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Calendário de seleção de dia de liquidação */}
      {calendarioAberto && rotaId && (
        <ModalCalendarioLiquidacao
          isOpen={calendarioAberto}
          onClose={() => {
            setDataTempCalendario(null);
            setCalendarioAberto(false);
            // Se estava em modo liquidação mas não há liquidação selecionada
            // (ex.: trocou de conta e cancelou), volta para período.
            if (modoFiltroTemporal === 'liquidacao' && !dataLiquidacao) {
              setModoFiltroTemporal('periodo');
            }
          }}
          rotaId={rotaId}
          liquidacoesMes={liquidacoesMes}
          dataSelecionada={dataTempCalendario || (dataLiquidacao ? new Date(dataLiquidacao + 'T12:00:00') : new Date())}
          onSelecionarData={(d) => setDataTempCalendario(d)}
          onMesChange={(ano, mes) => setMesCalendario({ ano, mes })}
          onConfirmar={(d) => {
            const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            setDataLiquidacao(ymd);
            setModoFiltroTemporal('liquidacao'); // entra no modo só ao confirmar
            setDataTempCalendario(null);
            setCalendarioAberto(false);
          }}
          loading={loadingCalendario}
        />
      )}

      {/* Pré-modal: escolher tipo de transação */}
      {modalEscolhaTransacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalEscolhaTransacao(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Adicionar transação</h2>
                <p className="text-sm text-gray-500">O que você quer registrar?</p>
              </div>
              <button
                onClick={() => setModalEscolhaTransacao(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <button
                onClick={() => { setModalEscolhaTransacao(false); setModalMovimentacao(true); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition-all"
              >
                <div className="w-11 h-11 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Nova movimentação</p>
                  <p className="text-xs text-gray-500">Registrar uma receita ou uma despesa</p>
                </div>
              </button>

              <button
                onClick={() => { setModalEscolhaTransacao(false); setModalTransferencia(true); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition-all"
              >
                <div className="w-11 h-11 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Nova transferência</p>
                  <p className="text-xs text-gray-500">Mover valores entre contas</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais - Componentes externos padronizados */}
      <ModalNovaMovimentacao
        isOpen={modalMovimentacao}
        onClose={() => setModalMovimentacao(false)}
        contas={contas}
        categorias={categorias}
        onSalvar={handleSalvarMovimentacao}
      />
      <ModalTransferencia
        isOpen={modalTransferencia}
        onClose={() => setModalTransferencia(false)}
        contas={contas}
        onSalvar={handleSalvarTransferencia}
      />
      <ModalAjusteSaldo
        isOpen={modalAjuste}
        onClose={() => setModalAjuste(false)}
        contas={contas}
        onSalvar={handleSalvarAjuste}
      />

      {/* Modal Ver Todas Rotas */}
      <ModalVerTodas
        isOpen={modalVerRotas}
        onClose={() => setModalVerRotas(false)}
        titulo="Saldos por Rota"
        itens={rotasItens}
        icone={MapPin}
        corIcone="text-emerald-600"
      />

      {/* Modal Ver Todos Microseguros */}
      <ModalVerTodas
        isOpen={modalVerMicroseguros}
        onClose={() => setModalVerMicroseguros(false)}
        titulo="Saldos por Microseguro"
        itens={microsegurosItens}
        icone={Shield}
        corIcone="text-amber-600"
      />

      {comprovante && <LightboxImagem url={comprovante} onClose={() => setComprovante(null)} />}
    </div>
  );
}