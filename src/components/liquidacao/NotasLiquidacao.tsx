'use client';

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  Plus,
  X,
  Send,
  Loader2,
  User,
  Calendar,
  Edit2,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// =====================================================
// TIPOS
// =====================================================

interface Nota {
  id: string;
  empresa_id: string;
  rota_id: string;
  vendedor_id: string;
  autor_id: string;
  autor_nome: string;
  autor_tipo: 'VENDEDOR' | 'MONITOR';
  liquidacao_id: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  emprestimo_id: string | null;
  parcela_id: string | null;
  numero_parcela: number | null;
  nota: string;
  prioridade: 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';
  status: 'ATIVA' | 'RESOLVIDA' | 'ARQUIVADA';
  obs_local: 'Geral' | 'Cliente' | 'Rota';
  data_referencia: string | null;
  created_at: string;
}

interface NotasLiquidacaoCardProps {
  liquidacaoId: string;
  rotaId: string;
  empresaId: string;
  vendedorId: string;
  autorId: string;
  autorNome: string;
  dataReferencia: string;
}

interface NotasClienteIconProps {
  clienteId: string;
  liquidacaoId: string;
  totalNotasLiquidacao: number;
  temNotasOutrasLiquidacoes: boolean;
  onClick: () => void;
}

// =====================================================
// HELPERS
// =====================================================

function formatarDataHora(data: string): string {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarDataCurta(data: string): string {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

// =====================================================
// ÍCONE DE NOTAS PARA CLIENTE (usado na tabela)
// =====================================================

export function NotasClienteIcon({
  totalNotasLiquidacao,
  temNotasOutrasLiquidacoes,
  onClick,
}: NotasClienteIconProps) {
  if (totalNotasLiquidacao === 0 && !temNotasOutrasLiquidacoes) {
    return null;
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="relative p-1 rounded hover:bg-gray-100 transition-colors"
      title={`${totalNotasLiquidacao} nota(s) nesta liquidação`}
    >
      <MessageSquare className={`w-4 h-4 ${totalNotasLiquidacao > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
      {totalNotasLiquidacao > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {totalNotasLiquidacao > 9 ? '9+' : totalNotasLiquidacao}
        </span>
      )}
    </button>
  );
}

// =====================================================
// CARD DE NOTAS DA LIQUIDAÇÃO
// =====================================================

export function NotasLiquidacaoCard({
  liquidacaoId,
  rotaId,
  empresaId,
  vendedorId,
  autorId,
  autorNome,
  dataReferencia,
}: NotasLiquidacaoCardProps) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [novaNota, setNovaNota] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [textoEdicao, setTextoEdicao] = useState('');
  const [expandido, setExpandido] = useState(true);

  // Carregar notas
  useEffect(() => {
    carregarNotas();
  }, [liquidacaoId]);

  const carregarNotas = async () => {
    if (!liquidacaoId) return;

    setLoading(true);
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase.rpc('fn_listar_notas', {
        p_rota_id: rotaId,
        p_data_inicio: null,
        p_data_fim: null,
        p_cliente_id: null,
        p_liquidacao_id: liquidacaoId,
        p_status: null,
        p_prioridade: null,
        p_limite: 100,
      });

      if (error) {
        console.error('Erro ao carregar notas:', error);
        return;
      }

      // Ordenar por created_at DESC
      const notasOrdenadas = (data || []).sort((a: Nota, b: Nota) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotas(notasOrdenadas);
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCriarNota = async () => {
    if (!novaNota.trim() || salvando) return;

    setSalvando(true);
    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc('fn_criar_nota', {
        p_empresa_id: empresaId,
        p_rota_id: rotaId,
        p_vendedor_id: vendedorId,
        p_autor_id: autorId,
        p_autor_nome: autorNome,
        p_autor_tipo: 'MONITOR', // No web é sempre MONITOR ou ADMIN
        p_liquidacao_id: liquidacaoId,
        p_cliente_id: null,
        p_emprestimo_id: null,
        p_parcela_id: null,
        p_nota: novaNota.trim(),
        p_prioridade: 'NORMAL',
        p_data_referencia: dataReferencia,
        p_latitude: null,
        p_longitude: null,
      });

      if (error) {
        console.error('Erro ao criar nota:', error);
        alert('Erro ao criar nota');
        return;
      }

      const resultado = Array.isArray(data) ? data[0] : data;
      
      if (resultado?.sucesso && resultado?.nota_id) {
        // Atualizar obs_local
        await supabase
          .from('notas')
          .update({ obs_local: 'Geral' })
          .eq('id', resultado.nota_id);

        setNovaNota('');
        setCriando(false);
        await carregarNotas();
      } else {
        alert(resultado?.mensagem || 'Erro ao criar nota');
      }
    } catch (error) {
      console.error('Erro ao criar nota:', error);
      alert('Erro ao criar nota');
    } finally {
      setSalvando(false);
    }
  };

  const handleEditarNota = async (notaId: string) => {
    if (!textoEdicao.trim() || salvando) return;

    setSalvando(true);
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('notas')
        .update({ nota: textoEdicao.trim() })
        .eq('id', notaId);

      if (error) {
        console.error('Erro ao editar nota:', error);
        alert('Erro ao editar nota');
        return;
      }

      setEditandoId(null);
      setTextoEdicao('');
      await carregarNotas();
    } catch (error) {
      console.error('Erro ao editar nota:', error);
      alert('Erro ao editar nota');
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (nota: Nota) => {
    setEditandoId(nota.id);
    setTextoEdicao(nota.nota);
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setTextoEdicao('');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div 
        className="px-4 py-3 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-900">Notas da Liquidação</h3>
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
            {notas.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!criando && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCriando(true);
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded hover:bg-amber-100 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Nova Nota
            </button>
          )}
          <span className={`transform transition-transform ${expandido ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {expandido && (
        <div className="p-4">
          {/* Formulário de nova nota */}
          {criando && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <textarea
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                placeholder="Escrever nota..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                rows={3}
                autoFocus
                disabled={salvando}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    setCriando(false);
                    setNovaNota('');
                  }}
                  disabled={salvando}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCriarNota}
                  disabled={salvando || !novaNota.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {salvando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Salvar
                </button>
              </div>
            </div>
          )}

          {/* Lista de notas */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          ) : notas.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {notas.map((nota) => (
                <div
                  key={nota.id}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  {/* Badge de tipo */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      nota.obs_local === 'Cliente' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {nota.obs_local === 'Cliente' ? 'Nota de Cliente' : 'Nota da Rota'}
                    </span>
                    {nota.prioridade !== 'NORMAL' && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        nota.prioridade === 'URGENTE' ? 'bg-red-100 text-red-700' :
                        nota.prioridade === 'ALTA' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {nota.prioridade}
                      </span>
                    )}
                  </div>

                  {/* Nome do cliente (se houver) */}
                  {nota.cliente_nome && (
                    <p className="text-sm font-medium text-gray-900 mb-1 flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-400" />
                      {nota.cliente_nome}
                    </p>
                  )}

                  {/* Texto da nota */}
                  {editandoId === nota.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={textoEdicao}
                        onChange={(e) => setTextoEdicao(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                        rows={3}
                        disabled={salvando}
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelarEdicao}
                          disabled={salvando}
                          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleEditarNota(nota.id)}
                          disabled={salvando || !textoEdicao.trim()}
                          className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
                        >
                          {salvando ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{nota.nota}</p>
                  )}

                  {/* Footer da nota */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{formatarDataHora(nota.created_at)}</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {nota.autor_nome}
                      </span>
                    </div>
                    {editandoId !== nota.id && (
                      <button
                        onClick={() => iniciarEdicao(nota)}
                        className="p-1 text-gray-400 hover:text-amber-600 transition-colors"
                        title="Editar nota"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Contexto adicional */}
                  {nota.numero_parcela && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <Calendar className="w-3 h-3" />
                      <span>Parcela {nota.numero_parcela}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              Nenhuma nota nesta liquidação
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =====================================================
// MODAL DE NOTAS DO CLIENTE
// =====================================================

interface ModalNotasClienteProps {
  isOpen: boolean;
  onClose: () => void;
  clienteId: string;
  clienteNome: string;
  rotaId: string;
  empresaId: string;
  vendedorId: string;
  liquidacaoId: string;
  autorId: string;
  autorNome: string;
  dataReferencia: string;
}

export function ModalNotasCliente({
  isOpen,
  onClose,
  clienteId,
  clienteNome,
  rotaId,
  empresaId,
  vendedorId,
  liquidacaoId,
  autorId,
  autorNome,
  dataReferencia,
}: ModalNotasClienteProps) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [novaNota, setNovaNota] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (isOpen && clienteId) {
      carregarNotas();
    }
  }, [isOpen, clienteId]);

  const carregarNotas = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      
      // Buscar notas de TODAS as liquidações para este cliente
      const { data, error } = await supabase.rpc('fn_listar_notas', {
        p_rota_id: rotaId,
        p_data_inicio: null,
        p_data_fim: null,
        p_cliente_id: clienteId,
        p_liquidacao_id: null, // NULL para ver todas as liquidações
        p_status: null,
        p_prioridade: null,
        p_limite: 100,
      });

      if (error) {
        console.error('Erro ao carregar notas:', error);
        return;
      }

      const notasOrdenadas = (data || []).sort((a: Nota, b: Nota) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotas(notasOrdenadas);
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCriarNota = async () => {
    if (!novaNota.trim() || salvando) return;

    setSalvando(true);
    try {
      const supabase = createClient();

      const { data, error } = await supabase.rpc('fn_criar_nota', {
        p_empresa_id: empresaId,
        p_rota_id: rotaId,
        p_vendedor_id: vendedorId,
        p_autor_id: autorId,
        p_autor_nome: autorNome,
        p_autor_tipo: 'MONITOR',
        p_liquidacao_id: liquidacaoId,
        p_cliente_id: clienteId,
        p_emprestimo_id: null,
        p_parcela_id: null,
        p_nota: novaNota.trim(),
        p_prioridade: 'NORMAL',
        p_data_referencia: dataReferencia,
        p_latitude: null,
        p_longitude: null,
      });

      if (error) {
        console.error('Erro ao criar nota:', error);
        alert('Erro ao criar nota');
        return;
      }

      const resultado = Array.isArray(data) ? data[0] : data;
      
      if (resultado?.sucesso && resultado?.nota_id) {
        await supabase
          .from('notas')
          .update({ obs_local: 'Cliente', cliente_nome: clienteNome })
          .eq('id', resultado.nota_id);

        setNovaNota('');
        setCriando(false);
        await carregarNotas();
      } else {
        alert(resultado?.mensagem || 'Erro ao criar nota');
      }
    } catch (error) {
      console.error('Erro ao criar nota:', error);
      alert('Erro ao criar nota');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-600" />
              Notas
            </h2>
            <p className="text-sm text-gray-500">{clienteNome}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Botão nova nota */}
          {!criando && (
            <button
              onClick={() => setCriando(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 border-2 border-dashed border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nova Nota
            </button>
          )}

          {/* Formulário */}
          {criando && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <textarea
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                placeholder="Escrever nota sobre este cliente..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                rows={3}
                autoFocus
                disabled={salvando}
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    setCriando(false);
                    setNovaNota('');
                  }}
                  disabled={salvando}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCriarNota}
                  disabled={salvando || !novaNota.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {salvando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Salvar
                </button>
              </div>
            </div>
          )}

          {/* Lista de notas */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          ) : notas.length > 0 ? (
            <div className="space-y-3">
              {notas.map((nota) => (
                <div
                  key={nota.id}
                  className={`p-3 rounded-lg border ${
                    nota.liquidacao_id === liquidacaoId
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{nota.nota}</p>
                  
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatarDataHora(nota.created_at)}</span>
                      <span>•</span>
                      <span>{nota.autor_nome}</span>
                    </div>
                  </div>

                  {/* Info de contexto */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span>{nota.data_referencia ? formatarDataCurta(nota.data_referencia) : '-'}</span>
                    {nota.numero_parcela && (
                      <>
                        <span>|</span>
                        <span>Parcela {nota.numero_parcela}</span>
                      </>
                    )}
                    {nota.liquidacao_id === liquidacaoId && (
                      <span className="ml-auto px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-[10px] font-medium">
                        ATUAL
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              Nenhuma nota para este cliente
            </div>
          )}
        </div>
      </div>
    </div>
  );
}