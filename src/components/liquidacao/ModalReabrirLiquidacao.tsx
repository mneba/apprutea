'use client';

import { useState } from 'react';
import { RotateCcw, Loader2, AlertTriangle, Calendar } from 'lucide-react';

interface ModalReabrirLiquidacaoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
  loading: boolean;
  dataLiquidacao: string;
}

export function ModalReabrirLiquidacao({
  isOpen,
  onClose,
  onConfirmar,
  loading,
  dataLiquidacao,
}: ModalReabrirLiquidacaoProps) {
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

  const dataFormatada = new Date(dataLiquidacao + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
            <RotateCcw className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Reabrir Liquidação</h2>
            <p className="text-sm text-gray-500">Permitir edições nesta liquidação</p>
          </div>
        </div>

        {/* Aviso */}
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

        {/* Info */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm text-gray-600">
          <ul className="space-y-1">
            <li>• A liquidação ficará disponível para edições</li>
            <li>• Apenas você (admin) poderá fazer alterações no web</li>
            <li>• O vendedor continuará trabalhando normalmente no app</li>
            <li>• Após as correções, feche a liquidação novamente</li>
          </ul>
        </div>

        {/* Campo de Motivo */}
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

        {/* Botões */}
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

export default ModalReabrirLiquidacao;