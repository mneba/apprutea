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
  AlertTriangle,
  X,
  UserCheck,
  Percent,
  Trash2,
  Edit,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { organizacaoService } from '@/services/organizacao';
import type { EmpresaResumo, RotaResumo, ResumoGeral, VendedorDisponivel, Socio } from '@/types/organizacao';

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
  
  // Modal de nova/editar rota
  const [modalRota, setModalRota] = useState(false);
  const [nomeRota, setNomeRota] = useState('');
  const [descricaoRota, setDescricaoRota] = useState('');
  const [vendedorRotaId, setVendedorRotaId] = useState('');
  const [vendedoresDisponiveis, setVendedoresDisponiveis] = useState<VendedorDisponivel[]>([]);
  const [empresaParaRota, setEmpresaParaRota] = useState<EmpresaResumo | null>(null);
  const [salvandoRota, setSalvandoRota] = useState(false);

  // Modal de nova/editar empresa
  const [modalEmpresa, setModalEmpresa] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<EmpresaResumo | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [cnpjEmpresa, setCnpjEmpresa] = useState('');
  const [telefoneEmpresa, setTelefoneEmpresa] = useState('');
  const [emailEmpresa, setEmailEmpresa] = useState('');
  const [enderecoEmpresa, setEnderecoEmpresa] = useState('');
  const [sociosEmpresa, setSociosEmpresa] = useState<Socio[]>([]);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);

  // Novo sócio inline
  const [novoSocioNome, setNovoSocioNome] = useState('');
  const [novoSocioDocumento, setNovoSocioDocumento] = useState('');
  const [novoSocioPercentual, setNovoSocioPercentual] = useState('');

  // Verificações
  const isSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';
  const hierarquiaId = localizacao?.hierarquia_id;
  const empresaIdSelecionada = localizacao?.empresa_id;
  const rotaIdSelecionada = localizacao?.rota_id;

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

      // Se tem empresa selecionada no seletor master → ir para rotas
      if (empresaIdSelecionada) {
        const empresa = await organizacaoService.buscarEmpresa(empresaIdSelecionada);
        if (empresa) {
          setEmpresaSelecionada(empresa);
          const rotasData = await organizacaoService.listarRotasPorEmpresa(empresaIdSelecionada);
          setRotas(rotasData);
          setViewMode('rotas');
        }
      } else if (hierarquiaId) {
        // Sem empresa selecionada → mostrar lista de empresas
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

  // Selecionar empresa e ver rotas (clicando no card)
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

  // ============================================
  // MODAL DE ROTA
  // ============================================

  const handleAbrirModalNovaRota = async (empresa: EmpresaResumo) => {
    setEmpresaParaRota(empresa);
    setNomeRota('');
    setDescricaoRota('');
    setVendedorRotaId('');
    
    // Carregar vendedores disponíveis
    const vendedores = await organizacaoService.buscarVendedoresDisponiveis(empresa.id);
    setVendedoresDisponiveis(vendedores);
    
    setModalRota(true);
  };

  const handleCriarRota = async () => {
    if (!nomeRota.trim() || !empresaParaRota) {
      alert('Digite o nome da rota');
      return;
    }

    setSalvandoRota(true);
    try {
      await organizacaoService.criarRota(empresaParaRota.id, {
        nome: nomeRota.trim(),
        descricao: descricaoRota.trim() || undefined,
        vendedor_id: vendedorRotaId || undefined,
      });
      setModalRota(false);
      
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

  // ============================================
  // MODAL DE EMPRESA
  // ============================================

  const handleAbrirModalNovaEmpresa = () => {
    setEmpresaEditando(null);
    setNomeEmpresa('');
    setCnpjEmpresa('');
    setTelefoneEmpresa('');
    setEmailEmpresa('');
    setEnderecoEmpresa('');
    setSociosEmpresa([]);
    setModalEmpresa(true);
  };

  const handleAbrirModalEditarEmpresa = async (empresa: EmpresaResumo) => {
    setEmpresaEditando(empresa);
    setNomeEmpresa(empresa.nome);
    setCnpjEmpresa(empresa.cnpj || '');
    setTelefoneEmpresa(empresa.telefone || '');
    setEmailEmpresa(empresa.email || '');
    setEnderecoEmpresa(empresa.endereco || '');
    
    // Carregar sócios
    const socios = await organizacaoService.listarSocios(empresa.id);
    setSociosEmpresa(socios);
    
    setModalEmpresa(true);
  };

  const handleAdicionarSocio = () => {
    if (!novoSocioNome.trim() || !novoSocioDocumento.trim() || !novoSocioPercentual) {
      alert('Preencha nome, documento e percentual do sócio');
      return;
    }

    const percentual = parseFloat(novoSocioPercentual);
    if (isNaN(percentual) || percentual <= 0 || percentual > 100) {
      alert('Percentual deve ser entre 0 e 100');
      return;
    }

    // Verificar se soma não passa de 100%
    const somaAtual = sociosEmpresa.reduce((acc, s) => acc + s.percentual_participacao, 0);
    if (somaAtual + percentual > 100) {
      alert(`A soma dos percentuais não pode ultrapassar 100%. Disponível: ${(100 - somaAtual).toFixed(2)}%`);
      return;
    }

    const novoSocio: Socio = {
      empresa_id: empresaEditando?.id || '',
      nome: novoSocioNome.trim(),
      documento: novoSocioDocumento.trim(),
      percentual_participacao: percentual,
      status: 'ATIVO',
    };

    setSociosEmpresa([...sociosEmpresa, novoSocio]);
    setNovoSocioNome('');
    setNovoSocioDocumento('');
    setNovoSocioPercentual('');
  };

  const handleRemoverSocio = (index: number) => {
    const novosSocios = [...sociosEmpresa];
    novosSocios.splice(index, 1);
    setSociosEmpresa(novosSocios);
  };

  const handleSalvarEmpresa = async () => {
    if (!nomeEmpresa.trim()) {
      alert('Nome da empresa é obrigatório');
      return;
    }

    if (!hierarquiaId) {
      alert('Selecione uma localização no seletor acima');
      return;
    }

    setSalvandoEmpresa(true);
    try {
      if (empresaEditando) {
        // Atualizar empresa
        await organizacaoService.atualizarEmpresa(empresaEditando.id, {
          nome: nomeEmpresa.trim(),
          cnpj: cnpjEmpresa.trim() || undefined,
          telefone: telefoneEmpresa.trim() || undefined,
          email: emailEmpresa.trim() || undefined,
          endereco: enderecoEmpresa.trim() || undefined,
        });

        // Salvar sócios
        for (const socio of sociosEmpresa) {
          if (!socio.id) {
            // Novo sócio
            await organizacaoService.salvarSocio({
              ...socio,
              empresa_id: empresaEditando.id,
            });
          }
        }
      } else {
        // Criar empresa
        const novaEmpresa = await organizacaoService.criarEmpresa({
          nome: nomeEmpresa.trim(),
          hierarquia_id: hierarquiaId,
          cnpj: cnpjEmpresa.trim() || undefined,
          telefone: telefoneEmpresa.trim() || undefined,
          email: emailEmpresa.trim() || undefined,
          endereco: enderecoEmpresa.trim() || undefined,
        });

        // Salvar sócios
        for (const socio of sociosEmpresa) {
          await organizacaoService.salvarSocio({
            ...socio,
            empresa_id: novaEmpresa.id,
          });
        }
      }

      setModalEmpresa(false);
      carregarDados();
    } catch (err: any) {
      console.error('Erro ao salvar empresa:', err);
      alert(`Erro ao salvar empresa: ${err.message}`);
    } finally {
      setSalvandoEmpresa(false);
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
  if (!hierarquiaId && !empresaIdSelecionada) {
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

  // Calcular soma de percentuais dos sócios
  const somaPercentuais = sociosEmpresa.reduce((acc, s) => acc + s.percentual_participacao, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organização</h1>
          {(localizacao?.empresa || empresaSelecionada) && (
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {localizacao?.empresa?.nome || empresaSelecionada?.nome || 'Empresa'}
            </p>
          )}
        </div>
        
        {viewMode === 'empresas' && isSuperAdmin && (
          <button
            onClick={handleAbrirModalNovaEmpresa}
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
                {isSuperAdmin && (
                  <button
                    onClick={handleAbrirModalNovaEmpresa}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Criar primeira empresa
                  </button>
                )}
              </div>
            ) : (
              empresas.map((empresa) => (
                <div
                  key={empresa.id}
                  onClick={() => handleSelecionarEmpresa(empresa)}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                >
                  {/* Header com nome e botão editar */}
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {empresa.nome}
                    </h3>
                    {isSuperAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAbrirModalEditarEmpresa(empresa);
                        }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Estatísticas */}
                  <div className="space-y-2">
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAbrirModalNovaRota(empresa);
                    }}
                    className="mt-4 flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors w-full justify-center"
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
            {isSuperAdmin && !empresaIdSelecionada && (
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
                {empresaSelecionada && (
                  <button
                    onClick={() => handleAbrirModalNovaRota(empresaSelecionada)}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Criar primeira rota
                  </button>
                )}
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
                onClick={() => handleAbrirModalNovaRota(empresaSelecionada)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar nova Rota
              </button>
            </div>
          )}
        </>
      )}

      {/* ============================================ */}
      {/* MODAL NOVA ROTA */}
      {/* ============================================ */}
      {modalRota && empresaParaRota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalRota(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Nova Rota</h3>
              <button
                onClick={() => setModalRota(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Badge empresa */}
              <div className="px-4 py-2.5 bg-green-100 border border-green-300 rounded-xl text-green-800 font-medium">
                Nova Rota para : {empresaParaRota.nome}
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nome da Rota
                </label>
                <input
                  type="text"
                  value={nomeRota}
                  onChange={(e) => setNomeRota(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder=""
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Descrição da Rota
                </label>
                <input
                  type="text"
                  value={descricaoRota}
                  onChange={(e) => setDescricaoRota(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder=""
                />
              </div>

              {/* Vendedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Vendedor Responsável
                </label>
                <select
                  value={vendedorRotaId}
                  onChange={(e) => setVendedorRotaId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Selecione Um Vendedor</option>
                  {vendedoresDisponiveis.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome} ({v.codigo_vendedor})
                    </option>
                  ))}
                </select>
                {vendedoresDisponiveis.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    Nenhum vendedor disponível (todos já têm rotas ou não há vendedores nesta empresa)
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setModalRota(false)}
                className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCriarRota}
                disabled={salvandoRota || !nomeRota.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {salvandoRota && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar Rota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL NOVA/EDITAR EMPRESA */}
      {/* ============================================ */}
      {modalEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalEmpresa(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg my-8">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {empresaEditando ? 'Editar Empresa' : 'Nova Empresa'}
              </h3>
              <button
                onClick={() => setModalEmpresa(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nome da Empresa
                </label>
                <input
                  type="text"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder=""
                />
              </div>

              {/* CNPJ e Telefone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    CNPJ / RUC
                  </label>
                  <input
                    type="text"
                    value={cnpjEmpresa}
                    onChange={(e) => setCnpjEmpresa(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder=""
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={telefoneEmpresa}
                    onChange={(e) => setTelefoneEmpresa(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder=""
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={emailEmpresa}
                  onChange={(e) => setEmailEmpresa(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder=""
                />
              </div>

              {/* Endereço */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Endereço
                </label>
                <textarea
                  value={enderecoEmpresa}
                  onChange={(e) => setEnderecoEmpresa(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  rows={2}
                  placeholder=""
                />
              </div>

              {/* Seção de Sócios */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-gray-500" />
                    Sócios
                  </h4>
                  <span className="text-sm text-gray-500">
                    Total: {somaPercentuais.toFixed(2)}%
                  </span>
                </div>

                {/* Lista de sócios */}
                {sociosEmpresa.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {sociosEmpresa.map((socio, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{socio.nome}</p>
                          <p className="text-sm text-gray-500">{socio.documento}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                            {socio.percentual_participacao}%
                          </span>
                          <button
                            onClick={() => handleRemoverSocio(index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adicionar novo sócio */}
                <div className="space-y-2 p-3 bg-gray-50 rounded-xl">
                  <p className="text-sm font-medium text-gray-700">Adicionar Sócio</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={novoSocioNome}
                      onChange={(e) => setNovoSocioNome(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      placeholder="Nome"
                    />
                    <input
                      type="text"
                      value={novoSocioDocumento}
                      onChange={(e) => setNovoSocioDocumento(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      placeholder="Documento"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="number"
                        value={novoSocioPercentual}
                        onChange={(e) => setNovoSocioPercentual(e.target.value)}
                        className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-200 text-sm"
                        placeholder="Percentual"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                    <button
                      onClick={handleAdicionarSocio}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setModalEmpresa(false)}
                className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarEmpresa}
                disabled={salvandoEmpresa || !nomeEmpresa.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {salvandoEmpresa && <Loader2 className="w-4 h-4 animate-spin" />}
                {empresaEditando ? 'Salvar Alterações' : 'Criar Empresa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
