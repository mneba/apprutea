'use client';
import { AlertTriangle, Calendar, User, X } from 'lucide-react';
import { formatarDataExtenso, formatarDataHoraCurto } from '@/utils/dateFormat';

interface FaixaLiquidacaoReabertaProps {
  dataLiquidacao: string;
  dataReabertura?: string;
  reabertoPor?: string;
  rotaNome?: string;
  onFechar?: () => void;
}

export function FaixaLiquidacaoReaberta({
  dataLiquidacao,
  dataReabertura,
  reabertoPor,
  rotaNome,
  onFechar,
}: FaixaLiquidacaoReabertaProps) {
  const dataFormatada = formatarDataExtenso(dataLiquidacao);
  const dataReaberturaFormatada = formatarDataHoraCurto(dataReabertura);
  // Dia da liquidação em formato curto, para repetir no aviso de rodapé
  const [ano, mes, dia] = dataLiquidacao.split('T')[0].split('-');
  const dataCurta = dia && mes ? `${dia}/${mes}/${ano}` : dataFormatada;

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

            {/* Qual liquidação está aberta — dado principal, em destaque */}
            <div className="flex items-center gap-1.5 mt-1">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="text-base font-semibold">
                {rotaNome ? `${rotaNome} — ` : ''}{dataFormatada}
              </span>
            </div>

            {/* Quem reabriu e quando — contexto secundário, sempre rotulado */}
            {(reabertoPor || dataReaberturaFormatada) && (
              <div className="flex items-center gap-1.5 text-xs text-white/80 mt-1">
                <User className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Reaberta{reabertoPor ? ` por ${reabertoPor}` : ''}
                  {dataReaberturaFormatada ? ` em ${dataReaberturaFormatada}` : ''}
                </span>
              </div>
            )}
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
          ⚠️ Tudo que você lançar aqui entra na liquidação de <strong>{dataCurta}</strong>
          {rotaNome ? <> da rota <strong>{rotaNome}</strong></> : null}, não na de hoje.
          Ao terminar as correções, clique em &quot;Fechar Dia&quot; para finalizar.
        </p>
      </div>
    </div>
  );
}
export default FaixaLiquidacaoReaberta;