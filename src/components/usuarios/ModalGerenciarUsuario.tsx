'use client';

import { useState, useEffect, Fragment, useRef } from 'react';
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
  Eye,
  EyeOff,
  Camera,
  Unlock,
  ArrowDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { usuariosService } from '@/services/usuarios';
import { organizacaoService } from '@/services/organizacao';
import type { UserProfile, Hierarquia, Cidade, Empresa, Rota, ModuloSistema, UserPermissao } from '@/types/database';

interface Props {
  usuario: UserProfile;
  onClose: () => void;
  onSave: () => void;
  onStatusChange?: () => void;
  modoProprioPerfil?: boolean;
}

type TabType = 'dados' | 'acesso' | 'permissoes' | 'liberacoes';

interface SelecaoAcesso {
  hierarquia_id: string;
  cidade_id: string;
  empresa_id: string;
  rotas_ids: string[];
}

// Chave do estado de liberações: "tipo|empresa_id|rota_id_ou_null"
type LiberacaoKey = string;

const makeLiberacaoKey = (tipo: string, empresaId: string, rotaId: string | null): LiberacaoKey =>
  `${tipo}|${empresaId}|${rotaId ?? 'null'}`;

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

const TODOS_TIPOS = [
  ...TIPOS_SOLICITACAO.LIQUIDACAO,
  ...TIPOS_SOLICITACAO.LIMITES,
  ...TIPOS_SOLICITACAO.OPERACOES,
];

export function ModalGerenciarUsuario({ usuario, onClose, onSave, onStatusChange, modoProprioPerfil = false }: Props) {
  const supabase = createClient();
  const { profile: editorProfile } = useUser();
  const editorIsSuperAdmin = editorProfile?.tipo_usuario === 'SUPER_ADMIN';

  // Permissões do editor (para calcular teto)
  const [permissoesEditor, setPermissoesEditor] = useState<Record<string, UserPermissao>>({});

  const [activeTab, setActiveTab] = useState<TabType>('dados');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dados base carregados
  const [hierarquias, setHierarquias] = useState<Hierarquia[]>([]);
  const [todasCidades, setTodasCidades] = useState<Cidade[]>([]);
  const [todasEmpresas, setTodasEmpresas] = useState<Empresa[]>([]);
  const [todasRotas, setTodasRotas] = useState<Rota[]>([]);
  const [modulos, setModulos] = useState<ModuloSistema[]>([]);

  // === ABA DADOS ===
  const [nome, setNome] = useState(usuario.nome || '');
  const [ddi, setDdi] = useState('+55');
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
  const [tipoUsuario, setTipoUsuario] = useState<'ADMIN' | 'USUARIO_PADRAO'>(
    usuario.tipo_usuario === 'ADMIN' ? 'ADMIN' : 'USUARIO_PADRAO'
  );
  const [copiandoPermissoes, setCopiandoPermissoes] = useState(false);
  const [selecoes, setSelecoes] = useState<SelecaoAcesso[]>([]);

  // Seleção sendo adicionada
  const [novoPais, setNovoPais] = useState('');
  const [novaHierarquiaId, setNovaHierarquiaId] = useState('');
  const [novaCidadeId, setNovaCidadeId] = useState('');
  const [novaEmpresaId, setNovaEmpresaId] = useState('');
  const [novasRotasIds, setNovasRotasIds] = useState<string[]>([]);

  // === ADMIN TITULAR ===
  const [adminTitular, setAdminTitular] = useState<{ user_id: string; nome: string } | null>(null);
  const [ehAdminTitular, setEhAdminTitular] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [codigo, setCodigo] = useState(usuario.token_acesso || '');
  const [codigoVisivel, setCodigoVisivel] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [gerandoCodigo, setGerandoCodigo] = useState(false);

  // === ABA PERMISSÕES ===
  const [permissoes, setPermissoes] = useState<Record<string, UserPermissao>>({});

  // === ABA LIBERAÇÕES ===
  // Chave: "tipo|empresa_id|rota_id_ou_null" → boolean
  const [liberacoes, setLiberacoes] = useState<Record<LiberacaoKey, boolean>>({});

  // Derivados para seleção cascata
  const paises = [...new Set(hierarquias.map((h) => h.pais))];
  const estadosDoPais = hierarquias.filter((h) => h.pais === novoPais);
  const cidadesDaHierarquia = todasCidades.filter((c) => c.hierarquia_id === novaHierarquiaId);
  const cidadeUnicaDaHierarquia = cidadesDaHierarquia.length === 1;
  const empresasDaCidade = todasEmpresas.filter((e) => e.cidade_id === novaCidadeId);
  const rotasDaEmpresa = (() => {
    const empresa = todasEmpresas.find((e) => e.id === novaEmpresaId);
    if (!empresa?.rotas_ids) return [];
    return todasRotas.filter((r) => empresa.rotas_ids?.includes(r.id));
  })();

  // Seleção pendente: empresa escolhida no formulário mas ainda NÃO adicionada à lista
  const temSelecaoPendente = !!novaEmpresaId && !selecoes.some((s) => s.empresa_id === novaEmpresaId);

  // Auto-select: se hierarquia tem só 1 cidade, seleciona ela automaticamente
  useEffect(() => {
    if (novaHierarquiaId && cidadesDaHierarquia.length === 1) {
      setNovaCidadeId(cidadesDaHierarquia[0].id);
    }
  }, [novaHierarquiaId, cidadesDaHierarquia.length]);

  // Carregar dados iniciais
  useEffect(() => {
    async function carregarDados() {
      setLoading(true);
      try {
        const [
          hierarquiasData,
          cidadesResumo,
          empresasData,
          rotasData,
          modulosData,
          permissoesData,
          permissoesEditorData,
        ] = await Promise.all([
          usuariosService.listarHierarquias(),
          organizacaoService.listarTodasCidades(),
          usuariosService.listarEmpresas(),
          usuariosService.listarRotas(),
          usuariosService.listarModulos(),
          usuariosService.listarPermissoesUsuario(usuario.user_id),
          // Permissões do editor — só carrega se não for SUPER_ADMIN
          editorIsSuperAdmin || !editorProfile?.user_id
            ? Promise.resolve([])
            : usuariosService.listarPermissoesUsuario(editorProfile.user_id),
        ]);

        // Reduzir CidadeComResumo para Cidade
        const cidadesData: Cidade[] = cidadesResumo.map((c) => ({
          id: c.id,
          hierarquia_id: c.hierarquia_id,
          nome: c.nome,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));

        setHierarquias(hierarquiasData);
        setTodasCidades(cidadesData);
        setTodasEmpresas(empresasData);
        setTodasRotas(rotasData);
        setModulos(modulosData);

        // Permissões do editor
        if (!editorIsSuperAdmin && permissoesEditorData.length > 0) {
          const map: Record<string, UserPermissao> = {};
          permissoesEditorData.forEach((p: UserPermissao) => { map[p.modulo_id] = p; });
          setPermissoesEditor(map);
        }

        // Extrair DDI do telefone existente
        if (usuario.telefone) {
          const telefoneExistente = usuario.telefone;
          const ddiEncontrado = ddis.find(d => telefoneExistente.startsWith(d.codigo));
          if (ddiEncontrado) {
            setDdi(ddiEncontrado.codigo);
            setTelefoneNumero(telefoneExistente.substring(ddiEncontrado.codigo.length).trim());
          } else {
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
            const rotasDaEmpresaUsuario = rotasIds.filter((rotaId: string) =>
              empresa.rotas_ids?.includes(rotaId)
            );
            selecoesExistentes.push({
              hierarquia_id: empresa.hierarquia_id,
              cidade_id: empresa.cidade_id || '',
              empresa_id: empresaId,
              rotas_ids: rotasDaEmpresaUsuario,
            });
          }
        });
        // Carregar admin titular das empresas do usuário
        if (selecoesExistentes.length > 0) {
          const primeiraEmpresa = selecoesExistentes[0].empresa_id;
          try {
            const admin = await usuariosService.buscarAdminEmpresa(primeiraEmpresa);
            setAdminTitular(admin);
            setEhAdminTitular(admin?.user_id === usuario.user_id);
          } catch (err) {
            console.warn('Erro ao buscar admin titular:', err);
          }
        }

        setSelecoes(selecoesExistentes);

        // Carregar liberações — novo formato com escopo empresa/rota
        try {
          const liberacoesData = await usuariosService.listarLiberacoesUsuario(usuario.user_id);
          const liberacoesMap: Record<LiberacaoKey, boolean> = {};
          liberacoesData.forEach((lib) => {
            const key = makeLiberacaoKey(lib.tipo_solicitacao, lib.empresa_id, lib.rota_id);
            liberacoesMap[key] = lib.pode_liberar;
          });
          setLiberacoes(liberacoesMap);
        } catch (err) {
          console.warn('Erro ao carregar liberações:', err);
        }

        // Carregar flag de notificações removido — gerenciado no cadastro da empresa

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
    if (!novaHierarquiaId || !novaCidadeId || !novaEmpresaId) return;

    const jaExiste = selecoes.some((s) => s.empresa_id === novaEmpresaId);
    if (jaExiste) {
      alert('Esta empresa já foi adicionada');
      return;
    }

    setSelecoes([...selecoes, {
      hierarquia_id: novaHierarquiaId,
      cidade_id: novaCidadeId,
      empresa_id: novaEmpresaId,
      rotas_ids: novasRotasIds,
    }]);

    setNovoPais('');
    setNovaHierarquiaId('');
    setNovaCidadeId('');
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

  const getNomeCidade = (cidadeId: string) => {
    const c = todasCidades.find((c) => c.id === cidadeId);
    return c?.nome || '';
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
    } catch (err: any) {
      console.error('Erro ao gerar código:', err);
      alert(`Erro ao gerar código: ${err?.message || 'Erro desconhecido'}`);
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

      // Marcar Todos → marca os 4
      if (campo === 'pode_todos' && !permissao.pode_todos) {
        return {
          ...prev,
          [moduloId]: { ...permissao, pode_todos: true, pode_guardar: true, pode_buscar: true, pode_eliminar: true },
        };
      }

      // Desmarcar Todos → desmarca os 4
      if (campo === 'pode_todos' && permissao.pode_todos) {
        return {
          ...prev,
          [moduloId]: { ...permissao, pode_todos: false, pode_guardar: false, pode_buscar: false, pode_eliminar: false },
        };
      }

      // Toggle individual — se desmarcar qualquer um, desmarca o pode_todos também
      const novoValor = !permissao[campo];
      const novaPermissao = { ...permissao, [campo]: novoValor };
      if (!novoValor) novaPermissao.pode_todos = false;

      // Se todos os 3 individuais estão marcados, marca pode_todos automaticamente
      if (
        (campo !== 'pode_guardar' ? novaPermissao.pode_guardar : novoValor) &&
        (campo !== 'pode_buscar' ? novaPermissao.pode_buscar : novoValor) &&
        (campo !== 'pode_eliminar' ? novaPermissao.pode_eliminar : novoValor)
      ) {
        novaPermissao.pode_todos = true;
      }

      return { ...prev, [moduloId]: novaPermissao };
    });
  };

  // === FUNÇÕES ABA LIBERAÇÕES ===

  // Toggle de uma célula individual da matriz
  const toggleLiberacao = (tipo: string, empresaId: string, rotaId: string | null) => {
    const key = makeLiberacaoKey(tipo, empresaId, rotaId);
    setLiberacoes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Marcar/desmarcar todos os tipos de uma categoria para um escopo específico
  const marcarCategoriaEscopo = (
    categoria: keyof typeof TIPOS_SOLICITACAO,
    empresaId: string,
    rotaId: string | null,
    marcar: boolean
  ) => {
    setLiberacoes((prev) => {
      const novas = { ...prev };
      TIPOS_SOLICITACAO[categoria].forEach((item) => {
        novas[makeLiberacaoKey(item.tipo, empresaId, rotaId)] = marcar;
      });
      return novas;
    });
  };

  // Marcar/desmarcar todos os tipos para todos os escopos de uma coluna
  const marcarColunaCompleta = (empresaId: string, rotaId: string | null, marcar: boolean) => {
    setLiberacoes((prev) => {
      const novas = { ...prev };
      TODOS_TIPOS.forEach((item) => {
        novas[makeLiberacaoKey(item.tipo, empresaId, rotaId)] = marcar;
      });
      return novas;
    });
  };

  // Verificar se todos os tipos de uma categoria estão marcados para um escopo
  const todosCategoriaMarcados = (
    categoria: keyof typeof TIPOS_SOLICITACAO,
    empresaId: string,
    rotaId: string | null
  ) => TIPOS_SOLICITACAO[categoria].every(
    (t) => liberacoes[makeLiberacaoKey(t.tipo, empresaId, rotaId)]
  );

  // Verificar se todos os tipos estão marcados para um escopo (coluna inteira)
  const todosColunaMarcados = (empresaId: string, rotaId: string | null) =>
    TODOS_TIPOS.every((t) => liberacoes[makeLiberacaoKey(t.tipo, empresaId, rotaId)]);

  // Agrupar módulos por categoria
  const modulosPorCategoria = modulos.reduce((acc, modulo) => {
    const categoria = modulo.categoria || 'Outros';
    if (!acc[categoria]) acc[categoria] = [];
    acc[categoria].push(modulo);
    return acc;
  }, {} as Record<string, ModuloSistema[]>);

  // Derivar colunas da aba Liberações a partir das seleções de acesso
  // Cada coluna = { empresaId, rotaId (null = todas), label }
  const colunasLiberacao = selecoes.flatMap((selecao) => {
    if (selecao.rotas_ids.length === 0) {
      // Sem rotas específicas → coluna única "Todas as rotas"
      return [{
        empresaId: selecao.empresa_id,
        rotaId: null as string | null,
        label: getNomeEmpresa(selecao.empresa_id),
        sublabel: 'Todas as rotas',
      }];
    }
    // Com rotas específicas → uma coluna por rota
    return selecao.rotas_ids.map((rotaId) => ({
      empresaId: selecao.empresa_id,
      rotaId,
      label: getNomeEmpresa(selecao.empresa_id),
      sublabel: todasRotas.find((r) => r.id === rotaId)?.nome || rotaId,
    }));
  });

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleAlterarStatus = async (novoStatus: 'APROVADO' | 'PENDENTE' | 'REJEITADO') => {
    try {
      await usuariosService.atualizarUsuario(usuario.user_id, { status: novoStatus });
      setStatus(novoStatus);
      showToast(
        novoStatus === 'APROVADO' ? '✓ Usuário aprovado com sucesso' :
        novoStatus === 'REJEITADO' ? '✗ Usuário rejeitado' :
        '⏳ Status alterado para Pendente'
      );
      onStatusChange?.(); // atualiza a lista sem fechar o modal
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      alert('Erro ao alterar status. Tente novamente.');
    }
  };

  const handleDefinirAdminTitular = async () => {
    if (selecoes.length === 0) return;
    const empresaId = selecoes[0].empresa_id;

    // Verificar se há permissões configuradas
    const temPermissoesConfiguradas = Object.values(permissoes).some(p =>
      p.pode_todos || p.pode_guardar || p.pode_buscar || p.pode_eliminar
    );

    if (!temPermissoesConfiguradas) {
      alert('Configure as permissões do usuário na aba Permissões antes de defini-lo como admin titular.');
      return;
    }

    try {
      // Salvar permissões atuais antes de definir como titular
      await usuariosService.salvarPermissoes(usuario.user_id, Object.values(permissoes));

      // Definir como admin titular
      await usuariosService.definirAdminEmpresa(usuario.user_id, empresaId);
      setEhAdminTitular(true);
      setAdminTitular({ user_id: usuario.user_id, nome: usuario.nome });
      showToast('✓ Usuário definido como admin titular');
      onStatusChange?.();
    } catch (err) {
      console.error('Erro ao definir admin titular:', err);
      alert('Erro ao definir admin titular. Tente novamente.');
    }
  };
  const handleMudarTipoUsuario = async (novoTipo: 'ADMIN' | 'USUARIO_PADRAO') => {
    setTipoUsuario(novoTipo);

    if (novoTipo === 'ADMIN') {
      // Copiar permissões + liberações do admin logado
      setCopiandoPermissoes(true);
      try {
        const { permissoes: permissoesCopias, liberacoes: liberacoesCopias } =
          await usuariosService.copiarPermissoesParaAdmin(usuario.user_id);

        const permissoesMap: Record<string, UserPermissao> = {};
        permissoesCopias.forEach((p) => {
          permissoesMap[p.modulo_id] = p;
        });
        setPermissoes(permissoesMap);

        const liberacoesMap: Record<LiberacaoKey, boolean> = {};
        liberacoesCopias.forEach((l) => {
          liberacoesMap[makeLiberacaoKey(l.tipo_solicitacao, l.empresa_id, l.rota_id)] = l.pode_liberar;
        });
        setLiberacoes(liberacoesMap);
      } catch (err) {
        console.error('Erro ao copiar permissões:', err);
      } finally {
        setCopiandoPermissoes(false);
      }
    } else {
      // Usuário Padrão — limpar todas as permissões para configuração manual
      setPermissoes({});
      setLiberacoes({});
    }
  };

  // === SALVAR ===
  const handleSalvar = async () => {
    setSaving(true);
    setAviso(null);
    try {
      const empresasIds = [...new Set(selecoes.map((s) => s.empresa_id))];
      const hierarquiasIds = [...new Set(selecoes.map((s) => s.hierarquia_id))];
      const cidadesIds = [...new Set(selecoes.map((s) => s.cidade_id).filter(Boolean))];
      const rotasIds = [...new Set(selecoes.flatMap((s) => s.rotas_ids))];

      let tipoFinal = usuario.tipo_usuario;
      if (tipoFinal !== 'SUPER_ADMIN') {
        if (ehMonitor) {
          tipoFinal = 'MONITOR';
        } else {
          tipoFinal = tipoUsuario;
        }
      }

      // Validar teto de permissões para USUARIO_PADRAO
      if (tipoFinal === 'USUARIO_PADRAO' && empresasIds.length > 0) {
        for (const empresaId of empresasIds) {
          const validacao = await usuariosService.validarTetoPermissoes(usuario.user_id, empresaId);
          if (!validacao.valido) {
            setSaving(false);
            setAviso(
              `As permissões excedem o limite do Admin titular em: ${validacao.modulos_excedidos.join(', ')}. Ajuste antes de salvar.`
            );
            return;
          }
        }
      }

      const telefoneCompleto = telefoneNumero ? `${ddi}${telefoneNumero.replace(/\D/g, '')}` : '';

      await usuariosService.atualizarUsuario(usuario.user_id, {
        nome,
        telefone: telefoneCompleto,
        documento,
        endereco,
        status,
        tipo_usuario: tipoFinal,
        empresas_ids: empresasIds,
        hierarquias_ids: hierarquiasIds,
        cidades_ids: cidadesIds,
        rotas_ids: rotasIds,
      } as any);

      if (!ehMonitor) {
        await usuariosService.salvarPermissoes(usuario.user_id, Object.values(permissoes));
      }

      const liberacoesArray = colunasLiberacao.flatMap((col) =>
        TODOS_TIPOS.map((item) => ({
          tipo_solicitacao: item.tipo,
          empresa_id: col.empresaId,
          rota_id: col.rotaId,
          pode_liberar: liberacoes[makeLiberacaoKey(item.tipo, col.empresaId, col.rotaId)] ?? false,
        }))
      );

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

  // === FOTO ===
  const [fotoUrl, setFotoUrl] = useState(usuario.url_foto_usuario || (usuario as any).Url_foto_usuario || '');
  const [uploadandoFoto, setUploadandoFoto] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const handleFotoClick = () => {
    fotoInputRef.current?.click();
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadandoFoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `usuarios/${usuario.user_id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('fotos')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('fotos')
        .getPublicUrl(path);

      const url = urlData.publicUrl;

      await usuariosService.atualizarUsuario(usuario.user_id, {
        url_foto_usuario: url,
      } as any);

      setFotoUrl(url);
    } catch (err) {
      console.error('Erro ao fazer upload da foto:', err);
      alert('Erro ao enviar foto. Tente novamente.');
    } finally {
      setUploadandoFoto(false);
      // Limpar input para permitir reenvio do mesmo arquivo
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  };

  const tabs = [
    { id: 'dados' as TabType, label: 'Dados', icon: User },
    { id: 'acesso' as TabType, label: 'Acesso', icon: Building2 },
    { id: 'permissoes' as TabType, label: 'Permissões', icon: Shield },
    { id: 'liberacoes' as TabType, label: 'Liberações', icon: Unlock },
  ];

  // No modo próprio perfil, esconde aba Acesso se tem só 1 empresa e no máximo 1 rota
  const deveEsconderAbaAcesso = modoProprioPerfil &&
    selecoes.length <= 1 &&
    (selecoes.length === 0 || selecoes[0].rotas_ids.length <= 1);

  const tabsVisiveis = tabs.filter(t => {
    if (ehMonitor && t.id === 'permissoes') return false;
    if (deveEsconderAbaAcesso && t.id === 'acesso') return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {/* Avatar clicável */}
            <div className="relative">
              <button
                onClick={handleFotoClick}
                disabled={uploadandoFoto}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center overflow-hidden ring-2 ring-white shadow-md hover:ring-blue-300 transition-all group"
                title="Clique para trocar a foto"
              >
                {uploadandoFoto ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : fotoUrl ? (
                  <img src={fotoUrl} alt="" className="w-16 h-16 object-cover" />
                ) : (
                  <User className="w-7 h-7 text-white" />
                )}
                {/* Overlay no hover */}
                {!uploadandoFoto && (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                )}
              </button>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                onChange={handleFotoChange}
                className="hidden"
              />
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

        {/* Toast de feedback */}
        {toast && (
          <div className={`mx-6 mt-3 px-4 py-2.5 rounded-lg text-sm font-medium text-center transition-all ${
            toast.startsWith('✓') ? 'bg-green-100 text-green-800 border border-green-200' :
            toast.startsWith('✗') ? 'bg-red-100 text-red-800 border border-red-200' :
            'bg-yellow-100 text-yellow-800 border border-yellow-200'
          }`}>
            {toast}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-4">
          {tabsVisiveis.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>

                    {/* Badge do status atual */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 w-fit ${
                      status === 'APROVADO' ? 'bg-green-100 text-green-800' :
                      status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      <span className="text-base">
                        {status === 'APROVADO' ? '✓' : status === 'PENDENTE' ? '⏳' : '✗'}
                      </span>
                      <span className="text-sm font-semibold">
                        {status === 'APROVADO' ? 'Aprovado' : status === 'PENDENTE' ? 'Pendente' : 'Rejeitado'}
                      </span>
                    </div>

                    {/* Botões de ação — ocultos no modo próprio perfil */}
                    {!modoProprioPerfil && (
                      <div className="flex gap-2">
                        {status !== 'APROVADO' && (
                          <button
                            onClick={() => handleAlterarStatus('APROVADO')}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Aprovar
                          </button>
                        )}
                        {status !== 'REJEITADO' && (
                          <button
                            onClick={() => handleAlterarStatus('REJEITADO')}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors shadow-sm"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeitar
                          </button>
                        )}
                        {status !== 'PENDENTE' && (
                          <button
                            onClick={() => handleAlterarStatus('PENDENTE')}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700 transition-colors shadow-sm"
                          >
                            <Clock className="w-4 h-4" />
                            Pendente
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Código de Acesso — inline com olho — oculto no modo próprio perfil */}
                  {!modoProprioPerfil && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                        <Key className="w-4 h-4 text-gray-400" />
                        Código de Acesso
                        {usuario.token_validado && (
                          <span className="text-xs text-green-600 font-normal">✓ validado</span>
                        )}
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={codigoVisivel ? 'text' : 'password'}
                          value={codigo}
                          readOnly
                          placeholder="Nenhum código gerado"
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 font-mono tracking-widest uppercase pr-10"
                        />
                        <button
                          onClick={() => setCodigoVisivel((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          title={codigoVisivel ? 'Ocultar código' : 'Mostrar código'}
                        >
                          {codigoVisivel
                            ? <EyeOff className="w-4 h-4" />
                            : <Eye className="w-4 h-4" />
                          }
                        </button>
                      </div>
                      <button
                        onClick={gerarCodigo}
                        disabled={gerandoCodigo}
                        className="px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Gerar novo código"
                      >
                        {gerandoCodigo
                          ? <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
                          : <RefreshCw className="w-4 h-4 text-gray-600" />
                        }
                      </button>
                      <button
                        onClick={copiarCodigo}
                        disabled={!codigo}
                        className="px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        title="Copiar código"
                      >
                        {copiado
                          ? <Check className="w-4 h-4 text-green-600" />
                          : <Copy className="w-4 h-4 text-gray-600" />
                        }
                      </button>
                    </div>
                    {codigo && codigo !== usuario.token_acesso && (
                      <p className="text-xs text-green-600 mt-1.5">
                        ✓ Novo código gerado. Clique em Salvar para confirmar.
                      </p>
                    )}
                  </div>
                  )}
                </div>
              )}

              {/* ABA ACESSO */}
              {activeTab === 'acesso' && (
                <div className="space-y-6">
                  {/* Toggle Monitor — oculto no modo próprio perfil */}
                  {!modoProprioPerfil && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900">É Monitor</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Monitores acessam apenas o app móvel e não possuem permissões de módulos
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ehMonitor}
                        onChange={(e) => setEhMonitor(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  )}

                  {/* Seletor de Tipo removido — admin é definido no cadastro da empresa */}

                  {/* Lista de acessos configurados */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        Acessos Configurados
                      </h3>
                      <span className="text-xs text-gray-400">
                        ({selecoes.length})
                      </span>
                    </div>

                    {selecoes.length > 0 ? (
                      <div className="space-y-2">
                        {selecoes.map((selecao, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl shadow-sm"
                          >
                            <div className="flex items-start gap-3 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  {getNomeEmpresa(selecao.empresa_id)}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {getNomeHierarquia(selecao.hierarquia_id)}
                                  {selecao.cidade_id && ` › ${getNomeCidade(selecao.cidade_id)}`}
                                </p>
                                {selecao.rotas_ids.length > 0 ? (
                                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {getNomesRotas(selecao.rotas_ids)}
                                  </p>
                                ) : (
                                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    Todas as rotas
                                  </p>
                                )}
                              </div>
                            </div>
                            {!modoProprioPerfil && (
                            <button
                              onClick={() => handleRemoverSelecao(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                              title="Remover acesso"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-sm text-gray-400">
                          Nenhum acesso configurado ainda.
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Use o formulário abaixo e clique em <span className="font-medium text-gray-500">Adicionar</span>.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Admin Titular da Empresa */}
                  {selecoes.length > 0 && !modoProprioPerfil && (
                    <div className={`p-4 rounded-xl border ${ehAdminTitular ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">Admin Titular da Empresa</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {ehAdminTitular
                              ? 'Este usuário é o admin titular'
                              : adminTitular
                                ? `Admin atual: ${adminTitular.nome}`
                                : 'Nenhum admin titular definido — este usuário será o primeiro'}
                          </p>
                        </div>
                        {!ehAdminTitular && (
                          <button
                            onClick={handleDefinirAdminTitular}
                            className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-lg hover:bg-blue-200 transition-colors"
                          >
                            Definir como titular
                          </button>
                        )}
                        {ehAdminTitular && adminTitular?.user_id !== usuario.user_id && (
                          <button
                            onClick={() => setEhAdminTitular(false)}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                      {ehAdminTitular && adminTitular && adminTitular.user_id !== usuario.user_id && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                          ⚠ Ao salvar, <strong>{adminTitular.nome}</strong> deixará de ser o admin titular desta empresa.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Aviso de teto de permissões */}
                  {aviso && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700">{aviso}</p>
                    </div>
                  )}

                  {/* Caixa "Adicionar Acesso" — oculta no modo próprio perfil */}
                  {!modoProprioPerfil && (
                  <div className="space-y-4 p-4 bg-blue-50/50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-blue-900">Adicionar Acesso</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">País</label>
                        <select
                          value={novoPais}
                          onChange={(e) => {
                            setNovoPais(e.target.value);
                            setNovaHierarquiaId('');
                            setNovaCidadeId('');
                            setNovaEmpresaId('');
                            setNovasRotasIds([]);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
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
                        <label className="block text-xs text-gray-500 mb-1">Estado</label>
                        <select
                          value={novaHierarquiaId}
                          onChange={(e) => {
                            setNovaHierarquiaId(e.target.value);
                            setNovaCidadeId('');
                            setNovaEmpresaId('');
                            setNovasRotasIds([]);
                          }}
                          disabled={!novoPais}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white disabled:bg-gray-100"
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

                    {/* Cidade — só aparece se hierarquia tem 2+ cidades */}
                    {novaHierarquiaId && !cidadeUnicaDaHierarquia && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Cidade</label>
                        <select
                          value={novaCidadeId}
                          onChange={(e) => {
                            setNovaCidadeId(e.target.value);
                            setNovaEmpresaId('');
                            setNovasRotasIds([]);
                          }}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
                        >
                          <option value="">Selecione...</option>
                          {cidadesDaHierarquia.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Empresa</label>
                      <select
                        value={novaEmpresaId}
                        onChange={(e) => {
                          setNovaEmpresaId(e.target.value);
                          setNovasRotasIds([]);
                        }}
                        disabled={!novaCidadeId}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white disabled:bg-gray-100"
                      >
                        <option value="">Selecione...</option>
                        {empresasDaCidade.map((e) => (
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
                                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                              }`}
                            >
                              {rota.nome}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {temSelecaoPendente && (
                      <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <ArrowDown className="w-4 h-4 text-amber-600 flex-shrink-0 animate-bounce" />
                        <p className="text-xs text-amber-700">
                          Clique em <span className="font-semibold">Adicionar</span> para incluir este acesso na lista antes de salvar.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleAdicionarSelecao}
                      disabled={!novaEmpresaId}
                      className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        temSelecaoPendente
                          ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md ring-2 ring-blue-300'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar à Lista
                    </button>
                  </div>
                  )}
                </div>
              )}

              {/* ABA PERMISSÕES */}
              {activeTab === 'permissoes' && !ehMonitor && (
                <div className="space-y-4">

                  {/* Aviso para ADMIN sendo editado por não-SUPER_ADMIN — não acontece mais */}

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                            Módulo
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">
                            <div className="flex flex-col items-center gap-1">
                              <span>Todos</span>
                              {(tipoUsuario !== 'ADMIN' || editorIsSuperAdmin) && (
                                <Checkbox
                                  checked={modulos.length > 0 && modulos.every(m => {
                                    const p = permissoes[m.id];
                                    return p?.pode_todos && p?.pode_guardar && p?.pode_buscar && p?.pode_eliminar;
                                  })}
                                  onChange={() => {
                                    const todosAtivos = modulos.every(m => {
                                      const p = permissoes[m.id];
                                      return p?.pode_todos && p?.pode_guardar && p?.pode_buscar && p?.pode_eliminar;
                                    });
                                    setPermissoes(prev => {
                                      const novo = { ...prev };
                                      modulos.forEach(m => {
                                        const editorPerm = permissoesEditor[m.id];
                                        const podeMarcar = editorIsSuperAdmin || (
                                          editorPerm?.pode_todos &&
                                          editorPerm?.pode_guardar &&
                                          editorPerm?.pode_buscar &&
                                          editorPerm?.pode_eliminar
                                        );
                                        if (!todosAtivos && !podeMarcar) return;
                                        novo[m.id] = {
                                          ...(novo[m.id] || { modulo_id: m.id, user_id: usuario.user_id }),
                                          pode_todos: !todosAtivos,
                                          pode_guardar: !todosAtivos,
                                          pode_buscar: !todosAtivos,
                                          pode_eliminar: !todosAtivos,
                                        } as UserPermissao;
                                      });
                                      return novo;
                                    });
                                  }}
                                  title="Marcar/desmarcar todos"
                                />
                              )}
                            </div>
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">Guardar</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">Buscar</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-20">Eliminar</th>
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
                              // ADMIN sem SUPER_ADMIN editando → todos marcados (read-only)
                              // ADMIN com SUPER_ADMIN editando → valores reais editáveis
                              const permissao = (tipoUsuario === 'ADMIN' && !editorIsSuperAdmin)
                                ? { pode_todos: true, pode_guardar: true, pode_buscar: true, pode_eliminar: true }
                                : permissoes[modulo.id];

                              const bloqueadoPorTipo = false; // ADMIN não é mais bloqueado
                              const editorPerm = permissoesEditor[modulo.id];

                              const podeTodos    = editorIsSuperAdmin || !!editorPerm?.pode_todos;
                              const podeGuardar  = editorIsSuperAdmin || !!editorPerm?.pode_guardar;
                              const podeBuscar   = editorIsSuperAdmin || !!editorPerm?.pode_buscar;
                              const podeEliminar = editorIsSuperAdmin || !!editorPerm?.pode_eliminar;

                              return (
                                <tr key={modulo.id} className={`${bloqueadoPorTipo ? 'opacity-70' : 'hover:bg-gray-50'}`}>
                                  <td className="px-4 py-3">
                                    <span className="text-sm text-gray-700">{modulo.nome}</span>
                                    {!editorIsSuperAdmin && !podeTodos && !podeGuardar && !podeBuscar && !podeEliminar && (
                                      <span className="ml-2 text-xs text-gray-400">(sem acesso)</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Checkbox
                                      checked={permissao?.pode_todos || false}
                                      onChange={() => !bloqueadoPorTipo && podeTodos && togglePermissao(modulo.id, 'pode_todos')}
                                      disabled={bloqueadoPorTipo || !podeTodos}
                                      title={!podeTodos ? 'Você não tem esta permissão' : undefined}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Checkbox
                                      checked={permissao?.pode_guardar || false}
                                      onChange={() => !bloqueadoPorTipo && podeGuardar && togglePermissao(modulo.id, 'pode_guardar')}
                                      disabled={bloqueadoPorTipo || !podeGuardar}
                                      title={!podeGuardar ? 'Você não tem esta permissão' : undefined}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Checkbox
                                      checked={permissao?.pode_buscar || false}
                                      onChange={() => !bloqueadoPorTipo && podeBuscar && togglePermissao(modulo.id, 'pode_buscar')}
                                      disabled={bloqueadoPorTipo || !podeBuscar}
                                      title={!podeBuscar ? 'Você não tem esta permissão' : undefined}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Checkbox
                                      checked={permissao?.pode_eliminar || false}
                                      onChange={() => !bloqueadoPorTipo && podeEliminar && togglePermissao(modulo.id, 'pode_eliminar')}
                                      disabled={bloqueadoPorTipo || !podeEliminar}
                                      title={!podeEliminar ? 'Você não tem esta permissão' : undefined}
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
                <div className="space-y-6">

                  {/* Matriz de Liberações */}
                  {colunasLiberacao.length === 0 ? (
                    <div className="text-center py-10 px-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <Unlock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 font-medium">Nenhum acesso configurado</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Configure os acessos na aba <span className="font-medium">Acesso</span> para definir as liberações por empresa e rota.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        Configure quais tipos de solicitações este usuário pode aprovar, por empresa e rota.
                      </p>
                      <div className="border border-gray-200 rounded-xl overflow-x-auto">
                        <table className="w-full min-w-max">
                          <thead className="bg-gray-50">
                            {/* Linha de empresas */}
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase min-w-[200px]">
                                Tipo de Solicitação
                              </th>
                              {colunasLiberacao.map((col, idx) => (
                                <th key={idx} className="px-3 py-3 text-left min-w-[130px]">
                                  <div
                                    className="text-xs font-semibold text-gray-700 leading-tight cursor-default"
                                    title={col.label}
                                  >
                                    {col.label.length > 15 ? col.label.slice(0, 15) + '…' : col.label}
                                  </div>
                                  <div
                                    className="text-xs text-gray-400 font-normal mt-0.5 cursor-default"
                                    title={col.sublabel}
                                  >
                                    {col.sublabel.length > 15 ? col.sublabel.slice(0, 15) + '…' : col.sublabel}
                                  </div>
                                  <button
                                    onClick={() => marcarColunaCompleta(col.empresaId, col.rotaId, !todosColunaMarcados(col.empresaId, col.rotaId))}
                                    className="text-xs text-blue-500 hover:text-blue-700 mt-1 font-normal"
                                  >
                                    {todosColunaMarcados(col.empresaId, col.rotaId) ? 'Desmarcar todos' : 'Marcar todos'}
                                  </button>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {(Object.keys(TIPOS_SOLICITACAO) as (keyof typeof TIPOS_SOLICITACAO)[]).map((categoria) => (
                              <Fragment key={categoria}>
                                {/* Linha de categoria */}
                                <tr className="bg-gray-100">
                                  <td className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">
                                    {categoria === 'LIQUIDACAO' ? 'Liquidação' : categoria === 'LIMITES' ? 'Limites' : 'Operações'}
                                  </td>
                                  {colunasLiberacao.map((col, idx) => (
                                    <td key={idx} className="px-3 py-2 text-left">
                                      <button
                                        onClick={() => marcarCategoriaEscopo(categoria, col.empresaId, col.rotaId, !todosCategoriaMarcados(categoria, col.empresaId, col.rotaId))}
                                        className="text-xs text-blue-500 hover:text-blue-700"
                                      >
                                        {todosCategoriaMarcados(categoria, col.empresaId, col.rotaId) ? 'Desmarcar' : 'Marcar'}
                                      </button>
                                    </td>
                                  ))}
                                </tr>
                                {/* Linhas de tipos */}
                                {TIPOS_SOLICITACAO[categoria].map((item) => (
                                  <tr key={item.tipo} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <div>
                                        <span className="text-sm text-gray-700">{item.label}</span>
                                        <p className="text-xs text-gray-400">{item.descricao}</p>
                                      </div>
                                    </td>
                                    {colunasLiberacao.map((col, idx) => (
                                      <td key={idx} className="px-3 py-3 text-left">
                                        <Checkbox
                                          checked={liberacoes[makeLiberacaoKey(item.tipo, col.empresaId, col.rotaId)] ?? false}
                                          onChange={() => toggleLiberacao(item.tipo, col.empresaId, col.rotaId)}
                                        />
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex-1">
            {activeTab === 'acesso' && temSelecaoPendente && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Há um acesso preenchido não adicionado à lista.</span>
              </div>
            )}
            {aviso && activeTab !== 'acesso' && (
              <div className="flex items-center gap-1.5 text-xs text-red-700">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{aviso}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
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
    </div>
  );
}

function Checkbox({ checked, onChange, disabled = false, title }: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      title={title}
      className={`
        w-6 h-6 rounded border-2 flex items-center justify-center transition-all
        ${disabled
          ? 'opacity-60 cursor-not-allowed bg-gray-100 border-gray-300'
          : checked
            ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
            : 'bg-white border-gray-300 hover:border-blue-400'
        }
        ${!disabled && checked ? 'text-white' : ''}
      `}
    >
      {checked && <Check className="w-4 h-4" />}
    </button>
  );
}