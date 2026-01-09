'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Lock,
  Eye,
} from 'lucide-react';
import type { LiquidacaoDiaria } from '@/types/liquidacao';

// =====================================================
// TIPOS
// =====================================================

interface DiaCalendario {
  data: Date;
  diaDoMes: number;
  isHoje: boolean;
  isMesAtual: boolean;
  isPassado: boolean;
  isFuturo: boolean;
  liquidacao?: LiquidacaoDiaria;
  previsao?: {
    quantidade: number;
    valor: number;
  };
}

interface CalendarioLiquidacaoProps {
  rotaId: string;
  liquidacoesMes: LiquidacaoDiaria[];
  resumoParcelas: Map<string, { quantidade: number; valor: number }>;
  dataSelecionada: Date;
  onSelecionarData: (data: Date) => void;
  onMesChange: (ano: number, mes: number) => void;
  loading?: boolean;
}

// =====================================================
// HELPERS
// =====================================================

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function formatarData(data: Date): string {
  return data.toISOString().split('T')[0];
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function gerarDiasDoMes(ano: number, mes: number): Date[] {
  const dias: Date[] = [];
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);
  
  // Adicionar dias do mês anterior para completar a primeira semana
  const diaSemanaInicio = primeiroDia.getDay();
  for (let i = diaSemanaInicio - 1; i >= 0; i--) {
    const d = new Date(ano, mes - 1, -i);
    dias.push(d);
  }
  
  // Adicionar dias do mês atual
  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    dias.push(new Date(ano, mes - 1, dia));
  }
  
  // Adicionar dias do próximo mês para completar a última semana
  const diasRestantes = 7 - (dias.length % 7);
  if (diasRestantes < 7) {
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push(new Date(ano, mes, i));
    }
  }
  
  return dias;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function CalendarioLiquidacao({
  rotaId,
  liquidacoesMes,
  resumoParcelas,
  dataSelecionada,
  onSelecionarData,
  onMesChange,
  loading = false,
}: CalendarioLiquidacaoProps) {
  const [anoAtual, setAnoAtual] = useState(dataSelecionada.getFullYear());
  const [mesAtual, setMesAtual] = useState(dataSelecionada.getMonth() + 1);
  
  const hoje = useMemo(() => new Date(), []);
  const hojeStr = formatarData(hoje);

  // Gerar dias do calendário
  const diasCalendario = useMemo(() => {
    const dias = gerarDiasDoMes(anoAtual, mesAtual);
    
    // Criar mapa de liquidações por data
    const liquidacoesPorData = new Map<string, LiquidacaoDiaria>();
    liquidacoesMes.forEach(liq => {
      const dataStr = liq.data_abertura.split('T')[0];
      liquidacoesPorData.set(dataStr, liq);
    });
    
    return dias.map((data): DiaCalendario => {
      const dataStr = formatarData(data);
      const isMesAtual = data.getMonth() + 1 === mesAtual;
      
      return {
        data,
        diaDoMes: data.getDate(),
        isHoje: dataStr === hojeStr,
        isMesAtual,
        isPassado: data < hoje && dataStr !== hojeStr,
        isFuturo: data > hoje,
        liquidacao: liquidacoesPorData.get(dataStr),
        previsao: resumoParcelas.get(dataStr),
      };
    });
  }, [anoAtual, mesAtual, liquidacoesMes, resumoParcelas, hoje, hojeStr]);

  // Navegar entre meses
  const irParaMesAnterior = () => {
    let novoMes = mesAtual - 1;
    let novoAno = anoAtual;
    if (novoMes < 1) {
      novoMes = 12;
      novoAno--;
    }
    setMesAtual(novoMes);
    setAnoAtual(novoAno);
    onMesChange(novoAno, novoMes);
  };

  const irParaProximoMes = () => {
    let novoMes = mesAtual + 1;
    let novoAno = anoAtual;
    if (novoMes > 12) {
      novoMes = 1;
      novoAno++;
    }
    setMesAtual(novoMes);
    setAnoAtual(novoAno);
    onMesChange(novoAno, novoMes);
  };

  const irParaHoje = () => {
    const novoMes = hoje.getMonth() + 1;
    const novoAno = hoje.getFullYear();
    setMesAtual(novoMes);
    setAnoAtual(novoAno);
    onMesChange(novoAno, novoMes);
    onSelecionarData(hoje);
  };

  // Verificar se a data está selecionada
  const isDataSelecionada = (data: Date) => {
    return formatarData(data) === formatarData(dataSelecionada);
  };

  // Obter classe de cor do dia
  const getClasseDia = (dia: DiaCalendario) => {
    if (!dia.isMesAtual) {
      return 'text-gray-300 bg-gray-50';
    }
    
    if (dia.liquidacao) {
      switch (dia.liquidacao.status) {
        case 'ABERTO':
          return 'bg-green-100 text-green-800 hover:bg-green-200';
        case 'FECHADO':
          return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
        case 'APROVADO':
          return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
        case 'REABERTO':
          return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
        default:
          return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
      }
    }
    
    if (dia.previsao && dia.previsao.quantidade > 0) {
      if (dia.isPassado) {
        // Parcelas que deveriam ter sido cobradas
        return 'bg-red-50 text-red-700 hover:bg-red-100';
      }
      // Parcelas futuras
      return 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100';
    }
    
    if (dia.isHoje) {
      return 'bg-blue-600 text-white hover:bg-blue-700';
    }
    
    return 'text-gray-700 hover:bg-gray-100';
  };

  // Obter ícone do dia
  const getIconeDia = (dia: DiaCalendario) => {
    if (dia.liquidacao) {
      switch (dia.liquidacao.status) {
        case 'ABERTO':
          return <Clock className="w-2.5 h-2.5 text-green-600" />;
        case 'FECHADO':
          return <Lock className="w-2.5 h-2.5 text-blue-600" />;
        case 'APROVADO':
          return <CheckCircle className="w-2.5 h-2.5 text-purple-600" />;
        case 'REABERTO':
          return <Eye className="w-2.5 h-2.5 text-amber-600" />;
      }
    }
    
    if (dia.previsao && dia.previsao.quantidade > 0 && dia.isPassado) {
      return <AlertTriangle className="w-2.5 h-2.5 text-red-500" />;
    }
    
    return null;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header do Calendário */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Calendário</h3>
          </div>
          <button
            onClick={irParaHoje}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Navegação do Mês */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-gray-100">
        <button
          onClick={irParaMesAnterior}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="font-medium text-gray-900">
          {MESES[mesAtual - 1]} {anoAtual}
        </span>
        <button
          onClick={irParaProximoMes}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Grade do Calendário */}
      <div className="p-2">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 mb-1">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              className="text-center text-xs font-medium text-gray-500 py-1"
            >
              {dia}
            </div>
          ))}
        </div>

        {/* Dias do mês */}
        <div className="grid grid-cols-7 gap-1">
          {diasCalendario.map((dia, index) => (
            <button
              key={index}
              onClick={() => dia.isMesAtual && onSelecionarData(dia.data)}
              disabled={!dia.isMesAtual || loading}
              className={`
                relative aspect-square flex flex-col items-center justify-center
                rounded-lg text-sm font-medium transition-all
                ${getClasseDia(dia)}
                ${isDataSelecionada(dia.data) ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                ${!dia.isMesAtual ? 'cursor-default' : 'cursor-pointer'}
              `}
            >
              <span>{dia.diaDoMes}</span>
              
              {/* Indicadores */}
              <div className="absolute bottom-0.5 flex gap-0.5">
                {getIconeDia(dia)}
                {dia.previsao && dia.previsao.quantidade > 0 && !dia.liquidacao && (
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Legenda */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
            <span className="text-gray-600">Aberto</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
            <span className="text-gray-600">Fechado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-purple-100 border border-purple-300" />
            <span className="text-gray-600">Aprovado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-50 border border-yellow-300" />
            <span className="text-gray-600">Parcelas</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-50 border border-red-300" />
            <span className="text-gray-600">Vencido</span>
          </div>
        </div>
      </div>

      {/* Resumo do Dia Selecionado */}
      <ResumoDiaSelecionado
        dia={diasCalendario.find(d => isDataSelecionada(d.data))}
        loading={loading}
      />
    </div>
  );
}

// =====================================================
// COMPONENTE DE RESUMO DO DIA
// =====================================================

function ResumoDiaSelecionado({
  dia,
  loading,
}: {
  dia?: DiaCalendario;
  loading?: boolean;
}) {
  if (!dia || !dia.isMesAtual) return null;

  const dataFormatada = dia.data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="px-4 py-3 border-t border-gray-200">
      <p className="text-xs text-gray-500 capitalize mb-2">{dataFormatada}</p>
      
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dia.liquidacao ? (
        // Dia com liquidação
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status:</span>
            <span className={`text-sm font-medium ${
              dia.liquidacao.status === 'ABERTO' ? 'text-green-600' :
              dia.liquidacao.status === 'FECHADO' ? 'text-blue-600' :
              dia.liquidacao.status === 'APROVADO' ? 'text-purple-600' :
              'text-amber-600'
            }`}>
              {dia.liquidacao.status}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Recebido:</span>
            <span className="text-sm font-semibold text-green-600">
              {formatarMoeda(dia.liquidacao.valor_recebido_dia || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Esperado:</span>
            <span className="text-sm font-medium text-gray-900">
              {formatarMoeda(dia.liquidacao.valor_esperado_dia || 0)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Pagamentos:</span>
            <span className="text-sm text-gray-900">
              <span className="text-green-600">{dia.liquidacao.pagamentos_pagos}</span>
              {' / '}
              <span className="text-red-600">{dia.liquidacao.pagamentos_nao_pagos}</span>
            </span>
          </div>
        </div>
      ) : dia.previsao && dia.previsao.quantidade > 0 ? (
        // Dia com parcelas previstas
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Parcelas:</span>
            <span className="font-semibold text-gray-900">{dia.previsao.quantidade}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">A receber:</span>
            <span className="font-semibold text-green-600">
              {formatarMoeda(dia.previsao.valor)}
            </span>
          </div>
          {dia.isPassado && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="w-4 h-4" />
              <span>Parcelas não cobradas</span>
            </div>
          )}
        </div>
      ) : (
        // Dia sem dados
        <p className="text-sm text-gray-400 text-center py-2">
          {dia.isFuturo ? 'Sem parcelas previstas' : 'Sem liquidação'}
        </p>
      )}
    </div>
  );
}