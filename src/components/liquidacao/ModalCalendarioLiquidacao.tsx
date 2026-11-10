'use client';

import { useMemo } from 'react';
import { X, Check, MapPin } from 'lucide-react';
import { CalendarioLiquidacao, ResumoDiaCalendario } from './CalendarioLiquidacao';
import type { LiquidacaoDiaria } from '@/types/liquidacao';

interface ModalCalendarioLiquidacaoProps {
  isOpen: boolean;
  onClose: () => void;
  rotaId: string;
  /** Nome da rota, so para o cabecalho manter o contexto da consulta. */
  rotaNome?: string;
  liquidacoesMes: LiquidacaoDiaria[];
  dataSelecionada: Date;
  onSelecionarData: (data: Date) => void;
  onMesChange: (ano: number, mes: number) => void;
  onConfirmar: (data: Date) => void;
  loading?: boolean;
}

function formatarDataYmd(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function ModalCalendarioLiquidacao({
  isOpen,
  onClose,
  rotaId,
  rotaNome,
  liquidacoesMes,
  dataSelecionada,
  onSelecionarData,
  onMesChange,
  onConfirmar,
  loading = false,
}: ModalCalendarioLiquidacaoProps) {
  // Achar a liquidação do dia selecionado (se houver)
  const liquidacaoDoDia = useMemo(() => {
    const dataStr = formatarDataYmd(dataSelecionada);
    return liquidacoesMes.find((liq) => {
      const liqDataStr =
        (liq as any).data_liquidacao?.split('T')[0] ||
        liq.data_abertura?.split('T')[0];
      return liqDataStr === dataStr;
    });
  }, [dataSelecionada, liquidacoesMes]);

  if (!isOpen) return null;

  const handleConfirmar = () => {
    onConfirmar(dataSelecionada);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-200">
          {/* A rota fica no CABECALHO, nao no Resumo do Dia: o corpo deste
              modal rola, e numa janela estreita o resumo desce para baixo do
              calendario. O cabecalho nao sai da vista enquanto se navega
              entre datas, que era exatamente o pedido do Julio em
              08/11/2026 -- ele sai para conferir outra coisa e volta sem
              saber de qual rota e o dia que esta vendo.
              `min-w-0` + `truncate`: ha nome de rota com 48 caracteres
              ("5.1 Sebastian - Jorge, Felipe, Huber Y Julio (25%)"), e sem
              isso ele empurraria o X para fora. */}
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 flex-shrink-0">Selecionar Data</h2>
            {rotaNome && (
              <span
                title={rotaNome}
                className="inline-flex items-center gap-1.5 min-w-0 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs font-medium text-blue-700"
              >
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{rotaNome}</span>
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo - calendário esquerda + resumo direita */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Esquerda: calendário */}
            <div>
              <CalendarioLiquidacao
                rotaId={rotaId}
                liquidacoesMes={liquidacoesMes}
                dataSelecionada={dataSelecionada}
                onSelecionarData={onSelecionarData}
                onMesChange={onMesChange}
                loading={loading}
              />
            </div>

            {/* Direita: resumo do dia selecionado */}
            <div>
              <ResumoDiaCalendario
                liquidacao={liquidacaoDoDia}
                data={dataSelecionada}
                loading={loading}
              />
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Selecionar este dia
          </button>
        </div>
      </div>
    </div>
  );
}