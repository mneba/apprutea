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
  Smartphone,
  Unlock
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { usuariosService } from '@/services/usuarios';
import type { UserProfile, Hierarquia, Empresa, Rota, ModuloSistema, UserPermissao } from '@/types/database';

interface Props {
  usuario: UserProfile;
  onClose: () => void;
  onSave: () => void;
}

type TabType = 'dados' | 'acesso' | 'codigo' | 'permissoes' | 'liberacoes';

interface SelecaoAcesso {
  hierarquia_id: string;
  empresa_id: string;
  rotas_ids: string[];
}

// Tipos de solicitação agrupados por categoria
const TIPOS_SOLICITACAO = {
  LIQUIDACAO: [
    { tipo: 'ABERTURA_RETROATIVA', label: 'Abertura Retroativa', descricao: 'Abrir liquidação de data passada' },
    { tipo: 'ABERTURA_DIAS_FALTANTES', label: 'Abertura Dias Faltantes', descricao: 'Abrir hoje pulando dias sem liquidação' },
    { tipo: 'REABRIR_LIQUIDACAO', label: 'Reabrir Liquidação', descricao: 'Reabrir liquidação já fechada' },
  ],
  LIMITES: [
    { tipo: 'VENDA_EXCEDE_LIMITE', label: 'Venda Excede Limite', descricao: 'Venda acima do limite permitido' },
    { tipo: 'RENOVACAO_EXCEDE_LIMITE', label: 'Renovação Excede Limite', descricao: 'Renovação acima do limite' },
    { tipo: 'DESPESA_EXCEDE_LIMITE', label: 'Despesa Excede Limite', descricao: 'Despesa acima do limite' },
    { tipo: 'RECEITA_EXCEDE_LIMITE', label: 'Receita Excede Limite', descricao: 'Receita acima do limite' },
  ],
  OPERACOES: [
    { tipo: 'ESTORNO_PAGAMENTO', label: 'Estorno de Pagamento', descricao: 'Estornar pagamento já registrado' },
    { tipo: 'CANCELAR_EMPRESTIMO', label: 'Cancelar Empréstimo', descricao: 'Cancelar empréstimo ativo' },
    { tipo: 'QUITAR_COM_DESCONTO', label: 'Quitar com Desconto', descricao: 'Quitar com valor menor que saldo' },
    { tipo: 'CLIENTE_OUTRA_ROTA', label: 'Cliente de Outra Rota', descricao: 'Atender cliente de outra rota' },
  ],
};

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
  const [ddi, setDdi] = useState('+55'); // Padrão Brasil
  const [telefoneNumero, setTelefoneNumero] = useState('');
  const [documento, setDocumento] = useState(usuario.documento || '');
  const [endereco, setEndereco] = useState(usuario.endereco || '');
  const [status, setStatus] = useState(usuario.status);

  // DDIs da América do Sul
  const ddis = [
    { codigo: '+55', pais: 'Brasil', bandeira: '🇧🇷' },
    { codigo: '+54', pais: 'Argentina', bandeira: '🇦🇷' },
    { codigo: '+56', pais: 'Chile', bandeira: '🇨🇱' },
    { codigo: '+57', pais: 'Colômbia', bandeira: '🇨🇴' },
    { codigo: '+51', pais: 'Peru', bandeira: '🇵🇪' },
    { codigo: '+598', pais: 'Uruguai', bandeira: '🇺🇾' },
    { codigo: '+595', pais: 'Paraguai', bandeira: '🇵🇾' },
    { codigo: '+591', pais: 'Bolívia', bandeira: '🇧🇴' },
    { codigo: '+593', pais: 'Equador', bandeira: '🇪🇨' },
    { codigo: '+58', pais: 'Venezuela', bandeira: '🇻🇪' },
    { codigo: '+592', pais: 'Guiana', bandeira: '🇬🇾' },
    { codigo: '+597', pais: 'Suriname', bandeira: '🇸🇷' },
  ];

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

  // === ABA LIBERAÇÕES ===
  const [liberacoes, setLiberacoes] = useState<Record<string, boolean>>({});

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

        // Extrair DDI do telefone existente
        if (usuario.telefone) {
          const telefoneExistente = usuario.telefone;
          // Tentar encontrar DDI no início
          const ddiEncontrado = ddis.find(d => telefoneExistente.startsWith(d.codigo));
          if (ddiEncontrado) {
            setDdi(ddiEncontrado.codigo);
            setTelefoneNumero(telefoneExistente.substring(ddiEncontrado.codigo.length).trim());
          } else {
            // Se não encontrar DDI, assumir que é número sem DDI
            setTelefoneNumero(telefoneExistente.replace(/^\+/, ''));
          }
        }

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

        // Carregar liberações
        try {
          const liberacoesData = await usuariosService.listarLiberacoesUsuario(usuario.user_id);
          const liberacoesMap: Record<string, boolean> = {};
          liberacoesData.forEach((lib: { tipo_solicitacao: string; pode_liberar: boolean }) => {
            liberacoesMap[lib.tipo_solicitacao] = lib.pode_liberar;
          });
          setLiberacoes(liberacoesMap);
        } catch (err) {
          console.warn('Erro ao carregar liberações (tabela pode não existir ainda):', err);
        }

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
    // Verificar se usuário está aprovado ANTES de chamar a API
    if (status !== 'APROVADO') {
      alert('⚠️ O usuário precisa estar APROVADO para gerar código de acesso.\n\nVá na aba "Dados" e altere o status para "Aprovado" primeiro.');
      return;
    }

    setGerandoCodigo(true);
    try {
      const novoCodigo = await usuariosService.gerarCodigoAcesso(usuario.user_id);
      setCodigo(novoCodigo);
      setCopiado(false);
    } catch (err: any) {
      console.error('Erro ao gerar código:', err);
      const mensagemErro = err?.message || 'Erro desconhecido';
      
      // Verificar se é erro de status
      if (mensagemErro.toLowerCase().includes('aprovado')) {
        alert('⚠️ O usuário precisa estar APROVADO para gerar código.\n\nVá na aba "Dados" e altere o status.');
      } else {
        alert(`Erro ao gerar código: ${mensagemErro}`);
      }
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

  // === FUNÇÕES ABA LIBERAÇÕES ===
  const toggleLiberacao = (tipo: string) => {
    setLiberacoes((prev) => ({
      ...prev,
      [tipo]: !prev[tipo],
    }));
  };

  const marcarTodasLiberacoes = (categoria: keyof typeof TIPOS_SOLICITACAO, marcar: boolean) => {
    setLiberacoes((prev) => {
      const novas = { ...prev };
      TIPOS_SOLICITACAO[categoria].forEach((item) => {
        novas[item.tipo] = marcar;
      });
      return novas;
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

      // Montar telefone completo com DDI
      const telefoneCompleto = telefoneNumero ? `${ddi}${telefoneNumero.replace(/\D/g, '')}` : '';

      // Salvar dados
      await usuariosService.atualizarUsuario(usuario.user_id, {
        nome,
        telefone: telefoneCompleto,
        documento,
        endereco,
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

      // Salvar liberações
      const liberacoesArray = Object.entries(liberacoes).map(([tipo, pode]) => ({
        tipo_solicitacao: tipo,
        pode_liberar: pode,
      }));
      
      if (liberacoesArray.length > 0) {
        await usuariosService.salvarLiberacoesUsuario(usuario.user_id, liberacoesArray);
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
    { id: 'liberacoes' as TabType, label: 'Liberações', icon: Unlock },
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
        <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
          {tabsVisiveis.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
                    <div className="flex gap-2">
                      <select
                        value={ddi}
                        onChange={(e) => setDdi(e.target.value)}
                        className="w-32 px-3 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        {ddis.map((d) => (
                          <option key={d.codigo} value={d.codigo}>
                            {d.bandeira} {d.codigo}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={telefoneNumero}
                        onChange={(e) => setTelefoneNumero(e.target.value)}
                        placeholder="11999999999"
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Apenas números, sem espaços ou traços
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Documento</label>
                    <input
                      type="text"
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Endereço</label>
                    <input
                      type="text"
                      value={endereco}
                      onChange={(e) => setEndereco(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as typeof status)}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="PENDENTE">Pendente</option>
                      <option value="APROVADO">Aprovado</option>
                      <option value="REJEITADO">Rejeitado</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ehMonitor}
                        onChange={(e) => setEhMonitor(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <span className="text-sm text-gray-700">
                      É Monitor (apenas app móvel)
                    </span>
                  </div>
                </div>
              )}

              {/* ABA ACESSO */}
              {activeTab === 'acesso' && (
                <div className="space-y-6">
                  {/* Seleções existentes */}
                  {selecoes.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-gray-700">Acessos Configurados</h3>
                      {selecoes.map((selecao, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
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
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Adicionar novo acesso */}
                  <div className="space-y-4 p-4 border border-dashed border-gray-300 rounded-xl">
                    <h3 className="text-sm font-medium text-gray-700">Adicionar Acesso</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">País</label>
                        <select
                          value={novoPais}
                          onChange={(e) => {
                            setNovoPais(e.target.value);
                            setNovaHierarquiaId('');
                            setNovaEmpresaId('');
                            setNovasRotasIds([]);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                        >
                          <option value="">Selecione...</option>
                          {paises.map((pais) => (
                            <option key={pais} value={pais}>
                              {pais}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Estado/Cidade</label>
                        <select
                          value={novaHierarquiaId}
                          onChange={(e) => {
                            setNovaHierarquiaId(e.target.value);
                            setNovaEmpresaId('');
                            setNovasRotasIds([]);
                          }}
                          disabled={!novoPais}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:bg-gray-100"
                        >
                          <option value="">Selecione...</option>
                          {estadosDoPais.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.estado}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Empresa</label>
                      <select
                        value={novaEmpresaId}
                        onChange={(e) => {
                          setNovaEmpresaId(e.target.value);
                          setNovasRotasIds([]);
                        }}
                        disabled={!novaHierarquiaId}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:bg-gray-100"
                      >
                        <option value="">Selecione...</option>
                        {empresasDaHierarquia.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    {novaEmpresaId && rotasDaEmpresa.length > 0 && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-2">
                          Rotas (opcional - deixe vazio para todas)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {rotasDaEmpresa.map((rota) => (
                            <button
                              key={rota.id}
                              onClick={() => toggleRota(rota.id)}
                              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                novasRotasIds.includes(rota.id)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {rota.nome}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleAdicionarSelecao}
                      disabled={!novaEmpresaId}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </button>
                  </div>
                </div>
              )}

              {/* ABA CÓDIGO */}
              {activeTab === 'codigo' && (
                <div className="space-y-6">
                  {status !== 'APROVADO' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Smartphone className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-yellow-800">
                            Usuário não aprovado
                          </p>
                          <p className="text-sm text-yellow-700 mt-1">
                            Para gerar o código de acesso, primeiro aprove o usuário na aba "Dados".
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Status:</span>
                      <span className={`text-sm font-medium ${
                        status === 'APROVADO' ? 'text-green-600' : 
                        status === 'PENDENTE' ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {status}
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
                        disabled={gerandoCodigo || status !== 'APROVADO'}
                        className="px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={status !== 'APROVADO' ? 'Usuário precisa estar aprovado' : 'Gerar novo código'}
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

              {/* ABA LIBERAÇÕES */}
              {activeTab === 'liberacoes' && (
                <div>
                  <p className="text-sm text-gray-600 mb-4">
                    Configure quais tipos de solicitações este usuário pode aprovar/rejeitar.
                  </p>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                            Tipo de Solicitação
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-28">
                            Pode Liberar
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {/* LIQUIDAÇÃO */}
                        <tr className="bg-gray-100">
                          <td className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                            Liquidação
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => {
                                const todosAtivos = TIPOS_SOLICITACAO.LIQUIDACAO.every(t => liberacoes[t.tipo]);
                                marcarTodasLiberacoes('LIQUIDACAO', !todosAtivos);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              {TIPOS_SOLICITACAO.LIQUIDACAO.every(t => liberacoes[t.tipo]) ? 'Desmarcar' : 'Marcar'} todos
                            </button>
                          </td>
                        </tr>
                        {TIPOS_SOLICITACAO.LIQUIDACAO.map((item) => (
                          <tr key={item.tipo} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <span className="text-sm text-gray-700">{item.label}</span>
                                <p className="text-xs text-gray-500">{item.descricao}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Checkbox
                                checked={liberacoes[item.tipo] || false}
                                onChange={() => toggleLiberacao(item.tipo)}
                              />
                            </td>
                          </tr>
                        ))}

                        {/* LIMITES */}
                        <tr className="bg-gray-100">
                          <td className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                            Limites
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => {
                                const todosAtivos = TIPOS_SOLICITACAO.LIMITES.every(t => liberacoes[t.tipo]);
                                marcarTodasLiberacoes('LIMITES', !todosAtivos);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              {TIPOS_SOLICITACAO.LIMITES.every(t => liberacoes[t.tipo]) ? 'Desmarcar' : 'Marcar'} todos
                            </button>
                          </td>
                        </tr>
                        {TIPOS_SOLICITACAO.LIMITES.map((item) => (
                          <tr key={item.tipo} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <span className="text-sm text-gray-700">{item.label}</span>
                                <p className="text-xs text-gray-500">{item.descricao}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Checkbox
                                checked={liberacoes[item.tipo] || false}
                                onChange={() => toggleLiberacao(item.tipo)}
                              />
                            </td>
                          </tr>
                        ))}

                        {/* OPERAÇÕES */}
                        <tr className="bg-gray-100">
                          <td className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                            Operações
                          </td>
                          <td className="px-4 py-2 text-center">
                            <button
                              onClick={() => {
                                const todosAtivos = TIPOS_SOLICITACAO.OPERACOES.every(t => liberacoes[t.tipo]);
                                marcarTodasLiberacoes('OPERACOES', !todosAtivos);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700"
                            >
                              {TIPOS_SOLICITACAO.OPERACOES.every(t => liberacoes[t.tipo]) ? 'Desmarcar' : 'Marcar'} todos
                            </button>
                          </td>
                        </tr>
                        {TIPOS_SOLICITACAO.OPERACOES.map((item) => (
                          <tr key={item.tipo} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <span className="text-sm text-gray-700">{item.label}</span>
                                <p className="text-xs text-gray-500">{item.descricao}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Checkbox
                                checked={liberacoes[item.tipo] || false}
                                onChange={() => toggleLiberacao(item.tipo)}
                              />
                            </td>
                          </tr>
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