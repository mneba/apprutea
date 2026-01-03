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
import { Input } from '@/components/ui';
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

  // Verificar se é SUPER_ADMIN (interno)
  const ehSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';

  // Carregar dados quando perfil estiver pronto
  useEffect(() => {
    if (!loadingUser && profile) {
      carregarDados();
    }
  }, [loadingUser, profile]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // SUPER_ADMIN vê todos, outros veem apenas da sua empresa
      const usuariosData = await usuariosService.listarUsuarios({
        isSuperAdmin: ehSuperAdmin,
        empresaId: ehSuperAdmin ? undefined : (localizacao.empresa_id || undefined),
      });
      setUsuarios(usuariosData);

      // Carregar todas as empresas para exibição
      const empresasData = await usuariosService.listarEmpresas();
      setEmpresas(empresasData);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  // Obter nome da empresa
  const getEmpresaNome = (usuario: UserProfile) => {
    if (!usuario.empresas_ids || usuario.empresas_ids.length === 0) {
      return usuario.empresa_pretendida || '-';
    }
    const empresaId = usuario.empresas_ids[0];
    const empresa = empresas.find((e) => e.id === empresaId);
    return empresa?.nome || usuario.empresa_pretendida || '-';
  };

  // Verificar se é monitor (apenas app móvel)
  const ehMonitor = (usuario: UserProfile) => usuario.tipo_usuario === 'MONITOR';

  // Filtrar usuários
  const usuariosFiltrados = usuarios.filter((usuario) => {
    const matchSearch =
      usuario.nome?.toLowerCase().includes(search.toLowerCase()) ||
      usuario.telefone?.toLowerCase().includes(search.toLowerCase()) ||
      usuario.empresa_pretendida?.toLowerCase().includes(search.toLowerCase());

    const matchStatus = filtroStatus === 'todos' || usuario.status === filtroStatus;

    const matchEmpresa =
      filtroEmpresa === 'todos' ||
      (usuario.empresas_ids && usuario.empresas_ids.includes(filtroEmpresa)) ||
      (!usuario.empresas_ids?.length && filtroEmpresa === 'sem_empresa');

    return matchSearch && matchStatus && matchEmpresa;
  });

  // Abrir modal
  const handleGerenciar = (usuario: UserProfile) => {
    setUsuarioSelecionado(usuario);
    setModalAberto(true);
  };

  // Se carregando
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500 mt-1">
            Gerencie os usuários e suas permissões
          </p>
        </div>
        {/* Botão removido - usuários se cadastram pelo app/web */}
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{usuarios.length}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {usuarios.filter((u) => u.status === 'APROVADO').length}
              </p>
              <p className="text-sm text-gray-500">Aprovados</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {usuarios.filter((u) => u.status === 'PENDENTE').length}
              </p>
              <p className="text-sm text-gray-500">Pendentes</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {usuarios.filter((u) => u.tipo_usuario === 'MONITOR').length}
              </p>
              <p className="text-sm text-gray-500">Apenas Móvel</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome, telefone ou empresa..."
              icon={<Search className="w-5 h-5" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Filtro de Empresa - só SUPER_ADMIN vê */}
            {ehSuperAdmin && (
              <select
                className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
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

            <select
              className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todos">Todos os Status</option>
              <option value="APROVADO">Aprovados</option>
              <option value="PENDENTE">Pendentes</option>
              <option value="REJEITADO">Rejeitados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Usuário
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Empresa
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Código
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Cadastro
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase w-24">
                  Gerenciar
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                    Carregando usuários...
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum usuário encontrado</p>
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((usuario) => {
                  const statusInfo = statusConfig[usuario.status] || statusConfig.PENDENTE;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                              {usuario.Url_foto_usuario ? (
                                <img
                                  src={usuario.Url_foto_usuario}
                                  alt={usuario.nome}
                                  className="w-10 h-10 object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-gray-500" />
                              )}
                            </div>
                            {/* Indicador apenas app móvel */}
                            {ehMonitor(usuario) && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white">
                                <Smartphone className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{usuario.nome}</p>
                            <p className="text-sm text-gray-500">{usuario.telefone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{getEmpresaNome(usuario)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {usuario.token_acesso ? (
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                              {usuario.token_acesso}
                            </code>
                            {usuario.token_validado && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-500">
                          {usuario.created_at
                            ? new Date(usuario.created_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </p>
                      </td>
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
