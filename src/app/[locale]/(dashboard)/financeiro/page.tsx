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
  FileText,
  AlertCircle
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
import type {
  SaldosContas,
  ResumoMovimentacoes,
  DadosGrafico,
  MovimentoFinanceiro,
  CategoriaFinanceira,
  ContaComDetalhes,
} from '@/types/financeiro';

// =====================================================
// TIPOS LOCAIS
// =====================================================
type AbaAtiva = 'resumo' | 'extrato';
type TipoFiltro = 'hoje' | 'ontem' | 'periodo';

interface FiltroData {
  tipo: TipoFiltro;
  dataInicio: string;
  dataFim: string;
}

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

function CardIndicador({ 
  titulo, 
  valor, 
  icone: Icone, 
  corIcone,
  corFundo,
  loading = false
}: { 
  titulo: string; 
  valor: number; 
  icone: React.ElementType; 
  corIcone: string;
  corFundo: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${corFundo} flex items-center justify-center`}>
          <Icone className={`w-5 h-5 ${corIcone}`} />
        </div>
        <span className="text-sm font-medium text-gray-600">{titulo}</span>
      </div>
      {loading ? (
        <div className="h-8 bg-gray-200 animate-pulse rounded" />
      ) : (
        <p className="text-2xl font-bold text-gray-900">
          {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      )}
    </div>
  );
}

function CardMovimentacao({ 
  tipo, 
  titulo, 
  valor, 
  quantidade,
  corValor,
  loading = false
}: { 
  tipo: 'entrada' | 'saida' | 'resultado';
  titulo: string;
  valor: number;
  quantidade: number;
  corValor: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <span className="text-sm font-medium text-gray-500">{titulo}</span>
      {loading ? (
        <div className="mt-2 space-y-2">
          <div className="h-6 bg-gray-200 animate-pulse rounded w-24" />
          <div className="h-4 bg-gray-200 animate-pulse rounded w-16" />
        </div>
      ) : (
        <div className="mt-2">
          <p className={`text-xl font-bold ${corValor}`}>
            {tipo === 'entrada' && '+'}{tipo === 'saida' && '-'}
            {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {quantidade} {quantidade === 1 ? 'transação' : 'transações'}
          </p>
        </div>
      )}
    </div>
  );
}

function BotaoAcaoRapida({ 
  icone: Icone, 
  titulo, 
  onClick 
}: { 
  icone: React.ElementType; 
  titulo: string; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
        <Icone className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
      </div>
      <span className="font-medium text-gray-700 group-hover:text-blue-700">{titulo}</span>
    </button>
  );
}

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
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            filtro.tipo === 'hoje'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
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
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            filtro.tipo === 'ontem'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Ontem
        </button>
      </div>

      <div className="relative">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
            filtro.tipo === 'periodo'
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-medium">{formatarPeriodo()}</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        {showCalendar && (
          <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 min-w-[280px]">
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
  categorias 
}: { 
  movimento: MovimentoFinanceiro; 
  categorias: CategoriaFinanceira[];
}) {
  const categoria = categorias.find(c => c.codigo === movimento.categoria);
  const isEntrada = movimento.tipo === 'RECEBER';
  const isTransferencia = movimento.tipo === 'TRANSFERENCIA';
  const isSaida = movimento.tipo === 'PAGAR';
  
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
  
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600">
          {new Date(movimento.data_lancamento).toLocaleDateString('pt-BR')}
        </span>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{movimento.descricao}</p>
          {getContaDisplay()}
          {movimento.observacoes && (
            <p className="text-xs text-gray-400 mt-0.5">{movimento.observacoes}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span 
          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium"
          style={{ 
            backgroundColor: categoria?.cor_hex ? `${categoria.cor_hex}20` : '#f3f4f6',
            color: categoria?.cor_hex || '#374151'
          }}
        >
          {categoria?.nome_pt || movimento.categoria}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`text-sm font-semibold ${
          isTransferencia ? 'text-blue-600' : isEntrada ? 'text-green-600' : 'text-red-600'
        }`}>
          {isTransferencia ? '↔' : isEntrada ? '+' : '-'} 
          {movimento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          movimento.status === 'PAGO' ? 'bg-green-100 text-green-700' :
          movimento.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-700' :
          movimento.status === 'CANCELADO' ? 'bg-gray-100 text-gray-700' :
          movimento.status === 'VENCIDO' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {movimento.status === 'PAGO' && '✓ '}
          {movimento.status}
        </span>
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

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

export default function FinanceiroPage() {
  const { localizacao, profile } = useUser();
  const empresaId = localizacao?.empresa_id;

  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('resumo');
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
  
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [loadingGrafico, setLoadingGrafico] = useState(false);
  const [loadingExtrato, setLoadingExtrato] = useState(false);
  const [loadingContas, setLoadingContas] = useState(false);
  
  const [modalMovimentacao, setModalMovimentacao] = useState(false);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [modalAjuste, setModalAjuste] = useState(false);

  const [saldos, setSaldos] = useState<SaldosContas>({
    total_consolidado: 0,
    saldo_empresa: 0,
    saldo_rotas: 0,
    saldo_microseguros: 0,
    contas: [],
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

  const carregarSaldos = useCallback(async () => {
    if (!empresaId) return;
    setLoadingSaldos(true);
    try {
      const data = await financeiroService.buscarSaldosContas(empresaId);
      setSaldos(data);
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
    } finally {
      setLoadingSaldos(false);
    }
  }, [empresaId]);

  const carregarResumo = useCallback(async () => {
    if (!empresaId) return;
    setLoadingResumo(true);
    try {
      const data = await financeiroService.buscarResumoMovimentacoes(
        empresaId, 
        filtroResumo.tipo === 'periodo' ? undefined : filtroResumo.tipo,
        filtroResumo.tipo === 'periodo' ? filtroResumo.dataInicio : undefined,
        filtroResumo.tipo === 'periodo' ? filtroResumo.dataFim : undefined
      );
      setResumo(data);
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    } finally {
      setLoadingResumo(false);
    }
  }, [empresaId, filtroResumo]);

  const carregarGrafico = useCallback(async () => {
    if (!empresaId) return;
    setLoadingGrafico(true);
    try {
      const data = await financeiroService.buscarDadosGrafico(
        empresaId, 
        filtroResumo.tipo === 'periodo' ? undefined : filtroResumo.tipo,
        filtroResumo.tipo === 'periodo' ? filtroResumo.dataInicio : undefined,
        filtroResumo.tipo === 'periodo' ? filtroResumo.dataFim : undefined
      );
      setDadosGrafico(data);
    } catch (error) {
      console.error('Erro ao carregar gráfico:', error);
    } finally {
      setLoadingGrafico(false);
    }
  }, [empresaId, filtroResumo]);

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
    setLoadingExtrato(true);
    try {
      const data = await financeiroService.buscarExtrato(empresaId, {
        periodo: filtroExtrato.tipo === 'periodo' ? undefined : filtroExtrato.tipo,
        conta_id: contaFiltro || undefined,
        categoria: categoriaFiltro || undefined,
        data_inicio: filtroExtrato.tipo === 'periodo' ? filtroExtrato.dataInicio : undefined,
        data_fim: filtroExtrato.tipo === 'periodo' ? filtroExtrato.dataFim : undefined,
      });
      setMovimentos(data);
    } catch (error) {
      console.error('Erro ao carregar extrato:', error);
    } finally {
      setLoadingExtrato(false);
    }
  }, [empresaId, filtroExtrato, contaFiltro, categoriaFiltro]);

  useEffect(() => {
    if (empresaId) {
      carregarSaldos();
      carregarContas();
      carregarCategorias();
    }
  }, [empresaId, carregarSaldos, carregarContas, carregarCategorias]);

  useEffect(() => {
    if (empresaId && abaAtiva === 'resumo') {
      carregarResumo();
      carregarGrafico();
    }
  }, [empresaId, abaAtiva, filtroResumo, carregarResumo, carregarGrafico]);

  useEffect(() => {
    if (empresaId && abaAtiva === 'extrato') {
      carregarExtrato();
    }
  }, [empresaId, abaAtiva, filtroExtrato, contaFiltro, categoriaFiltro, carregarExtrato]);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
          <button
            onClick={() => setAbaAtiva('resumo')}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${
              abaAtiva === 'resumo'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Resumo
          </button>
          <button
            onClick={() => setAbaAtiva('extrato')}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${
              abaAtiva === 'extrato'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Extrato Detalhado
          </button>
        </div>

        {abaAtiva === 'resumo' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Saldos das Contas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <CardIndicador titulo="Total Consolidado" valor={saldos.total_consolidado} icone={Wallet} corIcone="text-indigo-600" corFundo="bg-indigo-100" loading={loadingSaldos} />
                <CardIndicador titulo="Empresa" valor={saldos.saldo_empresa} icone={Building2} corIcone="text-blue-600" corFundo="bg-blue-100" loading={loadingSaldos} />
                <CardIndicador titulo="Rotas" valor={saldos.saldo_rotas} icone={MapPin} corIcone="text-emerald-600" corFundo="bg-emerald-100" loading={loadingSaldos} />
                <CardIndicador titulo="Microseguros" valor={saldos.saldo_microseguros} icone={Shield} corIcone="text-amber-600" corFundo="bg-amber-100" loading={loadingSaldos} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Movimentações do Período</h2>
                <FiltroPeriodo filtro={filtroResumo} onChange={setFiltroResumo} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 grid grid-cols-1 gap-4">
                  <CardMovimentacao tipo="entrada" titulo="Entradas" valor={resumo.total_entradas} quantidade={resumo.qtd_entradas} corValor="text-green-600" loading={loadingResumo} />
                  <CardMovimentacao tipo="saida" titulo="Saídas" valor={resumo.total_saidas} quantidade={resumo.qtd_saidas} corValor="text-red-600" loading={loadingResumo} />
                  <CardMovimentacao tipo="resultado" titulo="Resultado" valor={resumo.saldo_periodo} quantidade={resumo.qtd_total} corValor={resumo.saldo_periodo >= 0 ? 'text-blue-600' : 'text-red-600'} loading={loadingResumo} />
                </div>

                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Entradas vs Saídas</h3>
                  <div className="h-64">
                    {loadingGrafico ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                      </div>
                    ) : dadosGrafico.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        Sem dados para o período
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosGrafico} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="data_formatada" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                          <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Ações Rápidas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BotaoAcaoRapida icone={Plus} titulo="Nova movimentação" onClick={() => setModalMovimentacao(true)} />
                <BotaoAcaoRapida icone={ArrowRightLeft} titulo="Transferências" onClick={() => setModalTransferencia(true)} />
                <BotaoAcaoRapida icone={CheckSquare} titulo="Ajuste Saldo" onClick={() => setModalAjuste(true)} />
              </div>
            </div>
          </div>
        )}

        {abaAtiva === 'extrato' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <FiltroPeriodo filtro={filtroExtrato} onChange={setFiltroExtrato} />
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <select value={contaFiltro} onChange={(e) => setContaFiltro(e.target.value)} className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer">
                    <option value="">Todas as Contas</option>
                    <optgroup label="🏢 Empresa">
                      {contas.filter(c => c.tipo_conta === 'EMPRESA').map(c => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                    </optgroup>
                    <optgroup label="🛣️ Rotas">
                      {contas.filter(c => c.tipo_conta === 'ROTA').map(c => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                    </optgroup>
                    <optgroup label="🛡️ Microseguros">
                      {contas.filter(c => c.tipo_conta === 'MICROSEGURO').map(c => (<option key={c.id} value={c.id}>{c.nome}</option>))}
                    </optgroup>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>

                <div className="relative">
                  <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer">
                    <option value="">Todas as Categorias</option>
                    {categorias.map(c => (<option key={c.id} value={c.codigo}>{c.nome_pt}</option>))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingExtrato ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" /></td></tr>
                    ) : movimentos.length > 0 ? (
                      movimentos.map(m => (<LinhaExtrato key={m.id} movimento={m} categorias={categorias} />))
                    ) : (
                      <tr><td colSpan={5} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <FileText className="w-12 h-12 text-gray-300 mb-3" />
                          <p className="text-gray-500">Nenhuma movimentação encontrada</p>
                        </div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {movimentos.length > 0 && (
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                    <span className="text-gray-600">{movimentos.length} registros</span>
                    <div className="flex items-center gap-6">
                      <span className="text-green-600 font-medium">Entradas: {totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      <span className="text-red-600 font-medium">Saídas: {totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
    </div>
  );
}