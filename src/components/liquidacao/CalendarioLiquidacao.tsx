'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Lock,
  RotateCcw,
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
  liquidacao?: LiquidacaoDiaria;
}

interface CalendarioLiquidacaoProps {
  rotaId: string;
  liquidacoesMes: LiquidacaoDiaria[];
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

function formatarDataYmd(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
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

  // Dias do mês anterior para completar a primeira semana
  const diaSemanaInicio = primeiroDia.getDay();
  for (let i = diaSemanaInicio - 1; i >= 0; i--) {
    const d = new Date(ano, mes - 1, -i);
    dias.push(d);
  }

  // Dias do mês atual
  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    dias.push(new Date(ano, mes - 1, dia));
  }

  // Dias do próximo mês para completar a última semana
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
  dataSelecionada,
  onSelecionarData,
  onMesChange,
  loading = false,
}: CalendarioLiquidacaoProps) {
  const [anoAtual, setAnoAtual] = useState(dataSelecionada.getFullYear());
  const [mesAtual, setMesAtual] = useState(dataSelecionada.getMonth() + 1);

  const hoje = useMemo(() => new Date(), []);
  const hojeStr = formatarDataYmd(hoje);

  // Atualiza a tela do calendário quando a data selecionada externa muda de mês
  useEffect(() => {
    const novoAno = dataSelecionada.getFullYear();
    const novoMes = dataSelecionada.getMonth() + 1;
    if (novoAno !== anoAtual || novoMes !== mesAtual) {
      setAnoAtual(novoAno);
      setMesAtual(novoMes);
    }
  }, [dataSelecionada]);

  // Gerar dias do calendário
  const diasCalendario = useMemo(() => {
    const dias = gerarDiasDoMes(anoAtual, mesAtual);

    // Mapear liquidações por data_liquidacao (que é DATE no banco)
    const liquidacoesPorData = new Map<string, LiquidacaoDiaria>();
    liquidacoesMes.forEach((liq) => {
      // Tenta primeiro data_liquidacao (DATE), depois data_abertura (timestamp)
      const dataStr =
        (liq as any).data_liquidacao?.split('T')[0] ||
        liq.data_abertura?.split('T')[0];
      if (dataStr) {
        liquidacoesPorData.set(dataStr, liq);
      }
    });

    return dias.map((data): DiaCalendario => {
      const dataStr = formatarDataYmd(data);
      const isMesAtual = data.getMonth() + 1 === mesAtual;

      return {
        data,
        diaDoMes: data.getDate(),
        isHoje: dataStr === hojeStr,
        isMesAtual,
        liquidacao: liquidacoesPorData.get(dataStr),
      };
    });
  }, [anoAtual, mesAtual, liquidacoesMes, hojeStr]);

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

  const isDataSelecionada = (data: Date) => {
    return formatarDataYmd(data) === formatarDataYmd(dataSelecionada);
  };

  // Classes de cor por status (apenas 4 estados + neutro)
  const getClasseDia = (dia: DiaCalendario) => {
    if (!dia.isMesAtual) {
      return 'text-gray-300';
    }

    if (dia.liquidacao) {
      switch (dia.liquidacao.status) {
        case 'ABERTO':
          return 'bg-green-100 text-green-800 hover:bg-green-200';
        case 'FECHADO':
        case 'APROVADO':
          // APROVADO é tratado visualmente como FECHADO (mesma legenda)
          return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
        case 'REABERTO':
          return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
        default:
          return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
      }
    }

    // Sem registro
    if (dia.isHoje) {
      return 'bg-blue-600 text-white hover:bg-blue-700';
    }
    return 'text-gray-700 hover:bg-gray-100';
  };

  const getIconeDia = (dia: DiaCalendario) => {
    if (!dia.liquidacao) return null;
    switch (dia.liquidacao.status) {
      case 'ABERTO':
        return <Clock className="w-2.5 h-2.5 text-green-600" />;
      case 'FECHADO':
      case 'APROVADO':
        return <Lock className="w-2.5 h-2.5 text-blue-600" />;
      case 'REABERTO':
        return <RotateCcw className="w-2.5 h-2.5 text-amber-600" />;
      default:
        return null;
    }
  };

  const diaSelecionado = diasCalendario.find((d) => isDataSelecionada(d.data));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
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

      {/* Navegação do mês */}
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

      {/* Grade */}
      <div className="p-2">
        {/* Cabeçalho dias da semana */}
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

        {/* Dias */}
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
              <div className="absolute bottom-0.5">{getIconeDia(dia)}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Legenda — apenas 4 estados */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-500 mb-2">Legenda:</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-green-500" />
            <span className="text-gray-600">Aberto</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-blue-500" />
            <span className="text-gray-600">Fechado</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-amber-500" />
            <span className="text-gray-600">Reaberto</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border-2 border-gray-300" />
            <span className="text-gray-600">Sem registro</span>
          </div>
        </div>
      </div>

      {/* Resumo do dia selecionado */}
      <ResumoDiaSelecionado dia={diaSelecionado} loading={loading} />
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

  const liq = dia.liquidacao;

  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-white">
      <p className="text-xs text-gray-500 capitalize mb-3">{dataFormatada}</p>

      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : liq ? (
        <div className="space-y-2">
          <Linha
            label="Status"
            valor={liq.status}
            corValor={
              liq.status === 'ABERTO'
                ? 'text-green-600'
                : liq.status === 'REABERTO'
                ? 'text-amber-600'
                : 'text-blue-600'
            }
          />
          <Linha
            label="Recebido"
            valor={formatarMoeda(liq.valor_recebido_dia || 0)}
            corValor="text-green-600"
            bold
          />
          <Linha
            label="Esperado"
            valor={formatarMoeda(liq.valor_esperado_dia || 0)}
          />
          <Linha
            label="Pagamentos"
            valor={
              <span>
                <span className="text-green-600">{liq.pagamentos_pagos || 0}</span>
                {' / '}
                <span className="text-red-600">{liq.pagamentos_nao_pagos || 0}</span>
              </span>
            }
          />
          {((liq as any).total_microseguro_dia || 0) > 0 && (
            <Linha
              label="Microseguro"
              valor={formatarMoeda((liq as any).total_microseguro_dia || 0)}
              corValor="text-purple-600"
            />
          )}
        </div>
      ) : (
        <div className="text-center py-3 text-sm text-gray-400">Sem registro</div>
      )}
    </div>
  );
}

function Linha({
  label,
  valor,
  corValor,
  bold,
}: {
  label: string;
  valor: React.ReactNode;
  corValor?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}:</span>
      <span
        className={`text-sm ${bold ? 'font-semibold' : 'font-medium'} ${
          corValor || 'text-gray-900'
        }`}
      >
        {valor}
      </span>
    </div>
  );
}