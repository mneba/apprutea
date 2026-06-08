'use client';

import { useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Tag,
  ArrowUpCircle,
  ArrowDownCircle,
  CircleDot,
  Building2,
  MapPin,
  Shield,
  X,
  Check,
  GripVertical,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { categoriasFinanceirasService } from '@/services/categoriasFinanceiras';
import type { CategoriaFinanceira, CategoriaFinanceiraInput, TipoMovimento } from '@/types/categoriasFinanceiras';

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function CategoriasFinanceirasPage() {
  const { profile, loading: loadingUser } = useUser();
  
  // Estados
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimento | ''>('');
  const [filtroAtivo, setFiltroAtivo] = useState<boolean | ''>('');
  const [busca, setBusca] = useState('');
  
  // Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<CategoriaFinanceira | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  // Form
  const [formCodigo, setFormCodigo] = useState('');
  const [formNomePt, setFormNomePt] = useState('');
  const [formNomeEs, setFormNomeEs] = useState('');
  const [formTipo, setFormTipo] = useState<TipoMovimento>('PAGAR');
  const [formAplicavelEmpresa, setFormAplicavelEmpresa] = useState(true);
  const [formAplicavelRota, setFormAplicavelRota] = useState(true);
  const [formAplicavelMicroseguro, setFormAplicavelMicroseguro] = useState(false);
  const [formOrdem, setFormOrdem] = useState(0);
  const [formCorHex, setFormCorHex] = useState('');
  const [formIcone, setFormIcone] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  
  // Permissões
  const isSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';

  // ============================================
  // CARREGAR DADOS
  // ============================================

  const carregarCategorias = async () => {
    setLoading(true);
    try {
      const data = await categoriasFinanceirasService.listar({
        tipo_movimento: filtroTipo || undefined,
        ativo: filtroAtivo === '' ? undefined : filtroAtivo,
        busca: busca || undefined,
      });
      setCategorias(data);
    } catch (err) {
      console.error('Erro ao carregar categorias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingUser) {
      carregarCategorias();
    }
  }, [loadingUser, filtroTipo, filtroAtivo]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!loadingUser) {
        carregarCategorias();
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [busca]);

  // ============================================
  // HANDLERS
  // ============================================

  const abrirModalNova = () => {
    setCategoriaEditando(null);
    setFormCodigo('');
    setFormNomePt('');
    setFormNomeEs('');
    setFormTipo('PAGAR');
    setFormAplicavelEmpresa(true);
    setFormAplicavelRota(true);
    setFormAplicavelMicroseguro(false);
    setFormOrdem(categorias.length + 1);
    setFormCorHex('');
    setFormIcone('');
    setFormDescricao('');
    setModalAberto(true);
  };

  const abrirModalEditar = (categoria: CategoriaFinanceira) => {
    setCategoriaEditando(categoria);
    setFormCodigo(categoria.codigo);
    setFormNomePt(categoria.nome_pt);
    setFormNomeEs(categoria.nome_es);
    setFormTipo(categoria.tipo_movimento);
    setFormAplicavelEmpresa(categoria.aplicavel_empresa);
    setFormAplicavelRota(categoria.aplicavel_rota);
    setFormAplicavelMicroseguro(categoria.aplicavel_microseguro);
    setFormOrdem(categoria.ordem_exibicao);
    setFormCorHex(categoria.cor_hex || '');
    setFormIcone(categoria.icone || '');
    setFormDescricao(categoria.descricao || '');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setCategoriaEditando(null);
  };

  const handleSalvar = async () => {
    if (!formCodigo.trim() || !formNomePt.trim() || !formNomeEs.trim()) {
      alert('Preencha os campos obrigatórios');
      return;
    }

    setSalvando(true);
    try {
      const dados: CategoriaFinanceiraInput = {
        codigo: formCodigo,
        nome_pt: formNomePt,
        nome_es: formNomeEs,
        tipo_movimento: formTipo,
        aplicavel_empresa: formAplicavelEmpresa,
        aplicavel_rota: formAplicavelRota,
        aplicavel_microseguro: formAplicavelMicroseguro,
        ordem_exibicao: formOrdem,
        cor_hex: formCorHex || null,
        icone: formIcone || null,
        descricao: formDescricao || null,
      };

      if (categoriaEditando) {
        await categoriasFinanceirasService.atualizar(categoriaEditando.id, dados);
      } else {
        await categoriasFinanceirasService.criar(dados);
      }

      fecharModal();
      carregarCategorias();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar categoria');
    } finally {
      setSalvando(false);
    }
  };

  const handleAlternarAtivo = async (categoria: CategoriaFinanceira) => {
    try {
      await categoriasFinanceirasService.alternarAtivo(categoria.id, !categoria.ativo);
      carregarCategorias();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar status');
    }
  };

  const handleExcluir = async (categoria: CategoriaFinanceira) => {
    if (!confirm(`Excluir categoria "${categoria.nome_pt}"?`)) return;

    try {
      await categoriasFinanceirasService.excluir(categoria.id);
      carregarCategorias();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir categoria');
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const getTipoLabel = (tipo: TipoMovimento) => {
    switch (tipo) {
      case 'RECEBER': return 'Receita';
      case 'PAGAR': return 'Despesa';
      case 'AMBOS': return 'Ambos';
    }
  };

  const getTipoColor = (tipo: TipoMovimento) => {
    switch (tipo) {
      case 'RECEBER': return 'bg-green-100 text-green-700';
      case 'PAGAR': return 'bg-red-100 text-red-700';
      case 'AMBOS': return 'bg-blue-100 text-blue-700';
    }
  };

  const getTipoIcon = (tipo: TipoMovimento) => {
    switch (tipo) {
      case 'RECEBER': return <ArrowDownCircle className="w-4 h-4" />;
      case 'PAGAR': return <ArrowUpCircle className="w-4 h-4" />;
      case 'AMBOS': return <CircleDot className="w-4 h-4" />;
    }
  };

  // ============================================
  // LOADING
  // ============================================

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorias Financeiras</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie as categorias de receitas e despesas do sistema
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={abrirModalNova}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Nova Categoria
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Busca */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código ou nome..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filtro Tipo */}
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as TipoMovimento | '')}
            className="px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Todos os tipos</option>
            <option value="RECEBER">Receitas</option>
            <option value="PAGAR">Despesas</option>
            <option value="AMBOS">Ambos</option>
          </select>

          {/* Filtro Status */}
          <select
            value={filtroAtivo === '' ? '' : filtroAtivo ? 'true' : 'false'}
            onChange={(e) => setFiltroAtivo(e.target.value === '' ? '' : e.target.value === 'true')}
            className="px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">Todos os status</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : categorias.length === 0 ? (
          <div className="text-center py-12">
            <Tag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma categoria encontrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Ordem
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Nome (PT)
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Nome (ES)
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Aplicável
                  </th>
                  <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  {isSuperAdmin && (
                    <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categorias.map((categoria) => (
                  <tr key={categoria.id} className={`hover:bg-gray-50 ${!categoria.ativo ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-300" />
                        {categoria.ordem_exibicao}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {categoria.codigo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {categoria.nome_pt}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {categoria.nome_es}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${getTipoColor(categoria.tipo_movimento)}`}>
                        {getTipoIcon(categoria.tipo_movimento)}
                        {getTipoLabel(categoria.tipo_movimento)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {categoria.aplicavel_empresa && (
                          <span title="Empresa" className="p-1 bg-blue-100 rounded">
                            <Building2 className="w-4 h-4 text-blue-600" />
                          </span>
                        )}
                        {categoria.aplicavel_rota && (
                          <span title="Rota" className="p-1 bg-green-100 rounded">
                            <MapPin className="w-4 h-4 text-green-600" />
                          </span>
                        )}
                        {categoria.aplicavel_microseguro && (
                          <span title="Microseguro" className="p-1 bg-purple-100 rounded">
                            <Shield className="w-4 h-4 text-purple-600" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isSuperAdmin ? (
                        <button
                          onClick={() => handleAlternarAtivo(categoria)}
                          className="inline-flex items-center"
                          title={categoria.ativo ? 'Desativar' : 'Ativar'}
                        >
                          {categoria.ativo ? (
                            <ToggleRight className="w-8 h-8 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-gray-400" />
                          )}
                        </button>
                      ) : (
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          categoria.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {categoria.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      )}
                    </td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => abrirModalEditar(categoria)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleExcluir(categoria)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {categoriaEditando ? 'Editar Categoria' : 'Nova Categoria'}
              </h2>
              <button
                onClick={fecharModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Código */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formCodigo}
                  onChange={(e) => setFormCodigo(e.target.value.toUpperCase())}
                  placeholder="EX: GASOLINA"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
              </div>

              {/* Nomes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nome (PT) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formNomePt}
                    onChange={(e) => setFormNomePt(e.target.value)}
                    placeholder="Gasolina"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Nome (ES) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formNomeEs}
                    onChange={(e) => setFormNomeEs(e.target.value)}
                    placeholder="Gasolina"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tipo de Movimento <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                  {(['PAGAR', 'RECEBER', 'AMBOS'] as TipoMovimento[]).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setFormTipo(tipo)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-colors ${
                        formTipo === tipo
                          ? tipo === 'PAGAR' 
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : tipo === 'RECEBER'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {getTipoIcon(tipo)}
                      {getTipoLabel(tipo)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aplicável */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aplicável em
                </label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAplicavelEmpresa}
                      onChange={(e) => setFormAplicavelEmpresa(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">Empresa</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAplicavelRota}
                      onChange={(e) => setFormAplicavelRota(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700">Rota</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAplicavelMicroseguro}
                      onChange={(e) => setFormAplicavelMicroseguro(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <Shield className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-gray-700">Microseguro</span>
                  </label>
                </div>
              </div>

              {/* Ordem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Ordem de Exibição
                </label>
                <input
                  type="number"
                  value={formOrdem}
                  onChange={(e) => setFormOrdem(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Descrição
                </label>
                <textarea
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  placeholder="Descrição opcional..."
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={fecharModal}
                className="px-4 py-2.5 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {salvando ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                {categoriaEditando ? 'Salvar Alterações' : 'Criar Categoria'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}