'use client';

import { useState, useEffect } from 'react';
import { X, User, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { usuariosService } from '@/services/usuarios';
import type { UserProfile, Hierarquia, Empresa, Rota } from '@/types/database';

type TipoUsuario = 'SUPER_ADMIN' | 'ADMIN' | 'MONITOR' | 'USUARIO_PADRAO' | 'VENDEDOR';

interface Props {
  usuario: UserProfile;
  onClose: () => void;
  onSave: () => void;
}

interface HierarquiaComEmpresa {
  hierarquia_id: string;
  empresa_id: string;
  rotas_ids: string[];
}

export function ModalEditarUsuario({ usuario, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Dados base
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([]);
  const [todasEmpresas, setTodasEmpresas] = useState<Empresa[]>([]);
  const [todasRotas, setTodasRotas] = useState<Rota[]>([]);
  
  // Formulário
  const [nome, setNome] = useState(usuario.nome || '');
  const [telefone, setTelefone] = useState(usuario.telefone || '');
  const [documento, setDocumento] = useState(usuario.documento || '');
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>(usuario.tipo_usuario);
  const [status, setStatus] = useState(usuario.status);
  
  // Seleções hierárquicas (múltiplas)
  const [selecoes, setSelecoes] = useState<HierarquiaComEmpresa[]>([]);
  
  // Estado para nova seleção
  const [novaPaisSelecionado, setNovaPaisSelecionado] = useState('');
  const [novaHierarquiaId, setNovaHierarquiaId] = useState('');
  const [novaEmpresaId, setNovaEmpresaId] = useState('');
  const [novasRotasIds, setNovasRotasIds] = useState<string[]>([]);

  // Países únicos
  const paises = [...new Set(hierarquias.map((h) => h.pais))];

  // Estados/cidades do país selecionado
  const estadosDoPais = hierarquias.filter((h) => h.pais === novaPaisSelecionado);

  // Empresas da hierarquia selecionada
  const empresasDaHierarquia = todasEmpresas.filter(
    (e) => e.hierarquia_id === novaHierarquiaId
  );

  // Rotas da empresa selecionada
  const rotasDaEmpresa = (() => {
    const empresa = todasEmpresas.find((e) => e.id === novaEmpresaId);
    if (!empresa?.rotas_ids) return [];
    return todasRotas.filter((r) => empresa.rotas_ids?.includes(r.id));
  })();

  // Carregar dados iniciais
  useEffect(() => {
    async function carregarDados() {
      setLoading(true);
      try {
        const [hierarquiasData, empresasData, rotasData] = await Promise.all([
          usuariosService.listarHierarquias(),
          usuariosService.listarEmpresas(),
          usuariosService.listarRotas(),
        ]);

        setHierarquias(hierarquiasData);
        setTodasEmpresas(empresasData);
        setTodasRotas(rotasData);

        // Montar seleções existentes do usuário
        const selecoesExistentes: HierarquiaComEmpresa[] = [];
        const empresasIds = usuario.empresas_ids || [];
        const cidadesIds = usuario.cidades_ids || [];
        const rotasIds = usuario.rotas_ids || [];

        // Para cada empresa, encontrar a hierarquia e rotas correspondentes
        empresasIds.forEach((empresaId: string) => {
          const empresa = empresasData.find((e) => e.id === empresaId);
          if (empresa) {
            const rotasDaEmpresa = rotasIds.filter((rotaId: string) =>
              empresa.rotas_ids?.includes(rotaId)
            );
            selecoesExistentes.push({
              hierarquia_id: empresa.hierarquia_id,
              empresa_id: empresaId,
              rotas_ids: rotasDaEmpresa,
            });
          }
        });

        setSelecoes(selecoesExistentes);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    }
    carregarDados();
  }, [usuario]);

  // Adicionar nova seleção
  const handleAdicionarSelecao = () => {
    if (!novaHierarquiaId || !novaEmpresaId) return;

    // Verificar se já existe
    const jaExiste = selecoes.some((s) => s.empresa_id === novaEmpresaId);
    if (jaExiste) {
      alert('Esta empresa já foi adicionada');
      return;
    }

    setSelecoes([
      ...selecoes,
      {
        hierarquia_id: novaHierarquiaId,
        empresa_id: novaEmpresaId,
        rotas_ids: novasRotasIds,
      },
    ]);

    // Limpar seleção
    setNovaPaisSelecionado('');
    setNovaHierarquiaId('');
    setNovaEmpresaId('');
    setNovasRotasIds([]);
  };

  // Remover seleção
  const handleRemoverSelecao = (index: number) => {
    setSelecoes(selecoes.filter((_, i) => i !== index));
  };

  // Toggle rota na nova seleção
  const toggleRota = (rotaId: string) => {
    if (novasRotasIds.includes(rotaId)) {
      setNovasRotasIds(novasRotasIds.filter((id) => id !== rotaId));
    } else {
      setNovasRotasIds([...novasRotasIds, rotaId]);
    }
  };

  // Salvar
  const handleSalvar = async () => {
    setSaving(true);
    try {
      // Extrair arrays únicos
      const empresasIds = [...new Set(selecoes.map((s) => s.empresa_id))];
      const cidadesIds = [...new Set(selecoes.map((s) => s.hierarquia_id))];
      const rotasIds = [...new Set(selecoes.flatMap((s) => s.rotas_ids))];

      await usuariosService.atualizarUsuario(usuario.user_id, {
        nome,
        telefone,
        documento,
        tipo_usuario: tipoUsuario,
        status,
        empresas_ids: empresasIds,
        cidades_ids: cidadesIds,
        rotas_ids: rotasIds,
      });

      onSave();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar usuário. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  // Obter nome da hierarquia
  const getNomeHierarquia = (hierarquiaId: string) => {
    const h = hierarquias.find((h) => h.id === hierarquiaId);
    return h ? `${h.pais} > ${h.estado}` : '';
  };

  // Obter nome da empresa
  const getNomeEmpresa = (empresaId: string) => {
    const e = todasEmpresas.find((e) => e.id === empresaId);
    return e?.nome || '';
  };

  // Obter nomes das rotas
  const getNomesRotas = (rotasIds: string[]) => {
    return rotasIds
      .map((id) => todasRotas.find((r) => r.id === id)?.nome)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Editar Usuário</h2>
              <p className="text-sm text-gray-500">{usuario.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Dados Básicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                />
                <Input
                  label="Telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="+55 11 99999-9999"
                />
                <Input
                  label="Documento"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="CPF ou documento"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tipo de Usuário
                  </label>
                  <select
                    value={tipoUsuario}
                    onChange={(e) => setTipoUsuario(e.target.value as TipoUsuario)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MONITOR">Monitor</option>
                    <option value="USUARIO_PADRAO">Usuário Padrão</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="APROVADO">Aprovado</option>
                    <option value="PENDENTE">Pendente</option>
                    <option value="REJEITADO">Rejeitado</option>
                  </select>
                </div>
              </div>

              {/* Seção de Acesso */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Acesso a Empresas e Rotas
                </h3>

                {/* Lista de seleções existentes */}
                {selecoes.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {selecoes.map((selecao, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700">
                            {getNomeEmpresa(selecao.empresa_id)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {getNomeHierarquia(selecao.hierarquia_id)}
                          </p>
                          {selecao.rotas_ids.length > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              Rotas: {getNomesRotas(selecao.rotas_ids)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoverSelecao(index)}
                          className="p-1.5 hover:bg-red-100 rounded text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nova seleção */}
                <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-blue-700">Adicionar acesso:</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* País */}
                    <select
                      value={novaPaisSelecionado}
                      onChange={(e) => {
                        setNovaPaisSelecionado(e.target.value);
                        setNovaHierarquiaId('');
                        setNovaEmpresaId('');
                        setNovasRotasIds([]);
                      }}
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
                    >
                      <option value="">Selecione o país</option>
                      {paises.map((pais) => (
                        <option key={pais} value={pais}>{pais}</option>
                      ))}
                    </select>

                    {/* Estado/Cidade */}
                    <select
                      value={novaHierarquiaId}
                      onChange={(e) => {
                        setNovaHierarquiaId(e.target.value);
                        setNovaEmpresaId('');
                        setNovasRotasIds([]);
                      }}
                      disabled={!novaPaisSelecionado}
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-50"
                    >
                      <option value="">Selecione o estado</option>
                      {estadosDoPais.map((h) => (
                        <option key={h.id} value={h.id}>{h.estado}</option>
                      ))}
                    </select>

                    {/* Empresa */}
                    <select
                      value={novaEmpresaId}
                      onChange={(e) => {
                        setNovaEmpresaId(e.target.value);
                        setNovasRotasIds([]);
                      }}
                      disabled={!novaHierarquiaId}
                      className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-50"
                    >
                      <option value="">Selecione a empresa</option>
                      {empresasDaHierarquia.map((e) => (
                        <option key={e.id} value={e.id}>{e.nome}</option>
                      ))}
                    </select>

                    {/* Botão adicionar */}
                    <button
                      onClick={handleAdicionarSelecao}
                      disabled={!novaEmpresaId}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </button>
                  </div>

                  {/* Rotas (se empresa selecionada) */}
                  {novaEmpresaId && rotasDaEmpresa.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Rotas (opcional):</p>
                      <div className="flex flex-wrap gap-2">
                        {rotasDaEmpresa.map((rota) => (
                          <button
                            key={rota.id}
                            onClick={() => toggleRota(rota.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              novasRotasIds.includes(rota.id)
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'
                            }`}
                          >
                            {rota.nome}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} loading={saving}>
            Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
