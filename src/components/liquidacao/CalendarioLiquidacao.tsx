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

export interface DiaCalendario {
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

function formatarMoeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

function gerarDiasDoMes(ano: number, mes: number): Date[] {
  const dias: Date[] = [];
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);

  const diaSemanaInicio = primeiroDia.getDay();
  for (let i = diaSemanaInicio - 1; i >= 0; i--) {
    const d = new Date(ano, mes - 1, -i);
    dias.push(d);
  }

  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    dias.push(new Date(ano, mes - 1, dia));
  }

  const diasRestantes = 7 - (dias.length % 7);
  if (diasRestantes < 7) {
    for (let i = 1; i <= diasRestantes; i++) {
      dias.push(new Date(ano, mes, i));
    }
  }

  return dias;
}

// =====================================================
// COMPONENTE PRINCIPAL — Calendário
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

  useEffect(() => {
    const novoAno = dataSelecionada.getFullYear();
    const novoMes = dataSelecionada.getMonth() + 1;
    if (novoAno !== anoAtual || novoMes !== mesAtual) {
      setAnoAtual(novoAno);
      setMesAtual(novoMes);
    }
  }, [dataSelecionada]);

  const diasCalendario = useMemo(() => {
    const dias = gerarDiasDoMes(anoAtual, mesAtual);

    const liquidacoesPorData = new Map<string, LiquidacaoDiaria>();
    liquidacoesMes.forEach((liq) => {
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
          return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
        case 'REABERTO':
          return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
        default:
          return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
      }
    }

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
      <div className="p-3">
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

        <div className="grid grid-cols-7 gap-1.5">
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

      {/* Legenda */}
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
    </div>
  );
}

// =====================================================
// RESUMO DO DIA — Balanço didático com somas explícitas
// =====================================================

interface ResumoDiaCalendarioProps {
  liquidacao?: LiquidacaoDiaria;
  data: Date;
  loading?: boolean;
}

export function ResumoDiaCalendario({ liquidacao, data, loading }: ResumoDiaCalendarioProps) {
  const dataFormatada = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!liquidacao) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-500 capitalize mb-4">{dataFormatada}</p>
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mb-3">
            <span className="text-2xl">–</span>
          </div>
          <p className="text-sm">Sem registro neste dia</p>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    ABERTO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aberto' },
    FECHADO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Fechado' },
    APROVADO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Aprovado' },
    REABERTO: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Reaberto' },
  };
  const status = statusConfig[liquidacao.status] || statusConfig.ABERTO;

  // ============================================================
  // CÁLCULOS DO BALANÇO
  // ============================================================

  // CAIXA
  const caixaInicial = Number(liquidacao.caixa_inicial || 0);
  const caixaFinal = Number(liquidacao.caixa_final || 0);
  const recebido = Number(liquidacao.valor_recebido_dia || 0);
  //const outrasReceitas = Number(liquidacao.total_receitas_dia || 0) - recebido;
  const outrasReceitas = Number((liquidacao as any).total_receitas_dia || 0) - recebido;
  // total_receitas_dia já inclui cobranças (valor_recebido_dia). Subtraio pra
  // separar "Recebido" (cobranças) de "Outras receitas".
  const outrasReceitasSafe = outrasReceitas > 0 ? outrasReceitas : 0;
  const despesas = Number(liquidacao.total_despesas_dia || 0);
  const emprestimos = Number(liquidacao.total_emprestado_dia || 0);

  // CARTEIRA
  const carteiraInicial = Number(liquidacao.carteira_inicial || 0);
  const carteiraFinal = Number(liquidacao.carteira_final || 0);
  const jurosDia = Number(liquidacao.total_juros_dia || 0);

  // MICROSEGURO
  const microInicial = Number((liquidacao as any).microseguro_inicial || 0);
  const microFinal = Number((liquidacao as any).microseguro_final || 0);
  const microseguroDia = Number(liquidacao.total_microseguro_dia || 0);
  const temMicroseguro = microInicial > 0 || microFinal > 0 || microseguroDia > 0;

  // PAGAMENTOS
  const pagos = liquidacao.pagamentos_pagos || 0;
  const naoPagos = liquidacao.pagamentos_nao_pagos || 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Resumo do Dia</p>
          <p className="text-sm font-medium text-gray-700 capitalize">{dataFormatada}</p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>

      {/* CAIXA */}
      <SecaoBalanco titulo="Caixa">
        <Linha label="Saldo inicial" valor={formatarMoeda(caixaInicial)} />
        {recebido > 0 && (
          <Linha label="(+) Recebido" valor={`+ ${formatarMoeda(recebido)}`} cor="text-green-600" />
        )}
        {outrasReceitasSafe > 0 && (
          <Linha label="(+) Outras receitas" valor={`+ ${formatarMoeda(outrasReceitasSafe)}`} cor="text-green-600" />
        )}
        {despesas > 0 && (
          <Linha label="(−) Despesas" valor={`− ${formatarMoeda(despesas)}`} cor="text-red-600" />
        )}
        {emprestimos > 0 && (
          <Linha label="(−) Empréstimos" valor={`− ${formatarMoeda(emprestimos)}`} cor="text-red-600" />
        )}
        <LinhaTotal label="Saldo final" valor={formatarMoeda(caixaFinal)} />
      </SecaoBalanco>

      {/* CARTEIRA — A RECEBER */}
      <SecaoBalanco titulo="Carteira (A Receber)">
        <Linha label="Saldo inicial" valor={formatarMoeda(carteiraInicial)} />
        {emprestimos > 0 && (
          <Linha label="(+) Vendas do dia" valor={`+ ${formatarMoeda(emprestimos)}`} cor="text-green-600" />
        )}
        {jurosDia > 0 && (
          <Linha label="(+) Juros das vendas" valor={`+ ${formatarMoeda(jurosDia)}`} cor="text-green-600" />
        )}
        {recebido > 0 && (
          <Linha label="(−) Recaudo do dia" valor={`− ${formatarMoeda(recebido)}`} cor="text-red-600" />
        )}
        <LinhaTotal label="Saldo final" valor={formatarMoeda(carteiraFinal)} />
      </SecaoBalanco>

      {/* MICROSEGURO (se houver) */}
      {temMicroseguro && (
        <SecaoBalanco titulo="Microseguro" cor="purple">
          <Linha label="Saldo inicial" valor={formatarMoeda(microInicial)} />
          {microseguroDia > 0 && (
            <Linha
              label="(+) Vendas do dia"
              valor={`+ ${formatarMoeda(microseguroDia)}`}
              cor="text-purple-600"
            />
          )}
          {microseguroDia === 0 && (
            <Linha label="(=) Sem movimentação" valor="—" cor="text-gray-400" />
          )}
          <LinhaTotal label="Saldo final" valor={formatarMoeda(microFinal)} cor="text-purple-700" />
        </SecaoBalanco>
      )}

      {/* PAGAMENTOS DO DIA */}
      <SecaoBalanco titulo="Pagamentos do Dia">
        <Linha
          label="✅ Pagos"
          valor={
            <span>
              <span className="text-green-600 font-bold">{pagos}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span className="text-green-600 font-semibold">{formatarMoeda(recebido)}</span>
            </span>
          }
        />
        <Linha
          label="❌ Não pagos"
          valor={
            <span>
              <span className="text-red-600 font-bold">{naoPagos}</span>
              <span className="text-gray-400 ml-1 text-xs">cliente(s)</span>
            </span>
          }
        />
      </SecaoBalanco>
    </div>
  );
}

// =====================================================
// COMPONENTES AUXILIARES DO RESUMO
// =====================================================

function SecaoBalanco({
  titulo,
  cor = 'gray',
  children,
}: {
  titulo: string;
  cor?: 'gray' | 'purple';
  children: React.ReactNode;
}) {
  const corClasse = cor === 'purple' ? 'text-purple-700' : 'text-gray-700';
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${corClasse}`}>
        {titulo}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Linha({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: React.ReactNode;
  cor?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm py-0.5">
      <span className={cor || 'text-gray-600'}>{label}</span>
      <span className={`font-medium tabular-nums ${cor || 'text-gray-900'}`}>{valor}</span>
    </div>
  );
}

function LinhaTotal({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: string;
  cor?: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm pt-2 mt-1 border-t border-gray-200">
      <span className={`font-bold ${cor || 'text-gray-900'}`}>{label}</span>
      <span className={`font-bold tabular-nums ${cor || 'text-gray-900'}`}>{valor}</span>
    </div>
  );
}