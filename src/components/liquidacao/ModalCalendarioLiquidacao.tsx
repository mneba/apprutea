'use client';

import { X, Check } from 'lucide-react';
import { CalendarioLiquidacao } from './CalendarioLiquidacao';
import type { LiquidacaoDiaria } from '@/types/liquidacao';

interface ModalCalendarioLiquidacaoProps {
  isOpen: boolean;
  onClose: () => void;
  rotaId: string;
  liquidacoesMes: LiquidacaoDiaria[];
  dataSelecionada: Date;
  onSelecionarData: (data: Date) => void;
  onMesChange: (ano: number, mes: number) => void;
  onConfirmar: (data: Date) => void;
  loading?: boolean;
}

export function ModalCalendarioLiquidacao({
  isOpen,
  onClose,
  rotaId,
  liquidacoesMes,
  dataSelecionada,
  onSelecionarData,
  onMesChange,
  onConfirmar,
  loading = false,
}: ModalCalendarioLiquidacaoProps) {
  if (!isOpen) return null;

  const handleConfirmar = () => {
    onConfirmar(dataSelecionada);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header do modal */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">Selecionar Data</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto p-3">
          <CalendarioLiquidacao
            rotaId={rotaId}
            liquidacoesMes={liquidacoesMes}
            dataSelecionada={dataSelecionada}
            onSelecionarData={onSelecionarData}
            onMesChange={onMesChange}
            loading={loading}
          />
        </div>

        {/* Rodapé com ações */}
        <div className="flex items-center gap-2 p-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Selecionar
          </button>
        </div>
      </div>
    </div>
  );
}