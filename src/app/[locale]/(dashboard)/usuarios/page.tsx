'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  User,
  Building2,
  Loader2,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { usuariosService } from '@/services/usuarios';
import { useUser } from '@/contexts/UserContext';
import { ModalPermissoes } from '@/components/usuarios/ModalPermissoes';
import { ModalGerarCodigo } from '@/components/usuarios/ModalGerarCodigo';
import { ModalEditarUsuario } from '@/components/usuarios/ModalEditarUsuario';
import type { UserProfile, Empresa } from '@/types/database';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  APROVADO: { label: 'Aprovado', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  PENDENTE: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  REJEITADO: { label: 'Rejeitado', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const tipoUsuarioConfig: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-purple-100 text-purple-700' },
  ADMIN: { label: 'Admin', color: 'bg-blue-100 text-blue-700' },
  MONITOR: { label: 'Monitor', color: 'bg-cyan-100 text-cyan-700' },
  USUARIO_PADRAO: { label: 'Usuário Padrão', color: 'bg-gray-100 text-gray-700' },
  VENDEDOR: { label: 'Vendedor', color: 'bg-orange-100 text-orange-700' },
};

export default function UsuariosPage() {
  const { profile, isSuperAdmin, localizacao, loading: loadingUser } = useUser();
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('todos');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UserProfile | null>(null);
  const [modalPermissoes, setModalPermissoes] = useState(false);
  const [modalCodigo, setModalCodigo] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Debug - ver o que está acontecendo
  useEffect(() => {
    console.log('🔍 Debug UsuariosPage:', {
      loadingUser,
      profile: profile?.nome,
      tipo_usuario: profile?.tipo_usuario,
      isSuperAdmin,
      localizacao_empresa: localizacao.empresa_id,
    });
  }, [loadingUser, profile, isSuperAdmin, localizacao]);

  // Carregar usuários e empresas - AGUARDAR perfil carregar
  useEffect(() => {
    // Só carregar quando o perfil do usuário estiver pronto
    if (!loadingUser && profile) {
      carregarDados();
    }
  }, [loadingUser, profile]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      console.log('📥 Carregando usuários...', { 
        isSuperAdmin, 
        tipo_usuario: profile?.tipo_usuario,
        empresaId: localizacao.empresa_id 
      });
      
      // SUPER_ADMIN sempre vê todos os usuários (isSuperAdmin = true, empresaId = undefined)
      // Outros usuários veem apenas da sua empresa
      const filtroIsSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';
      
      const usuariosData = await usuariosService.listarUsuarios({
        isSuperAdmin: filtroIsSuperAdmin,
        empresaId: filtroIsSuperAdmin ? undefined : (localizacao.empresa_id || undefined),
      });
      
      console.log('✅ Usuários carregados:', usuariosData.length);
      setUsuarios(usuariosData);

      // Carregar todas as empresas para o filtro e para mostrar na tabela
      const empresasData = await usuariosService.listarEmpresas();
      setEmpresas(empresasData);
      
    } catch (err) {
      console.error('❌ Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  // Obter nome da empresa do usuário
  const getEmpresaNome = (usuario: UserProfile) => {
    if (!usuario.empresas_ids || usuario.empresas_ids.length === 0) {
      return usuario.empresa_pretendida || '-';
    }
    const empresaId = usuario.empresas_ids[0];
    const empresa = empresas.find((e) => e.id === empresaId);
    return empresa?.nome || usuario.empresa_pretendida || '-';
  };

  // Filtrar usuários
  const usuariosFiltrados = usuarios.filter((usuario) => {
    const matchSearch =
      usuario.nome?.toLowerCase().includes(search.toLowerCase()) ||
      usuario.telefone?.toLowerCase().includes(search.toLowerCase()) ||
      usuario.empresa_pretendida?.toLowerCase().includes(search.toLowerCase());

    const matchStatus = filtroStatus === 'todos' || usuario.status === filtroStatus;
    const matchTipo = filtroTipo === 'todos' || usuario.tipo_usuario === filtroTipo;

    // Filtro por empresa (apenas se selecionado)
    const matchEmpresa =
      filtroEmpresa === 'todos' ||
      (usuario.empresas_ids && usuario.empresas_ids.includes(filtroEmpresa)) ||
      (!usuario.empresas_ids?.length && filtroEmpresa === 'sem_empresa');

    return matchSearch && matchStatus && matchTipo && matchEmpresa;
  });

  // Abrir menu de ações com posicionamento inteligente
  const handleAbrirMenu = (usuarioId: string, event: React.MouseEvent) => {
    setMenuAberto(menuAberto === usuarioId ? null : usuarioId);
  };

  const handleGerarCodigo = (usuario: UserProfile) => {
    setUsuarioSelecionado(usuario);
    setModalCodigo(true);
    setMenuAberto(null);
  };

  const handleEditarPermissoes = (usuario: UserProfile) => {
    setUsuarioSelecionado(usuario);
    setModalPermissoes(true);
    setMenuAberto(null);
  };

  const handleEditar = (usuario: UserProfile) => {
    setUsuarioSelecionado(usuario);
    setModalEditar(true);
    setMenuAberto(null);
  };

  // Se ainda está carregando o usuário do contexto, mostrar loading
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

  // Verificar se é SUPER_ADMIN diretamente do profile
  const ehSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários e Permissões</h1>
          <p className="text-gray-500 mt-1">
            {ehSuperAdmin 
              ? '👑 Visualizando todos os usuários do sistema' 
              : 'Gerencie os usuários da sua empresa'}
          </p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />}>Novo Usuário</Button>
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
              <p className="text-sm text-gray-500">Total de Usuários</p>
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
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {usuarios.filter((u) => u.tipo_usuario === 'SUPER_ADMIN' || u.tipo_usuario === 'ADMIN').length}
              </p>
              <p className="text-sm text-gray-500">Administradores</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
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
            {/* Filtro de Empresa - SUPER_ADMIN sempre vê este filtro */}
            {ehSuperAdmin && (
              <select
                className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
              >
                <option value="todos">Todas as Empresas</option>
                <option value="sem_empresa">Sem Empresa Vinculada</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </option>
                ))}
              </select>
            )}

            <select
              className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todos">Todos os Status</option>
              <option value="APROVADO">Aprovados</option>
              <option value="PENDENTE">Pendentes</option>
              <option value="REJEITADO">Rejeitados</option>
            </select>

            <select
              className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="todos">Todos os Tipos</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="MONITOR">Monitor</option>
              <option value="USUARIO_PADRAO">Usuário Padrão</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Empresa
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Cadastro
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                      Carregando usuários...
                    </div>
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum usuário encontrado</p>
                    {!ehSuperAdmin && !localizacao.empresa_id && (
                      <p className="text-sm mt-2">Selecione uma empresa na localização</p>
                    )}
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((usuario, index) => {
                  const statusInfo = statusConfig[usuario.status] || statusConfig.PENDENTE;
                  const tipoInfo = tipoUsuarioConfig[usuario.tipo_usuario] || tipoUsuarioConfig.USUARIO_PADRAO;
                  const StatusIcon = statusInfo.icon;
                  const isLastRows = index >= usuariosFiltrados.length - 2;

                  return (
                    <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {usuario.Url_foto_usuario ? (
                              <img
                                src={usuario.Url_foto_usuario}
                                alt={usuario.nome}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-gray-500" />
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
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tipoInfo.color}`}>
                          {tipoInfo.label}
                        </span>
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
                          <span className="text-gray-400 text-sm">Não gerado</span>
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
                        <div className="relative" ref={menuAberto === usuario.id ? menuRef : null}>
                          <button
                            onClick={(e) => handleAbrirMenu(usuario.id, e)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-5 h-5 text-gray-400" />
                          </button>

                          {menuAberto === usuario.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuAberto(null)}
                              />
                              <div
                                className={`absolute right-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 ${
                                  isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'
                                }`}
                              >
                                <button
                                  onClick={() => handleGerarCodigo(usuario)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Key className="w-4 h-4" />
                                  {usuario.token_acesso ? 'Regenerar Código' : 'Gerar Código'}
                                </button>
                                <button
                                  onClick={() => handleEditarPermissoes(usuario)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Shield className="w-4 h-4" />
                                  Permissões
                                </button>
                                <button
                                  onClick={() => handleEditar(usuario)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <Edit className="w-4 h-4" />
                                  Editar
                                </button>
                                <hr className="my-1" />
                                <button
                                  onClick={() => setMenuAberto(null)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Excluir
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais */}
      {modalPermissoes && usuarioSelecionado && (
        <ModalPermissoes
          usuario={usuarioSelecionado}
          onClose={() => {
            setModalPermissoes(false);
            setUsuarioSelecionado(null);
          }}
          onSave={() => {
            carregarDados();
            setModalPermissoes(false);
            setUsuarioSelecionado(null);
          }}
        />
      )}

      {modalCodigo && usuarioSelecionado && (
        <ModalGerarCodigo
          usuario={usuarioSelecionado}
          onClose={() => {
            setModalCodigo(false);
            setUsuarioSelecionado(null);
          }}
          onSave={() => {
            carregarDados();
            setModalCodigo(false);
            setUsuarioSelecionado(null);
          }}
        />
      )}

      {modalEditar && usuarioSelecionado && (
        <ModalEditarUsuario
          usuario={usuarioSelecionado}
          onClose={() => {
            setModalEditar(false);
            setUsuarioSelecionado(null);
          }}
          onSave={() => {
            carregarDados();
            setModalEditar(false);
            setUsuarioSelecionado(null);
          }}
        />
      )}
    </div>
  );
}
