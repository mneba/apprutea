'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Wallet, 
  Building2, 
  MapPin, 
  Shield,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Plus,
  ArrowRight,
  CheckSquare,
  X,
  Loader2,
  Calendar,
  Filter,
  ChevronDown,
  DollarSign,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useUser } from '@/contexts/UserContext';
import { financeiroService } from '@/services/financeiro';
import type {
  PeriodoFiltro,
  SaldosContas,
  ResumoMovimentacoes,
  DadosGrafico,
  MovimentoFinanceiro,
  CategoriaFinanceira,
  ContaComDetalhes,
} from '@/types/financeiro';

// =====================================================
// TIPOS LOCAIS
// =====================================================
type AbaAtiva = 'resumo' | 'extrato';

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

// Card de Indicador (Saldos)
function CardIndicador({ 
  titulo, 
  valor, 
  icone: Icone, 
  corIcone,
  corFundo,
  loading = false
}: { 
  titulo: string; 
  valor: number; 
  icone: React.ElementType; 
  corIcone: string;
  corFundo: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg ${corFundo} flex items-center justify-center`}>
          <Icone className={`w-5 h-5 ${corIcone}`} />
        </div>
        <span className="text-sm font-medium text-gray-600">{titulo}</span>
      </div>
      {loading ? (
        <div className="h-8 bg-gray-200 animate-pulse rounded" />
      ) : (
        <p className="text-2xl font-bold text-gray-900">
          {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      )}
    </div>
  );
}

// Card de Movimentação
function CardMovimentacao({ 
  tipo, 
  titulo, 
  valor, 
  quantidade,
  corValor,
  loading = false
}: { 
  tipo: 'entrada' | 'saida' | 'resultado';
  titulo: string;
  valor: number;
  quantidade: number;
  corValor: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <span className="text-sm font-medium text-gray-500">{titulo}</span>
      {loading ? (
        <div className="mt-2 space-y-2">
          <div className="h-6 bg-gray-200 animate-pulse rounded w-24" />
          <div className="h-4 bg-gray-200 animate-pulse rounded w-16" />
        </div>
      ) : (
        <div className="mt-2">
          <p className={`text-xl font-bold ${corValor}`}>
            {tipo === 'entrada' && '+'}{tipo === 'saida' && '-'}
            {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {quantidade} {quantidade === 1 ? 'transação' : 'transações'}
          </p>
        </div>
      )}
    </div>
  );
}

// Botão de Ação Rápida
function BotaoAcaoRapida({ 
  icone: Icone, 
  titulo, 
  onClick 
}: { 
  icone: React.ElementType; 
  titulo: string; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
    >
      <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
        <Icone className="w-5 h-5 text-gray-600 group-hover:text-blue-600" />
      </div>
      <span className="font-medium text-gray-700 group-hover:text-blue-700">{titulo}</span>
    </button>
  );
}

// Breadcrumb de Período
function BreadcrumbPeriodo({ 
  periodoAtivo, 
  onChange 
}: { 
  periodoAtivo: PeriodoFiltro; 
  onChange: (periodo: PeriodoFiltro) => void;
}) {
  const periodos: { valor: PeriodoFiltro; label: string }[] = [
    { valor: 'hoje', label: 'Hoje' },
    { valor: 'ontem', label: 'Ontem' },
    { valor: '7dias', label: '7 dias' },
    { valor: '15dias', label: '15 dias' },
    { valor: '30dias', label: '30 dias' },
    { valor: 'mes_fechado', label: 'Mês Fechado' },
  ];
  
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
      {periodos.map((p) => (
        <button
          key={p.valor}
          onClick={() => onChange(p.valor)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
            periodoAtivo === p.valor
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// Linha do Extrato
function LinhaExtrato({ 
  movimento, 
  categorias 
}: { 
  movimento: MovimentoFinanceiro; 
  categorias: CategoriaFinanceira[];
}) {
  const categoria = categorias.find(c => c.codigo === movimento.categoria);
  const isEntrada = movimento.tipo === 'RECEBER';
  const isTransferencia = movimento.tipo === 'TRANSFERENCIA';
  
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600">
          {new Date(movimento.data_lancamento).toLocaleDateString('pt-BR')}
        </span>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-900">{movimento.descricao}</p>
          {movimento.observacoes && (
            <p className="text-xs text-gray-500 mt-0.5">{movimento.observacoes}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span 
          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium"
          style={{ 
            backgroundColor: categoria?.cor_hex ? `${categoria.cor_hex}20` : '#f3f4f6',
            color: categoria?.cor_hex || '#374151'
          }}
        >
          {categoria?.nome_pt || movimento.categoria}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`text-sm font-semibold ${
          isTransferencia ? 'text-blue-600' : isEntrada ? 'text-green-600' : 'text-red-600'
        }`}>
          {isTransferencia ? '↔' : isEntrada ? '+' : '-'} 
          {movimento.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          movimento.status === 'PAGO' ? 'bg-green-100 text-green-700' :
          movimento.status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-700' :
          movimento.status === 'CANCELADO' ? 'bg-gray-100 text-gray-700' :
          movimento.status === 'VENCIDO' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {movimento.status === 'PAGO' && '✓ '}
          {movimento.status}
        </span>
      </td>
    </tr>
  );
}

// Aviso de seleção de empresa
function AvisoSelecioneEmpresa() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-amber-600" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecione uma Empresa</h3>
      <p className="text-gray-500 text-center max-w-md">
        Para visualizar as informações financeiras, selecione uma empresa no menu superior.
      </p>
    </div>
  );
}

// =====================================================
// MODAIS
// =====================================================

// Modal Nova Movimentação
function ModalNovaMovimentacao({ 
  isOpen, 
  onClose, 
  contas,
  categorias,
  onSalvar 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  contas: ContaComDetalhes[];
  categorias: CategoriaFinanceira[];
  onSalvar: (dados: any) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<'RECEBER' | 'PAGAR'>('RECEBER');
  const [contaId, setContaId] = useState('');
  const [categoria, setCategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('DINHEIRO');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const contaSelecionada = contas.find(c => c.id === contaId);
  const categoriasFiltradas = categorias.filter(c => {
    if (c.tipo_movimento !== 'AMBOS' && c.tipo_movimento !== tipo) return false;
    if (contaSelecionada?.tipo_conta === 'EMPRESA' && !c.aplicavel_empresa) return false;
    if (contaSelecionada?.tipo_conta === 'ROTA' && !c.aplicavel_rota) return false;
    if (contaSelecionada?.tipo_conta === 'MICROSEGURO' && !c.aplicavel_microseguro) return false;
    return true;
  });

  // Limpar form ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setTipo('RECEBER');
      setContaId('');
      setCategoria('');
      setDescricao('');
      setValor('');
      setFormaPagamento('DINHEIRO');
      setObservacoes('');
      setErro('');
    }
  }, [isOpen]);

  const handleSalvar = async () => {
    if (!contaId || !categoria || !descricao || !valor) {
      setErro('Preencha todos os campos obrigatórios');
      return;
    }
    
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({
        tipo,
        conta_destino_id: contaId,
        categoria,
        descricao,
        valor: parseFloat(valor),
        forma_pagamento: formaPagamento,
        observacoes,
      });
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar movimentação');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Nova Movimentação</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {erro}
            </div>
          )}

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Movimento</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setTipo('RECEBER'); setCategoria(''); }}
                className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all ${
                  tipo === 'RECEBER' 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Entrada
              </button>
              <button
                onClick={() => { setTipo('PAGAR'); setCategoria(''); }}
                className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all ${
                  tipo === 'PAGAR' 
                    ? 'border-red-500 bg-red-50 text-red-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <TrendingDown className="w-4 h-4 inline mr-2" />
                Saída
              </button>
            </div>
          </div>

          {/* Conta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conta *</label>
            <select
              value={contaId}
              onChange={(e) => { setContaId(e.target.value); setCategoria(''); }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione uma conta</option>
              <optgroup label="🏢 Empresa">
                {contas.filter(c => c.tipo_conta === 'EMPRESA').map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} - {c.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🛣️ Rotas">
                {contas.filter(c => c.tipo_conta === 'ROTA').map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} - {c.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🛡️ Microseguros">
                {contas.filter(c => c.tipo_conta === 'MICROSEGURO').map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} - {c.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Categoria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categoria *</label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!contaId}
            >
              <option value="">Selecione uma categoria</option>
              {categoriasFiltradas.map(c => (
                <option key={c.id} value={c.codigo}>{c.nome_pt}</option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descrição *</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Pagamento parcela 5/24 - João Silva"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Valor *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento</label>
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="DINHEIRO">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="TRANSFERENCIA">Transferência</option>
              <option value="CARTAO">Cartão</option>
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Observações adicionais..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !contaId || !categoria || !descricao || !valor}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {tipo === 'RECEBER' ? 'Registrar Entrada' : 'Registrar Saída'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal Transferência
function ModalTransferencia({ 
  isOpen, 
  onClose, 
  contas,
  onSalvar 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  contas: ContaComDetalhes[];
  onSalvar: (dados: any) => Promise<void>;
}) {
  const [contaOrigem, setContaOrigem] = useState('');
  const [contaDestino, setContaDestino] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const contaOrigemObj = contas.find(c => c.id === contaOrigem);
  const contasDestinoFiltradas = contas.filter(c => c.id !== contaOrigem);

  // Limpar form ao abrir
  useEffect(() => {
    if (isOpen) {
      setContaOrigem('');
      setContaDestino('');
      setValor('');
      setDescricao('');
      setObservacoes('');
      setErro('');
    }
  }, [isOpen]);

  const handleSalvar = async () => {
    if (!contaOrigem || !contaDestino || !valor) {
      setErro('Preencha todos os campos obrigatórios');
      return;
    }
    
    const valorNum = parseFloat(valor);
    if (contaOrigemObj && valorNum > contaOrigemObj.saldo_atual) {
      setErro('Saldo insuficiente na conta de origem');
      return;
    }
    
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({
        conta_origem_id: contaOrigem,
        conta_destino_id: contaDestino,
        valor: valorNum,
        descricao: descricao || 'Transferência entre contas',
        observacoes,
      });
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao realizar transferência');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Transferência entre Contas</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {erro}
            </div>
          )}

          {/* Conta Origem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conta de Origem *</label>
            <select
              value={contaOrigem}
              onChange={(e) => { setContaOrigem(e.target.value); setContaDestino(''); }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione a conta de origem</option>
              {contas.map(c => (
                <option key={c.id} value={c.id}>
                  [{c.tipo_conta}] {c.nome} - {c.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </option>
              ))}
            </select>
          </div>

          {/* Ícone de Transferência */}
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <ArrowRight className="w-5 h-5 text-blue-600" />
            </div>
          </div>

          {/* Conta Destino */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conta de Destino *</label>
            <select
              value={contaDestino}
              onChange={(e) => setContaDestino(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!contaOrigem}
            >
              <option value="">Selecione a conta de destino</option>
              {contasDestinoFiltradas.map(c => (
                <option key={c.id} value={c.id}>
                  [{c.tipo_conta}] {c.nome} - {c.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </option>
              ))}
            </select>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Valor *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={contaOrigemObj?.saldo_atual || undefined}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {contaOrigemObj && (
              <p className="text-xs text-gray-500 mt-1">
                Saldo disponível: {contaOrigemObj.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Capital para rota / Devolução de lucros"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Observações adicionais..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !contaOrigem || !contaDestino || !valor}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar Transferência
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal Ajuste de Saldo
function ModalAjusteSaldo({ 
  isOpen, 
  onClose, 
  contas,
  onSalvar 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  contas: ContaComDetalhes[];
  onSalvar: (dados: any) => Promise<void>;
}) {
  const [contaId, setContaId] = useState('');
  const [tipoAjuste, setTipoAjuste] = useState<'positivo' | 'negativo'>('positivo');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const contaSelecionada = contas.find(c => c.id === contaId);
  const valorNum = parseFloat(valor) || 0;
  const valorAjuste = tipoAjuste === 'positivo' ? valorNum : -valorNum;
  const valorFinal = (contaSelecionada?.saldo_atual || 0) + valorAjuste;

  // Limpar form ao abrir
  useEffect(() => {
    if (isOpen) {
      setContaId('');
      setTipoAjuste('positivo');
      setValor('');
      setMotivo('');
      setObservacoes('');
      setErro('');
    }
  }, [isOpen]);

  const handleSalvar = async () => {
    if (!contaId || !valor || !motivo) {
      setErro('Preencha todos os campos obrigatórios');
      return;
    }
    
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({
        conta_id: contaId,
        valor: valorAjuste,
        motivo,
        observacoes,
      });
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao registrar ajuste');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Ajuste de Saldo</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {erro}
            </div>
          )}

          {/* Conta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Conta *</label>
            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione a conta</option>
              {contas.map(c => (
                <option key={c.id} value={c.id}>
                  [{c.tipo_conta}] {c.nome} - {c.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de Ajuste */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Ajuste</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTipoAjuste('positivo')}
                className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all ${
                  tipoAjuste === 'positivo' 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                + Aumentar
              </button>
              <button
                onClick={() => setTipoAjuste('negativo')}
                className={`flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all ${
                  tipoAjuste === 'negativo' 
                    ? 'border-red-500 bg-red-50 text-red-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                - Diminuir
              </button>
            </div>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Valor do Ajuste *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Preview */}
          {contaSelecionada && valor && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">Preview do ajuste:</p>
              <div className="flex items-center justify-between">
                <span className="text-gray-700">
                  {contaSelecionada.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className={`font-semibold ${valorFinal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {valorFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motivo *</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione o motivo</option>
              <option value="Diferença no fechamento">Diferença no fechamento</option>
              <option value="Correção de erro">Correção de erro</option>
              <option value="Ajuste de auditoria">Ajuste de auditoria</option>
              <option value="Saldo inicial">Saldo inicial</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Justificativa detalhada do ajuste..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-5 border-t bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !contaId || !valor || !motivo}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirmar Ajuste
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

export default function FinanceiroPage() {
  const { localizacaoAtual, profile } = useUser();
  const empresaId = localizacaoAtual?.empresa?.id;

  // Estado
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('resumo');
  const [periodoResumo, setPeriodoResumo] = useState<PeriodoFiltro>('7dias');
  const [periodoExtrato, setPeriodoExtrato] = useState<PeriodoFiltro>('30dias');
  const [contaFiltro, setContaFiltro] = useState<string>('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('');
  
  // Loading states
  const [loadingSaldos, setLoadingSaldos] = useState(false);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [loadingGrafico, setLoadingGrafico] = useState(false);
  const [loadingExtrato, setLoadingExtrato] = useState(false);
  const [loadingContas, setLoadingContas] = useState(false);
  
  // Modais
  const [modalMovimentacao, setModalMovimentacao] = useState(false);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [modalAjuste, setModalAjuste] = useState(false);

  // Dados
  const [saldos, setSaldos] = useState<SaldosContas>({
    total_consolidado: 0,
    saldo_empresa: 0,
    saldo_rotas: 0,
    saldo_microseguros: 0,
    contas: [],
  });
  const [resumo, setResumo] = useState<ResumoMovimentacoes>({
    total_entradas: 0,
    total_saidas: 0,
    saldo_periodo: 0,
    qtd_entradas: 0,
    qtd_saidas: 0,
    qtd_total: 0,
  });
  const [dadosGrafico, setDadosGrafico] = useState<DadosGrafico[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoFinanceiro[]>([]);
  const [contas, setContas] = useState<ContaComDetalhes[]>([]);
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);

  // Carregar saldos
  const carregarSaldos = useCallback(async () => {
    if (!empresaId) return;
    setLoadingSaldos(true);
    try {
      const data = await financeiroService.buscarSaldosContas(empresaId);
      setSaldos(data);
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
    } finally {
      setLoadingSaldos(false);
    }
  }, [empresaId]);

  // Carregar resumo por período
  const carregarResumo = useCallback(async () => {
    if (!empresaId) return;
    setLoadingResumo(true);
    try {
      const data = await financeiroService.buscarResumoMovimentacoes(empresaId, periodoResumo);
      setResumo(data);
    } catch (error) {
      console.error('Erro ao carregar resumo:', error);
    } finally {
      setLoadingResumo(false);
    }
  }, [empresaId, periodoResumo]);

  // Carregar dados do gráfico
  const carregarGrafico = useCallback(async () => {
    if (!empresaId) return;
    setLoadingGrafico(true);
    try {
      const data = await financeiroService.buscarDadosGrafico(empresaId, periodoResumo);
      setDadosGrafico(data);
    } catch (error) {
      console.error('Erro ao carregar gráfico:', error);
    } finally {
      setLoadingGrafico(false);
    }
  }, [empresaId, periodoResumo]);

  // Carregar contas
  const carregarContas = useCallback(async () => {
    if (!empresaId) return;
    setLoadingContas(true);
    try {
      const data = await financeiroService.buscarContas(empresaId);
      setContas(data);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    } finally {
      setLoadingContas(false);
    }
  }, [empresaId]);

  // Carregar categorias
  const carregarCategorias = useCallback(async () => {
    try {
      const data = await financeiroService.buscarCategorias();
      setCategorias(data);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  }, []);

  // Carregar extrato
  const carregarExtrato = useCallback(async () => {
    if (!empresaId) return;
    setLoadingExtrato(true);
    try {
      const data = await financeiroService.buscarExtrato(empresaId, {
        periodo: periodoExtrato,
        conta_id: contaFiltro || undefined,
        categoria: categoriaFiltro || undefined,
      });
      setMovimentos(data);
    } catch (error) {
      console.error('Erro ao carregar extrato:', error);
    } finally {
      setLoadingExtrato(false);
    }
  }, [empresaId, periodoExtrato, contaFiltro, categoriaFiltro]);

  // Effects
  useEffect(() => {
    if (empresaId) {
      carregarSaldos();
      carregarContas();
      carregarCategorias();
    }
  }, [empresaId, carregarSaldos, carregarContas, carregarCategorias]);

  useEffect(() => {
    if (empresaId && abaAtiva === 'resumo') {
      carregarResumo();
      carregarGrafico();
    }
  }, [empresaId, abaAtiva, periodoResumo, carregarResumo, carregarGrafico]);

  useEffect(() => {
    if (empresaId && abaAtiva === 'extrato') {
      carregarExtrato();
    }
  }, [empresaId, abaAtiva, periodoExtrato, contaFiltro, categoriaFiltro, carregarExtrato]);

  // Handlers
  const handleSalvarMovimentacao = async (dados: any) => {
    const result = await financeiroService.criarMovimentacao(
      dados,
      profile?.user_id,
      profile?.nome
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    // Recarregar dados
    await Promise.all([carregarSaldos(), carregarContas(), carregarResumo(), carregarExtrato()]);
  };

  const handleSalvarTransferencia = async (dados: any) => {
    const result = await financeiroService.criarTransferencia(
      dados,
      profile?.user_id,
      profile?.nome
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    // Recarregar dados
    await Promise.all([carregarSaldos(), carregarContas(), carregarResumo(), carregarExtrato()]);
  };

  const handleSalvarAjuste = async (dados: any) => {
    const result = await financeiroService.criarAjusteSaldo(
      dados,
      profile?.user_id,
      profile?.nome
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    // Recarregar dados
    await Promise.all([carregarSaldos(), carregarContas(), carregarResumo(), carregarExtrato()]);
  };

  // Se não tem empresa selecionada
  if (!empresaId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          </div>
          <AvisoSelecioneEmpresa />
        </div>
      </div>
    );
  }

  // Calcular totais do extrato
  const totalEntradas = movimentos.filter(m => m.tipo === 'RECEBER').reduce((acc, m) => acc + m.valor, 0);
  const totalSaidas = movimentos.filter(m => m.tipo === 'PAGAR').reduce((acc, m) => acc + m.valor, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
          <button
            onClick={() => setAbaAtiva('resumo')}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${
              abaAtiva === 'resumo'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Resumo
          </button>
          <button
            onClick={() => setAbaAtiva('extrato')}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${
              abaAtiva === 'extrato'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Extrato Detalhado
          </button>
        </div>

        {/* ==================== ABA RESUMO ==================== */}
        {abaAtiva === 'resumo' && (
          <div className="space-y-6">
            {/* Cards de Saldo */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Saldos das Contas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <CardIndicador
                  titulo="Total Consolidado"
                  valor={saldos.total_consolidado}
                  icone={Wallet}
                  corIcone="text-indigo-600"
                  corFundo="bg-indigo-100"
                  loading={loadingSaldos}
                />
                <CardIndicador
                  titulo="Empresa"
                  valor={saldos.saldo_empresa}
                  icone={Building2}
                  corIcone="text-blue-600"
                  corFundo="bg-blue-100"
                  loading={loadingSaldos}
                />
                <CardIndicador
                  titulo="Rotas"
                  valor={saldos.saldo_rotas}
                  icone={MapPin}
                  corIcone="text-emerald-600"
                  corFundo="bg-emerald-100"
                  loading={loadingSaldos}
                />
                <CardIndicador
                  titulo="Microseguros"
                  valor={saldos.saldo_microseguros}
                  icone={Shield}
                  corIcone="text-amber-600"
                  corFundo="bg-amber-100"
                  loading={loadingSaldos}
                />
              </div>
            </div>

            {/* Movimentações + Gráfico */}
            <div>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Movimentações</h2>
                <BreadcrumbPeriodo periodoAtivo={periodoResumo} onChange={setPeriodoResumo} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cards de Movimentação */}
                <div className="grid grid-cols-3 gap-4">
                  <CardMovimentacao
                    tipo="entrada"
                    titulo="Entradas"
                    valor={resumo.total_entradas}
                    quantidade={resumo.qtd_entradas}
                    corValor="text-green-600"
                    loading={loadingResumo}
                  />
                  <CardMovimentacao
                    tipo="saida"
                    titulo="Saídas"
                    valor={resumo.total_saidas}
                    quantidade={resumo.qtd_saidas}
                    corValor="text-red-600"
                    loading={loadingResumo}
                  />
                  <CardMovimentacao
                    tipo="resultado"
                    titulo="Resultado"
                    valor={resumo.saldo_periodo}
                    quantidade={resumo.qtd_total}
                    corValor={resumo.saldo_periodo >= 0 ? 'text-green-600' : 'text-red-600'}
                    loading={loadingResumo}
                  />
                </div>

                {/* Gráfico */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="h-48">
                    {loadingGrafico ? (
                      <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                      </div>
                    ) : dadosGrafico.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        Sem dados para o período
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosGrafico} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis 
                            dataKey="data_formatada" 
                            tick={{ fontSize: 11 }} 
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                          />
                          <YAxis 
                            tick={{ fontSize: 11 }} 
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                          />
                          <Tooltip 
                            formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            labelStyle={{ color: '#374151' }}
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                          />
                          <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Ações Rápidas */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Ações Rápidas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BotaoAcaoRapida
                  icone={Plus}
                  titulo="Nova movimentação"
                  onClick={() => setModalMovimentacao(true)}
                />
                <BotaoAcaoRapida
                  icone={ArrowRightLeft}
                  titulo="Transferências"
                  onClick={() => setModalTransferencia(true)}
                />
                <BotaoAcaoRapida
                  icone={CheckSquare}
                  titulo="Ajuste Saldo"
                  onClick={() => setModalAjuste(true)}
                />
              </div>
            </div>
          </div>
        )}

        {/* ==================== ABA EXTRATO DETALHADO ==================== */}
        {abaAtiva === 'extrato' && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Breadcrumb de Período */}
              <BreadcrumbPeriodo periodoAtivo={periodoExtrato} onChange={setPeriodoExtrato} />
              
              {/* Filtros Dropdown */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Filtro de Conta */}
                <div className="relative">
                  <select
                    value={contaFiltro}
                    onChange={(e) => setContaFiltro(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Todas as Contas</option>
                    <optgroup label="🏢 Empresa">
                      {contas.filter(c => c.tipo_conta === 'EMPRESA').map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </optgroup>
                    <optgroup label="🛣️ Rotas">
                      {contas.filter(c => c.tipo_conta === 'ROTA').map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </optgroup>
                    <optgroup label="🛡️ Microseguros">
                      {contas.filter(c => c.tipo_conta === 'MICROSEGURO').map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </optgroup>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>

                {/* Filtro de Categoria */}
                <div className="relative">
                  <select
                    value={categoriaFiltro}
                    onChange={(e) => setCategoriaFiltro(e.target.value)}
                    className="appearance-none pl-4 pr-10 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">Todas as Categorias</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.codigo}>{c.nome_pt}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Tabela de Extrato */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingExtrato ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                        </td>
                      </tr>
                    ) : movimentos.length > 0 ? (
                      movimentos.map(m => (
                        <LinhaExtrato key={m.id} movimento={m} categorias={categorias} />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center">
                            <FileText className="w-12 h-12 text-gray-300 mb-3" />
                            <p className="text-gray-500">Nenhuma movimentação encontrada</p>
                            <p className="text-sm text-gray-400 mt-1">Ajuste os filtros ou período para ver mais resultados</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Footer da tabela com totais */}
              {movimentos.length > 0 && (
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
                    <span className="text-gray-600">
                      {movimentos.length} {movimentos.length === 1 ? 'registro' : 'registros'}
                    </span>
                    <div className="flex items-center gap-6">
                      <span className="text-green-600 font-medium">
                        Entradas: {totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className="text-red-600 font-medium">
                        Saídas: {totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      <ModalNovaMovimentacao
        isOpen={modalMovimentacao}
        onClose={() => setModalMovimentacao(false)}
        contas={contas}
        categorias={categorias}
        onSalvar={handleSalvarMovimentacao}
      />
      <ModalTransferencia
        isOpen={modalTransferencia}
        onClose={() => setModalTransferencia(false)}
        contas={contas}
        onSalvar={handleSalvarTransferencia}
      />
      <ModalAjusteSaldo
        isOpen={modalAjuste}
        onClose={() => setModalAjuste(false)}
        contas={contas}
        onSalvar={handleSalvarAjuste}
      />
    </div>
  );
}
