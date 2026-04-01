'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, User, AlertTriangle, Clock, ChevronRight, FileText } from 'lucide-react';
import { usuariosService } from '@/services/usuarios';
import { solicitacoesService } from '@/services/solicitacoes';
import { useUser } from '@/contexts/UserContext';
import { useRouter } from '@/i18n/routing';

interface Mensagem {
  id: string;
  mensagem: string;
  lido: boolean;
  created_at: string;
  origem?: {
    nome: string;
  };
}

interface SolicitacaoPendente {
  id: string;
  tipo_solicitacao: string;
  data_solicitada: string | null;
  motivo_solicitacao: string;
  created_at: string;
  expira_em: string;
  vendedor_nome: string;
  vendedor_codigo: string;
  rota_nome: string;
  rota_id: string;
  cliente_nome: string | null;
  valor_solicitado: number | null;
  valor_limite: number | null;
  ja_visualizada: boolean;
}

// Labels amigáveis para tipos de solicitação
const TIPO_LABELS: Record<string, string> = {
  'ABERTURA_RETROATIVA': 'Abertura Retroativa',
  'ABERTURA_DIAS_FALTANTES': 'Abertura Dias Faltantes',
  'VENDA_EXCEDE_LIMITE': 'Venda Excede Limite',
  'RENOVACAO_EXCEDE_LIMITE': 'Renovação Excede Limite',
  'DESPESA_EXCEDE_LIMITE': 'Despesa Excede Limite',
  'RECEITA_EXCEDE_LIMITE': 'Receita Excede Limite',
  'ESTORNO_PAGAMENTO': 'Estorno de Pagamento',
  'CANCELAR_EMPRESTIMO': 'Cancelar Empréstimo',
  'REABRIR_LIQUIDACAO': 'Reabrir Liquidação',
  'QUITAR_COM_DESCONTO': 'Quitar com Desconto',
  'CLIENTE_OUTRA_ROTA': 'Cliente de Outra Rota',
};

export function MenuNotificacoes() {
  const { user } = useUser();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPendente[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carregar dados
  const carregarDados = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [mensagensData, solicitacoesData] = await Promise.all([
        usuariosService.listarMensagensNaoLidas(user.id),
        solicitacoesService.listarPendentesNaoVistas(user.id),
      ]);
      setMensagens(mensagensData);
      setSolicitacoes(solicitacoesData || []);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar ao abrir
  useEffect(() => {
    if (isOpen && user) {
      carregarDados();
    }
  }, [isOpen, user]);

  // Polling a cada 30 segundos
  useEffect(() => {
    if (!user) return;
    carregarDados();
    const interval = setInterval(carregarDados, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Marcar mensagem como lida
  const handleMarcarLida = async (mensagemId: string) => {
    try {
      await usuariosService.marcarMensagemLida(mensagemId);
      setMensagens((prev) => prev.filter((m) => m.id !== mensagemId));
    } catch (err) {
      console.error('Erro ao marcar mensagem:', err);
    }
  };

  // Marcar todas mensagens como lidas
  const handleMarcarTodasLidas = async () => {
    if (!user) return;
    try {
      await usuariosService.marcarTodasLidas(user.id);
      setMensagens([]);
    } catch (err) {
      console.error('Erro ao marcar mensagens:', err);
    }
  };

  // Ir para central de solicitações
  const handleIrParaCentral = () => {
    setIsOpen(false);
    router.push('/liberacoes');
  };

  // Marcar solicitação como vista e ir para central
  const handleVerSolicitacao = async (solicitacaoId: string) => {
    if (!user) return;
    try {
      await solicitacoesService.marcarComoVista(solicitacaoId, user.id);
      setSolicitacoes((prev) => prev.filter((s) => s.id !== solicitacaoId));
    } catch (err) {
      console.error('Erro ao marcar solicitação:', err);
    }
    handleIrParaCentral();
  };

  // Formatar data relativa
  const formatarDataRelativa = (data: string) => {
    const agora = new Date();
    const dataMsg = new Date(data);
    const diffMs = agora.getTime() - dataMsg.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHoras = Math.floor(diffMs / 3600000);
    const diffDias = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Agora';
    if (diffMin < 60) return `${diffMin} min`;
    if (diffHoras < 24) return `${diffHoras}h`;
    if (diffDias < 7) return `${diffDias}d`;
    return dataMsg.toLocaleDateString('pt-BR');
  };

  // Total de notificações (mensagens + solicitações)
  const totalNotificacoes = mensagens.length + solicitacoes.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do sino */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {totalNotificacoes > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
            {totalNotificacoes > 9 ? '9+' : totalNotificacoes}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="font-semibold text-gray-800">Notificações</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Conteúdo */}
          <div className="max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : totalNotificacoes === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <>
                {/* SEÇÃO: Solicitações Pendentes */}
                {solicitacoes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-4 py-2 bg-amber-50 border-b border-amber-100">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">
                          Solicitações Pendentes ({solicitacoes.length})
                        </span>
                      </div>
                      <button
                        onClick={handleIrParaCentral}
                        className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
                      >
                        Ver todas
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {solicitacoes.slice(0, 5).map((solicitacao) => (
                        <button
                          key={solicitacao.id}
                          onClick={() => handleVerSolicitacao(solicitacao.id)}
                          className="w-full p-3 hover:bg-amber-50 transition-colors text-left"
                        >
                          <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {TIPO_LABELS[solicitacao.tipo_solicitacao] || solicitacao.tipo_solicitacao}
                                </span>
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                                  Pendente
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5 truncate">
                                {solicitacao.vendedor_nome} • {solicitacao.rota_nome}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <Clock className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-400">
                                  {formatarDataRelativa(solicitacao.created_at)}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 self-center" />
                          </div>
                        </button>
                      ))}
                    </div>
                    {solicitacoes.length > 5 && (
                      <button
                        onClick={handleIrParaCentral}
                        className="w-full py-2 text-sm text-amber-600 hover:bg-amber-50 font-medium border-t border-amber-100"
                      >
                        Ver mais {solicitacoes.length - 5} solicitações
                      </button>
                    )}
                  </div>
                )}

                {/* SEÇÃO: Mensagens */}
                {mensagens.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-700">
                        Mensagens ({mensagens.length})
                      </span>
                      <button
                        onClick={handleMarcarTodasLidas}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Marcar todas
                      </button>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {mensagens.map((mensagem) => (
                        <div
                          key={mensagem.id}
                          className="p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-gray-700 whitespace-pre-line line-clamp-3">
                                  {mensagem.mensagem}
                                </p>
                                <button
                                  onClick={() => handleMarcarLida(mensagem.id)}
                                  className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
                                  title="Marcar como lida"
                                >
                                  <Check className="w-4 h-4 text-gray-400" />
                                </button>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {mensagem.origem?.nome && (
                                  <span className="text-xs text-gray-500">
                                    De: {mensagem.origem.nome}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400">
                                  {formatarDataRelativa(mensagem.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer - Link para Central */}
          {solicitacoes.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <button 
                onClick={handleIrParaCentral}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Abrir Central de Solicitações
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}