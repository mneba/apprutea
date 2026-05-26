'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Building2,
  Loader2,
  Smartphone,
} from 'lucide-react';
import { usuariosService } from '@/services/usuarios';
import { useUser } from '@/contexts/UserContext';
import { ModalGerenciarUsuario } from '@/components/usuarios';
import type { UserProfile, Empresa } from '@/types/database';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  APROVADO: { label: 'Aprovado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  REJEITADO: { label: 'Rejeitado', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function UsuariosPage() {
  const { profile, localizacao, loading: loadingUser } = useUser();
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todos');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UserProfile | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [cardAtivo, setCardAtivo] = useState<string>('todos');

  const ehSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';

  useEffect(() => {
    if (!loadingUser && profile) {
      carregarDados();
    }
  }, [loadingUser, profile]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const usuariosData = await usuariosService.listarUsuarios({
        isSuperAdmin: ehSuperAdmin,
        empresaId: ehSuperAdmin ? undefined : (localizacao.empresa_id || undefined),
      });
      setUsuarios(usuariosData);

      const empresasData = await usuariosService.listarEmpresas();
      setEmpresas(empresasData);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEmpresaNome = (usuario: UserProfile) => {
    if (!usuario.empresas_ids || usuario.empresas_ids.length === 0) {
      return usuario.empresa_pretendida || '-';
    }
    const empresa = empresas.find((e) => e.id === usuario.empresas_ids![0]);
    return empresa?.nome || usuario.empresa_pretendida || '-';
  };

  const getFotoUrl = (usuario: UserProfile): string => {
    return (usuario as any).url_foto_usuario || (usuario as any).Url_foto_usuario || '';
  };

  const ehMonitor = (usuario: UserProfile) => usuario.tipo_usuario === 'MONITOR';

  // Cards de resumo — clicáveis para filtrar
  const cards = [
    {
      id: 'todos',
      label: 'Total',
      count: usuarios.length,
      icon: User,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      id: 'APROVADO',
      label: 'Aprovados',
      count: usuarios.filter((u) => u.status === 'APROVADO').length,
      icon: CheckCircle,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
    },
    {
      id: 'PENDENTE',
      label: 'Pendentes',
      count: usuarios.filter((u) => u.status === 'PENDENTE').length,
      icon: Clock,
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
    },
    {
      id: 'MONITOR',
      label: 'Apenas Móvel',
      count: usuarios.filter((u) => u.tipo_usuario === 'MONITOR').length,
      icon: Smartphone,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
    },
  ];

  const handleCardClick = (cardId: string) => {
    setCardAtivo(cardId);
    if (cardId === 'todos') {
      setFiltroStatus('todos');
    } else if (cardId === 'MONITOR') {
      setFiltroStatus('todos'); // MONITOR é filtro de tipo, não status
    } else {
      setFiltroStatus(cardId);
    }
  };

  // Filtrar usuários
  const usuariosFiltrados = usuarios.filter((usuario) => {
    const matchSearch =
      usuario.nome?.toLowerCase().includes(search.toLowerCase()) ||
      usuario.telefone?.toLowerCase().includes(search.toLowerCase()) ||
      usuario.empresa_pretendida?.toLowerCase().includes(search.toLowerCase());

    const matchStatus =
      cardAtivo === 'todos'
        ? filtroStatus === 'todos' || usuario.status === filtroStatus
        : cardAtivo === 'MONITOR'
        ? usuario.tipo_usuario === 'MONITOR'
        : usuario.status === cardAtivo;

    const matchEmpresa =
      filtroEmpresa === 'todos' ||
      (usuario.empresas_ids && usuario.empresas_ids.includes(filtroEmpresa)) ||
      (!usuario.empresas_ids?.length && filtroEmpresa === 'sem_empresa');

    return matchSearch && matchStatus && matchEmpresa;
  });

  const handleGerenciar = (usuario: UserProfile) => {
    setUsuarioSelecionado(usuario);
    setModalAberto(true);
  };

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ===== ÁREA FIXA (não rola) ===== */}

      {/* Título */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500 mt-1">Gerencie os usuários e suas permissões</p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => {
          const Icon = card.icon;
          const ativo = cardAtivo === card.id;
          return (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              className={`
                flex items-center gap-3 p-4 rounded-xl border text-left transition-all
                ${ativo
                  ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}
              `}
            >
              <div className={`w-10 h-10 rounded-lg ${card.iconBg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.count}</p>
                <p className="text-sm text-gray-500">{card.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        {/* Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Filtro de empresa — só SUPER_ADMIN */}
        {ehSuperAdmin && (
          <select
            className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 min-w-[180px]"
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
          >
            <option value="todos">Todas as Empresas</option>
            <option value="sem_empresa">Sem Empresa</option>
            {empresas.map((empresa) => (
              <option key={empresa.id} value={empresa.id}>
                {empresa.nome}
              </option>
            ))}
          </select>
        )}

        {/* Filtro de status */}
        <select
          className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 min-w-[160px]"
          value={filtroStatus}
          onChange={(e) => {
            setFiltroStatus(e.target.value);
            setCardAtivo('todos');
          }}
        >
          <option value="todos">Todos os Status</option>
          <option value="APROVADO">Aprovados</option>
          <option value="PENDENTE">Pendentes</option>
          <option value="REJEITADO">Rejeitados</option>
        </select>
      </div>

      {/* ===== ÁREA COM SCROLL (só a tabela rola) ===== */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col min-h-0">

        {/* Header da tabela — fixo */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Usuário
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Empresa
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Código
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Cadastro
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                  Ações
                </th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Corpo da tabela — rola */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Carregando usuários...</p>
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <User className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-500 text-sm">Nenhum usuário encontrado</p>
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((usuario) => {
                  const statusInfo = statusConfig[usuario.status] || statusConfig.PENDENTE;
                  const StatusIcon = statusInfo.icon;
                  const fotoUrl = getFotoUrl(usuario);

                  return (
                    <tr
                      key={usuario.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {/* Usuário */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                              {fotoUrl ? (
                                <img
                                  src={fotoUrl}
                                  alt={usuario.nome}
                                  className="w-10 h-10 object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                            {ehMonitor(usuario) && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white">
                                <Smartphone className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{usuario.nome}</p>
                            <p className="text-xs text-gray-500">{usuario.telefone}</p>
                          </div>
                        </div>
                      </td>

                      {/* Empresa */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-300 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{getEmpresaNome(usuario)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Código */}
                      <td className="px-6 py-4">
                        {usuario.token_acesso ? (
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-700">
                              {usuario.token_acesso}
                            </code>
                            {usuario.token_validado && (
                              <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-sm">-</span>
                        )}
                      </td>

                      {/* Cadastro */}
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {usuario.created_at
                            ? new Date(usuario.created_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleGerenciar(usuario)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                          Gerenciar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalAberto && usuarioSelecionado && (
        <ModalGerenciarUsuario
          usuario={usuarioSelecionado}
          onClose={() => {
            setModalAberto(false);
            setUsuarioSelecionado(null);
          }}
          onSave={() => {
            carregarDados();
            setModalAberto(false);
            setUsuarioSelecionado(null);
          }}
        />
      )}
    </div>
  );
}