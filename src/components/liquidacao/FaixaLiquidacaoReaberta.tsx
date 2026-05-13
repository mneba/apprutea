'use client';
import { AlertTriangle, Calendar, User, X } from 'lucide-react';
import { formatarDataExtenso, formatarDataHoraCurto } from '@/utils/dateFormat';

interface FaixaLiquidacaoReabertaProps {
  dataLiquidacao: string;
  dataReabertura?: string;
  reabertoPor?: string;
  onFechar?: () => void;
}

export function FaixaLiquidacaoReaberta({
  dataLiquidacao,
  dataReabertura,
  reabertoPor,
  onFechar,
}: FaixaLiquidacaoReabertaProps) {
  const dataFormatada = formatarDataExtenso(dataLiquidacao);
  const dataReaberturaFormatada = formatarDataHoraCurto(dataReabertura);

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 rounded-xl shadow-lg mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">LIQUIDAÇÃO REABERTA</span>
              <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                Modo Edição
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-white/90 mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {dataFormatada}
              </span>
              {reabertoPor && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  Reaberta por: {reabertoPor}
                </span>
              )}
              {dataReaberturaFormatada && (
                <span className="text-white/70">
                  em {dataReaberturaFormatada}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {onFechar && (
          <button
            onClick={onFechar}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Fechar liquidação reaberta"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <div className="mt-2 pt-2 border-t border-white/20 text-sm text-white/80">
        <p>
          ⚠️ Você está editando uma liquidação de data anterior. 
          Após realizar as correções necessárias, clique em "Fechar Dia" para finalizar.
        </p>
      </div>
    </div>
  );
}
export default FaixaLiquidacaoReaberta;