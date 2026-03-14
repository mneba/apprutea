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
  Calendar,
  Settings,
  CalendarOff,
  CalendarCheck,
  GripVertical,
  Search,
  Save,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { organizacaoService } from '@/services/organizacao';
import type { EmpresaResumo, RotaResumo, ResumoGeral, VendedorDisponivel, Socio } from '@/types/organizacao';

type ViewMode = 'empresas' | 'rotas';

export default function OrganizacaoPage() {
  const { profile, localizacao, setLocalizacao, loading: loadingUser } = useUser();
  
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
  const [rotaEditando, setRotaEditando] = useState<RotaResumo | null>(null);
  const [nomeRota, setNomeRota] = useState('');
  const [descricaoRota, setDescricaoRota] = useState('');
  const [vendedorRotaId, setVendedorRotaId] = useState('');
  const [trabalhaDomingo, setTrabalhaDomingo] = useState(false);
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

  // Hierarquias (para seletor de cidade)
  const [hierarquias, setHierarquias] = useState<{ id: string; pais: string; estado: string }[]>([]);
  const [hierarquiaIdEmpresa, setHierarquiaIdEmpresa] = useState('');

  // Modal de clientes da rota (ordenação)
  const [modalClientes, setModalClientes] = useState(false);
  const [rotaParaClientes, setRotaParaClientes] = useState<RotaResumo | null>(null);
  const [clientesRota, setClientesRota] = useState<{
    id: string;
    cliente_id: string;
    nome: string;
    endereco: string;
    ordem: number;
  }[]>([]);
  const [clientesRotaOriginal, setClientesRotaOriginal] = useState<typeof clientesRota>([]);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [filtroCliente, setFiltroCliente] = useState('');

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
    setRotaEditando(null);
    setNomeRota('');
    setDescricaoRota('');
    setVendedorRotaId('');
    setTrabalhaDomingo(false);
    
    // Carregar vendedores disponíveis
    const vendedores = await organizacaoService.buscarVendedoresDisponiveis(empresa.id);
    setVendedoresDisponiveis(vendedores);
    
    setModalRota(true);
  };

  const handleAbrirModalEditarRota = async (rota: RotaResumo) => {
    if (!empresaSelecionada) return;
    
    setEmpresaParaRota(empresaSelecionada);
    setRotaEditando(rota);
    setNomeRota(rota.nome);
    setDescricaoRota(rota.descricao || '');
    setVendedorRotaId(rota.vendedor_id || '');
    setTrabalhaDomingo(rota.trabalha_domingo ?? false);
    
    // Carregar vendedores disponíveis + o vendedor atual da rota
    const vendedores = await organizacaoService.buscarVendedoresDisponiveis(empresaSelecionada.id);
    
    // Se a rota já tem um vendedor, adicionar ele à lista
    if (rota.vendedor_id && rota.vendedor_nome) {
      const vendedorAtual = vendedores.find(v => v.id === rota.vendedor_id);
      if (!vendedorAtual) {
        vendedores.unshift({
          id: rota.vendedor_id,
          nome: rota.vendedor_nome,
          codigo_vendedor: '',
        });
      }
    }
    
    setVendedoresDisponiveis(vendedores);
    setModalRota(true);
  };

  const handleSalvarRota = async () => {
    if (!nomeRota.trim() || !empresaParaRota) {
      alert('Digite o nome da rota');
      return;
    }

    setSalvandoRota(true);
    try {
      if (rotaEditando) {
        // Verificar se trabalha_domingo está sendo DESATIVADO (de true para false)
        const trabalhaAntes = rotaEditando.trabalha_domingo ?? false;
        const trabalhaDepois = trabalhaDomingo;
        const desativouTrabalhaDomingo = trabalhaAntes && !trabalhaDepois;

        // Atualizar rota existente
        await organizacaoService.atualizarRota(rotaEditando.id, {
          nome: nomeRota.trim(),
          descricao: descricaoRota.trim() || undefined,
          vendedor_id: vendedorRotaId || null,
          trabalha_domingo: trabalhaDomingo,
        });

        // Se DESATIVOU trabalha_domingo, mover parcelas de domingo para segunda
        if (desativouTrabalhaDomingo) {
          const resultado = await organizacaoService.deslocarParcelasDomingoPorRota(rotaEditando.id);
          if (resultado.sucesso) {
            console.log('Parcelas deslocadas:', resultado.mensagem);
          } else {
            console.error('Erro ao deslocar parcelas:', resultado.mensagem);
          }
        }
      } else {
        // Criar nova rota
        await organizacaoService.criarRota(empresaParaRota.id, {
          nome: nomeRota.trim(),
          descricao: descricaoRota.trim() || undefined,
          vendedor_id: vendedorRotaId || undefined,
          trabalha_domingo: trabalhaDomingo,
        });
      }
      
      setModalRota(false);
      
      // Recarregar dados
      if (viewMode === 'rotas' && empresaSelecionada) {
        const rotasData = await organizacaoService.listarRotasPorEmpresa(empresaSelecionada.id);
        setRotas(rotasData);
      } else {
        carregarDados();
      }
    } catch (err: any) {
      console.error('Erro ao salvar rota:', err);
      alert(`Erro ao salvar rota: ${err.message}`);
    } finally {
      setSalvandoRota(false);
    }
  };

  // ============================================
  // MODAL DE CLIENTES DA ROTA
  // ============================================

  const handleAbrirModalClientes = async (rota: RotaResumo) => {
    setRotaParaClientes(rota);
    setCarregandoClientes(true);
    setFiltroCliente('');
    setModalClientes(true);

    try {
      const clientes = await organizacaoService.listarClientesRota(rota.id);
      setClientesRota(clientes);
      setClientesRotaOriginal(JSON.parse(JSON.stringify(clientes)));
    } catch (err) {
      console.error('Erro ao carregar clientes da rota:', err);
      alert('Erro ao carregar clientes');
    } finally {
      setCarregandoClientes(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newClientes = [...clientesRota];
    const draggedItem = newClientes[draggedIndex];
    
    newClientes.splice(draggedIndex, 1);
    newClientes.splice(index, 0, draggedItem);
    
    newClientes.forEach((cliente, idx) => {
      cliente.ordem = idx + 1;
    });

    setClientesRota(newClientes);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Modal para alterar ordem
  const [modalOrdem, setModalOrdem] = useState<{
    aberto: boolean;
    clienteId: string;
    clienteNome: string;
    clienteEndereco: string;
    ordemAtual: number;
    novaOrdem: string;
  }>({
    aberto: false,
    clienteId: '',
    clienteNome: '',
    clienteEndereco: '',
    ordemAtual: 0,
    novaOrdem: '',
  });

  const handleAbrirModalOrdem = (cliente: { cliente_id: string; nome: string; endereco: string; ordem: number }) => {
    setModalOrdem({
      aberto: true,
      clienteId: cliente.cliente_id,
      clienteNome: cliente.nome,
      clienteEndereco: cliente.endereco || 'Endereço não informado',
      ordemAtual: cliente.ordem,
      novaOrdem: String(cliente.ordem),
    });
  };

  const handleConfirmarOrdem = () => {
    const novaOrdem = parseInt(modalOrdem.novaOrdem, 10);
    
    // Validar entrada
    if (isNaN(novaOrdem) || novaOrdem < 1 || novaOrdem > clientesRota.length) {
      alert(`Digite um número entre 1 e ${clientesRota.length}`);
      return;
    }

    // Encontrar o cliente e sua posição atual
    const indexAtual = clientesRota.findIndex(c => c.cliente_id === modalOrdem.clienteId);
    if (indexAtual === -1) return;

    const ordemAtual = clientesRota[indexAtual].ordem;
    
    // Se a ordem não mudou, só fechar
    if (ordemAtual === novaOrdem) {
      setModalOrdem({ aberto: false, clienteId: '', clienteNome: '', clienteEndereco: '', ordemAtual: 0, novaOrdem: '' });
      return;
    }

    // Criar cópia da lista
    const newClientes = [...clientesRota];
    
    // Remover cliente da posição atual
    const [clienteMovido] = newClientes.splice(indexAtual, 1);
    
    // Inserir na nova posição (novaOrdem - 1 porque array é 0-indexed)
    newClientes.splice(novaOrdem - 1, 0, clienteMovido);
    
    // Reatribuir ordens sequenciais
    newClientes.forEach((cliente, idx) => {
      cliente.ordem = idx + 1;
    });

    setClientesRota(newClientes);
    setModalOrdem({ aberto: false, clienteId: '', clienteNome: '', clienteEndereco: '', ordemAtual: 0, novaOrdem: '' });
  };

  const handleSalvarOrdemClientes = async () => {
    if (!rotaParaClientes) return;

    setSalvandoOrdem(true);
    try {
      await organizacaoService.salvarOrdemClientesRota(
        rotaParaClientes.id,
        clientesRota.map(c => ({ cliente_id: c.cliente_id, ordem: c.ordem }))
      );
      setClientesRotaOriginal(JSON.parse(JSON.stringify(clientesRota)));
      alert('Ordem salva com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar ordem:', err);
      alert(`Erro ao salvar ordem: ${err.message}`);
    } finally {
      setSalvandoOrdem(false);
    }
  };

  const temAlteracoesOrdem = () => {
    if (clientesRota.length !== clientesRotaOriginal.length) return true;
    return clientesRota.some((cliente, index) => 
      cliente.cliente_id !== clientesRotaOriginal[index]?.cliente_id
    );
  };

  const clientesFiltrados = clientesRota.filter(cliente =>
    cliente.nome.toLowerCase().includes(filtroCliente.toLowerCase()) ||
    cliente.endereco.toLowerCase().includes(filtroCliente.toLowerCase())
  );

  // ============================================
  // MODAL DE EMPRESA
  // ============================================

  const handleAbrirModalNovaEmpresa = async () => {
    setEmpresaEditando(null);
    setNomeEmpresa('');
    setCnpjEmpresa('');
    setTelefoneEmpresa('');
    setEmailEmpresa('');
    setEnderecoEmpresa('');
    setSociosEmpresa([]);
    setHierarquiaIdEmpresa(hierarquiaId || '');
    
    // Carregar hierarquias disponíveis
    const listaHierarquias = await organizacaoService.listarHierarquias();
    setHierarquias(listaHierarquias);
    
    setModalEmpresa(true);
  };

  const handleAbrirModalEditarEmpresa = async (empresa: EmpresaResumo) => {
    setEmpresaEditando(empresa);
    setNomeEmpresa(empresa.nome);
    setCnpjEmpresa(empresa.cnpj || '');
    setTelefoneEmpresa(empresa.telefone || '');
    setEmailEmpresa(empresa.email || '');
    setEnderecoEmpresa(empresa.endereco || '');
    
    // Carregar hierarquias disponíveis
    const listaHierarquias = await organizacaoService.listarHierarquias();
    setHierarquias(listaHierarquias);
    
    // Buscar hierarquia_id da empresa
    const hierarquiaAtual = await organizacaoService.buscarHierarquiaEmpresa(empresa.id);
    setHierarquiaIdEmpresa(hierarquiaAtual || '');
    
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

    if (!hierarquiaIdEmpresa) {
      alert('Selecione uma cidade/estado');
      return;
    }

    setSalvandoEmpresa(true);
    try {
      if (empresaEditando) {
        // Atualizar empresa (incluindo hierarquia_id)
        await organizacaoService.atualizarEmpresa(empresaEditando.id, {
          nome: nomeEmpresa.trim(),
          cnpj: cnpjEmpresa.trim() || undefined,
          telefone: telefoneEmpresa.trim() || undefined,
          email: emailEmpresa.trim() || undefined,
          endereco: enderecoEmpresa.trim() || undefined,
          hierarquia_id: hierarquiaIdEmpresa,
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
          hierarquia_id: hierarquiaIdEmpresa,
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

        // Atualizar seletor para a nova empresa
        if (setLocalizacao) {
          setLocalizacao({
            empresa_id: novaEmpresa.id,
            empresa: { id: novaEmpresa.id, nome: novaEmpresa.nome } as any,
            rota_id: null,
            rota: null,
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
        
        {/* Botões de ação - SUPER_ADMIN sempre pode adicionar empresa */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            {viewMode === 'rotas' && empresaSelecionada && (
              <>
                <button
                  onClick={() => handleAbrirModalEditarEmpresa(empresaSelecionada)}
                  className="flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  <Edit className="w-5 h-5" />
                  Gerenciar Empresa
                </button>
                <button
                  onClick={() => handleAbrirModalNovaRota(empresaSelecionada)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Nova Rota
                </button>
              </>
            )}
            <button
              onClick={handleAbrirModalNovaEmpresa}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
            >
              <Building2 className="w-5 h-5" />
              Nova Empresa
            </button>
          </div>
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

                  {/* Badge Trabalha Domingo */}
                  <div className="mt-3">
                    {rota.trabalha_domingo ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                        <CalendarCheck className="w-3.5 h-3.5" />
                        Trabalha Domingo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                        <CalendarOff className="w-3.5 h-3.5" />
                        Não trabalha Domingo
                      </span>
                    )}
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

                  {/* Botões de Ação */}
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => handleAbrirModalClientes(rota)}
                      className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors justify-center"
                    >
                      <Users className="w-4 h-4" />
                      Clientes
                    </button>
                    <button
                      onClick={() => handleAbrirModalEditarRota(rota)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Configurações
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ============================================ */}
      {/* MODAL DE ROTA */}
      {/* ============================================ */}
      {modalRota && empresaParaRota && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalRota(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {rotaEditando ? 'Configurações da Rota' : 'Nova Rota'}
              </h3>
              <button
                onClick={() => setModalRota(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Badge indicando contexto */}
              <div className={`px-4 py-2.5 rounded-xl font-medium ${
                rotaEditando 
                  ? 'bg-blue-100 border border-blue-300 text-blue-800' 
                  : 'bg-green-100 border border-green-300 text-green-800'
              }`}>
                {rotaEditando 
                  ? `Editando: ${rotaEditando.nome}` 
                  : `Nova Rota para: ${empresaParaRota.nome}`
                }
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
                  placeholder="Ex: Rota Centro Norte"
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
                  placeholder="Ex: Região central e zona norte"
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
                      {v.nome} {v.codigo_vendedor ? `(${v.codigo_vendedor})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Configurações Operacionais */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-gray-500" />
                  Configurações Operacionais
                </h4>
                
                {/* Toggle Trabalha Domingo */}
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Trabalha no Domingo</p>
                      <p className="text-sm text-gray-500">Permitir operações aos domingos</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrabalhaDomingo(!trabalhaDomingo)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      trabalhaDomingo ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        trabalhaDomingo ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
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
                onClick={handleSalvarRota}
                disabled={salvandoRota || !nomeRota.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {salvandoRota && <Loader2 className="w-4 h-4 animate-spin" />}
                {rotaEditando ? 'Salvar Alterações' : 'Criar Rota'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL CLIENTES DA ROTA */}
      {/* ============================================ */}
      {modalClientes && rotaParaClientes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalClientes(false)} />
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Clientes da Rota
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {rotaParaClientes.nome} • {clientesRota.length} clientes
                </p>
              </div>
              <button
                onClick={() => setModalClientes(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de busca */}
            <div className="px-6 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={filtroCliente}
                  onChange={(e) => setFiltroCliente(e.target.value)}
                  placeholder="Buscar cliente por nome ou endereço..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Instrução */}
            {!carregandoClientes && clientesRota.length > 0 && (
              <div className="px-6 py-2 bg-blue-50 border-b border-blue-100">
                <p className="text-xs text-blue-600 flex items-center gap-2">
                  <GripVertical className="w-3.5 h-3.5" />
                  Arraste para reordenar ou clique no número para definir a posição
                </p>
              </div>
            )}

            {/* Lista de clientes */}
            <div className="flex-1 overflow-y-auto p-4">
              {carregandoClientes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : clientesRota.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum cliente cadastrado nesta rota</p>
                </div>
              ) : clientesFiltrados.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum cliente encontrado com "{filtroCliente}"</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clientesFiltrados.map((cliente) => (
                    <div
                      key={cliente.cliente_id}
                      draggable={!filtroCliente}
                      onDragStart={() => handleDragStart(clientesRota.findIndex(c => c.cliente_id === cliente.cliente_id))}
                      onDragOver={(e) => handleDragOver(e, clientesRota.findIndex(c => c.cliente_id === cliente.cliente_id))}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-3 p-3 bg-white border rounded-xl transition-all ${
                        draggedIndex === clientesRota.findIndex(c => c.cliente_id === cliente.cliente_id)
                          ? 'border-blue-400 shadow-lg scale-[1.02] bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      } ${!filtroCliente ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                      {/* Ordem - Botão clicável */}
                      <div className="flex items-center gap-2">
                        {!filtroCliente && (
                          <GripVertical className="w-4 h-4 text-gray-400" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbrirModalOrdem(cliente);
                          }}
                          className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold hover:bg-blue-200 hover:scale-105 transition-all"
                          title="Clique para alterar posição"
                        >
                          {cliente.ordem}
                        </button>
                      </div>

                      {/* Dados do cliente */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {cliente.nome}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {cliente.endereco || 'Endereço não informado'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
              <div className="text-sm text-gray-500">
                {temAlteracoesOrdem() && (
                  <span className="text-orange-600 font-medium">
                    • Alterações não salvas
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModalClientes(false)}
                  className="px-4 py-2.5 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={handleSalvarOrdemClientes}
                  disabled={salvandoOrdem || !temAlteracoesOrdem()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {salvandoOrdem ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar Ordem
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL DE EMPRESA */}
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
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Cidade/Estado (Hierarquia) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Cidade / Estado
                </label>
                <select
                  value={hierarquiaIdEmpresa}
                  onChange={(e) => setHierarquiaIdEmpresa(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Selecione uma cidade</option>
                  {hierarquias.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.estado} - {h.pais}
                    </option>
                  ))}
                </select>
              </div>

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

      {/* ============================================ */}
      {/* MODAL ALTERAR ORDEM DO CLIENTE */}
      {/* ============================================ */}
      {modalOrdem.aberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setModalOrdem({ aberto: false, clienteId: '', clienteNome: '', clienteEndereco: '', ordemAtual: 0, novaOrdem: '' })} 
          />
          
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Alterar Posição
            </h3>
            
            {/* Info do cliente */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4">
              <p className="font-medium text-gray-900">
                {modalOrdem.clienteNome}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">
                {modalOrdem.clienteEndereco}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nova posição (1 a {clientesRota.length})
              </label>
              <input
                type="number"
                min={1}
                max={clientesRota.length}
                value={modalOrdem.novaOrdem}
                onChange={(e) => setModalOrdem({ ...modalOrdem, novaOrdem: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmarOrdem();
                  }
                }}
                autoFocus
                className="w-full px-4 py-3 text-center text-2xl font-bold rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {modalOrdem.ordemAtual !== parseInt(modalOrdem.novaOrdem) && modalOrdem.novaOrdem && (
                <p className="text-xs text-blue-600 mt-2 text-center">
                  Mover da posição {modalOrdem.ordemAtual} para {modalOrdem.novaOrdem}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModalOrdem({ aberto: false, clienteId: '', clienteNome: '', clienteEndereco: '', ordemAtual: 0, novaOrdem: '' })}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarOrdem}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}