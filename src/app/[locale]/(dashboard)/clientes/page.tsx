'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Plus,
  ChevronDown,
  Phone,
  DollarSign,
  AlertTriangle,
  Eye,
  PlusCircle,
  CreditCard,
  X,
  Loader2,
  UserPlus,
  Building2,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { clientesService } from '@/services/clientes';
import type {
  ClienteComTotais,
  ContagemClientes,
  Segmento,
  RotaSimples,
  StatusCliente,
  FrequenciaPagamento,
} from '@/types/clientes';

// =====================================================
// CONSTANTES
// =====================================================

const STATUS_COLORS: Record<StatusCliente, { bg: string; text: string; label: string }> = {
  ATIVO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativo' },
  INATIVO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Inativo' },
  SUSPENSO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Suspenso' },
};

const FREQUENCIAS: { value: FrequenciaPagamento; label: string }[] = [
  { value: 'DIARIO', label: 'Diário' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'QUINZENAL', label: 'Quinzenal' },
  { value: 'MENSAL', label: 'Mensal' },
];

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

// =====================================================
// MODAL NOVA VENDA
// =====================================================

function ModalNovaVenda({
  isOpen,
  onClose,
  cliente,
  segmentos,
  rotas,
  empresaId,
  userId,
  onSucesso,
}: {
  isOpen: boolean;
  onClose: () => void;
  cliente?: ClienteComTotais | null;
  segmentos: Segmento[];
  rotas: RotaSimples[];
  empresaId: string;
  userId: string;
  onSucesso: () => void;
}) {
  const isNovoCliente = !cliente;
  const temEmprestimoAtivo = cliente && cliente.qtd_emprestimos_ativos > 0;

  const [etapa, setEtapa] = useState<'cliente' | 'emprestimo' | 'resumo'>('cliente');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Dados do cliente
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefoneCelular, setTelefoneCelular] = useState('');
  const [telefoneFixo, setTelefoneFixo] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [enderecoComercial, setEnderecoComercial] = useState('');
  const [segmentoId, setSegmentoId] = useState('');
  const [observacoesCliente, setObservacoesCliente] = useState('');

  // Dados do empréstimo
  const [rotaId, setRotaId] = useState('');
  const [valorPrincipal, setValorPrincipal] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState('12');
  const [taxaJuros, setTaxaJuros] = useState('20');
  const [frequencia, setFrequencia] = useState<FrequenciaPagamento>('DIARIO');
  const [dataPrimeiroVencimento, setDataPrimeiroVencimento] = useState('');
  const [observacoesEmprestimo, setObservacoesEmprestimo] = useState('');
  const [microseguroValor, setMicroseguroValor] = useState('');

  useEffect(() => {
    if (isOpen) {
      setEtapa(isNovoCliente ? 'cliente' : 'emprestimo');
      setErro('');
      
      if (cliente) {
        setNome(cliente.nome);
        setDocumento(cliente.documento || '');
        setTelefoneCelular(cliente.telefone_celular || '');
      } else {
        setNome('');
        setDocumento('');
        setTelefoneCelular('');
        setTelefoneFixo('');
        setEmail('');
        setEndereco('');
        setEnderecoComercial('');
        setSegmentoId('');
        setObservacoesCliente('');
      }
      
      setRotaId('');
      setValorPrincipal('');
      setNumeroParcelas('12');
      setTaxaJuros('20');
      setFrequencia('DIARIO');
      setMicroseguroValor('');
      setObservacoesEmprestimo('');
      
      const amanha = new Date();
      amanha.setDate(amanha.getDate() + 1);
      setDataPrimeiroVencimento(amanha.toISOString().split('T')[0]);
    }
  }, [isOpen, cliente, isNovoCliente]);

  const calculo = clientesService.calcularEmprestimo(
    parseFloat(valorPrincipal) || 0,
    parseFloat(taxaJuros) || 0,
    parseInt(numeroParcelas) || 1
  );

  const totalComMicroseguro = calculo.valor_total + (parseFloat(microseguroValor) || 0);

  const podeAvancarCliente = nome.trim() && telefoneCelular.trim();
  const podeAvancarEmprestimo = rotaId && valorPrincipal && numeroParcelas && taxaJuros && dataPrimeiroVencimento;

  const handleSalvar = async () => {
    setSalvando(true);
    setErro('');

    try {
      let resultado;

      if (isNovoCliente) {
        resultado = await clientesService.novaVendaCompleta({
          cliente_nome: nome,
          cliente_documento: documento || undefined,
          cliente_telefone: telefoneCelular,
          cliente_telefone_fixo: telefoneFixo || undefined,
          cliente_email: email || undefined,
          cliente_endereco: endereco || undefined,
          cliente_endereco_comercial: enderecoComercial || undefined,
          cliente_segmento_id: segmentoId || undefined,
          cliente_observacoes: observacoesCliente || undefined,
          valor_principal: parseFloat(valorPrincipal),
          numero_parcelas: parseInt(numeroParcelas),
          taxa_juros: parseFloat(taxaJuros),
          frequencia,
          data_primeiro_vencimento: dataPrimeiroVencimento,
          observacoes: observacoesEmprestimo || undefined,
          empresa_id: empresaId,
          rota_id: rotaId,
          user_id: userId,
          microseguro_valor: microseguroValor ? parseFloat(microseguroValor) : undefined,
        });
      } else if (temEmprestimoAtivo) {
        resultado = await clientesService.vendaAdicional({
          cliente_id: cliente!.id,
          valor_principal: parseFloat(valorPrincipal),
          numero_parcelas: parseInt(numeroParcelas),
          taxa_juros: parseFloat(taxaJuros),
          frequencia,
          data_primeiro_vencimento: dataPrimeiroVencimento,
          observacoes: observacoesEmprestimo || undefined,
          empresa_id: empresaId,
          rota_id: rotaId,
          user_id: userId,
          microseguro_valor: microseguroValor ? parseFloat(microseguroValor) : undefined,
        });
      } else {
        resultado = await clientesService.renovarEmprestimo({
          cliente_id: cliente!.id,
          valor_principal: parseFloat(valorPrincipal),
          numero_parcelas: parseInt(numeroParcelas),
          taxa_juros: parseFloat(taxaJuros),
          frequencia,
          data_primeiro_vencimento: dataPrimeiroVencimento,
          observacoes: observacoesEmprestimo || undefined,
          empresa_id: empresaId,
          rota_id: rotaId,
          user_id: userId,
          microseguro_valor: microseguroValor ? parseFloat(microseguroValor) : undefined,
        });
      }

      if (!resultado.success) {
        throw new Error(resultado.error || 'Erro ao processar venda');
      }

      onSucesso();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b bg-blue-600 text-white">
          <div>
            <h2 className="text-lg font-semibold">
              {isNovoCliente ? 'Nova Venda' : temEmprestimoAtivo ? 'Venda Adicional' : 'Renovação'}
            </h2>
            {cliente && <p className="text-blue-200 text-sm">{cliente.nome}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-blue-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b">
          {isNovoCliente && (
            <button
              onClick={() => setEtapa('cliente')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                etapa === 'cliente' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              1. Cliente
            </button>
          )}
          <button
            onClick={() => podeAvancarCliente && setEtapa('emprestimo')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              etapa === 'emprestimo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            {isNovoCliente ? '2.' : '1.'} Empréstimo
          </button>
          <button
            onClick={() => podeAvancarEmprestimo && setEtapa('resumo')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              etapa === 'resumo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
            }`}
          >
            {isNovoCliente ? '3.' : '2.'} Resumo
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {erro}
            </div>
          )}

          {etapa === 'cliente' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Nome do cliente"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Documento</label>
                  <input
                    type="text"
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    placeholder="CPF ou RG"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Celular *</label>
                  <input
                    type="tel"
                    value={telefoneCelular}
                    onChange={(e) => setTelefoneCelular(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone fixo</label>
                  <input
                    type="tel"
                    value={telefoneFixo}
                    onChange={(e) => setTelefoneFixo(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço residencial</label>
                  <input
                    type="text"
                    value={endereco}
                    onChange={(e) => setEndereco(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Endereço comercial</label>
                  <input
                    type="text"
                    value={enderecoComercial}
                    onChange={(e) => setEnderecoComercial(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
                  <select
                    value={segmentoId}
                    onChange={(e) => setSegmentoId(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {segmentos.map(s => (
                      <option key={s.id} value={s.id}>{s.nome_pt}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={observacoesCliente}
                    onChange={(e) => setObservacoesCliente(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {etapa === 'emprestimo' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rota *</label>
                <select
                  value={rotaId}
                  onChange={(e) => setRotaId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione a rota</option>
                  {rotas.map(r => (
                    <option key={r.id} value={r.id}>{r.nome} ({r.cidade_nome})</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Principal *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={valorPrincipal}
                      onChange={(e) => setValorPrincipal(e.target.value)}
                      className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Taxa de Juros *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxaJuros}
                      onChange={(e) => setTaxaJuros(e.target.value)}
                      className="w-full pl-4 pr-8 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nº de Parcelas *</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={numeroParcelas}
                    onChange={(e) => setNumeroParcelas(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequência *</label>
                  <select
                    value={frequencia}
                    onChange={(e) => setFrequencia(e.target.value as FrequenciaPagamento)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {FREQUENCIAS.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">1º Vencimento *</label>
                  <input
                    type="date"
                    value={dataPrimeiroVencimento}
                    onChange={(e) => setDataPrimeiroVencimento(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Microseguro</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={microseguroValor}
                      onChange={(e) => setMicroseguroValor(e.target.value)}
                      placeholder="0,00"
                      className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {valorPrincipal && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Resumo do Cálculo</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-blue-700">Valor Principal:</span>
                    <span className="text-right font-medium">{calculo.valor_principal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span className="text-blue-700">Juros ({taxaJuros}%):</span>
                    <span className="text-right font-medium">{calculo.valor_juros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span className="text-blue-700">Total a Receber:</span>
                    <span className="text-right font-medium">{calculo.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    <span className="text-blue-700">Valor da Parcela:</span>
                    <span className="text-right font-medium">{calculo.valor_parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {etapa === 'resumo' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Cliente
                </h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-gray-500">Nome:</span> <span className="font-medium">{nome}</span></p>
                  <p><span className="text-gray-500">Celular:</span> <span className="font-medium">{telefoneCelular}</span></p>
                  {documento && <p><span className="text-gray-500">Documento:</span> <span className="font-medium">{documento}</span></p>}
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Empréstimo
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Valor Principal:</span>
                    <span className="font-medium">{calculo.valor_principal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Juros ({taxaJuros}%):</span>
                    <span className="font-medium">+ {calculo.valor_juros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between border-t border-green-200 pt-2">
                    <span className="text-green-700 font-medium">Total a Receber:</span>
                    <span className="font-bold text-green-900">{calculo.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-600">
                    <span>{numeroParcelas}x de</span>
                    <span>{calculo.valor_parcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({frequencia})</span>
                  </div>
                </div>
              </div>

              {microseguroValor && parseFloat(microseguroValor) > 0 && (
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h4 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Microseguro
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-700">Valor:</span>
                    <span className="font-medium">{parseFloat(microseguroValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              )}

              <div className="bg-blue-600 rounded-lg p-4 text-white">
                <div className="flex justify-between items-center">
                  <span className="font-medium">TOTAL A RECEBER:</span>
                  <span className="text-2xl font-bold">{totalComMicroseguro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-3 p-5 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">
            Cancelar
          </button>
          
          <div className="flex gap-2">
            {etapa !== 'cliente' && (isNovoCliente || etapa === 'resumo') && (
              <button
                onClick={() => setEtapa(etapa === 'resumo' ? 'emprestimo' : 'cliente')}
                className="px-4 py-2.5 text-gray-700 font-medium bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Voltar
              </button>
            )}
            
            {etapa !== 'resumo' && (
              <button
                onClick={() => setEtapa(etapa === 'cliente' ? 'emprestimo' : 'resumo')}
                disabled={etapa === 'cliente' ? !podeAvancarCliente : !podeAvancarEmprestimo}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Avançar
              </button>
            )}
            
            {etapa === 'resumo' && (
              <button
                onClick={handleSalvar}
                disabled={salvando}
                className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar Venda
              </button>
            )}
          </div>
        </div>
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

  const handleVerDetalhes = (clienteId: string) => {
    console.log('Ver detalhes:', clienteId);
  };

  const handleSucessoVenda = () => {
    carregarClientes();
    carregarContagem();
  };

  if (!empresaId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Clientes</h1>
          <AvisoSelecioneEmpresa />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-gray-500 text-sm">{contagem.total} clientes cadastrados</p>
          </div>
          <button
            onClick={() => handleNovaVenda()}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
          >
            <UserPlus className="w-5 h-5" />
            Novo Cliente
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <CardEstatistica titulo="Total" valor={contagem.total} icone={Users} corIcone="text-gray-600" corFundo="bg-gray-100" onClick={() => setStatusFiltro('')} ativo={statusFiltro === ''} />
          <CardEstatistica titulo="Ativos" valor={contagem.ativos} icone={CheckCircle} corIcone="text-green-600" corFundo="bg-green-100" onClick={() => setStatusFiltro('ATIVO')} ativo={statusFiltro === 'ATIVO'} />
          <CardEstatistica titulo="Inativos" valor={contagem.inativos} icone={Clock} corIcone="text-gray-600" corFundo="bg-gray-100" onClick={() => setStatusFiltro('INATIVO')} ativo={statusFiltro === 'INATIVO'} />
          <CardEstatistica titulo="Suspensos" valor={contagem.suspensos} icone={AlertCircle} corIcone="text-red-600" corFundo="bg-red-100" onClick={() => setStatusFiltro('SUSPENSO')} ativo={statusFiltro === 'SUSPENSO'} />
          <CardEstatistica titulo="Com Empréstimo" valor={contagem.com_emprestimo_ativo} icone={CreditCard} corIcone="text-blue-600" corFundo="bg-blue-100" />
          <CardEstatistica titulo="Atrasados" valor={contagem.com_parcelas_atrasadas} icone={AlertTriangle} corIcone="text-amber-600" corFundo="bg-amber-100" />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, documento, telefone ou código..."
              className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={rotaFiltro}
            onChange={(e) => setRotaFiltro(e.target.value)}
            className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 min-w-[180px]"
          >
            <option value="">Todas as Rotas</option>
            {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select>
        </div>

        {loadingClientes ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente encontrado</h3>
            <p className="text-gray-500 mb-4">Ajuste os filtros ou cadastre um novo cliente</p>
            <button onClick={() => handleNovaVenda()} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <UserPlus className="w-4 h-4" /> Cadastrar Cliente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientes.map(cliente => (
              <CardCliente key={cliente.id} cliente={cliente} onVerDetalhes={handleVerDetalhes} onNovaVenda={handleNovaVenda} />
            ))}
          </div>
        )}
      </div>

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
