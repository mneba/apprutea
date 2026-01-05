'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Users,
  CreditCard,
  Plus,
  Loader2,
  ChevronLeft,
  User,
  AlertTriangle,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { organizacaoService } from '@/services/organizacao';
import type { EmpresaResumo, RotaResumo, ResumoGeral } from '@/types/organizacao';

type ViewMode = 'empresas' | 'rotas';

export default function OrganizacaoPage() {
  const { profile, localizacao, loading: loadingUser } = useUser();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('empresas');
  const [resumoGeral, setResumoGeral] = useState<ResumoGeral>({
    total_empresas: 0,
    total_rotas_ativas: 0,
    total_clientes: 0,
    total_emprestimos_ativos: 0,
  });
  const [empresas, setEmpresas] = useState<EmpresaResumo[]>([]);
  const [rotas, setRotas] = useState<RotaResumo[]>([]);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<EmpresaResumo | null>(null);
  
  // Modal de nova rota
  const [modalNovaRota, setModalNovaRota] = useState(false);
  const [nomeNovaRota, setNomeNovaRota] = useState('');
  const [empresaParaNovaRota, setEmpresaParaNovaRota] = useState<string | null>(null);
  const [salvandoRota, setSalvandoRota] = useState(false);

  // Verificações
  const isSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';
  const hierarquiaId = localizacao?.hierarquia_id;
  const empresaUnica = localizacao?.empresa_id;

  // Carregar dados iniciais
  useEffect(() => {
    if (!loadingUser && profile) {
      carregarDados();
    }
  }, [loadingUser, profile, localizacao]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // Buscar resumo geral
      const resumo = await organizacaoService.buscarResumoGeral(hierarquiaId || undefined);
      setResumoGeral(resumo);

      // Se não é super admin e tem empresa única, ir direto para rotas
      if (!isSuperAdmin && empresaUnica) {
        const rotasData = await organizacaoService.listarRotasPorEmpresa(empresaUnica);
        setRotas(rotasData);
        setEmpresaSelecionada({
          id: empresaUnica,
          nome: localizacao?.empresa?.nome || 'Empresa',
          total_rotas: rotasData.length,
          total_clientes: 0,
          total_emprestimos: 0,
        });
        setViewMode('rotas');
      } else if (hierarquiaId) {
        // Super admin ou usuário com múltiplas empresas
        const empresasData = await organizacaoService.listarEmpresasPorHierarquia(hierarquiaId);
        setEmpresas(empresasData);
        setViewMode('empresas');
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  // Selecionar empresa e ver rotas
  const handleSelecionarEmpresa = async (empresa: EmpresaResumo) => {
    setLoading(true);
    try {
      const rotasData = await organizacaoService.listarRotasPorEmpresa(empresa.id);
      setRotas(rotasData);
      setEmpresaSelecionada(empresa);
      setViewMode('rotas');
    } catch (err) {
      console.error('Erro ao carregar rotas:', err);
    } finally {
      setLoading(false);
    }
  };

  // Voltar para empresas
  const handleVoltar = () => {
    setViewMode('empresas');
    setEmpresaSelecionada(null);
    setRotas([]);
  };

  // Abrir modal de nova rota
  const handleAbrirModalNovaRota = (empresaId: string) => {
    setEmpresaParaNovaRota(empresaId);
    setNomeNovaRota('');
    setModalNovaRota(true);
  };

  // Criar nova rota
  const handleCriarRota = async () => {
    if (!nomeNovaRota.trim() || !empresaParaNovaRota) {
      alert('Digite o nome da rota');
      return;
    }

    setSalvandoRota(true);
    try {
      await organizacaoService.criarRota(empresaParaNovaRota, nomeNovaRota.trim());
      setModalNovaRota(false);
      setNomeNovaRota('');
      
      // Recarregar dados
      if (viewMode === 'rotas' && empresaSelecionada) {
        const rotasData = await organizacaoService.listarRotasPorEmpresa(empresaSelecionada.id);
        setRotas(rotasData);
      } else {
        carregarDados();
      }
    } catch (err: any) {
      console.error('Erro ao criar rota:', err);
      alert(`Erro ao criar rota: ${err.message}`);
    } finally {
      setSalvandoRota(false);
    }
  };

  // Loading
  if (loadingUser || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  // Sem hierarquia selecionada
  if (!hierarquiaId && !empresaUnica) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mb-6">
          <AlertTriangle className="w-10 h-10 text-yellow-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Selecione uma Localização
        </h2>
        <p className="text-gray-500 max-w-md">
          Use o seletor de localização no topo da página para visualizar as empresas e rotas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organização</h1>
          {localizacao && (
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {localizacao.pais} &gt; {localizacao.estado}
              {empresaSelecionada && ` > ${empresaSelecionada.nome}`}
            </p>
          )}
        </div>
        
        {viewMode === 'empresas' && isSuperAdmin && (
          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Adicionar
          </button>
        )}
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Total de Empresas</span>
            <Building2 className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{resumoGeral.total_empresas}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Rotas Ativas</span>
            <MapPin className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{resumoGeral.total_rotas_ativas}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Total de Clientes</span>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{resumoGeral.total_clientes}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Empréstimos Ativos</span>
            <CreditCard className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{resumoGeral.total_emprestimos_ativos}</p>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {viewMode === 'empresas' ? (
        <>
          {/* Título Empresas */}
          <h2 className="text-lg font-semibold text-gray-900">Empresas</h2>

          {/* Grid de Empresas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {empresas.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhuma empresa encontrada</p>
              </div>
            ) : (
              empresas.map((empresa) => (
                <div
                  key={empresa.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  {/* Nome da Empresa - Clicável */}
                  <button
                    onClick={() => handleSelecionarEmpresa(empresa)}
                    className="text-left w-full"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                      {empresa.nome}
                    </h3>
                  </button>

                  {/* Estatísticas */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Rotas</span>
                      <span className="font-medium text-blue-600">{empresa.total_rotas}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Clientes</span>
                      <span className="font-medium text-gray-900">{empresa.total_clientes}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Empréstimos</span>
                      <span className="font-medium text-gray-900">{empresa.total_emprestimos}</span>
                    </div>
                  </div>

                  {/* Botão Adicionar Rota */}
                  <button
                    onClick={() => handleAbrirModalNovaRota(empresa.id)}
                    className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar nova Rota
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* Botão Voltar + Título */}
          <div>
            {isSuperAdmin && (
              <button
                onClick={handleVoltar}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Voltar
              </button>
            )}
            <h2 className="text-lg font-semibold text-gray-900">
              {empresaSelecionada?.nome}, Rotas
            </h2>
          </div>

          {/* Grid de Rotas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rotas.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhuma rota cadastrada</p>
                <button
                  onClick={() => empresaSelecionada && handleAbrirModalNovaRota(empresaSelecionada.id)}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Criar primeira rota
                </button>
              </div>
            ) : (
              rotas.map((rota) => (
                <div
                  key={rota.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  {/* Header da Rota */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{rota.nome}</h3>
                      <p className="text-sm text-gray-500">
                        Vendedor: {rota.vendedor_nome || <span className="italic">Não atribuído</span>}
                      </p>
                    </div>
                  </div>

                  {/* Estatísticas */}
                  <div className="mt-4 flex items-center gap-6">
                    <div className="flex flex-col items-center">
                      <Users className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-lg font-semibold text-gray-900">{rota.total_clientes}</span>
                      <span className="text-xs text-gray-500">Clientes</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <CreditCard className="w-5 h-5 text-gray-400 mb-1" />
                      <span className="text-lg font-semibold text-gray-900">{rota.total_emprestimos}</span>
                      <span className="text-xs text-gray-500">Empréstimos</span>
                    </div>
                  </div>

                  {/* Botão Clientes */}
                  <button
                    className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    Clientes
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Botão adicionar rota (quando já tem rotas) */}
          {rotas.length > 0 && empresaSelecionada && (
            <div className="flex justify-center">
              <button
                onClick={() => handleAbrirModalNovaRota(empresaSelecionada.id)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar nova Rota
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Nova Rota */}
      {modalNovaRota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalNovaRota(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nova Rota</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nome da Rota *
              </label>
              <input
                type="text"
                value={nomeNovaRota}
                onChange={(e) => setNomeNovaRota(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Rota Centro Norte"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setModalNovaRota(false)}
                className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriarRota}
                disabled={salvandoRota || !nomeNovaRota.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {salvandoRota && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar Rota
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
