'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, 
  UserPlus,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  MapPin,
  Phone,
  Mail,
  ChevronDown,
  Loader2,
  AlertCircle,
  X,
  ArrowUpAZ,
  ArrowDownAZ,
  LayoutGrid,
  List,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { clientesService } from '@/services/clientes';
import { ModalNovaVenda } from '@/components/clientes';
import { ModalDetalhesCliente } from '@/components/clientes/ModalDetalhesCliente';
import type { ClienteComTotais, Segmento, RotaSimples } from '@/types/clientes';

// =====================================================
// TIPOS
// =====================================================

type TipoOrdenacao = 'nome_asc' | 'nome_desc' | 'codigo_asc' | 'codigo_desc' | 'data_asc' | 'data_desc';
type TipoVisualizacao = 'cards' | 'tabela';

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

function CardEstatistica({ 
  titulo, 
  valor, 
  icone: Icone, 
  corIcone, 
  corFundo,
  ativo = false,
  onClick
}: { 
  titulo: string; 
  valor: number; 
  icone: React.ElementType; 
  corIcone: string;
  corFundo: string;
  ativo?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border p-4 hover:shadow-md transition-all ${
        ativo ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${corFundo} flex items-center justify-center`}>
          <Icone className={`w-5 h-5 ${corIcone}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{valor}</p>
          <p className="text-sm text-gray-500">{titulo}</p>
        </div>
      </div>
    </button>
  );
}

function BadgeStatus({ status }: { status: string }) {
  const config = {
    ATIVO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo' },
    INATIVO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Inativo' },
    SUSPENSO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspenso' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function CardCliente({ 
  cliente, 
  onDetalhes, 
  onNovaVenda 
}: { 
  cliente: ClienteComTotais; 
  onDetalhes: () => void;
  onNovaVenda: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
          {cliente.nome.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Código do cliente (consecutivo) */}
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs font-mono text-gray-600">
              #{cliente.codigo_cliente}
            </span>
            <h3 className="font-semibold text-gray-900 truncate">{cliente.nome}</h3>
            <BadgeStatus status={cliente.status} />
          </div>

          {cliente.documento && (
            <p className="text-sm text-gray-500 mb-1">{cliente.documento}</p>
          )}

          <div className="flex flex-wrap gap-3 text-sm text-gray-500">
            {cliente.telefone_celular && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {cliente.telefone_celular}
              </span>
            )}
            {cliente.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {cliente.email}
              </span>
            )}
            {cliente.rotas_nomes && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {cliente.rotas_nomes}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onDetalhes}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Detalhes
          </button>
          <button
            onClick={onNovaVenda}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Nova Venda
          </button>
        </div>
      </div>
    </div>
  );
}

function TabelaClientes({
  clientes,
  onDetalhes,
  onNovaVenda
}: {
  clientes: ClienteComTotais[];
  onDetalhes: (cliente: ClienteComTotais) => void;
  onNovaVenda: (cliente: ClienteComTotais) => void;
}) {
  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Código</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Nome</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Documento</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Telefone</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Endereço</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Rota</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Saldo Devedor</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Emp. Ativos</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clientes.map((cliente) => (
              <tr 
                key={cliente.id} 
                className="hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => onDetalhes(cliente)}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-gray-600">#{cliente.codigo_cliente}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900">{cliente.nome}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{cliente.documento || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{cliente.telefone_celular || '-'}</td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{cliente.endereco || '-'}</td>
                <td className="px-4 py-3 text-gray-600">{cliente.rotas_nomes || '-'}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {formatarMoeda(cliente.valor_saldo_devedor)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                    cliente.qtd_emprestimos_ativos > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {cliente.qtd_emprestimos_ativos}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <BadgeStatus status={cliente.status} />
                </td>
                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onNovaVenda(cliente)}
                    className="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                  >
                    Nova Venda
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AvisoSelecioneEmpresa() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-amber-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecione uma Empresa</h3>
      <p className="text-gray-500 text-center max-w-md">
        Para visualizar os clientes, selecione uma empresa no menu superior.
      </p>
    </div>
  );
}

function AvisoSemRotas() {
  return (
    <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200 mb-6">
      <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800">Nenhuma rota cadastrada</p>
        <p className="text-sm text-amber-700">
          Para cadastrar clientes, é necessário ter pelo menos uma rota. Acesse o módulo de Rotas para criar.
        </p>
      </div>
    </div>
  );
}

// =====================================================
// FUNÇÕES DE EXPORTAÇÃO
// =====================================================

function exportarCSV(clientes: ClienteComTotais[]) {
  const headers = [
    'Código',
    'Nome',
    'Documento',
    'Telefone',
    'Email',
    'Endereço',
    'Rota',
    'Saldo Devedor',
    'Emp. Ativos',
    'Total Empréstimos',
    'Status',
    'Data Cadastro'
  ];

  const linhas = clientes.map(c => [
    c.codigo_cliente,
    `"${c.nome}"`,
    c.documento || '',
    c.telefone_celular || '',
    c.email || '',
    `"${c.endereco || ''}"`,
    `"${c.rotas_nomes || ''}"`,
    c.valor_saldo_devedor || 0,
    c.qtd_emprestimos_ativos || 0,
    c.qtd_emprestimos_total || 0,
    c.status,
    c.data_cadastro ? new Date(c.data_cadastro).toLocaleDateString('pt-BR') : ''
  ]);

  const csv = [headers.join(';'), ...linhas.map(l => l.join(';'))].join('\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportarExcel(clientes: ClienteComTotais[]) {
  // Usando formato XLSX simples (XML-based)
  const headers = [
    'Código', 'Nome', 'Documento', 'Telefone', 'Email', 'Endereço', 
    'Rota', 'Saldo Devedor', 'Emp. Ativos', 'Total Empréstimos', 'Status', 'Data Cadastro'
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += '  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += '<Worksheet ss:Name="Clientes">\n<Table>\n';

  // Headers
  xml += '<Row>\n';
  headers.forEach(h => {
    xml += `<Cell><Data ss:Type="String">${h}</Data></Cell>\n`;
  });
  xml += '</Row>\n';

  // Dados
  clientes.forEach(c => {
    xml += '<Row>\n';
    xml += `<Cell><Data ss:Type="Number">${c.codigo_cliente}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="String">${c.nome}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="String">${c.documento || ''}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="String">${c.telefone_celular || ''}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="String">${c.email || ''}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="String">${c.endereco || ''}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="String">${c.rotas_nomes || ''}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="Number">${c.valor_saldo_devedor || 0}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="Number">${c.qtd_emprestimos_ativos || 0}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="Number">${c.qtd_emprestimos_total || 0}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="String">${c.status}</Data></Cell>\n`;
    xml += `<Cell><Data ss:Type="String">${c.data_cadastro ? new Date(c.data_cadastro).toLocaleDateString('pt-BR') : ''}</Data></Cell>\n`;
    xml += '</Row>\n';
  });

  xml += '</Table>\n</Worksheet>\n</Workbook>';

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clientes_${new Date().toISOString().split('T')[0]}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

export default function ClientesPage() {
  const { localizacao, profile } = useUser();
  const empresaId = localizacao?.empresa_id;
  const rotaIdContexto = localizacao?.rota_id;
  const userId = profile?.user_id;

  const [clientes, setClientes] = useState<ClienteComTotais[]>([]);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [rotas, setRotas] = useState<RotaSimples[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>('');
  const [rotaFiltro, setRotaFiltro] = useState<string>('');
  
  // Novos estados para ordenação e visualização
  const [ordenacao, setOrdenacao] = useState<TipoOrdenacao>('nome_asc');
  const [visualizacao, setVisualizacao] = useState<TipoVisualizacao>('cards');
  const [menuExportarAberto, setMenuExportarAberto] = useState(false);
  
  const [modalNovaVenda, setModalNovaVenda] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteComTotais | null>(null);
  
  // Modal de detalhes
  const [modalDetalhes, setModalDetalhes] = useState(false);
  const [clienteDetalhes, setClienteDetalhes] = useState<ClienteComTotais | null>(null);

  // Ordenar clientes
  const clientesOrdenados = useMemo(() => {
    const lista = [...clientes];
    
    switch (ordenacao) {
      case 'nome_asc':
        return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      case 'nome_desc':
        return lista.sort((a, b) => b.nome.localeCompare(a.nome, 'pt-BR'));
      case 'codigo_asc':
        return lista.sort((a, b) => (a.codigo_cliente || 0) - (b.codigo_cliente || 0));
      case 'codigo_desc':
        return lista.sort((a, b) => (b.codigo_cliente || 0) - (a.codigo_cliente || 0));
      case 'data_asc':
        return lista.sort((a, b) => new Date(a.data_cadastro || 0).getTime() - new Date(b.data_cadastro || 0).getTime());
      case 'data_desc':
        return lista.sort((a, b) => new Date(b.data_cadastro || 0).getTime() - new Date(a.data_cadastro || 0).getTime());
      default:
        return lista;
    }
  }, [clientes, ordenacao]);

  const estatisticas = useMemo(() => {
    const total = clientes.length;
    const ativos = clientes.filter(c => c.status === 'ATIVO').length;
    const inativos = clientes.filter(c => c.status === 'INATIVO').length;
    const suspensos = clientes.filter(c => c.status === 'SUSPENSO').length;
    return { total, ativos, inativos, suspensos };
  }, [clientes]);

  // Se tem rota no contexto OU rotas carregadas, então tem rotas
  const temRotas = rotas.length > 0 || !!rotaIdContexto;

  const carregarClientes = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    try {
      const data = await clientesService.buscarClientes({
        empresa_id: empresaId,
        busca: busca || undefined,
        status: (statusFiltro as 'ATIVO' | 'INATIVO' | 'SUSPENSO') || undefined,
        rota_id: rotaFiltro || rotaIdContexto || undefined,
      });
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoading(false);
    }
  }, [empresaId, busca, statusFiltro, rotaFiltro, rotaIdContexto]);

  const carregarSegmentos = useCallback(async () => {
    if (!empresaId) return;
    try {
      const data = await clientesService.buscarSegmentos();
      setSegmentos(data);
    } catch (error) {
      console.error('Erro ao carregar segmentos:', error);
    }
  }, [empresaId]);

  const carregarRotas = useCallback(async () => {
    if (!empresaId) return;
    try {
      const data = await clientesService.buscarRotasEmpresa(empresaId);
      setRotas(data);
    } catch (error) {
      console.error('Erro ao carregar rotas:', error);
    }
  }, [empresaId]);

  useEffect(() => {
    if (empresaId) {
      carregarClientes();
      carregarSegmentos();
      carregarRotas();
    }
  }, [empresaId, carregarClientes, carregarSegmentos, carregarRotas]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (empresaId) carregarClientes();
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, empresaId, carregarClientes]);

  const handleNovaVenda = (cliente?: ClienteComTotais) => {
    setClienteSelecionado(cliente || null);
    setModalNovaVenda(true);
  };

  const handleSucessoVenda = () => {
    setModalNovaVenda(false);
    setClienteSelecionado(null);
    carregarClientes();
  };

  const handleFiltroStatus = (status: string) => {
    setStatusFiltro(prev => prev === status ? '' : status);
  };

  const limparFiltros = () => {
    setBusca('');
    setStatusFiltro('');
    setRotaFiltro('');
  };

  if (!empresaId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          </div>
          <AvisoSelecioneEmpresa />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          
          <button
            onClick={() => handleNovaVenda()}
            disabled={!temRotas}
            title={!temRotas ? 'Cadastre pelo menos uma rota primeiro' : undefined}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
              temRotas 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <UserPlus className="w-5 h-5" />
            Novo Cliente
          </button>
        </div>

        {/* Aviso sem rotas */}
        {!temRotas && <AvisoSemRotas />}

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <CardEstatistica
            titulo="Total"
            valor={estatisticas.total}
            icone={Users}
            corIcone="text-blue-600"
            corFundo="bg-blue-100"
            ativo={!statusFiltro}
            onClick={() => setStatusFiltro('')}
          />
          <CardEstatistica
            titulo="Ativos"
            valor={estatisticas.ativos}
            icone={UserCheck}
            corIcone="text-green-600"
            corFundo="bg-green-100"
            ativo={statusFiltro === 'ATIVO'}
            onClick={() => handleFiltroStatus('ATIVO')}
          />
          <CardEstatistica
            titulo="Inativos"
            valor={estatisticas.inativos}
            icone={UserX}
            corIcone="text-gray-600"
            corFundo="bg-gray-100"
            ativo={statusFiltro === 'INATIVO'}
            onClick={() => handleFiltroStatus('INATIVO')}
          />
          <CardEstatistica
            titulo="Suspensos"
            valor={estatisticas.suspensos}
            icone={AlertTriangle}
            corIcone="text-red-600"
            corFundo="bg-red-100"
            ativo={statusFiltro === 'SUSPENSO'}
            onClick={() => handleFiltroStatus('SUSPENSO')}
          />
        </div>

        {/* Filtros e Controles */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Busca */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, documento, telefone..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filtro de Rota */}
          {rotas.length > 1 && (
            <div className="relative">
              <select
                value={rotaFiltro}
                onChange={(e) => setRotaFiltro(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Todas as Rotas</option>
                {rotas.map(r => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          )}

          {/* Ordenação */}
          <div className="relative">
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as TipoOrdenacao)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="nome_asc">Nome A-Z</option>
              <option value="nome_desc">Nome Z-A</option>
              <option value="codigo_asc">Código ↑</option>
              <option value="codigo_desc">Código ↓</option>
              <option value="data_desc">Mais recentes</option>
              <option value="data_asc">Mais antigos</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Toggle Visualização */}
          <div className="flex border border-gray-300 rounded-xl overflow-hidden">
            <button
              onClick={() => setVisualizacao('cards')}
              className={`px-3 py-2.5 flex items-center gap-1 transition-colors ${
                visualizacao === 'cards' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="Visualização em Cards"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setVisualizacao('tabela')}
              className={`px-3 py-2.5 flex items-center gap-1 transition-colors ${
                visualizacao === 'tabela' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
              title="Visualização em Tabela"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Exportar */}
          <div className="relative">
            <button
              onClick={() => setMenuExportarAberto(!menuExportarAberto)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {menuExportarAberto && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setMenuExportarAberto(false)} 
                />
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[160px]">
                  <button
                    onClick={() => {
                      exportarCSV(clientesOrdenados);
                      setMenuExportarAberto(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Exportar CSV
                  </button>
                  <button
                    onClick={() => {
                      exportarExcel(clientesOrdenados);
                      setMenuExportarAberto(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Exportar Excel
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Limpar Filtros */}
          {(busca || statusFiltro || rotaFiltro) && (
            <button
              onClick={limparFiltros}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>

        {/* Lista de Clientes */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : clientesOrdenados.length > 0 ? (
          visualizacao === 'cards' ? (
            <div className="space-y-3">
              {clientesOrdenados.map(cliente => (
                <CardCliente
                  key={cliente.id}
                  cliente={cliente}
                  onDetalhes={() => {
                    setClienteDetalhes(cliente);
                    setModalDetalhes(true);
                  }}
                  onNovaVenda={() => handleNovaVenda(cliente)}
                />
              ))}
            </div>
          ) : (
            <TabelaClientes
              clientes={clientesOrdenados}
              onDetalhes={(cliente) => {
                setClienteDetalhes(cliente);
                setModalDetalhes(true);
              }}
              onNovaVenda={(cliente) => handleNovaVenda(cliente)}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200">
            <Users className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum cliente encontrado</h3>
            <p className="text-gray-500 text-center max-w-md mb-4">
              {busca || statusFiltro || rotaFiltro 
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece cadastrando seu primeiro cliente.'}
            </p>
            {!busca && !statusFiltro && !rotaFiltro && temRotas && (
              <button
                onClick={() => handleNovaVenda()}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700"
              >
                <UserPlus className="w-5 h-5" />
                Cadastrar Cliente
              </button>
            )}
          </div>
        )}

        {/* Modal de Nova Venda */}
        {empresaId && userId && (
          <ModalNovaVenda
            isOpen={modalNovaVenda}
            onClose={() => setModalNovaVenda(false)}
            cliente={clienteSelecionado}
            segmentos={segmentos}
            rotas={rotas}
            empresaId={empresaId}
            userId={userId}
            rotaIdContexto={rotaIdContexto}
            onSucesso={handleSucessoVenda}
          />
        )}

        {/* Modal de Detalhes do Cliente */}
        <ModalDetalhesCliente
          isOpen={modalDetalhes}
          onClose={() => {
            setModalDetalhes(false);
            setClienteDetalhes(null);
          }}
          cliente={clienteDetalhes}
        />
    </div>
  );
}
