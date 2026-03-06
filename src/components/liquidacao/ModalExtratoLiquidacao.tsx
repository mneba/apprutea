'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Share2,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Banknote,
  CreditCard,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { LiquidacaoDiaria } from '@/types/liquidacao';

// =====================================================
// TIPOS
// =====================================================

interface MovimentacaoExtrato {
  id: string;
  tipo: 'RECEBER' | 'PAGAR';
  categoria: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  created_at: string;
  forma_pagamento: string;
  cliente_nome: string | null;
  status: string;
}

interface ExtratoData {
  movimentacoes: MovimentacaoExtrato[];
  totalEntradas: number;
  totalSaidas: number;
}

// =====================================================
// HELPERS
// =====================================================

function formatarMoeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

function formatarHora(data: string | null | undefined): string {
  if (!data) return '';
  return new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarDataCompleta(data: string | null | undefined): string {
  if (!data) return '';
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + '  ' + new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarCategoria(categoria: string): string {
  const mapa: Record<string, string> = {
    'COBRANCA_CUOTAS': 'Cobrança de Parcela',
    'COBRANCA_PARCELAS': 'Cobrança de Parcela',
    'EMPRESTIMO': 'Empréstimo',
    'VENDA_MICROSEGURO': 'Venda Microseguro',
    'MICROSEGURO': 'Microseguro',
    'PRESTAMO': 'Empréstimo',
    'APORTE': 'Aporte de Capital',
    'AJUSTE_CAJA': 'Ajuste de Caixa',
    'GASOLINA': 'Gasolina',
    'MANUTENCAO': 'Manutenção',
    'ALIMENTACAO': 'Alimentação',
    'TRANSPORTE': 'Transporte',
    'ESTORNO_PAGAMENTO': 'Estorno de Pagamento',
    'MULTA': 'Multa',
    'OUTROS': 'Outros',
    'RETIRADA': 'Retirada',
    'DESPESA': 'Despesa',
  };
  return mapa[categoria] || categoria;
}

function formatarFormaPagamento(forma: string | null): string {
  if (!forma) return '';
  const mapa: Record<string, string> = {
    'DINHEIRO': 'Dinheiro',
    'TRANSFERENCIA': 'Transferência',
    'PIX': 'PIX',
    'CARTAO': 'Cartão',
  };
  return mapa[forma] || forma;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

interface ModalExtratoLiquidacaoProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacao: LiquidacaoDiaria | null;
  rotaNome: string;
}

export function ModalExtratoLiquidacao({
  isOpen,
  onClose,
  liquidacao,
  rotaNome,
}: ModalExtratoLiquidacaoProps) {
  const [loading, setLoading] = useState(false);
  const [extrato, setExtrato] = useState<ExtratoData | null>(null);
  const [gerando, setGerando] = useState(false);
  const extratoRef = useRef<HTMLDivElement>(null);

  // Carregar movimentações quando abrir
  useEffect(() => {
    if (isOpen && liquidacao) {
      carregarMovimentacoes();
    }
  }, [isOpen, liquidacao]);

  const carregarMovimentacoes = async () => {
    if (!liquidacao) return;

    setLoading(true);
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('financeiro')
        .select(`
          id,
          tipo,
          categoria,
          descricao,
          valor,
          data_lancamento,
          created_at,
          forma_pagamento,
          cliente_nome,
          status
        `)
        .eq('liquidacao_id', liquidacao.id)
        .eq('status', 'PAGO')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao carregar movimentações:', error);
        return;
      }

      const movimentacoes = (data || []) as MovimentacaoExtrato[];
      
      const totalEntradas = movimentacoes
        .filter(m => m.tipo === 'RECEBER')
        .reduce((acc, m) => acc + Number(m.valor), 0);
      
      const totalSaidas = movimentacoes
        .filter(m => m.tipo === 'PAGAR')
        .reduce((acc, m) => acc + Number(m.valor), 0);

      setExtrato({
        movimentacoes,
        totalEntradas,
        totalSaidas,
      });
    } catch (error) {
      console.error('Erro ao carregar extrato:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompartilharPDF = async () => {
    if (!liquidacao || !extrato) return;

    setGerando(true);
    try {
      // Gerar HTML do extrato
      const html = gerarHTMLExtrato(liquidacao, extrato, rotaNome);
      
      // Abrir nova janela para impressão/PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar PDF');
    } finally {
      setGerando(false);
    }
  };

  if (!isOpen) return null;

  const entradas = extrato?.movimentacoes.filter(m => m.tipo === 'RECEBER') || [];
  const saidas = extrato?.movimentacoes.filter(m => m.tipo === 'PAGAR') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-[#E8E4DF] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Extrato do Dia</h2>
              <p className="text-sm text-gray-500">{rotaNome}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo do Extrato - Estilo Cupom */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : liquidacao && extrato ? (
            <div
              ref={extratoRef}
              className="bg-[#FFFEF7] rounded-lg p-4 font-mono text-sm shadow-inner"
            >
              {/* Cabeçalho */}
              <div className="text-center mb-4">
                <p className="font-bold text-gray-900">{rotaNome}</p>
                <p className="text-gray-500 text-xs">EXTRATO LIQUIDAÇÃO DIÁRIA</p>
                <div className="border-t-2 border-double border-gray-400 my-2" />
                <p className="text-gray-600 text-xs">
                  {formatarDataCompleta(liquidacao.data_fechamento || liquidacao.data_abertura)}
                </p>
                <div className="border-t-2 border-double border-gray-400 my-2" />
              </div>

              {/* Resumo Principal */}
              <div className="space-y-1 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-700">CAIXA INICIAL</span>
                  <span className="font-medium">{formatarMoeda(liquidacao.caixa_inicial)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>(+) COBRANÇAS</span>
                  <span className="font-medium">{formatarMoeda(extrato.totalEntradas)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>(-) SAÍDAS</span>
                  <span className="font-medium">{formatarMoeda(extrato.totalSaidas)}</span>
                </div>
                <div className="border-t-2 border-double border-gray-400 my-2" />
                <div className="flex justify-between font-bold text-lg">
                  <span>CAIXA FINAL</span>
                  <span>{formatarMoeda(liquidacao.caixa_final)}</span>
                </div>
                <div className="border-t-2 border-double border-gray-400 my-2" />
              </div>

              {/* Detalhes Entradas */}
              {entradas.length > 0 && (
                <div className="mb-4">
                  <p className="text-center font-bold text-gray-900 mb-2">
                    DETALHES ENTRADAS ({entradas.length})
                  </p>
                  <div className="border-t border-dashed border-gray-300 mb-2" />
                  
                  <div className="space-y-3">
                    {entradas.map((mov, index) => (
                      <div key={mov.id}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <span className="text-gray-500 mr-2">{String(index + 1).padStart(2, '0')}</span>
                            <span className="font-medium">{formatarCategoria(mov.categoria)}</span>
                          </div>
                          <span className="text-green-600 font-medium">
                            +{formatarMoeda(mov.valor)}
                          </span>
                        </div>
                        {mov.cliente_nome && (
                          <p className="text-gray-500 text-xs ml-6 lowercase">{mov.cliente_nome}</p>
                        )}
                        <div className="flex justify-between ml-6 text-xs text-gray-400">
                          <span>{formatarHora(mov.created_at)}</span>
                          {mov.forma_pagamento && (
                            <span>{formatarFormaPagamento(mov.forma_pagamento)}</span>
                          )}
                        </div>
                        {index < entradas.length - 1 && (
                          <div className="border-t border-dotted border-gray-200 mt-2" />
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-dashed border-gray-300 mt-2 pt-2" />
                  <div className="flex justify-between font-bold text-green-600">
                    <span>TOTAL COBRANÇAS</span>
                    <span>{formatarMoeda(extrato.totalEntradas)}</span>
                  </div>
                </div>
              )}

              {/* Detalhes Saídas */}
              {saidas.length > 0 && (
                <div className="mb-4">
                  <p className="text-center font-bold text-gray-900 mb-2">
                    DETALHES SAÍDAS ({saidas.length})
                  </p>
                  <div className="border-t border-dashed border-gray-300 mb-2" />
                  
                  <div className="space-y-3">
                    {saidas.map((mov, index) => (
                      <div key={mov.id}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <span className="text-gray-500 mr-2">{String(index + 1).padStart(2, '0')}</span>
                            <span className="font-medium">{formatarCategoria(mov.categoria)}</span>
                          </div>
                          <span className="text-red-600 font-medium">
                            -{formatarMoeda(mov.valor)}
                          </span>
                        </div>
                        {mov.cliente_nome && (
                          <p className="text-gray-500 text-xs ml-6 lowercase">{mov.cliente_nome}</p>
                        )}
                        <div className="flex justify-between ml-6 text-xs text-gray-400">
                          <span>{formatarHora(mov.created_at)}</span>
                          {mov.forma_pagamento && (
                            <span>{formatarFormaPagamento(mov.forma_pagamento)}</span>
                          )}
                        </div>
                        {index < saidas.length - 1 && (
                          <div className="border-t border-dotted border-gray-200 mt-2" />
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-dashed border-gray-300 mt-2 pt-2" />
                  <div className="flex justify-between font-bold text-red-600">
                    <span>TOTAL SAÍDAS</span>
                    <span>{formatarMoeda(extrato.totalSaidas)}</span>
                  </div>
                </div>
              )}

              {/* Sem movimentações */}
              {entradas.length === 0 && saidas.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                  Nenhuma movimentação registrada
                </div>
              )}

              {/* Rodapé */}
              <div className="border-t-2 border-double border-gray-400 my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>SALDO FINAL</span>
                <span>{formatarMoeda(liquidacao.caixa_final)}</span>
              </div>
              <div className="border-t-2 border-double border-gray-400 my-2" />
              <p className="text-center text-gray-400 text-xs mt-4">
                *** FIM DO EXTRATO ***
              </p>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              Nenhuma liquidação selecionada
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-300 bg-[#E8E4DF]">
          <button
            onClick={handleCompartilharPDF}
            disabled={loading || gerando || !extrato}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gerando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Gerando PDF...
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                Compartilhar PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// GERADOR DE HTML PARA PDF
// =====================================================

function gerarHTMLExtrato(
  liquidacao: LiquidacaoDiaria,
  extrato: ExtratoData,
  rotaNome: string
): string {
  const entradas = extrato.movimentacoes.filter(m => m.tipo === 'RECEBER');
  const saidas = extrato.movimentacoes.filter(m => m.tipo === 'PAGAR');

  const linhasEntradas = entradas.map((mov, index) => `
    <tr>
      <td style="color: #6B7280; padding-right: 8px;">${String(index + 1).padStart(2, '0')}</td>
      <td>${formatarCategoria(mov.categoria)}</td>
      <td style="text-align: right; color: #059669; font-weight: 600;">+${formatarMoeda(mov.valor)}</td>
    </tr>
    ${mov.cliente_nome ? `<tr><td></td><td colspan="2" style="color: #9CA3AF; font-size: 10px; text-transform: lowercase;">${mov.cliente_nome}</td></tr>` : ''}
    <tr><td></td><td style="color: #D1D5DB; font-size: 10px;">${formatarHora(mov.created_at)}</td><td style="text-align: right; color: #D1D5DB; font-size: 10px;">${formatarFormaPagamento(mov.forma_pagamento)}</td></tr>
  `).join('<tr><td colspan="3" style="border-bottom: 1px dotted #E5E7EB; padding: 4px 0;"></td></tr>');

  const linhasSaidas = saidas.map((mov, index) => `
    <tr>
      <td style="color: #6B7280; padding-right: 8px;">${String(index + 1).padStart(2, '0')}</td>
      <td>${formatarCategoria(mov.categoria)}</td>
      <td style="text-align: right; color: #DC2626; font-weight: 600;">-${formatarMoeda(mov.valor)}</td>
    </tr>
    ${mov.cliente_nome ? `<tr><td></td><td colspan="2" style="color: #9CA3AF; font-size: 10px; text-transform: lowercase;">${mov.cliente_nome}</td></tr>` : ''}
    <tr><td></td><td style="color: #D1D5DB; font-size: 10px;">${formatarHora(mov.created_at)}</td><td style="text-align: right; color: #D1D5DB; font-size: 10px;">${formatarFormaPagamento(mov.forma_pagamento)}</td></tr>
  `).join('<tr><td colspan="3" style="border-bottom: 1px dotted #E5E7EB; padding: 4px 0;"></td></tr>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Extrato - ${rotaNome}</title>
  <style>
    @page { size: 80mm auto; margin: 5mm; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #1F2937;
      background: #FFFEF7;
      margin: 0;
      padding: 10px;
      max-width: 72mm;
      margin: 0 auto;
    }
    .header { text-align: center; margin-bottom: 12px; }
    .header h1 { font-size: 14px; margin: 0 0 4px 0; }
    .header p { font-size: 10px; color: #9CA3AF; margin: 0; }
    .sep-double { border-top: 2px double #9CA3AF; margin: 8px 0; }
    .sep-dashed { border-top: 1px dashed #D1D5DB; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; }
    .row.green { color: #059669; }
    .row.red { color: #DC2626; }
    .row.bold { font-weight: bold; font-size: 14px; }
    .section-title { text-align: center; font-weight: bold; margin: 16px 0 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; vertical-align: top; }
    .total { font-weight: bold; }
    .footer { text-align: center; color: #9CA3AF; font-size: 10px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${rotaNome}</h1>
    <p>EXTRATO LIQUIDAÇÃO DIÁRIA</p>
  </div>
  <div class="sep-double"></div>
  <p style="text-align: center; color: #6B7280; font-size: 10px;">
    ${formatarDataCompleta(liquidacao.data_fechamento || liquidacao.data_abertura)}
  </p>
  <div class="sep-double"></div>

  <div class="row">
    <span>CAIXA INICIAL</span>
    <span>${formatarMoeda(liquidacao.caixa_inicial)}</span>
  </div>
  <div class="row green">
    <span>(+) COBRANÇAS</span>
    <span>${formatarMoeda(extrato.totalEntradas)}</span>
  </div>
  <div class="row red">
    <span>(-) SAÍDAS</span>
    <span>${formatarMoeda(extrato.totalSaidas)}</span>
  </div>
  <div class="sep-double"></div>
  <div class="row bold">
    <span>CAIXA FINAL</span>
    <span>${formatarMoeda(liquidacao.caixa_final)}</span>
  </div>
  <div class="sep-double"></div>

  ${entradas.length > 0 ? `
    <p class="section-title">DETALHES ENTRADAS (${entradas.length})</p>
    <div class="sep-dashed"></div>
    <table>${linhasEntradas}</table>
    <div class="sep-dashed"></div>
    <div class="row green total">
      <span>TOTAL COBRANÇAS</span>
      <span>${formatarMoeda(extrato.totalEntradas)}</span>
    </div>
  ` : ''}

  ${saidas.length > 0 ? `
    <p class="section-title">DETALHES SAÍDAS (${saidas.length})</p>
    <div class="sep-dashed"></div>
    <table>${linhasSaidas}</table>
    <div class="sep-dashed"></div>
    <div class="row red total">
      <span>TOTAL SAÍDAS</span>
      <span>${formatarMoeda(extrato.totalSaidas)}</span>
    </div>
  ` : ''}

  <div class="sep-double"></div>
  <div class="row bold" style="font-size: 16px;">
    <span>SALDO FINAL</span>
    <span>${formatarMoeda(liquidacao.caixa_final)}</span>
  </div>
  <div class="sep-double"></div>

  <p class="footer">*** FIM DO EXTRATO ***</p>
</body>
</html>
  `;
}

export default ModalExtratoLiquidacao;