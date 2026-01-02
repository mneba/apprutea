'use client';

import { useState, useEffect } from 'react';
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
  Filter
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { usuariosService } from '@/services/usuarios';
import { ModalPermissoes } from '@/components/usuarios/ModalPermissoes';
import { ModalGerarCodigo } from '@/components/usuarios/ModalGerarCodigo';
import type { UserProfile } from '@/types/database';

const statusConfig = {
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
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UserProfile | null>(null);
  const [modalPermissoes, setModalPermissoes] = useState(false);
  const [modalCodigo, setModalCodigo] = useState(false);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  // Carregar usuários
  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    setLoading(true);
    try {
      const data = await usuariosService.listarUsuarios();
      setUsuarios(data);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar usuários
  const usuariosFiltrados = usuarios.filter(usuario => {
    const matchSearch = usuario.nome.toLowerCase().includes(search.toLowerCase()) ||
                       usuario.telefone?.toLowerCase().includes(search.toLowerCase()) ||
                       usuario.empresa_pretendida?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || usuario.status === filtroStatus;
    const matchTipo = filtroTipo === 'todos' || usuario.tipo_usuario === filtroTipo;
    return matchSearch && matchStatus && matchTipo;
  });

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários e Permissões</h1>
          <p className="text-gray-500 mt-1">Gerencie os usuários e suas permissões no sistema</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />}>
          Novo Usuário
        </Button>
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
                {usuarios.filter(u => u.status === 'APROVADO').length}
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
                {usuarios.filter(u => u.status === 'PENDENTE').length}
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
                {usuarios.filter(u => u.tipo_usuario === 'SUPER_ADMIN' || u.tipo_usuario === 'ADMIN').length}
              </p>
              <p className="text-sm text-gray-500">Administradores</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome, telefone ou empresa..."
              icon={<Search className="w-5 h-5" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
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
              <option value="VENDEDOR">Vendedor</option>
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
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      Carregando usuários...
                    </div>
                  </td>
                </tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((usuario) => {
                  const statusInfo = statusConfig[usuario.status];
                  const tipoInfo = tipoUsuarioConfig[usuario.tipo_usuario] || tipoUsuarioConfig.USUARIO_PADRAO;
                  const StatusIcon = statusInfo?.icon || Clock;

                  return (
                    <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            {usuario.url_foto_usuario ? (
                              <img 
                                src={usuario.url_foto_usuario} 
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
                        <p className="text-gray-700">{usuario.empresa_pretendida || '-'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tipoInfo.color}`}>
                          {tipoInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo?.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo?.label}
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
                          {usuario.created_at ? new Date(usuario.created_at).toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative">
                          <button
                            onClick={() => setMenuAberto(menuAberto === usuario.id ? null : usuario.id)}
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
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
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
                                  onClick={() => setMenuAberto(null)}
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

      {/* Modal de Permissões */}
      {modalPermissoes && usuarioSelecionado && (
        <ModalPermissoes
          usuario={usuarioSelecionado}
          onClose={() => {
            setModalPermissoes(false);
            setUsuarioSelecionado(null);
          }}
          onSave={() => {
            carregarUsuarios();
            setModalPermissoes(false);
            setUsuarioSelecionado(null);
          }}
        />
      )}

      {/* Modal de Gerar Código */}
      {modalCodigo && usuarioSelecionado && (
        <ModalGerarCodigo
          usuario={usuarioSelecionado}
          onClose={() => {
            setModalCodigo(false);
            setUsuarioSelecionado(null);
          }}
          onSave={() => {
            carregarUsuarios();
            setModalCodigo(false);
            setUsuarioSelecionado(null);
          }}
        />
      )}
    </div>
  );
}
