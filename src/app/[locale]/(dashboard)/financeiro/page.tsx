'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, 
  Building2, 
  MapPin, 
  Shield,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Plus,
  CheckSquare,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
  X,
  Eye,
  Search,
  Ban
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useUser } from '@/contexts/UserContext';
import { financeiroService } from '@/services/financeiro';
import { 
  ModalNovaMovimentacao, 
  ModalTransferencia, 
  ModalAjusteSaldo 
} from '@/components/financeiro';
import { LightboxImagem, BotaoVerComprovante } from '@/components/liquidacao/CardsFinanceiros';
import type {
  SaldosContas,
  ResumoMovimentacoes,
  DadosGrafico,
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

function FiltroPeriodo({ 
  filtro, 
  onChange 
}: { 
  filtro: FiltroData; 
  onChange: (filtro: FiltroData) => void;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [tempDataInicio, setTempDataInicio] = useState(filtro.dataInicio);
  const [tempDataFim, setTempDataFim] = useState(filtro.dataFim);

  const handleAplicarPeriodo = () => {
    onChange({
      tipo: 'periodo',
      dataInicio: tempDataInicio,
      dataFim: tempDataFim,
    });
    setShowCalendar(false);
  };

  const formatarPeriodo = () => {
    if (filtro.tipo === 'hoje') return 'Hoje';
    if (filtro.tipo === 'ontem') return 'Ontem';
    if (filtro.dataInicio === filtro.dataFim) {
      return new Date(filtro.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR');
    }
    return `${new Date(filtro.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} - ${new Date(filtro.dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`;
  };
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => onChange({ tipo: 'hoje', dataInicio: new Date().toISOString().split('T')[0], dataFim: new Date().toISOString().split('T')[0] })}
          className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
            filtro.tipo === 'hoje'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
          }`}
        >
          Hoje
        </button>
        <button
          onClick={() => {
            const ontem = new Date();
            ontem.setDate(ontem.getDate() - 1);
            const ontemStr = ontem.toISOString().split('T')[0];
            onChange({ tipo: 'ontem', dataInicio: ontemStr, dataFim: ontemStr });
          }}
          className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${
            filtro.tipo === 'ontem'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
          }`}
        >
          Ontem
        </button>
      </div>

      <div className="relative">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-semibold transition-all ${
            filtro.tipo === 'periodo'
              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
              : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-700'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-medium">{formatarPeriodo()}</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        {showCalendar && (
          <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 min-w-[280px] max-w-[calc(100vw-2rem)]">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
                <input
                  type="date"
                  value={tempDataInicio}
                  onChange={(e) => setTempDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={tempDataFim}
                  onChange={(e) => setTempDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCalendar(false)}
                  className="flex-1 px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAplicarPeriodo}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  const [buscaExtrato, setBuscaExtrato] = useState<string>('');
  const [tipoMovimento, setTipoMovimento] = useState<string>(''); // '', 'ENTRADA', 'SAIDA'
  const [statusFiltro, setStatusFiltro] = useState<string>('PAGO'); // '', 'PAGO', 'PENDENTE', 'ANULADO', 'TODOS'
  const [modoFiltroTemporal, setModoFiltroTemporal] = useState<'periodo' | 'liquidacao'>('periodo');
  const [dataLiquidacao, setDataLiquidacao] = useState<string>(''); // YYYY-MM-DD
  const [loadingUltimaLiquidacao, setLoadingUltimaLiquidacao] = useState(false);
  
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [loadingGrafico, setLoadingGrafico] = useState(false);
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
  const [resumo, setResumo] = useState<ResumoMovimentacoes>({
    total_entradas: 0,
    total_saidas: 0,
    saldo_periodo: 0,
    qtd_entradas: 0,
    qtd_saidas: 0,
    qtd_total: 0,
  });
  const [dadosGrafico, setDadosGrafico] = useState<DadosGrafico[]>([]);
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

  const carregarResumo = useCallback(async () => {
    if (!empresaId) return;
    setLoadingResumo(true);
    try {
      const data = await financeiroService.buscarResumoMovimentacoes(
        empresaId, 
        filtroResumo.tipo === 'periodo' ? undefined : filtroResumo.tipo,
        filtroResumo.tipo === 'periodo' ? filtroResumo.dataInicio : undefined,
        filtroResumo.tipo === 'periodo' ? filtroResumo.dataFim : undefined,
        rotaId
      );
      setResumo(data);
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    } finally {
      setLoadingResumo(false);
    }
  }, [empresaId, filtroResumo, rotaId]);

  const carregarGrafico = useCallback(async () => {
    if (!empresaId) return;
    setLoadingGrafico(true);
    try {
      const data = await financeiroService.buscarDadosGrafico(
        empresaId, 
        filtroResumo.tipo === 'periodo' ? undefined : filtroResumo.tipo,
        filtroResumo.tipo === 'periodo' ? filtroResumo.dataInicio : undefined,
        filtroResumo.tipo === 'periodo' ? filtroResumo.dataFim : undefined,
        rotaId
      );
      setDadosGrafico(data);
    } catch (error) {
      console.error('Erro ao carregar gráfico:', error);
    } finally {
      setLoadingGrafico(false);
    }
  }, [empresaId, filtroResumo, rotaId]);

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
        categoria: categoriaFiltro || undefined,
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
  }, [empresaId, filtroExtrato, contaFiltro, categoriaFiltro, rotaId, modoFiltroTemporal, dataLiquidacao, statusFiltro]);

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

  useEffect(() => {
    if (empresaId) {
      carregarResumo();
      carregarGrafico();
    }
  }, [empresaId, filtroResumo, rotaId, carregarResumo, carregarGrafico]);

  useEffect(() => {
    if (empresaId) {
      carregarExtrato();
    }
  }, [empresaId, filtroExtrato, contaFiltro, categoriaFiltro, rotaId, modoFiltroTemporal, dataLiquidacao, carregarExtrato]);

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
      await Promise.all([carregarSaldos(), carregarContas(), carregarResumo(), carregarExtrato()]);
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
    await Promise.all([carregarSaldos(), carregarContas(), carregarResumo(), carregarExtrato()]);
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
    await Promise.all([carregarSaldos(), carregarContas(), carregarResumo(), carregarExtrato()]);
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
    await Promise.all([carregarSaldos(), carregarContas(), carregarResumo(), carregarExtrato()]);
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
  }, [movimentos, tipoMovimento, buscaExtrato, statusFiltro]);

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

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-3">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          {modoRota && rotaNome && (
            <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
              <MapPin className="w-4 h-4" />
              Exibindo: Rota {rotaNome}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <FiltroPeriodo
            filtro={filtroResumo}
            onChange={(f) => { setFiltroResumo(f); setFiltroExtrato(f); }}
          />
          <button
            onClick={() => setModalEscolhaTransacao(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Adicionar transação
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_34%] gap-3 min-h-0">

        {/* COLUNA ESQUERDA — LANÇAMENTOS (detalhe) */}
        <div className="bg-white rounded-lg border border-gray-200 flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-200 flex-shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Lançamentos</h3>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={buscaExtrato}
                  onChange={(e) => setBuscaExtrato(e.target.value)}
                  placeholder="Buscar descrição, conta ou valor..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-md border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-xs"
                />
              </div>
              {(buscaExtrato || tipoMovimento || contaFiltro || categoriaFiltro || statusFiltro !== 'PAGO') && (
                <button
                  onClick={() => { setBuscaExtrato(''); setTipoMovimento(''); setContaFiltro(''); setCategoriaFiltro(''); setStatusFiltro('PAGO'); }}
                  className="ml-auto px-2 py-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md text-xs flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpar
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
                <button
                  onClick={() => setTipoMovimento('')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${tipoMovimento === '' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >Tudo</button>
                <button
                  onClick={() => setTipoMovimento('ENTRADA')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${tipoMovimento === 'ENTRADA' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >Entradas</button>
                <button
                  onClick={() => setTipoMovimento('SAIDA')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${tipoMovimento === 'SAIDA' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                >Saídas</button>
              </div>

              <select
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value)}
                className="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="PAGO">Pagos</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="ANULADO">Anulados</option>
                <option value="TODOS">Todos os status</option>
              </select>

              <select
                value={contaFiltro}
                onChange={(e) => setContaFiltro(e.target.value)}
                className="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[150px]"
              >
                <option value="">Todas as contas</option>
                <optgroup label="Empresa">
                  {contas.filter(c => c.tipo_conta === 'EMPRESA').map(c => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                </optgroup>
                <optgroup label="Rotas">
                  {contas.filter(c => c.tipo_conta === 'ROTA').map(c => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                </optgroup>
                <optgroup label="Microseguros">
                  {contas.filter(c => c.tipo_conta === 'MICROSEGURO').map(c => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                </optgroup>
              </select>

              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="px-2 py-1 bg-white border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[150px]"
              >
                <option value="">Todas as categorias</option>
                {categorias.map(c => (<option key={c.id} value={c.codigo}>{c.nome_pt}</option>))}
              </select>

              <button
                onClick={() => { setModoFiltroTemporal(modoFiltroTemporal === 'periodo' ? 'liquidacao' : 'periodo'); if (modoFiltroTemporal === 'liquidacao') setDataLiquidacao(''); }}
                title={modoFiltroTemporal === 'periodo' ? 'Filtrando por período — clique para filtrar por liquidação' : 'Filtrando por liquidação — clique para filtrar por período'}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
                  modoFiltroTemporal === 'liquidacao' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {modoFiltroTemporal === 'liquidacao' ? 'Por liquidação' : 'Por período'}
              </button>

              {modoFiltroTemporal === 'liquidacao' && (
                loadingUltimaLiquidacao ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                ) : (
                  <input
                    type="date"
                    value={dataLiquidacao}
                    onChange={(e) => setDataLiquidacao(e.target.value)}
                    className="px-2 py-1 rounded-md border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                )
              )}
            </div>
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

        {/* COLUNA DIREITA — SALDOS + RESULTADO (resumo) */}
        <div className="bg-white rounded-lg border border-gray-200 flex flex-col min-h-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Saldos</h3>
          </div>

          <div className="divide-y divide-gray-100 flex-shrink-0">
            {loadingSaldos ? (
              <div className="p-3 space-y-2">
                <div className="h-8 bg-gray-100 animate-pulse rounded" />
                <div className="h-8 bg-gray-100 animate-pulse rounded" />
              </div>
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

          <div className="px-3 py-2.5 border-t border-gray-200 flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-indigo-50 rounded-md flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Resultado do período</h3>
          </div>

          <div className="px-3 pb-3 flex-shrink-0">
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${resumo.total_entradas + resumo.total_saidas > 0 ? Math.round((resumo.total_entradas / (resumo.total_entradas + resumo.total_saidas)) * 100) : 0}%` }}
              />
            </div>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">entradas · {resumo.qtd_entradas}</span>
                <span className="font-semibold text-green-600 tabular-nums">
                  {resumo.total_entradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">saídas · {resumo.qtd_saidas}</span>
                <span className="font-semibold text-red-600 tabular-nums">
                  {resumo.total_saidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-gray-100">
                <span className="text-gray-500">resultado</span>
                <span className={`font-bold tabular-nums ${resumo.saldo_periodo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {resumo.saldo_periodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          </div>

          <div className="px-3 pb-3 flex-1 min-h-[110px]">
            {loadingGrafico ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : dadosGrafico.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-400">
                Sem dados no período
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={110}>
                <BarChart data={dadosGrafico} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="data_formatada" tick={{ fontSize: 9 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={32} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

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