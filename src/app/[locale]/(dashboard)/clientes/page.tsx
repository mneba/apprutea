'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  ChevronDown,
  Phone,
  AlertTriangle,
  Eye,
  PlusCircle,
  CreditCard,
  Loader2,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Clock,
  MapPin
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { clientesService } from '@/services/clientes';
import { ModalNovaVenda } from '@/components/clientes/ModalNovaVenda';
import type {
  ClienteComTotais,
  ContagemClientes,
  Segmento,
  RotaSimples,
  StatusCliente,
} from '@/types/clientes';

// =====================================================
// CONSTANTES
// =====================================================

const STATUS_COLORS: Record<StatusCliente, { bg: string; text: string; label: string }> = {
  ATIVO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo' },
  INATIVO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Inativo' },
  SUSPENSO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspenso' },
};

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

function CardEstatistica({ 
  titulo, 
  valor, 
  icone: Icone, 
  corIcone,
  corFundo,
  onClick,
  ativo = false,
}: { 
  titulo: string; 
  valor: number; 
  icone: React.ElementType; 
  corIcone: string;
  corFundo: string;
  onClick?: () => void;
  ativo?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 text-left transition-all hover:shadow-md ${
        ativo ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-gray-900">{valor}</p>
          <p className="text-sm text-gray-500">{titulo}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${corFundo} flex items-center justify-center`}>
          <Icone className={`w-5 h-5 ${corIcone}`} />
        </div>
      </div>
    </button>
  );
}

function BadgeStatus({ status }: { status: StatusCliente }) {
  const config = STATUS_COLORS[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

function CardCliente({ 
  cliente, 
  onVerDetalhes,
  onNovaVenda,
}: { 
  cliente: ClienteComTotais;
  onVerDetalhes: (id: string) => void;
  onNovaVenda: (cliente: ClienteComTotais) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {cliente.foto_url ? (
            <img 
              src={cliente.foto_url} 
              alt={cliente.nome}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
              <Users className="w-6 h-6 text-gray-500" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900">{cliente.nome}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>#{cliente.codigo_cliente}</span>
              <BadgeStatus status={cliente.status} />
            </div>
          </div>
        </div>
        
        {cliente.parcelas_atrasadas > 0 && (
          <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium">{cliente.parcelas_atrasadas} atrasada(s)</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="w-4 h-4 text-gray-400" />
          <span>{cliente.telefone_celular || '-'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <span>{cliente.qtd_emprestimos_ativos} ativo(s)</span>
        </div>
      </div>

      {cliente.valor_saldo_devedor > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Saldo devedor</span>
            <span className="font-semibold text-gray-900">
              {cliente.valor_saldo_devedor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onVerDetalhes(cliente.id)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Eye className="w-4 h-4" />
          Detalhes
        </button>
        <button
          onClick={() => onNovaVenda(cliente)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          Nova Venda
        </button>
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
      <MapPin className="w-5 h-5 text-amber-500 flex-shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800">
          Nenhuma rota cadastrada
        </p>
        <p className="text-sm text-amber-700 mt-0.5">
          Para cadastrar clientes, primeiro cadastre pelo menos uma rota para esta empresa.
        </p>
      </div>
    </div>
  );
}

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

export default function ClientesPage() {
  const { localizacao, profile } = useUser();
  const empresaId = localizacao?.empresa_id;
  const rotaIdContexto = localizacao?.rota_id; // Rota do seletor
  const userId = profile?.user_id;

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusCliente | ''>('');
  const [rotaFiltro, setRotaFiltro] = useState('');
  
  const [loadingClientes, setLoadingClientes] = useState(false);
  
  const [clientes, setClientes] = useState<ClienteComTotais[]>([]);
  const [contagem, setContagem] = useState<ContagemClientes>({
    total: 0, ativos: 0, inativos: 0, suspensos: 0, com_emprestimo_ativo: 0, com_parcelas_atrasadas: 0,
  });
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [rotas, setRotas] = useState<RotaSimples[]>([]);

  const [modalNovaVenda, setModalNovaVenda] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteComTotais | null>(null);

  // Verificar se empresa tem rotas
  const temRotas = rotas.length > 0;

  const carregarClientes = useCallback(async () => {
    if (!empresaId) return;
    setLoadingClientes(true);
    try {
      const data = await clientesService.buscarClientes({
        empresa_id: empresaId,
        rota_id: rotaFiltro || undefined,
        status: statusFiltro || undefined,
        busca: busca || undefined,
      });
      setClientes(data);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      setLoadingClientes(false);
    }
  }, [empresaId, rotaFiltro, statusFiltro, busca]);

  const carregarContagem = useCallback(async () => {
    if (!empresaId) return;
    try {
      const data = await clientesService.contarClientes(empresaId, rotaFiltro || undefined);
      setContagem(data);
    } catch (error) {
      console.error('Erro ao carregar contagem:', error);
    }
  }, [empresaId, rotaFiltro]);

  const carregarDadosAuxiliares = useCallback(async () => {
    if (!empresaId) return;
    try {
      const [segmentosData, rotasData] = await Promise.all([
        clientesService.buscarSegmentos(),
        clientesService.buscarRotasEmpresa(empresaId),
      ]);
      setSegmentos(segmentosData);
      setRotas(rotasData);
    } catch (error) {
      console.error('Erro ao carregar dados auxiliares:', error);
    }
  }, [empresaId]);

  useEffect(() => { carregarDadosAuxiliares(); }, [carregarDadosAuxiliares]);
  useEffect(() => { carregarContagem(); }, [carregarContagem]);
  useEffect(() => {
    const timer = setTimeout(() => carregarClientes(), 300);
    return () => clearTimeout(timer);
  }, [carregarClientes]);

  const handleNovaVenda = (cliente?: ClienteComTotais) => {
    setClienteSelecionado(cliente || null);
    setModalNovaVenda(true);
  };

  const handleSucessoVenda = () => {
    carregarClientes();
    carregarContagem();
  };

  const handleVerDetalhes = (clienteId: string) => {
    // TODO: Implementar modal de detalhes ou navegar para página
    console.log('Ver detalhes:', clienteId);
  };

  const handleFiltrarStatus = (status: StatusCliente | '') => {
    setStatusFiltro(prev => prev === status ? '' : status);
  };

  if (!empresaId) {
    return (
      <div className="p-6">
        <AvisoSelecioneEmpresa />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">{contagem.total} clientes cadastrados</p>
        </div>
        
        {/* Botão só habilitado se tiver pelo menos 1 rota */}
        <button
          onClick={() => handleNovaVenda()}
          disabled={!temRotas}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors ${
            temRotas 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={!temRotas ? 'Cadastre pelo menos uma rota primeiro' : ''}
        >
          <UserPlus className="w-5 h-5" />
          Novo Cliente
        </button>
      </div>

      {/* Aviso se não tiver rotas */}
      {!temRotas && <AvisoSemRotas />}

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <CardEstatistica
          titulo="Total"
          valor={contagem.total}
          icone={Users}
          corIcone="text-gray-600"
          corFundo="bg-gray-100"
          onClick={() => handleFiltrarStatus('')}
          ativo={statusFiltro === ''}
        />
        <CardEstatistica
          titulo="Ativos"
          valor={contagem.ativos}
          icone={CheckCircle}
          corIcone="text-green-600"
          corFundo="bg-green-100"
          onClick={() => handleFiltrarStatus('ATIVO')}
          ativo={statusFiltro === 'ATIVO'}
        />
        <CardEstatistica
          titulo="Inativos"
          valor={contagem.inativos}
          icone={Clock}
          corIcone="text-gray-600"
          corFundo="bg-gray-100"
          onClick={() => handleFiltrarStatus('INATIVO')}
          ativo={statusFiltro === 'INATIVO'}
        />
        <CardEstatistica
          titulo="Suspensos"
          valor={contagem.suspensos}
          icone={AlertCircle}
          corIcone="text-red-600"
          corFundo="bg-red-100"
          onClick={() => handleFiltrarStatus('SUSPENSO')}
          ativo={statusFiltro === 'SUSPENSO'}
        />
        <CardEstatistica
          titulo="Com Empréstimo"
          valor={contagem.com_emprestimo_ativo}
          icone={CreditCard}
          corIcone="text-blue-600"
          corFundo="bg-blue-100"
        />
        <CardEstatistica
          titulo="Atrasados"
          valor={contagem.com_parcelas_atrasadas}
          icone={AlertTriangle}
          corIcone="text-amber-600"
          corFundo="bg-amber-100"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Busca */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, documento, telefone ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filtro de Rotas - só mostra se tiver mais de 1 rota */}
        {rotas.length > 1 && (
          <div className="relative">
            <select
              value={rotaFiltro}
              onChange={(e) => setRotaFiltro(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[180px]"
            >
              <option value="">Todas as Rotas</option>
              {rotas.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Lista de Clientes */}
      {loadingClientes ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : clientes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientes.map(cliente => (
            <CardCliente 
              key={cliente.id} 
              cliente={cliente}
              onVerDetalhes={handleVerDetalhes}
              onNovaVenda={handleNovaVenda}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum cliente encontrado</h3>
          <p className="text-gray-500 text-center max-w-md mb-4">
            {busca || statusFiltro || rotaFiltro
              ? 'Ajuste os filtros para ver mais resultados.'
              : 'Cadastre seu primeiro cliente para começar.'
            }
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
    </div>
  );
}

      {empresaId && userId && (
        <ModalNovaVenda
          isOpen={modalNovaVenda}
          onClose={() => { setModalNovaVenda(false); setClienteSelecionado(null); }}
          cliente={clienteSelecionado}
          segmentos={segmentos}
          rotas={rotas}
          empresaId={empresaId}
          userId={userId}
          onSucesso={handleSucessoVenda}
        />
      )}
    </div>
  );
}
