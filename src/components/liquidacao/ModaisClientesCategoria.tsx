'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  UserPlus,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// =====================================================
// TIPOS
// =====================================================

interface EmprestimoCategoria {
  id: string;
  valor_principal: number;
  valor_total: number;
  valor_parcela: number;
  numero_parcelas: number;
  taxa_juros: number;
  data_primeiro_vencimento: string | null;
  created_at: string;
  status: string;
  tipo_emprestimo: string;
  cliente: {
    nome: string;
    codigo_cliente?: number | string;
  } | null;
}

// =====================================================
// HELPERS
// =====================================================

function formatarMoeda(valor: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor || 0);
}

function formatarHora(data: string): string {
  return new Date(data).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarDataParcela(dataIso: string | null | undefined): string {
  if (!dataIso) return '—';
  const dataStr = dataIso.split('T')[0];
  return new Date(dataStr + 'T12:00:00').toLocaleDateString('pt-BR');
}

// =====================================================
// MODAL BASE
// =====================================================

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBgColor: string;
  children: React.ReactNode;
}

function ModalBase({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  iconBgColor,
  children,
}: ModalBaseProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 ${iconBgColor} rounded-lg flex items-center justify-center`}
            >
              {icon}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

// =====================================================
// CARD DE EMPRÉSTIMO (reutilizado pelos modais)
// =====================================================

function CardEmprestimoCategoria({
  emp,
  idx,
  bgClass,
  corValor,
  borderClass,
}: {
  emp: EmprestimoCategoria;
  idx: number;
  bgClass: string;
  corValor: string;
  borderClass: string;
}) {
  const clienteNome = emp.cliente?.nome || '—';
  const clienteCodigo = emp.cliente?.codigo_cliente
    ? `#${emp.cliente.codigo_cliente} `
    : '';
  const primeiroPgto = formatarDataParcela(emp.data_primeiro_vencimento);

  return (
    <div className={`p-3 ${bgClass} rounded-lg border-l-4 ${borderClass}`}>
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold text-gray-900">
          {String(idx + 1).padStart(2, '0')} {clienteCodigo}
          {clienteNome}
        </span>
        <span className={`text-sm font-bold whitespace-nowrap pl-2 ${corValor}`}>
          {formatarMoeda(Number(emp.valor_principal))}
        </span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        1° pgto: {primeiroPgto} · {emp.numero_parcelas}x{' '}
        {formatarMoeda(Number(emp.valor_parcela))} · {emp.taxa_juros}%
      </div>
      <div className="text-[10px] text-gray-400 mt-1">
        {formatarHora(emp.created_at)}
      </div>
    </div>
  );
}

// =====================================================
// HOOK GENÉRICO PARA CARREGAR EMPRÉSTIMOS POR CATEGORIA
// =====================================================

function useEmprestimosCategoria(
  isOpen: boolean,
  liquidacaoId: string,
  filtro: { tipo_emprestimo?: string; status?: string }
) {
  const [loading, setLoading] = useState(true);
  const [registros, setRegistros] = useState<EmprestimoCategoria[]>([]);

  useEffect(() => {
    if (isOpen && liquidacaoId) {
      carregar();
    }
  }, [isOpen, liquidacaoId]);

  const carregar = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from('emprestimos')
        .select(
          `
          id, valor_principal, valor_total, valor_parcela, numero_parcelas,
          taxa_juros, data_primeiro_vencimento, created_at, status, tipo_emprestimo,
          cliente:cliente_id(nome, codigo_cliente)
        `
        )
        .eq('liquidacao_id', liquidacaoId)
        .order('created_at', { ascending: false });

      if (filtro.tipo_emprestimo) {
        query = query.eq('tipo_emprestimo', filtro.tipo_emprestimo);
      }
      if (filtro.status) {
        query = query.eq('status', filtro.status);
      }

      const { data, error } = await query;
      if (!error && data) {
        setRegistros(data as unknown as EmprestimoCategoria[]);
      }
    } catch (error) {
      console.error('Erro ao carregar empréstimos:', error);
    } finally {
      setLoading(false);
    }
  };

  return { loading, registros };
}

// =====================================================
// MODAL: CLIENTES NOVOS
// =====================================================

interface ModalCategoriaProps {
  isOpen: boolean;
  onClose: () => void;
  liquidacaoId: string;
  totalFallback?: number;
}

export function ModalClientesNovos({
  isOpen,
  onClose,
  liquidacaoId,
  totalFallback = 0,
}: ModalCategoriaProps) {
  const { loading, registros } = useEmprestimosCategoria(isOpen, liquidacaoId, {
    tipo_emprestimo: 'NOVO',
  });

  const qtd = loading ? totalFallback : registros.length;
  const total = registros.reduce((s, r) => s + Number(r.valor_principal), 0);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Clientes Novos"
      subtitle={`${qtd} cliente(s) · ${formatarMoeda(total)}`}
      icon={<UserPlus className="w-5 h-5 text-green-600" />}
      iconBgColor="bg-green-100"
    >
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
          </div>
        ) : registros.length > 0 ? (
          <div className="space-y-3">
            {registros.map((emp, idx) => (
              <CardEmprestimoCategoria
                key={emp.id}
                emp={emp}
                idx={idx}
                bgClass="bg-green-50"
                corValor="text-green-700"
                borderClass="border-green-400"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Nenhum cliente novo neste dia
          </div>
        )}

        {registros.length > 0 && (
          <div className="mt-4 p-3 bg-green-100 rounded-lg flex justify-between items-center">
            <span className="font-medium text-green-800">TOTAL EMPRESTADO</span>
            <span className="font-bold text-green-800">{formatarMoeda(total)}</span>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

// =====================================================
// MODAL: CLIENTES RENOVADOS
// =====================================================

export function ModalClientesRenovados({
  isOpen,
  onClose,
  liquidacaoId,
  totalFallback = 0,
}: ModalCategoriaProps) {
  const { loading, registros } = useEmprestimosCategoria(isOpen, liquidacaoId, {
    tipo_emprestimo: 'RENOVACAO',
  });

  const qtd = loading ? totalFallback : registros.length;
  const total = registros.reduce((s, r) => s + Number(r.valor_principal), 0);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Clientes Renovados"
      subtitle={`${qtd} cliente(s) · ${formatarMoeda(total)}`}
      icon={<RefreshCw className="w-5 h-5 text-blue-600" />}
      iconBgColor="bg-blue-100"
    >
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : registros.length > 0 ? (
          <div className="space-y-3">
            {registros.map((emp, idx) => (
              <CardEmprestimoCategoria
                key={emp.id}
                emp={emp}
                idx={idx}
                bgClass="bg-blue-50"
                corValor="text-blue-700"
                borderClass="border-blue-400"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Nenhuma renovação neste dia
          </div>
        )}

        {registros.length > 0 && (
          <div className="mt-4 p-3 bg-blue-100 rounded-lg flex justify-between items-center">
            <span className="font-medium text-blue-800">TOTAL EMPRESTADO</span>
            <span className="font-bold text-blue-800">{formatarMoeda(total)}</span>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

// =====================================================
// MODAL: CLIENTES RENEGOCIADOS
// =====================================================

export function ModalClientesRenegociados({
  isOpen,
  onClose,
  liquidacaoId,
  totalFallback = 0,
}: ModalCategoriaProps) {
  const { loading, registros } = useEmprestimosCategoria(isOpen, liquidacaoId, {
    tipo_emprestimo: 'RENEGOCIACAO',
  });

  const qtd = loading ? totalFallback : registros.length;
  const total = registros.reduce((s, r) => s + Number(r.valor_principal), 0);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Clientes Renegociados"
      subtitle={`${qtd} cliente(s) · ${formatarMoeda(total)}`}
      icon={<RotateCcw className="w-5 h-5 text-purple-600" />}
      iconBgColor="bg-purple-100"
    >
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          </div>
        ) : registros.length > 0 ? (
          <div className="space-y-3">
            {registros.map((emp, idx) => (
              <CardEmprestimoCategoria
                key={emp.id}
                emp={emp}
                idx={idx}
                bgClass="bg-purple-50"
                corValor="text-purple-700"
                borderClass="border-purple-400"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Nenhuma renegociação neste dia
          </div>
        )}

        {registros.length > 0 && (
          <div className="mt-4 p-3 bg-purple-100 rounded-lg flex justify-between items-center">
            <span className="font-medium text-purple-800">TOTAL RENEGOCIADO</span>
            <span className="font-bold text-purple-800">{formatarMoeda(total)}</span>
          </div>
        )}
      </div>
    </ModalBase>
  );
}

// =====================================================
// MODAL: CLIENTES QUITADOS
// =====================================================

export function ModalClientesQuitados({
  isOpen,
  onClose,
  liquidacaoId,
  totalFallback = 0,
}: ModalCategoriaProps) {
  const { loading, registros } = useEmprestimosCategoria(isOpen, liquidacaoId, {
    status: 'QUITADO',
  });

  const qtd = loading ? totalFallback : registros.length;
  const total = registros.reduce((s, r) => s + Number(r.valor_principal), 0);

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Empréstimos Quitados"
      subtitle={`${qtd} cliente(s) · ${formatarMoeda(total)}`}
      icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
      iconBgColor="bg-emerald-100"
    >
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : registros.length > 0 ? (
          <div className="space-y-3">
            {registros.map((emp, idx) => (
              <CardEmprestimoCategoria
                key={emp.id}
                emp={emp}
                idx={idx}
                bgClass="bg-emerald-50"
                corValor="text-emerald-700"
                borderClass="border-emerald-400"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Nenhum empréstimo quitado neste dia
          </div>
        )}

        {registros.length > 0 && (
          <div className="mt-4 p-3 bg-emerald-100 rounded-lg flex justify-between items-center">
            <span className="font-medium text-emerald-800">TOTAL QUITADO</span>
            <span className="font-bold text-emerald-800">{formatarMoeda(total)}</span>
          </div>
        )}
      </div>
    </ModalBase>
  );
}