'use client';

import { useState, useEffect, Fragment } from 'react';
import { 
  X, 
  User, 
  Loader2, 
  Plus, 
  Trash2, 
  Key, 
  Copy, 
  Check, 
  RefreshCw,
  Shield,
  Building2,
  MapPin,
  Smartphone
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { usuariosService } from '@/services/usuarios';
import type { UserProfile, Hierarquia, Empresa, Rota, ModuloSistema, UserPermissao } from '@/types/database';

interface Props {
  usuario: UserProfile;
  onClose: () => void;
  onSave: () => void;
}

type TabType = 'dados' | 'acesso' | 'codigo' | 'permissoes';

interface SelecaoAcesso {
  hierarquia_id: string;
  empresa_id: string;
  rotas_ids: string[];
}

export function ModalGerenciarUsuario({ usuario, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('dados');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dados base carregados
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([]);
  const [todasEmpresas, setTodasEmpresas] = useState<Empresa[]>([]);
  const [todasRotas, setTodasRotas] = useState<Rota[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);

  // === ABA DADOS ===
  const [nome, setNome] = useState(usuario.nome || '');
  const [telefone, setTelefone] = useState(usuario.telefone || '');
  const [documento, setDocumento] = useState(usuario.documento || '');
  const [status, setStatus] = useState(usuario.status);

  // === ABA ACESSO ===
  const [ehMonitor, setEhMonitor] = useState(usuario.tipo_usuario === 'MONITOR');
  const [selecoes, setSelecoes] = useState<SelecaoAcesso[]>([]);
  
  // Seleção sendo adicionada
  const [novoPais, setNovoPais] = useState('');
  const [novaHierarquiaId, setNovaHierarquiaId] = useState('');
  const [novaEmpresaId, setNovaEmpresaId] = useState('');
  const [novasRotasIds, setNovasRotasIds] = useState<string[]>([]);

  // === ABA CÓDIGO ===
  const [codigo, setCodigo] = useState(usuario.token_acesso || '');
  const [copiado, setCopiado] = useState(false);
  const [gerandoCodigo, setGerandoCodigo] = useState(false);

  // === ABA PERMISSÕES ===
  const [permissoes, setPermissoes] = useState<Record<string, UserPermissao>>({});

  // Derivados para seleção cascata
  const paises = [...new Set(hierarquias.map((h) => h.pais))];
  const estadosDoPais = hierarquias.filter((h) => h.pais === novoPais);
  const empresasDaHierarquia = todasEmpresas.filter((e) => e.hierarquia_id === novaHierarquiaId);
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
        const [hierarquiasData, empresasData, rotasData, modulosData, permissoesData] = await Promise.all([
          usuariosService.listarHierarquias(),
          usuariosService.listarEmpresas(),
          usuariosService.listarRotas(),
          usuariosService.listarModulos(),
          usuariosService.listarPermissoesUsuario(usuario.user_id),
        ]);

        setHierarquias(hierarquiasData);
        setTodasEmpresas(empresasData);
        setTodasRotas(rotasData);
        setModulos(modulosData);

        // Montar permissões
        const permissoesMap: Record<string, UserPermissao> = {};
        permissoesData.forEach((p) => {
          permissoesMap[p.modulo_id] = p;
        });
        setPermissoes(permissoesMap);

        // Montar seleções de acesso existentes
        const selecoesExistentes: SelecaoAcesso[] = [];
        const empresasIds = usuario.empresas_ids || [];
        const rotasIds = usuario.rotas_ids || [];

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

  // === FUNÇÕES ABA ACESSO ===
  const handleAdicionarSelecao = () => {
    if (!novaHierarquiaId || !novaEmpresaId) return;
    
    const jaExiste = selecoes.some((s) => s.empresa_id === novaEmpresaId);
    if (jaExiste) {
      alert('Esta empresa já foi adicionada');
      return;
    }
    
    setSelecoes([...selecoes, {
      hierarquia_id: novaHierarquiaId,
      empresa_id: novaEmpresaId,
      rotas_ids: novasRotasIds,
    }]);
    
    // Limpar seleção
    setNovoPais('');
    setNovaHierarquiaId('');
    setNovaEmpresaId('');
    setNovasRotasIds([]);
  };

  const handleRemoverSelecao = (index: number) => {
    setSelecoes(selecoes.filter((_, i) => i !== index));
  };

  const toggleRota = (rotaId: string) => {
    if (novasRotasIds.includes(rotaId)) {
      setNovasRotasIds(novasRotasIds.filter((id) => id !== rotaId));
    } else {
      setNovasRotasIds([...novasRotasIds, rotaId]);
    }
  };

  const getNomeHierarquia = (hierarquiaId: string) => {
    const h = hierarquias.find((h) => h.id === hierarquiaId);
    return h ? `${h.pais} > ${h.estado}` : '';
  };

  const getNomeEmpresa = (empresaId: string) => {
    const e = todasEmpresas.find((e) => e.id === empresaId);
    return e?.nome || '';
  };

  const getNomesRotas = (rotasIds: string[]) => {
    return rotasIds
      .map((id) => todasRotas.find((r) => r.id === id)?.nome)
      .filter(Boolean)
      .join(', ');
  };

  // === FUNÇÕES ABA CÓDIGO ===
  const gerarCodigo = async () => {
    setGerandoCodigo(true);
    try {
      const novoCodigo = await usuariosService.gerarCodigoAcesso(usuario.user_id);
      setCodigo(novoCodigo);
      setCopiado(false);
    } catch (err) {
      console.error('Erro ao gerar código:', err);
      alert('Erro ao gerar código. Tente novamente.');
    } finally {
      setGerandoCodigo(false);
    }
  };

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  // === FUNÇÕES ABA PERMISSÕES ===
  const togglePermissao = (
    moduloId: string,
    campo: 'pode_todos' | 'pode_guardar' | 'pode_buscar' | 'pode_eliminar'
  ) => {
    setPermissoes((prev) => {
      const permissao = prev[moduloId] || {
        modulo_id: moduloId,
        user_id: usuario.user_id,
        pode_todos: false,
        pode_guardar: false,
        pode_buscar: false,
        pode_eliminar: false,
      };

      // Se marcou "todos", marca todos os outros
      if (campo === 'pode_todos' && !permissao.pode_todos) {
        return {
          ...prev,
          [moduloId]: { ...permissao, pode_todos: true, pode_guardar: true, pode_buscar: true, pode_eliminar: true },
        };
      }

      // Se desmarcou "todos", apenas desmarca ele
      if (campo === 'pode_todos' && permissao.pode_todos) {
        return {
          ...prev,
          [moduloId]: { ...permissao, pode_todos: false },
        };
      }

      return {
        ...prev,
        [moduloId]: { ...permissao, [campo]: !permissao[campo] },
      };
    });
  };

  // Agrupar módulos por categoria
  const modulosPorCategoria = modulos.reduce((acc, modulo) => {
    const categoria = modulo.categoria || 'Outros';
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(modulo);
    return acc;
  }, {} as Record<string, ModuloSistema[]>);

  // === SALVAR ===
  const handleSalvar = async () => {
    setSaving(true);
    try {
      // Extrair arrays únicos
      const empresasIds = [...new Set(selecoes.map((s) => s.empresa_id))];
      const cidadesIds = [...new Set(selecoes.map((s) => s.hierarquia_id))];
      const rotasIds = [...new Set(selecoes.flatMap((s) => s.rotas_ids))];

      // Tipo interno: SUPER_ADMIN mantém, senão é USUARIO_PADRAO ou MONITOR
      let tipoUsuario = usuario.tipo_usuario;
      if (tipoUsuario !== 'SUPER_ADMIN') {
        tipoUsuario = ehMonitor ? 'MONITOR' : 'USUARIO_PADRAO';
      }

      // Salvar dados
      await usuariosService.atualizarUsuario(usuario.user_id, {
        nome,
        telefone,
        documento,
        status,
        tipo_usuario: tipoUsuario,
        empresas_ids: empresasIds,
        cidades_ids: cidadesIds,
        rotas_ids: rotasIds,
      });

      // Salvar permissões (apenas se não for monitor)
      if (!ehMonitor) {
        await usuariosService.salvarPermissoes(usuario.user_id, Object.values(permissoes));
      }

      onSave();
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'dados' as TabType, label: 'Dados', icon: User },
    { id: 'acesso' as TabType, label: 'Acesso', icon: Building2 },
    { id: 'codigo' as TabType, label: 'Código', icon: Key },
    { id: 'permissoes' as TabType, label: 'Permissões', icon: Shield },
  ];

  // Monitor não vê aba de permissões (só usa app móvel)
  const tabsVisiveis = ehMonitor ? tabs.filter(t => t.id !== 'permissoes') : tabs;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden">
              {usuario.Url_foto_usuario ? (
                <img src={usuario.Url_foto_usuario} alt="" className="w-12 h-12 object-cover" />
              ) : (
                <User className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{usuario.nome}</h2>
              <p className="text-sm text-gray-500">{usuario.telefone}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          {tabsVisiveis.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* ABA DADOS */}
              {activeTab === 'dados' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
                      <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
                      <input
                        type="text"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+55 11 99999-9999"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Documento</label>
                      <input
                        type="text"
                        value={documento}
                        onChange={(e) => setDocumento(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="CPF ou documento"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-white focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="APROVADO">Aprovado</option>
                        <option value="PENDENTE">Pendente</option>
                        <option value="REJEITADO">Rejeitado</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ABA ACESSO */}
              {activeTab === 'acesso' && (
                <div className="space-y-6">
                  {/* Checkbox Monitor */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ehMonitor}
                        onChange={(e) => setEhMonitor(e.target.checked)}
                        className="w-5 h-5 mt-0.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-orange-600" />
                          <span className="font-medium text-gray-900">Apenas App Móvel</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Este usuário terá acesso apenas ao aplicativo móvel, não poderá acessar o sistema web.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Lista de empresas vinculadas */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Empresas com Acesso
                    </h3>

                    {selecoes.length > 0 ? (
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
                    ) : (
                      <div className="text-center py-6 bg-gray-50 rounded-xl mb-4">
                        <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Nenhuma empresa vinculada</p>
                      </div>
                    )}

                    {/* Adicionar nova empresa */}
                    <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-medium text-blue-700">Adicionar acesso:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          value={novoPais}
                          onChange={(e) => {
                            setNovoPais(e.target.value);
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

                        <select
                          value={novaHierarquiaId}
                          onChange={(e) => {
                            setNovaHierarquiaId(e.target.value);
                            setNovaEmpresaId('');
                            setNovasRotasIds([]);
                          }}
                          disabled={!novoPais}
                          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm disabled:opacity-50"
                        >
                          <option value="">Selecione o estado</option>
                          {estadosDoPais.map((h) => (
                            <option key={h.id} value={h.id}>{h.estado}</option>
                          ))}
                        </select>

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

                        <button
                          onClick={handleAdicionarSelecao}
                          disabled={!novaEmpresaId}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Adicionar
                        </button>
                      </div>

                      {/* Rotas (opcional) */}
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

              {/* ABA CÓDIGO */}
              {activeTab === 'codigo' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Status:</span>
                      <span className={`text-sm font-medium ${
                        usuario.status === 'APROVADO' ? 'text-green-600' : 
                        usuario.status === 'PENDENTE' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {usuario.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Token validado:</span>
                      <span className={`text-sm font-medium ${usuario.token_validado ? 'text-green-600' : 'text-gray-500'}`}>
                        {usuario.token_validado ? 'Sim' : 'Não'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Código de Acesso
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={codigo}
                        readOnly
                        placeholder="Clique em gerar"
                        className="flex-1 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-center text-xl tracking-widest font-mono uppercase"
                      />
                      <button
                        onClick={gerarCodigo}
                        disabled={gerandoCodigo}
                        className="px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        title="Gerar novo código"
                      >
                        {gerandoCodigo ? (
                          <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                        ) : (
                          <RefreshCw className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                      <button
                        onClick={copiarCodigo}
                        disabled={!codigo}
                        className="px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        title="Copiar código"
                      >
                        {copiado ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Formato: TK + 6 dígitos (gerado automaticamente)
                    </p>
                  </div>

                  {codigo && codigo !== usuario.token_acesso && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-700">✓ Novo código gerado! Clique em Salvar para confirmar.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ABA PERMISSÕES */}
              {activeTab === 'permissoes' && !ehMonitor && (
                <div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                            Módulo
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                            Todos
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                            Guardar
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                            Buscar
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                            Eliminar
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.entries(modulosPorCategoria).map(([categoria, modulosCategoria]) => (
                          <Fragment key={categoria}>
                            <tr className="bg-gray-100">
                              <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                                {categoria}
                              </td>
                            </tr>
                            {modulosCategoria.map((modulo) => {
                              const permissao = permissoes[modulo.id];
                              return (
                                <tr key={modulo.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3">
                                    <span className="text-sm text-gray-700">{modulo.nome}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Checkbox
                                      checked={permissao?.pode_todos || false}
                                      onChange={() => togglePermissao(modulo.id, 'pode_todos')}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Checkbox
                                      checked={permissao?.pode_guardar || false}
                                      onChange={() => togglePermissao(modulo.id, 'pode_guardar')}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Checkbox
                                      checked={permissao?.pode_buscar || false}
                                      onChange={() => togglePermissao(modulo.id, 'pode_buscar')}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Checkbox
                                      checked={permissao?.pode_eliminar || false}
                                      onChange={() => togglePermissao(modulo.id, 'pode_eliminar')}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`
        w-6 h-6 rounded border-2 flex items-center justify-center transition-all
        ${checked
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-gray-300 hover:border-blue-400'}
      `}
    >
      {checked && <Check className="w-4 h-4" />}
    </button>
  );
}
