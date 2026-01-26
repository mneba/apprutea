'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Calendar,
  AlertTriangle,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// =====================================================
// TIPOS
// =====================================================

type FrequenciaPagamento = 'DIARIO' | 'SEMANAL' | 'QUINZENAL' | 'MENSAL' | 'FLEXIVEL';

interface EmprestimoParaEdicao {
  id: string;
  valor_principal: number;
  valor_total: number;
  valor_saldo: number;
  numero_parcelas: number;
  parcelas_pagas?: number;
  taxa_juros: number;
  frequencia_pagamento: FrequenciaPagamento;
  dia_semana_cobranca?: number | null;
  dia_mes_cobranca?: number | null;
  dias_mes_cobranca?: number[] | null;
  status: string;
  observacoes?: string;
}

interface CardEdicaoEmprestimoProps {
  emprestimo: EmprestimoParaEdicao;
  onSucesso?: () => void;
  onRenegociar?: (emprestimoId: string) => void;
}

// =====================================================
// CONSTANTES
// =====================================================

const FREQUENCIAS: { value: FrequenciaPagamento; label: string; icone: string }[] = [
  { value: 'DIARIO', label: 'Diário', icone: '📅' },
  { value: 'SEMANAL', label: 'Semanal', icone: '📆' },
  { value: 'QUINZENAL', label: 'Quinzenal', icone: '🗓️' },
  { value: 'MENSAL', label: 'Mensal', icone: '📊' },
  { value: 'FLEXIVEL', label: 'Flexível', icone: '⚡' },
];

const DIAS_SEMANA = [
  { value: 0, label: 'Dom', completo: 'Domingo' },
  { value: 1, label: 'Seg', completo: 'Segunda' },
  { value: 2, label: 'Ter', completo: 'Terça' },
  { value: 3, label: 'Qua', completo: 'Quarta' },
  { value: 4, label: 'Qui', completo: 'Quinta' },
  { value: 5, label: 'Sex', completo: 'Sexta' },
  { value: 6, label: 'Sáb', completo: 'Sábado' },
];

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function CardEdicaoEmprestimo({
  emprestimo,
  onSucesso,
  onRenegociar,
}: CardEdicaoEmprestimoProps) {
  // Estados
  const [editando, setEditando] = useState(false);
  const [frequencia, setFrequencia] = useState<FrequenciaPagamento>(emprestimo.frequencia_pagamento);
  const [diaSemana, setDiaSemana] = useState<number | null>(emprestimo.dia_semana_cobranca ?? null);
  const [diaMes, setDiaMes] = useState<number | null>(emprestimo.dia_mes_cobranca ?? null);
  const [diasFlexiveis, setDiasFlexiveis] = useState<number[]>(emprestimo.dias_mes_cobranca ?? []);
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>(''); // ⭐ NOVO
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [requerRenegociacao, setRequerRenegociacao] = useState(false);
  const [parcelasAtrasadas, setParcelasAtrasadas] = useState(0);

  // Resetar ao mudar empréstimo
  useEffect(() => {
    setFrequencia(emprestimo.frequencia_pagamento);
    setDiaSemana(emprestimo.dia_semana_cobranca ?? null);
    setDiaMes(emprestimo.dia_mes_cobranca ?? null);
    setDiasFlexiveis(emprestimo.dias_mes_cobranca ?? []);
    setDataPrimeiraParcela('');
    setEditando(false);
    setErro(null);
    setSucesso(null);
    setRequerRenegociacao(false);
  }, [emprestimo.id]);

  // Verificar se houve mudança de frequência
  const mudouFrequencia = frequencia !== emprestimo.frequencia_pagamento;
  
  // Verificar se houve alguma mudança
  const houveMudanca = 
    mudouFrequencia ||
    diaSemana !== emprestimo.dia_semana_cobranca ||
    diaMes !== emprestimo.dia_mes_cobranca ||
    JSON.stringify(diasFlexiveis) !== JSON.stringify(emprestimo.dias_mes_cobranca || []);

  // ⭐ Validar se pode salvar
  const podeSalvar = () => {
    if (!houveMudanca) return false;
    
    // Se mudou frequência, data é obrigatória
    if (mudouFrequencia && !dataPrimeiraParcela) return false;
    
    // Validar parâmetros específicos
    if (frequencia === 'SEMANAL' && diaSemana === null) return false;
    if (frequencia === 'MENSAL' && diaMes === null) return false;
    if (frequencia === 'FLEXIVEL' && diasFlexiveis.length === 0) return false;
    
    return true;
  };

  // Handler para salvar
  const handleSalvar = async () => {
    // Validações
    if (mudouFrequencia && !dataPrimeiraParcela) {
      setErro('Informe a data da primeira parcela pendente.');
      return;
    }
    
    if (frequencia === 'SEMANAL' && diaSemana === null) {
      setErro('Selecione o dia da semana para cobrança.');
      return;
    }
    
    if (frequencia === 'MENSAL' && diaMes === null) {
      setErro('Selecione o dia do mês para cobrança.');
      return;
    }
    
    if (frequencia === 'FLEXIVEL' && diasFlexiveis.length === 0) {
      setErro('Selecione pelo menos um dia do mês.');
      return;
    }

    setSalvando(true);
    setErro(null);
    setSucesso(null);
    setRequerRenegociacao(false);

    try {
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase.rpc('fn_alterar_emprestimo', {
        p_emprestimo_id: emprestimo.id,
        p_user_id: user.id,
        p_frequencia_pagamento: frequencia,
        p_dia_semana_cobranca: frequencia === 'SEMANAL' ? diaSemana : null,
        p_dia_mes_cobranca: frequencia === 'MENSAL' ? diaMes : null,
        p_dias_mes_cobranca: frequencia === 'FLEXIVEL' ? diasFlexiveis : null,
        p_data_primeira_parcela: mudouFrequencia ? dataPrimeiraParcela : null,
      });

      if (error) throw error;

      const resultado = Array.isArray(data) ? data[0] : data;

      if (resultado?.sucesso) {
        setSucesso(resultado.mensagem);
        setEditando(false);
        // Chamar onSucesso imediatamente para recarregar os dados
        onSucesso?.();
        // Limpar mensagem de sucesso após 2 segundos
        setTimeout(() => {
          setSucesso(null);
        }, 2000);
      } else {
        if (resultado?.requer_renegociacao) {
          setRequerRenegociacao(true);
          setParcelasAtrasadas(resultado.parcelas_atrasadas || 0);
        }
        setErro(resultado?.mensagem || 'Erro ao alterar empréstimo');
      }
    } catch (error: any) {
      console.error('Erro ao alterar empréstimo:', error);
      setErro(error.message || 'Erro ao alterar empréstimo');
    } finally {
      setSalvando(false);
    }
  };

  // Cancelar edição
  const handleCancelar = () => {
    setFrequencia(emprestimo.frequencia_pagamento);
    setDiaSemana(emprestimo.dia_semana_cobranca ?? null);
    setDiaMes(emprestimo.dia_mes_cobranca ?? null);
    setDiasFlexiveis(emprestimo.dias_mes_cobranca ?? []);
    setDataPrimeiraParcela('');
    setEditando(false);
    setErro(null);
    setRequerRenegociacao(false);
  };

  // Toggle dia flexível
  const toggleDiaFlexivel = (dia: number) => {
    setDiasFlexiveis(prev => 
      prev.includes(dia) 
        ? prev.filter(d => d !== dia)
        : [...prev, dia].sort((a, b) => a - b)
    );
  };

  // Se empréstimo não está ATIVO, não permite edição
  if (emprestimo.status !== 'ATIVO') {
    return null;
  }

  // Data mínima = hoje
  const dataMinima = new Date().toISOString().split('T')[0];

  return (
    <div className="border-t border-gray-100 pt-3 mt-3">
      {/* Header da seção */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          Frequência de Pagamento
        </h4>
        {!editando && (
          <button
            onClick={() => setEditando(true)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            Alterar
          </button>
        )}
      </div>

      {/* Mensagens */}
      {erro && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm">
          <div className="flex items-start gap-2 text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p>{erro}</p>
              {requerRenegociacao && (
                <button
                  onClick={() => onRenegociar?.(emprestimo.id)}
                  className="mt-2 px-3 py-1 bg-amber-500 text-white rounded text-xs font-medium hover:bg-amber-600 transition-colors"
                >
                  <RefreshCw className="w-3 h-3 inline mr-1" />
                  Iniciar Renegociação ({parcelasAtrasadas} parcela(s) em atraso)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {sucesso && (
        <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4" />
          {sucesso}
        </div>
      )}

      {/* Modo visualização */}
      {!editando && (
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
            {FREQUENCIAS.find(f => f.value === emprestimo.frequencia_pagamento)?.icone}{' '}
            {FREQUENCIAS.find(f => f.value === emprestimo.frequencia_pagamento)?.label}
          </span>
          {emprestimo.frequencia_pagamento === 'SEMANAL' && emprestimo.dia_semana_cobranca !== null && (
            <span className="text-sm text-gray-500">
              ({DIAS_SEMANA.find(d => d.value === emprestimo.dia_semana_cobranca)?.completo})
            </span>
          )}
          {emprestimo.frequencia_pagamento === 'MENSAL' && emprestimo.dia_mes_cobranca && (
            <span className="text-sm text-gray-500">
              (Dia {emprestimo.dia_mes_cobranca})
            </span>
          )}
          {emprestimo.frequencia_pagamento === 'FLEXIVEL' && emprestimo.dias_mes_cobranca?.length && (
            <span className="text-sm text-gray-500">
              (Dias: {emprestimo.dias_mes_cobranca.join(', ')})
            </span>
          )}
        </div>
      )}

      {/* Modo edição */}
      {editando && (
        <div className="space-y-4 bg-gray-50 rounded-lg p-3 -mx-1">
          {/* Seleção de frequência */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Nova Frequência</label>
            <div className="grid grid-cols-5 gap-1">
              {FREQUENCIAS.map((freq) => (
                <button
                  key={freq.value}
                  type="button"
                  onClick={() => setFrequencia(freq.value)}
                  className={`p-2 rounded-lg border text-center transition-all text-xs ${
                    frequencia === freq.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className="block text-lg mb-0.5">{freq.icone}</span>
                  {freq.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dia da semana (SEMANAL) */}
          {frequencia === 'SEMANAL' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Dia da Semana <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-7 gap-1">
                {DIAS_SEMANA.map((dia) => (
                  <button
                    key={dia.value}
                    type="button"
                    onClick={() => setDiaSemana(dia.value)}
                    className={`p-2 rounded text-center transition-all text-xs ${
                      diaSemana === dia.value
                        ? 'bg-blue-500 text-white font-medium'
                        : 'bg-white border border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dia do mês (MENSAL) */}
          {frequencia === 'MENSAL' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Dia do Mês <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => setDiaMes(dia)}
                    className={`p-1.5 rounded text-center transition-all text-xs ${
                      diaMes === dia
                        ? 'bg-blue-500 text-white font-medium'
                        : 'bg-white border border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dias flexíveis */}
          {frequencia === 'FLEXIVEL' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Dias do Mês (selecione múltiplos) <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((dia) => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => toggleDiaFlexivel(dia)}
                    className={`p-1.5 rounded text-center transition-all text-xs ${
                      diasFlexiveis.includes(dia)
                        ? 'bg-blue-500 text-white font-medium'
                        : 'bg-white border border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
              {diasFlexiveis.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Selecionados: {diasFlexiveis.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* ⭐ DATA DA PRIMEIRA PARCELA (obrigatório se mudou frequência) */}
          {mudouFrequencia && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <label className="block text-xs font-medium text-amber-800 mb-2">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Data da Primeira Parcela Pendente <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dataPrimeiraParcela}
                onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                min={dataMinima}
                className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm bg-white"
                required
              />
              <p className="mt-1 text-xs text-amber-600">
                Esta data será usada como base para recalcular todas as parcelas pendentes.
              </p>
            </div>
          )}

          {/* Aviso de recálculo */}
          {houveMudanca && !mudouFrequencia && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2 text-blue-700 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>As configurações do empréstimo serão atualizadas.</p>
              </div>
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={handleCancelar}
              disabled={salvando}
              className="px-3 py-1.5 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={salvando || !podeSalvar()}
              className="px-3 py-1.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
