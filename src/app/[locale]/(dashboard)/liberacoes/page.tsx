'use client';

import { useState, useEffect } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Filter,
  Search,
  ChevronDown,
  Loader2,
  Calendar,
  User,
  MapPin,
  DollarSign,
  RefreshCw,
  PlusCircle
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { createClient } from '@/lib/supabase/client';
import { solicitacoesService, TIPO_SOLICITACAO_LABELS, STATUS_SOLICITACAO_COLORS, type Solicitacao } from '@/services/solicitacoes';

// Labels e ícones por tipo de solicitação
const TIPO_CONFIG: Record<string, { titulo: string; subtitulo: string; icone: string; cor: string }> = {
  'ABERTURA_RETROATIVA': { 
    titulo: 'Abertura de Liquidação', 
    subtitulo: 'Abertura Retroativa',
    icone: '📅',
    cor: 'amber'
  },
  'ABERTURA_DIAS_FALTANTES': { 
    titulo: 'Abertura de Liquidação', 
    subtitulo: 'Dias Faltantes',
    icone: '📅',
    cor: 'amber'
  },
  'ESTORNO_PAGAMENTO': { 
    titulo: 'Exclusão de Parcela', 
    subtitulo: 'Estorno de Pagamento',
    icone: '🗑️',
    cor: 'red'
  },
  'VENDA_EXCEDE_LIMITE': { 
    titulo: 'Limite Excedido', 
    subtitulo: 'Venda',
    icone: '💰',
    cor: 'blue'
  },
  'RENOVACAO_EXCEDE_LIMITE': { 
    titulo: 'Limite Excedido', 
    subtitulo: 'Renovação',
    icone: '🔄',
    cor: 'blue'
  },
  'DESPESA_EXCEDE_LIMITE': { 
    titulo: 'Limite Excedido', 
    subtitulo: 'Despesa',
    icone: '📤',
    cor: 'red'
  },
  'RECEITA_EXCEDE_LIMITE': { 
    titulo: 'Limite Excedido', 
    subtitulo: 'Receita',
    icone: '📥',
    cor: 'green'
  },
  'CANCELAR_EMPRESTIMO': { 
    titulo: 'Cancelar Empréstimo', 
    subtitulo: 'Cancelamento',
    icone: '❌',
    cor: 'red'
  },
  'REABRIR_LIQUIDACAO': { 
    titulo: 'Reabrir Liquidação', 
    subtitulo: 'Reabertura',
    icone: '🔓',
    cor: 'amber'
  },
  'QUITAR_COM_DESCONTO': { 
    titulo: 'Quitação com Desconto', 
    subtitulo: 'Desconto',
    icone: '💵',
    cor: 'green'
  },
  'CLIENTE_OUTRA_ROTA': { 
    titulo: 'Cliente de Outra Rota', 
    subtitulo: 'Rota Diferente',
    icone: '🔀',
    cor: 'purple'
  },
  'RENEGOCIACAO': { 
    titulo: 'Renegociação', 
    subtitulo: 'Autorização de Renegociação',
    icone: '🔄',
    cor: 'blue'
  },
  'EMPRESTIMO_ADICIONAL': { 
    titulo: 'Empréstimo Adicional', 
    subtitulo: 'Autorização de Empréstimo Adicional',
    icone: '➕',
    cor: 'green'
  },
};

// Modal de Detalhes/Ação
function ModalDetalhesSolicitacao({
  solicitacao,
  onClose,
  onAprovar,
  onRejeitar,
  loading,
}: {
  solicitacao: Solicitacao;
  onClose: () => void;
  onAprovar: (motivo?: string) => void;
  onRejeitar: (motivo: string) => void;
  loading: boolean;
}) {
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [motivoAprovacao, setMotivoAprovacao] = useState('');
  const [mostrarMotivoRejeicao, setMostrarMotivoRejeicao] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [detalhesEmprestimo, setDetalhesEmprestimo] = useState<any>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  const statusColors = STATUS_SOLICITACAO_COLORS[solicitacao.status] || STATUS_SOLICITACAO_COLORS['PENDENTE'];
  const tipoConfig = TIPO_CONFIG[solicitacao.tipo_solicitacao] || { 
    titulo: solicitacao.tipo_solicitacao, 
    subtitulo: '', 
    icone: '📋',
    cor: 'gray'
  };

  const formatarDataHora = (data: string | null) => {
    if (!data) return '-';
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarDataSimples = (data: string | null) => {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const formatarMoeda = (valor: number | null) => {
    if (valor === null || valor === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  // Verificar tipo de solicitação
  const isAbertura = ['ABERTURA_RETROATIVA', 'ABERTURA_DIAS_FALTANTES'].includes(solicitacao.tipo_solicitacao);
  const isExclusaoParcela = solicitacao.tipo_solicitacao === 'ESTORNO_PAGAMENTO';
  const isRenegociacao = solicitacao.tipo_solicitacao === 'RENEGOCIACAO';
  const isEmprestimoAdicional = solicitacao.tipo_solicitacao === 'EMPRESTIMO_ADICIONAL';
  const isAutorizacaoCliente = isRenegociacao || isEmprestimoAdicional;

  // Carregar detalhes do empréstimo para renegociação
  useEffect(() => {
    const carregarDetalhesEmprestimo = async () => {
      if (!isRenegociacao || !solicitacao.emprestimo_id) return;
      
      setLoadingDetalhes(true);
      try {
        const supabase = createClient();
        
        // Usar RPC para evitar problemas de RLS
        const { data, error } = await supabase.rpc('fn_buscar_detalhes_emprestimo_solicitacao', {
          p_emprestimo_id: solicitacao.emprestimo_id
        });

        if (error) {
          console.error('Erro ao buscar empréstimo:', error);
          setLoadingDetalhes(false);
          return;
        }

        if (data && data.length > 0) {
          setDetalhesEmprestimo(data[0]);
        }
      } catch (err) {
        console.error('Erro ao carregar detalhes do empréstimo:', err);
      } finally {
        setLoadingDetalhes(false);
      }
    };

    carregarDetalhesEmprestimo();
  }, [isRenegociacao, solicitacao.emprestimo_id]);

  // Handler para confirmar aprovação de autorização de cliente
  const handleConfirmarAprovacao = () => {
    if (isAutorizacaoCliente) {
      setMostrarConfirmacao(true);
    } else {
      onAprovar(motivoAprovacao || undefined);
    }
  };

  const handleAprovacaoConfirmada = () => {
    setMostrarConfirmacao(false);
    onAprovar(motivoAprovacao || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{tipoConfig.icone}</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{tipoConfig.titulo}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}>
                {statusColors.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <XCircle className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* === ABERTURA DE LIQUIDAÇÃO === */}
          {isAbertura && (
            <>
              {/* Info Grid */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Vendedor</span>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{solicitacao.vendedor_nome}</p>
                    <p className="text-xs text-gray-500">{solicitacao.vendedor_codigo}</p>
                  </div>
                </div>
                <div className="border-t border-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Rota</span>
                  <p className="font-medium text-gray-900">{solicitacao.rota_nome}</p>
                </div>
                <div className="border-t border-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Data</span>
                  <p className="font-medium text-gray-900 text-lg">{formatarDataSimples(solicitacao.data_solicitada)}</p>
                </div>
              </div>

              {/* Motivo */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">{tipoConfig.subtitulo}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs text-amber-600 mb-1">Comentário do vendedor:</p>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">
                    {solicitacao.motivo_solicitacao || 'Nenhum motivo informado'}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* === EXCLUSÃO DE PARCELA === */}
          {isExclusaoParcela && (
            <>
              {/* Info Grid */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Vendedor</span>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{solicitacao.vendedor_nome}</p>
                    <p className="text-xs text-gray-500">{solicitacao.vendedor_codigo}</p>
                  </div>
                </div>
                <div className="border-t border-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Rota</span>
                  <p className="font-medium text-gray-900">{solicitacao.rota_nome}</p>
                </div>
                <div className="border-t border-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Cliente</span>
                  <p className="font-medium text-gray-900">{solicitacao.cliente_nome || '-'}</p>
                </div>
                {solicitacao.valor_solicitado !== null && (
                  <>
                    <div className="border-t border-gray-200" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Valor</span>
                      <p className="font-semibold text-red-600 text-lg">{formatarMoeda(solicitacao.valor_solicitado)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Motivo */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">{tipoConfig.subtitulo}</span>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-xs text-red-600 mb-1">Comentário do vendedor:</p>
                  <p className="text-sm text-red-900 whitespace-pre-wrap">
                    {solicitacao.motivo_solicitacao || 'Nenhum motivo informado'}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* === RENEGOCIAÇÃO ou EMPRÉSTIMO ADICIONAL === */}
          {isAutorizacaoCliente && (
            <>
              {/* Info Grid */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Cliente</span>
                  <p className="font-medium text-gray-900 text-lg">{solicitacao.cliente_nome || '-'}</p>
                </div>
                <div className="border-t border-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Vendedor</span>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{solicitacao.vendedor_nome}</p>
                    <p className="text-xs text-gray-500">{solicitacao.vendedor_codigo}</p>
                  </div>
                </div>
                <div className="border-t border-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Rota</span>
                  <p className="font-medium text-gray-900">{solicitacao.rota_nome}</p>
                </div>
              </div>

              {/* Detalhes do Empréstimo (apenas para renegociação) */}
              {isRenegociacao && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Empréstimo a Renegociar
                  </h4>
                  {loadingDetalhes ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    </div>
                  ) : detalhesEmprestimo ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-600">Valor Principal:</span>
                        <span className="font-medium text-blue-900">{formatarMoeda(detalhesEmprestimo.valor_principal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">Valor Total:</span>
                        <span className="font-medium text-blue-900">{formatarMoeda(detalhesEmprestimo.valor_total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">Saldo Devedor:</span>
                        <span className="font-semibold text-blue-900">{formatarMoeda(detalhesEmprestimo.valor_saldo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">Data do Empréstimo:</span>
                        <span className="text-blue-900">{formatarDataSimples(detalhesEmprestimo.data_emprestimo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600">Status:</span>
                        <span className={`font-medium ${detalhesEmprestimo.status === 'VENCIDO' ? 'text-red-600' : 'text-blue-900'}`}>
                          {detalhesEmprestimo.status}
                        </span>
                      </div>
                      {detalhesEmprestimo.parcelas_vencidas > 0 && (
                        <div className="flex justify-between">
                          <span className="text-blue-600">Parcelas Vencidas:</span>
                          <span className="font-medium text-red-600">{detalhesEmprestimo.parcelas_vencidas}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-blue-600">Detalhes do empréstimo não disponíveis</p>
                  )}
                </div>
              )}

              {/* Info para Empréstimo Adicional */}
              {isEmprestimoAdicional && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                    <PlusCircle className="w-4 h-4" />
                    Empréstimo Adicional
                  </h4>
                  <p className="text-sm text-green-700">
                    O cliente já possui um empréstimo ativo e o vendedor está solicitando autorização para conceder um empréstimo adicional.
                  </p>
                </div>
              )}

              {/* Motivo */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">Motivo da Solicitação</span>
                </div>
                <div className={`${isRenegociacao ? 'bg-blue-50 border-blue-200' : 'bg-green-50 border-green-200'} border rounded-xl p-4`}>
                  <p className={`text-xs ${isRenegociacao ? 'text-blue-600' : 'text-green-600'} mb-1`}>Comentário do vendedor:</p>
                  <p className={`text-sm ${isRenegociacao ? 'text-blue-900' : 'text-green-900'} whitespace-pre-wrap`}>
                    {solicitacao.motivo_solicitacao || 'Nenhum motivo informado'}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* === OUTROS TIPOS (layout genérico) === */}
          {!isAbertura && !isExclusaoParcela && !isAutorizacaoCliente && (
            <>
              {/* Info Grid */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Vendedor</span>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{solicitacao.vendedor_nome}</p>
                    <p className="text-xs text-gray-500">{solicitacao.vendedor_codigo}</p>
                  </div>
                </div>
                <div className="border-t border-gray-200" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Rota</span>
                  <p className="font-medium text-gray-900">{solicitacao.rota_nome}</p>
                </div>
                {solicitacao.cliente_nome && (
                  <>
                    <div className="border-t border-gray-200" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Cliente</span>
                      <p className="font-medium text-gray-900">{solicitacao.cliente_nome}</p>
                    </div>
                  </>
                )}
                {solicitacao.data_solicitada && (
                  <>
                    <div className="border-t border-gray-200" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Data</span>
                      <p className="font-medium text-gray-900">{formatarDataSimples(solicitacao.data_solicitada)}</p>
                    </div>
                  </>
                )}
                {solicitacao.valor_solicitado !== null && (
                  <>
                    <div className="border-t border-gray-200" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Valor Solicitado</span>
                      <p className="font-semibold text-gray-900">{formatarMoeda(solicitacao.valor_solicitado)}</p>
                    </div>
                  </>
                )}
                {solicitacao.valor_limite !== null && (
                  <>
                    <div className="border-t border-gray-200" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Limite</span>
                      <p className="font-medium text-gray-900">{formatarMoeda(solicitacao.valor_limite)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Motivo */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">{tipoConfig.subtitulo || 'Motivo'}</span>
                </div>
                <div className="bg-gray-100 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Comentário do vendedor:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {solicitacao.motivo_solicitacao || 'Nenhum motivo informado'}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Solicitado em */}
          <p className="text-xs text-gray-400 text-center">
            Solicitado em: {formatarDataHora(solicitacao.created_at)}
          </p>

          {/* Resolução (se já foi resolvida) */}
          {solicitacao.status !== 'PENDENTE' && solicitacao.resolvido_por_nome && (
            <div className="bg-gray-50 rounded-xl p-4 mt-2">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Resolução</h3>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-500">Por:</span> {solicitacao.resolvido_por_nome}</p>
                <p><span className="text-gray-500">Em:</span> {formatarDataHora(solicitacao.data_resolucao)}</p>
                {solicitacao.motivo_resolucao && (
                  <p><span className="text-gray-500">Obs:</span> {solicitacao.motivo_resolucao}</p>
                )}
              </div>
            </div>
          )}

          {/* Ações (se pendente) */}
          {solicitacao.status === 'PENDENTE' && (
            <div className="space-y-3 pt-2">
              {/* Campo de observação para aprovação */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Observação (opcional)
                </label>
                <textarea
                  value={motivoAprovacao}
                  onChange={(e) => setMotivoAprovacao(e.target.value)}
                  placeholder="Adicione uma observação..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              {/* Campo de motivo para rejeição */}
              {mostrarMotivoRejeicao && (
                <div>
                  <label className="block text-xs font-medium text-red-600 mb-1">
                    Motivo da Rejeição *
                  </label>
                  <textarea
                    value={motivoRejeicao}
                    onChange={(e) => setMotivoRejeicao(e.target.value)}
                    placeholder="Informe o motivo..."
                    className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm resize-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    rows={2}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {solicitacao.status === 'PENDENTE' && !mostrarConfirmacao && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              Cancelar
            </button>
            
            {!mostrarMotivoRejeicao ? (
              <>
                <button
                  onClick={() => setMostrarMotivoRejeicao(true)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  <XCircle className="w-4 h-4" />
                  Rejeitar
                </button>
                <button
                  onClick={handleConfirmarAprovacao}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isAutorizacaoCliente ? 'Aprovar e Ativar Autorização' : 'Aprovar'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setMostrarMotivoRejeicao(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                >
                  Voltar
                </button>
                <button
                  onClick={() => onRejeitar(motivoRejeicao)}
                  disabled={loading || !motivoRejeicao.trim()}
                  className="flex items-center gap-1.5 px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Confirmar Rejeição
                </button>
              </>
            )}
          </div>
        )}

        {/* Modal de Confirmação para Autorização de Cliente */}
        {mostrarConfirmacao && (
          <div className="px-6 py-4 border-t border-gray-200 bg-amber-50">
            <div className="mb-4">
              <div className="flex items-center gap-2 text-amber-800 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Confirmar Autorização</span>
              </div>
              <p className="text-sm text-amber-700">
                Tem certeza que deseja autorizar o cliente <strong>{solicitacao.cliente_nome}</strong> a {' '}
                {isRenegociacao ? 'renegociar seu empréstimo' : 'obter um empréstimo adicional'}?
              </p>
              <p className="text-xs text-amber-600 mt-2">
                Esta autorização será válida até que o vendedor a utilize.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setMostrarConfirmacao(false)}
                className="px-4 py-2 text-gray-600 hover:bg-amber-100 rounded-lg transition-colors text-sm"
              >
                Voltar
              </button>
              <button
                onClick={handleAprovacaoConfirmada}
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Sim, Autorizar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Badge de Status
function BadgeStatus({ status }: { status: string }) {
  const colors = STATUS_SOLICITACAO_COLORS[status] || STATUS_SOLICITACAO_COLORS['PENDENTE'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {colors.label}
    </span>
  );
}

// Página Principal
export default function LiberacoesPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [todasSolicitacoes, setTodasSolicitacoes] = useState<Solicitacao[]>([]);
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState<Solicitacao | null>(null);
  const [loadingAcao, setLoadingAcao] = useState(false);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<string>('PENDENTE');
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>(''); // '', 'ENTRADAS', 'SAIDAS', 'LIQUIDACAO'
  const [filtroCliente, setFiltroCliente] = useState<string>('');
  const [filtroData, setFiltroData] = useState<string>(''); // YYYY-MM-DD
  const [busca, setBusca] = useState('');

  // Categorias de tipos
  const CATEGORIAS: Record<string, string[]> = {
    'LIQUIDACAO': ['ABERTURA_RETROATIVA', 'ABERTURA_DIAS_FALTANTES', 'REABRIR_LIQUIDACAO'],
    'ENTRADAS': ['VENDA_EXCEDE_LIMITE', 'RENOVACAO_EXCEDE_LIMITE', 'RECEITA_EXCEDE_LIMITE'],
    'SAIDAS': ['DESPESA_EXCEDE_LIMITE', 'ESTORNO_PAGAMENTO', 'CANCELAR_EMPRESTIMO', 'QUITAR_COM_DESCONTO'],
    'CLIENTES': ['RENEGOCIACAO', 'EMPRESTIMO_ADICIONAL', 'CLIENTE_OUTRA_ROTA'],
  };

  // Carregar TODAS as solicitações (sem filtro de status)
  const carregarSolicitacoes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await solicitacoesService.listarTodas(user.id, {
        status: null, // Busca todas
        tipo: filtroTipo || null,
      });
      setTodasSolicitacoes(data);
    } catch (err) {
      console.error('Erro ao carregar solicitações:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSolicitacoes();
  }, [user, filtroTipo]);

  // Aprovar solicitação
  const handleAprovar = async (motivo?: string) => {
    if (!solicitacaoSelecionada || !user) return;
    setLoadingAcao(true);
    try {
      let resultado;
      
      // Para RENEGOCIACAO e EMPRESTIMO_ADICIONAL, usar função especial
      if (['RENEGOCIACAO', 'EMPRESTIMO_ADICIONAL'].includes(solicitacaoSelecionada.tipo_solicitacao)) {
        resultado = await solicitacoesService.aprovarAutorizacaoCliente(solicitacaoSelecionada, user.id);
      } else {
        resultado = await solicitacoesService.aprovar(solicitacaoSelecionada.id, user.id, motivo);
      }
      
      if (resultado.success) {
        setSolicitacaoSelecionada(null);
        carregarSolicitacoes();
      } else {
        alert(resultado.message);
      }
    } catch (err) {
      console.error('Erro ao aprovar:', err);
      alert('Erro ao aprovar solicitação');
    } finally {
      setLoadingAcao(false);
    }
  };

  // Rejeitar solicitação
  const handleRejeitar = async (motivo: string) => {
    if (!solicitacaoSelecionada || !user) return;
    if (!motivo.trim()) {
      alert('Informe o motivo da rejeição');
      return;
    }
    setLoadingAcao(true);
    try {
      const resultado = await solicitacoesService.rejeitar(solicitacaoSelecionada.id, user.id, motivo);
      if (resultado.success) {
        setSolicitacaoSelecionada(null);
        carregarSolicitacoes();
      } else {
        alert(resultado.message);
      }
    } catch (err) {
      console.error('Erro ao rejeitar:', err);
      alert('Erro ao rejeitar solicitação');
    } finally {
      setLoadingAcao(false);
    }
  };

  // Contadores (baseados em TODAS as solicitações)
  const contadores = {
    pendentes: todasSolicitacoes.filter((s) => s.status === 'PENDENTE').length,
    aprovadas: todasSolicitacoes.filter((s) => s.status === 'APROVADO').length,
    rejeitadas: todasSolicitacoes.filter((s) => s.status === 'REJEITADO').length,
  };

  // Filtrar por status e busca (para a tabela)
  const solicitacoesFiltradas = todasSolicitacoes.filter((s) => {
    // Filtro de status
    if (filtroStatus && s.status !== filtroStatus) return false;
    
    // Filtro de tipo específico
    if (filtroTipo && s.tipo_solicitacao !== filtroTipo) return false;

    // Filtro de categoria
    if (filtroCategoria && CATEGORIAS[filtroCategoria]) {
      if (!CATEGORIAS[filtroCategoria].includes(s.tipo_solicitacao)) return false;
    }

    // Filtro de cliente
    if (filtroCliente) {
      const termoCliente = filtroCliente.toLowerCase();
      if (!s.cliente_nome?.toLowerCase().includes(termoCliente)) return false;
    }

    // Filtro de data (data_solicitada)
    if (filtroData && s.data_solicitada !== filtroData) return false;
    
    // Filtro de busca geral
    if (busca) {
      const termo = busca.toLowerCase();
      const encontrou = (
        s.vendedor_nome?.toLowerCase().includes(termo) ||
        s.rota_nome?.toLowerCase().includes(termo) ||
        s.cliente_nome?.toLowerCase().includes(termo) ||
        TIPO_SOLICITACAO_LABELS[s.tipo_solicitacao]?.toLowerCase().includes(termo)
      );
      if (!encontrou) return false;
    }

    return true;
  });

  // Limpar todos os filtros
  const limparFiltros = () => {
    setFiltroStatus('');
    setFiltroTipo('');
    setFiltroCategoria('');
    setFiltroCliente('');
    setFiltroData('');
    setBusca('');
  };

  // Verificar se há filtros ativos
  const temFiltrosAtivos = filtroStatus || filtroTipo || filtroCategoria || filtroCliente || filtroData || busca;

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 space-y-4 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Central de Solicitações</h1>
            <p className="text-gray-500 mt-1">Gerencie as solicitações de autorização dos vendedores</p>
          </div>
          <button
            onClick={carregarSolicitacoes}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setFiltroStatus('PENDENTE')}
            className={`p-4 rounded-xl border-2 transition-colors ${
              filtroStatus === 'PENDENTE' 
                ? 'border-amber-500 bg-amber-50' 
                : 'border-gray-200 bg-white hover:border-amber-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-amber-600">{contadores.pendentes}</p>
                <p className="text-sm text-gray-600">Pendentes</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFiltroStatus('APROVADO')}
            className={`p-4 rounded-xl border-2 transition-colors ${
              filtroStatus === 'APROVADO' 
                ? 'border-green-500 bg-green-50' 
                : 'border-gray-200 bg-white hover:border-green-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-green-600">{contadores.aprovadas}</p>
                <p className="text-sm text-gray-600">Aprovadas</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setFiltroStatus('REJEITADO')}
            className={`p-4 rounded-xl border-2 transition-colors ${
              filtroStatus === 'REJEITADO' 
                ? 'border-red-500 bg-red-50' 
                : 'border-gray-200 bg-white hover:border-red-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-left">
                <p className="text-2xl font-bold text-red-600">{contadores.rejeitadas}</p>
                <p className="text-sm text-gray-600">Rejeitadas</p>
              </div>
            </div>
          </button>
        </div>

        {/* Filtros */}
        <div className="space-y-3">
          {/* Linha 1: Busca geral + Cliente + Data */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por vendedor, rota..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="relative flex-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                placeholder="Filtrar por cliente..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white min-w-[160px]"
              />
            </div>
          </div>

          {/* Linha 2: Categoria + Tipo + Limpar */}
          <div className="flex items-center gap-3">
            <select
              value={filtroCategoria}
              onChange={(e) => { setFiltroCategoria(e.target.value); setFiltroTipo(''); }}
              className="px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm min-w-[160px]"
            >
              <option value="">Todas categorias</option>
              <option value="LIQUIDACAO">📅 Liquidação</option>
              <option value="ENTRADAS">📥 Entradas</option>
              <option value="SAIDAS">📤 Saídas</option>
              <option value="CLIENTES">👤 Clientes</option>
            </select>

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm min-w-[200px]"
            >
              <option value="">Todos os tipos</option>
              {filtroCategoria && CATEGORIAS[filtroCategoria] ? (
                // Mostrar apenas tipos da categoria selecionada
                CATEGORIAS[filtroCategoria].map((tipo) => (
                  <option key={tipo} value={tipo}>{TIPO_SOLICITACAO_LABELS[tipo]}</option>
                ))
              ) : (
                // Mostrar todos os tipos
                Object.entries(TIPO_SOLICITACAO_LABELS).map(([tipo, label]) => (
                  <option key={tipo} value={tipo}>{label}</option>
                ))
              )}
            </select>

            {temFiltrosAtivos && (
              <button
                onClick={limparFiltros}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm flex items-center gap-1"
              >
                <XCircle className="w-4 h-4" />
                Limpar filtros
              </button>
            )}

            <div className="flex-1" />

            <span className="text-sm text-gray-500">
              {solicitacoesFiltradas.length} resultado{solicitacoesFiltradas.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : solicitacoesFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg font-medium">Nenhuma solicitação encontrada</p>
            <p className="text-sm">Ajuste os filtros ou aguarde novas solicitações</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Vendedor</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Rota</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Data</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 bg-gray-50">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 bg-gray-50">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {solicitacoesFiltradas.map((solicitacao) => (
                  <tr 
                    key={solicitacao.id} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                      !solicitacao.ja_visualizada && solicitacao.status === 'PENDENTE' ? 'bg-amber-50/50' : ''
                    }`}
                    onClick={() => setSolicitacaoSelecionada(solicitacao)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!solicitacao.ja_visualizada && solicitacao.status === 'PENDENTE' && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                        )}
                        <span className="font-medium text-gray-900">
                          {TIPO_SOLICITACAO_LABELS[solicitacao.tipo_solicitacao] || solicitacao.tipo_solicitacao}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{solicitacao.vendedor_nome}</p>
                      <p className="text-xs text-gray-500">{solicitacao.vendedor_codigo}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{solicitacao.rota_nome}</td>
                    <td className="px-4 py-3 text-gray-600">{formatarData(solicitacao.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      <BadgeStatus status={solicitacao.status} />
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSolicitacaoSelecionada(solicitacao)}
                        className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        {solicitacao.status === 'PENDENTE' ? 'Resolver' : 'Detalhes'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {solicitacaoSelecionada && (
        <ModalDetalhesSolicitacao
          solicitacao={solicitacaoSelecionada}
          onClose={() => setSolicitacaoSelecionada(null)}
          onAprovar={handleAprovar}
          onRejeitar={handleRejeitar}
          loading={loadingAcao}
        />
      )}
    </div>
  );
}