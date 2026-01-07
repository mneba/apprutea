'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Loader2, 
  TrendingUp,
  TrendingDown,
  ArrowRight,
  DollarSign,
  FileText,
  Building2,
  MapPin,
  Shield,
  Wallet,
  AlertCircle,
  ArrowRightLeft,
  CheckSquare,
} from 'lucide-react';
import type { ContaComDetalhes, CategoriaFinanceira } from '@/types/financeiro';

// =====================================================
// MODAL NOVA MOVIMENTAÇÃO (Entrada/Saída)
// =====================================================

interface ModalNovaMovimentacaoProps {
  isOpen: boolean;
  onClose: () => void;
  contas: ContaComDetalhes[];
  categorias: CategoriaFinanceira[];
  onSalvar: (dados: any) => Promise<void>;
}

export function ModalNovaMovimentacao({ 
  isOpen, 
  onClose, 
  contas,
  categorias,
  onSalvar 
}: ModalNovaMovimentacaoProps) {
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

  // Ícone e cor baseados no tipo de conta
  const getIconeConta = (tipoConta: string) => {
    switch (tipoConta) {
      case 'EMPRESA': return <Building2 className="w-4 h-4 text-blue-600" />;
      case 'ROTA': return <MapPin className="w-4 h-4 text-green-600" />;
      case 'MICROSEGURO': return <Shield className="w-4 h-4 text-purple-600" />;
      default: return <Wallet className="w-4 h-4 text-gray-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header com gradiente */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          tipo === 'RECEBER' 
            ? 'bg-gradient-to-r from-green-600 to-green-700' 
            : 'bg-gradient-to-r from-red-600 to-red-700'
        }`}>
          <div className="flex items-center gap-3">
            {tipo === 'RECEBER' ? (
              <TrendingUp className="w-6 h-6 text-white" />
            ) : (
              <TrendingDown className="w-6 h-6 text-white" />
            )}
            <h2 className="text-xl font-semibold text-white">
              {tipo === 'RECEBER' ? 'Nova Entrada' : 'Nova Saída'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {/* Tipo de Movimento */}
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de Movimento</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setTipo('RECEBER'); setCategoria(''); }}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                  tipo === 'RECEBER' 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <TrendingUp className="w-5 h-5" />
                Entrada
              </button>
              <button
                onClick={() => { setTipo('PAGAR'); setCategoria(''); }}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                  tipo === 'PAGAR' 
                    ? 'border-red-500 bg-red-50 text-red-700' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <TrendingDown className="w-5 h-5" />
                Saída
              </button>
            </div>
          </div>

          {/* Conta */}
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Wallet className="w-4 h-4 text-gray-500" />
              Conta *
            </label>
            <select
              value={contaId}
              onChange={(e) => { setContaId(e.target.value); setCategoria(''); }}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            {contaSelecionada && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                {getIconeConta(contaSelecionada.tipo_conta)}
                <span>Saldo atual: <strong>{contaSelecionada.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></span>
              </div>
            )}
          </div>

          {/* Categoria e Valor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4 text-gray-500" />
                Categoria *
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!contaId}
              >
                <option value="">Selecione</option>
                {categoriasFiltradas.map(c => (
                  <option key={c.id} value={c.codigo}>{c.nome_pt}</option>
                ))}
              </select>
            </div>

            <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <DollarSign className={`w-4 h-4 ${tipo === 'RECEBER' ? 'text-green-500' : 'text-red-500'}`} />
                Valor *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">Descrição *</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Pagamento parcela 5/24 - João Silva"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Forma de Pagamento e Observações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="DINHEIRO">💵 Dinheiro</option>
                <option value="PIX">📱 PIX</option>
                <option value="TRANSFERENCIA">🏦 Transferência</option>
                <option value="CARTAO">💳 Cartão</option>
              </select>
            </div>

            <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Anotações..."
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !contaId || !categoria || !descricao || !valor}
            className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-xl transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
              tipo === 'RECEBER' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {tipo === 'RECEBER' ? (
              <>
                <TrendingUp className="w-4 h-4" />
                Registrar Entrada
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4" />
                Registrar Saída
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


// =====================================================
// MODAL TRANSFERÊNCIA
// =====================================================

interface ModalTransferenciaProps {
  isOpen: boolean;
  onClose: () => void;
  contas: ContaComDetalhes[];
  onSalvar: (dados: any) => Promise<void>;
}

export function ModalTransferencia({ 
  isOpen, 
  onClose, 
  contas,
  onSalvar 
}: ModalTransferenciaProps) {
  const [contaOrigem, setContaOrigem] = useState('');
  const [contaDestino, setContaDestino] = useState('');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const contaOrigemObj = contas.find(c => c.id === contaOrigem);
  const contaDestinoObj = contas.find(c => c.id === contaDestino);
  const contasDestinoFiltradas = contas.filter(c => c.id !== contaOrigem);

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

  // Ícone baseado no tipo de conta
  const getIconeConta = (tipoConta: string) => {
    switch (tipoConta) {
      case 'EMPRESA': return '🏢';
      case 'ROTA': return '🛣️';
      case 'MICROSEGURO': return '🛡️';
      default: return '💰';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">Transferência entre Contas</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {/* Conta de Origem */}
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Wallet className="w-4 h-4 text-red-500" />
              Conta de Origem (Saída) *
            </label>
            <select
              value={contaOrigem}
              onChange={(e) => { setContaOrigem(e.target.value); setContaDestino(''); }}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione a conta de origem</option>
              {contas.map(c => (
                <option key={c.id} value={c.id}>
                  {getIconeConta(c.tipo_conta)} {c.nome} - {c.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </option>
              ))}
            </select>
            {contaOrigemObj && (
              <p className="mt-2 text-sm text-gray-500">
                Saldo disponível: <strong className="text-gray-700">{contaOrigemObj.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </p>
            )}
          </div>

          {/* Seta visual */}
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          {/* Conta de Destino */}
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Wallet className="w-4 h-4 text-green-500" />
              Conta de Destino (Entrada) *
            </label>
            <select
              value={contaDestino}
              onChange={(e) => setContaDestino(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!contaOrigem}
            >
              <option value="">Selecione a conta de destino</option>
              {contasDestinoFiltradas.map(c => (
                <option key={c.id} value={c.id}>
                  {getIconeConta(c.tipo_conta)} {c.nome} - {c.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </option>
              ))}
            </select>
            {contaDestinoObj && (
              <p className="mt-2 text-sm text-gray-500">
                Saldo atual: <strong className="text-gray-700">{contaDestinoObj.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </p>
            )}
          </div>

          {/* Valor */}
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <DollarSign className="w-4 h-4 text-blue-500" />
              Valor da Transferência *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={contaOrigemObj?.saldo_atual || undefined}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Descrição e Observações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Capital para rota"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
              <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
              <input
                type="text"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Anotações..."
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Preview da transferência */}
          {contaOrigemObj && contaDestinoObj && valor && (
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-3">Resumo da Transferência</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">{contaOrigemObj.nome}:</span>
                  <span className="text-red-600 font-medium">- {parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">{contaDestinoObj.nome}:</span>
                  <span className="text-green-600 font-medium">+ {parseFloat(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !contaOrigem || !contaDestino || !valor}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            <ArrowRightLeft className="w-4 h-4" />
            Confirmar Transferência
          </button>
        </div>
      </div>
    </div>
  );
}


// =====================================================
// MODAL AJUSTE DE SALDO
// =====================================================

interface ModalAjusteSaldoProps {
  isOpen: boolean;
  onClose: () => void;
  contas: ContaComDetalhes[];
  onSalvar: (dados: any) => Promise<void>;
}

export function ModalAjusteSaldo({ 
  isOpen, 
  onClose, 
  contas,
  onSalvar 
}: ModalAjusteSaldoProps) {
  const [contaId, setContaId] = useState('');
  const [saldoFinal, setSaldoFinal] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const contaSelecionada = contas.find(c => c.id === contaId);
  const saldoAtual = contaSelecionada?.saldo_atual || 0;
  const saldoFinalNum = parseFloat(saldoFinal) || 0;
  const diferenca = saldoFinalNum - saldoAtual;

  useEffect(() => {
    if (isOpen) {
      setContaId('');
      setSaldoFinal('');
      setMotivo('');
      setObservacoes('');
      setErro('');
    }
  }, [isOpen]);

  // Quando seleciona conta, preenche saldo atual como sugestão
  useEffect(() => {
    if (contaSelecionada) {
      setSaldoFinal(contaSelecionada.saldo_atual.toFixed(2));
    }
  }, [contaSelecionada]);

  const handleSalvar = async () => {
    if (!contaId || saldoFinal === '' || !motivo) {
      setErro('Preencha todos os campos obrigatórios');
      return;
    }

    if (diferenca === 0) {
      setErro('O saldo final é igual ao saldo atual. Nenhum ajuste necessário.');
      return;
    }
    
    setSalvando(true);
    setErro('');
    try {
      await onSalvar({
        conta_id: contaId,
        saldo_final: saldoFinalNum,
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

  // Ícone baseado no tipo de conta
  const getIconeConta = (tipoConta: string) => {
    switch (tipoConta) {
      case 'EMPRESA': return '🏢';
      case 'ROTA': return '🛣️';
      case 'MICROSEGURO': return '🛡️';
      default: return '💰';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-amber-600 to-amber-700">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-6 h-6 text-white" />
            <h2 className="text-xl font-semibold text-white">Ajuste de Saldo</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && (
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {/* Info */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Como funciona</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Informe o <strong>saldo correto</strong> que a conta deveria ter. O sistema calculará automaticamente a diferença e registrará o ajuste.
              </p>
            </div>
          </div>

          {/* Conta */}
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              Conta *
            </label>
            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Selecione a conta</option>
              {contas.map(c => (
                <option key={c.id} value={c.id}>
                  {getIconeConta(c.tipo_conta)} {c.nome} - Saldo: {c.saldo_atual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </option>
              ))}
            </select>
          </div>

          {/* Saldos */}
          {contaSelecionada && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
                <label className="block text-sm font-medium text-gray-500 mb-2">Saldo Atual (Sistema)</label>
                <p className="text-2xl font-bold text-gray-700">
                  {saldoAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>

              <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50">
                <label className="flex items-center gap-2 text-sm font-medium text-amber-700 mb-2">
                  <DollarSign className="w-4 h-4" />
                  Saldo Correto (Novo) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={saldoFinal}
                    onChange={(e) => setSaldoFinal(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-12 pr-4 py-2.5 rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Diferença calculada */}
          {contaSelecionada && saldoFinal !== '' && diferenca !== 0 && (
            <div className={`p-4 rounded-xl border ${
              diferenca > 0 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <p className="text-sm font-medium mb-1">
                {diferenca > 0 ? '⬆️ Ajuste de Entrada' : '⬇️ Ajuste de Saída'}
              </p>
              <p className={`text-2xl font-bold ${
                diferenca > 0 ? 'text-green-700' : 'text-red-700'
              }`}>
                {diferenca > 0 ? '+' : ''}{diferenca.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          )}

          {/* Motivo */}
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <FileText className="w-4 h-4 text-gray-500" />
              Motivo do Ajuste *
            </label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Selecione o motivo</option>
              <option value="CONFERENCIA_CAIXA">Conferência de caixa</option>
              <option value="CORRECAO_ERRO">Correção de erro</option>
              <option value="ABERTURA_DIA">Abertura do dia</option>
              <option value="FECHAMENTO_DIA">Fechamento do dia</option>
              <option value="AUDITORIA">Auditoria</option>
              <option value="OUTRO">Outro motivo</option>
            </select>
          </div>

          {/* Observações */}
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-white">
            <label className="block text-sm font-medium text-gray-700 mb-2">Observações</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Descreva o motivo do ajuste com mais detalhes..."
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={salvando || !contaId || saldoFinal === '' || !motivo || diferenca === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            <CheckSquare className="w-4 h-4" />
            Registrar Ajuste
          </button>
        </div>
      </div>
    </div>
  );
}
