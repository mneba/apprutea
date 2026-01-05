'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  CheckCircle,
  XCircle,
  User,
  Loader2,
  Phone,
  Calendar,
  Key,
  AlertTriangle,
  Building2,
  Settings,
} from 'lucide-react';
import { Input } from '@/components/ui';
import { vendedoresService } from '@/services/vendedores';
import { useUser } from '@/contexts/UserContext';
import { ModalVendedor } from '@/components/vendedores';
import type { Vendedor } from '@/types/vendedores';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  ATIVO: { label: 'Ativo', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  INATIVO: { label: 'Inativo', color: 'bg-gray-100 text-gray-700', icon: XCircle },
};

export default function VendedoresPage() {
  const { profile, localizacao, loading: loadingUser } = useUser();
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  
  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [vendedorSelecionado, setVendedorSelecionado] = useState<Vendedor | null>(null);

  // Verificar se tem empresa selecionada
  const empresaSelecionada = localizacao?.empresa_id;
  const empresaNome = localizacao?.empresa?.nome;

  // Carregar dados
  useEffect(() => {
    if (!loadingUser && profile && empresaSelecionada) {
      carregarDados();
    } else if (!loadingUser && !empresaSelecionada) {
      setLoading(false);
      setVendedores([]);
    }
  }, [loadingUser, profile, empresaSelecionada]);

  const carregarDados = async () => {
    if (!empresaSelecionada) return;
    
    setLoading(true);
    try {
      const data = await vendedoresService.listarVendedores(empresaSelecionada);
      setVendedores(data);
    } catch (err) {
      console.error('Erro ao carregar vendedores:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar vendedores
  const vendedoresFiltrados = vendedores.filter((vendedor) => {
    const matchSearch =
      vendedor.nome?.toLowerCase().includes(search.toLowerCase()) ||
      vendedor.codigo_vendedor?.toLowerCase().includes(search.toLowerCase()) ||
      vendedor.telefone?.toLowerCase().includes(search.toLowerCase()) ||
      vendedor.documento?.toLowerCase().includes(search.toLowerCase());

    const matchStatus = filtroStatus === 'todos' || vendedor.status === filtroStatus;

    return matchSearch && matchStatus;
  });

  // Abrir modal para novo vendedor
  const handleNovoVendedor = () => {
    setVendedorSelecionado(null);
    setModalAberto(true);
  };

  // Abrir modal para gerenciar vendedor
  const handleGerenciarVendedor = (vendedor: Vendedor) => {
    setVendedorSelecionado(vendedor);
    setModalAberto(true);
  };

  // Fechar modal
  const handleFecharModal = () => {
    setModalAberto(false);
    setVendedorSelecionado(null);
  };

  // Após salvar
  const handleSalvar = () => {
    carregarDados();
    handleFecharModal();
  };

  // Se carregando usuário
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

  // Se não tem empresa selecionada
  if (!empresaSelecionada) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-yellow-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Selecione uma Empresa
        </h2>
        <p className="text-gray-500 max-w-md mb-6">
          Para cadastrar e gerenciar vendedores, é necessário primeiro selecionar uma empresa no seletor de localização acima.
        </p>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Building2 className="w-4 h-4" />
          <span>Use o seletor no topo da página</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendedores</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {empresaNome || 'Empresa selecionada'}
          </p>
        </div>
        <button
          onClick={handleNovoVendedor}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          Novo Vendedor
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{vendedores.length}</p>
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
                {vendedores.filter((v) => v.status === 'ATIVO').length}
              </p>
              <p className="text-sm text-gray-500">Ativos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {vendedores.filter((v) => v.status === 'INATIVO').length}
              </p>
              <p className="text-sm text-gray-500">Inativos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <Key className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {vendedores.filter((v) => v.codigo_acesso).length}
              </p>
              <p className="text-sm text-gray-500">Com Código</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome, código, telefone ou documento..."
              icon={<Search className="w-5 h-5" />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              className="px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-blue-500"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todos">Todos os Status</option>
              <option value="ATIVO">Ativos</option>
              <option value="INATIVO">Inativos</option>
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
                  Vendedor
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Código
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Contato
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Código Acesso
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                  Cadastro
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase w-32">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                    Carregando vendedores...
                  </td>
                </tr>
              ) : vendedoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <User className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum vendedor encontrado</p>
                    <button
                      onClick={handleNovoVendedor}
                      className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Cadastrar primeiro vendedor
                    </button>
                  </td>
                </tr>
              ) : (
                vendedoresFiltrados.map((vendedor) => {
                  const statusInfo = statusConfig[vendedor.status] || statusConfig.ATIVO;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <tr key={vendedor.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden">
                            {vendedor.foto_url ? (
                              <img
                                src={vendedor.foto_url}
                                alt={vendedor.nome}
                                className="w-10 h-10 object-cover"
                              />
                            ) : (
                              <span className="text-white font-semibold text-sm">
                                {vendedor.nome?.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {vendedor.nome} {vendedor.apellidos}
                            </p>
                            <p className="text-sm text-gray-500">{vendedor.documento}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                          {vendedor.codigo_vendedor}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {vendedor.telefone && (
                            <div className="flex items-center gap-1.5 text-sm text-gray-600">
                              <Phone className="w-3.5 h-3.5" />
                              {vendedor.telefone}
                            </div>
                          )}
                          {vendedor.email && (
                            <p className="text-sm text-gray-500 truncate max-w-[200px]">
                              {vendedor.email}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {vendedor.codigo_acesso ? (
                          <code className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-mono">
                            {vendedor.codigo_acesso}
                          </code>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Calendar className="w-3.5 h-3.5" />
                          {vendedor.created_at
                            ? new Date(vendedor.created_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleGerenciarVendedor(vendedor)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
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
      {modalAberto && (
        <ModalVendedor
          vendedor={vendedorSelecionado}
          empresaId={empresaSelecionada}
          onClose={handleFecharModal}
          onSave={handleSalvar}
        />
      )}
    </div>
  );
}
