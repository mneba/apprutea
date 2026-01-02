'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, CheckCheck, User } from 'lucide-react';
import { usuariosService } from '@/services/usuarios';
import { useUser } from '@/contexts/UserContext';

interface Mensagem {
  id: string;
  mensagem: string;
  lido: boolean;
  created_at: string;
  origem?: {
    nome: string;
  };
}

export function MenuNotificacoes() {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
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

  // Carregar mensagens
  const carregarMensagens = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await usuariosService.listarMensagensNaoLidas(user.id);
      setMensagens(data);
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar ao abrir
  useEffect(() => {
    if (isOpen && user) {
      carregarMensagens();
    }
  }, [isOpen, user]);

  // Polling a cada 30 segundos
  useEffect(() => {
    if (!user) return;
    carregarMensagens();
    const interval = setInterval(carregarMensagens, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Marcar como lida
  const handleMarcarLida = async (mensagemId: string) => {
    try {
      await usuariosService.marcarMensagemLida(mensagemId);
      setMensagens((prev) => prev.filter((m) => m.id !== mensagemId));
    } catch (err) {
      console.error('Erro ao marcar mensagem:', err);
    }
  };

  // Marcar todas como lidas
  const handleMarcarTodasLidas = async () => {
    if (!user) return;
    try {
      await usuariosService.marcarTodasLidas(user.id);
      setMensagens([]);
    } catch (err) {
      console.error('Erro ao marcar mensagens:', err);
    }
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do sino */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {mensagens.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
            {mensagens.length > 9 ? '9+' : mensagens.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="font-semibold text-gray-800">Notificações</span>
            <div className="flex items-center gap-2">
              {mensagens.length > 0 && (
                <button
                  onClick={handleMarcarTodasLidas}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Lista de mensagens */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : mensagens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
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
            )}
          </div>

          {/* Footer */}
          {mensagens.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
              <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
                Ver todas as notificações
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
