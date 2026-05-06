'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  MapPin,
  Plus,
  Loader2,
  Edit,
  Trash2,
  Save,
  Search,
  Building2,
} from 'lucide-react';
import { organizacaoService } from '@/services/organizacao';
import type { CidadeComResumo } from '@/types/organizacao';

interface ModalGerenciarCidadesProps {
  aberto: boolean;
  onFechar: () => void;
  onCidadesAlteradas?: () => void;
}

export default function ModalGerenciarCidades({
  aberto,
  onFechar,
  onCidadesAlteradas,
}: ModalGerenciarCidadesProps) {
  // Listas
  const [cidades, setCidades] = useState<CidadeComResumo[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Filtros
  const [filtroPais, setFiltroPais] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [busca, setBusca] = useState('');

  // Edição inline
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nomeEditando, setNomeEditando] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Deleção
  const [deletandoId, setDeletandoId] = useState<string | null>(null);

  // Criação inline (quando busca não retorna nada)
  const [criandoNova, setCriandoNova] = useState(false);

  // Carregar ao abrir
  useEffect(() => {
    if (aberto) {
      carregarCidades();
      // Reset de filtros e edição
      setFiltroPais('');
      setFiltroEstado('');
      setBusca('');
      setEditandoId(null);
      setNomeEditando('');
    }
  }, [aberto]);

  const carregarCidades = async () => {
    setCarregando(true);
    try {
      const lista = await organizacaoService.listarTodasCidades();
      setCidades(lista);
    } catch (err) {
      console.error('Erro ao carregar cidades:', err);
    } finally {
      setCarregando(false);
    }
  };

  // Listas únicas para filtros
  const paisesDisponiveis = useMemo(() => {
    const set = new Set(cidades.map((c) => c.pais));
    return Array.from(set).sort();
  }, [cidades]);

  const estadosDisponiveis = useMemo(() => {
    const filtradas = filtroPais
      ? cidades.filter((c) => c.pais === filtroPais)
      : cidades;
    const set = new Set(filtradas.map((c) => c.estado));
    return Array.from(set).sort();
  }, [cidades, filtroPais]);

  // Resetar estado quando muda país
  useEffect(() => {
    setFiltroEstado('');
  }, [filtroPais]);

  // Lista filtrada
  const cidadesFiltradas = useMemo(() => {
    return cidades
      .filter((c) => !filtroPais || c.pais === filtroPais)
      .filter((c) => !filtroEstado || c.estado === filtroEstado)
      .filter((c) =>
        !busca.trim() ||
        c.nome.toLowerCase().includes(busca.toLowerCase().trim())
      )
      .sort((a, b) => {
        if (a.pais !== b.pais) return a.pais.localeCompare(b.pais);
        if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
        return a.nome.localeCompare(b.nome);
      });
  }, [cidades, filtroPais, filtroEstado, busca]);

  // Pode criar nova? Só faz sentido se tiver país E estado escolhidos
  // E a busca digitada não retornar nada
  const podeCriarNova =
    !!filtroPais &&
    !!filtroEstado &&
    busca.trim().length > 0 &&
    cidadesFiltradas.length === 0;

  // Hierarquia escolhida pelos filtros (para criar nova cidade)
  const hierarquiaEscolhida = useMemo(() => {
    if (!filtroPais || !filtroEstado) return null;
    return cidades.find(
      (c) => c.pais === filtroPais && c.estado === filtroEstado
    );
  }, [cidades, filtroPais, filtroEstado]);

  const handleCriarNova = async () => {
    if (!hierarquiaEscolhida) return;
    const nome = busca.trim();
    if (!nome) return;

    setCriandoNova(true);
    try {
      await organizacaoService.criarCidade({
        hierarquia_id: hierarquiaEscolhida.hierarquia_id,
        nome,
      });
      setBusca('');
      await carregarCidades();
      onCidadesAlteradas?.();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar cidade');
    } finally {
      setCriandoNova(false);
    }
  };

  const handleIniciarEdicao = (cidade: CidadeComResumo) => {
    setEditandoId(cidade.id);
    setNomeEditando(cidade.nome);
  };

  const handleCancelarEdicao = () => {
    setEditandoId(null);
    setNomeEditando('');
  };

  const handleSalvarEdicao = async (cidadeId: string) => {
    const novoNome = nomeEditando.trim();
    if (!novoNome) {
      alert('Nome não pode ficar vazio');
      return;
    }
    setSalvandoEdicao(true);
    try {
      await organizacaoService.atualizarCidade(cidadeId, { nome: novoNome });
      setEditandoId(null);
      setNomeEditando('');
      await carregarCidades();
      onCidadesAlteradas?.();
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar cidade');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleDeletar = async (cidade: CidadeComResumo) => {
    if (cidade.total_empresas > 0) {
      alert(
        `Não é possível excluir esta cidade: existem ${cidade.total_empresas} empresa(s) vinculada(s).`
      );
      return;
    }
    if (!confirm(`Excluir a cidade "${cidade.nome}" (${cidade.estado}/${cidade.pais})?`)) {
      return;
    }
    setDeletandoId(cidade.id);
    try {
      await organizacaoService.deletarCidade(cidade.id);
      await carregarCidades();
      onCidadesAlteradas?.();
    } catch (err: any) {
      alert(err.message || 'Erro ao deletar cidade');
    } finally {
      setDeletandoId(null);
    }
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Gerenciar Cidades
              </h3>
              <p className="text-sm text-gray-500">
                Cadastre e edite cidades disponíveis no sistema
              </p>
            </div>
          </div>
          <button
            onClick={onFechar}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros */}
        <div className="p-6 border-b border-gray-200 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                País
              </label>
              <select
                value={filtroPais}
                onChange={(e) => setFiltroPais(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
              >
                <option value="">Todos os países</option>
                {paisesDisponiveis.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Estado
              </label>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                disabled={!filtroPais}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">Todos os estados</option>
                {estadosDisponiveis.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Busca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Buscar cidade
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Digite o nome da cidade..."
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Botão de criar nova (aparece quando busca não acha nada) */}
          {podeCriarNova && hierarquiaEscolhida && (
            <button
              onClick={handleCriarNova}
              disabled={criandoNova}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {criandoNova ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Adicionar "{busca.trim()}" em {filtroEstado}/{filtroPais}
            </button>
          )}

          {/* Aviso quando filtro insuficiente para criar */}
          {busca.trim().length > 0 &&
            cidadesFiltradas.length === 0 &&
            !podeCriarNova && (
              <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Para adicionar uma cidade nova, selecione primeiro o país e o
                estado nos filtros acima.
              </div>
            )}
        </div>

        {/* Lista */}
        <div className="p-6 max-h-[50vh] overflow-y-auto">
          {carregando ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : cidadesFiltradas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Nenhuma cidade encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cidadesFiltradas.map((cidade) => {
                const emEdicao = editandoId === cidade.id;
                const podeDeletar = cidade.total_empresas === 0;

                return (
                  <div
                    key={cidade.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-blue-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {emEdicao ? (
                        <input
                          type="text"
                          value={nomeEditando}
                          onChange={(e) => setNomeEditando(e.target.value)}
                          autoFocus
                          className="w-full px-2 py-1 rounded border border-blue-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      ) : (
                        <p className="font-medium text-gray-900 truncate">
                          {cidade.nome}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 truncate">
                        {cidade.estado} • {cidade.pais}
                        {' • '}
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {cidade.total_empresas} empresa
                          {cidade.total_empresas !== 1 ? 's' : ''}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {emEdicao ? (
                        <>
                          <button
                            onClick={() => handleSalvarEdicao(cidade.id)}
                            disabled={salvandoEdicao}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Salvar"
                          >
                            {salvandoEdicao ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={handleCancelarEdicao}
                            disabled={salvandoEdicao}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleIniciarEdicao(cidade)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar nome"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletar(cidade)}
                            disabled={!podeDeletar || deletandoId === cidade.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              podeDeletar
                                ? 'Excluir cidade'
                                : 'Cidade tem empresas vinculadas'
                            }
                          >
                            {deletandoId === cidade.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-500 text-center">
            Cidades com empresas vinculadas não podem ser excluídas. Edite o
            nome ou aguarde transferir as empresas para outra cidade.
          </p>
        </div>
      </div>
    </div>
  );
}