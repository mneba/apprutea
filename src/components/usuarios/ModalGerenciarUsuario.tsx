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
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';
import { usuariosService } from '@/services/usuarios';
import { organizacaoService } from '@/services/organizacao';
import type { UserProfile, Hierarquia, Cidade, Empresa, Rota, ModuloSistema, UserPermissao } from '@/types/database';

interface Props {
  usuario: UserProfile;
  onClose: () => void;
  onSave: () => void;
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

export function ModalGerenciarUsuario({ usuario, onClose, onSave }: Props) {
  const supabase = createClient();
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

  // === ABA CÓDIGO (agora inline na aba Dados) ===
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
        ] = await Promise.all([
          usuariosService.listarHierarquias(),
          organizacaoService.listarTodasCidades(),
          usuariosService.listarEmpresas(),
          usuariosService.listarRotas(),
          usuariosService.listarModulos(),
          usuariosService.listarPermissoesUsuario(usuario.user_id),
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

      if (campo === 'pode_todos' && !permissao.pode_todos) {
        return {
          ...prev,
          [moduloId]: { ...permissao, pode_todos: true, pode_guardar: true, pode_buscar: true, pode_eliminar: true },
        };
      }

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

  // === MUDANÇA DE TIPO DE USUÁRIO ===
  const handleMudarTipoUsuario = async (novoTipo: 'ADMIN' | 'USUARIO_PADRAO') => {
    setTipoUsuario(novoTipo);

    // Ao classificar como ADMIN, copiar permissões + liberações do admin logado
    if (novoTipo === 'ADMIN') {
      setCopiandoPermissoes(true);
      try {
        const { permissoes: permissoesCopias, liberacoes: liberacoesCopias } =
          await usuariosService.copiarPermissoesParaAdmin(usuario.user_id);

        // Montar mapa de permissões
        const permissoesMap: Record<string, UserPermissao> = {};
        permissoesCopias.forEach((p) => {
          permissoesMap[p.modulo_id] = p;
        });
        setPermissoes(permissoesMap);

        // Montar mapa de liberações
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
    }
  };

  // === SALVAR ===
  const handleSalvar = async () => {
    setSaving(true);
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
          tipoFinal = tipoUsuario; // ADMIN ou USUARIO_PADRAO
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

      // Montar array de liberações com escopo completo
      // Inclui todas as combinações tipo × coluna, marcadas ou não
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

  const tabsVisiveis = ehMonitor ? tabs.filter(t => t.id !== 'permissoes') : tabs;

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

                  {/* Código de Acesso — inline com olho */}
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
                        disabled={gerandoCodigo || status !== 'APROVADO'}
                        className="px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={status !== 'APROVADO' ? 'Aprovação necessária para gerar código' : 'Gerar novo código'}
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
                    {status !== 'APROVADO' && (
                      <p className="text-xs text-amber-600 mt-1.5">
                        Aprove o usuário para gerar ou reger o código.
                      </p>
                    )}
                    {codigo && codigo !== usuario.token_acesso && (
                      <p className="text-xs text-green-600 mt-1.5">
                        ✓ Novo código gerado. Clique em Salvar para confirmar.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ABA ACESSO */}
              {activeTab === 'acesso' && (
                <div className="space-y-6">
                  {/* Toggle Monitor */}
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

                  {/* Seletor de Tipo — só aparece se não for Monitor e não for SUPER_ADMIN */}
                  {!ehMonitor && usuario.tipo_usuario !== 'SUPER_ADMIN' && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-1">Tipo de Usuário</p>
                        <p className="text-xs text-gray-500">
                          Admin herda suas permissões e liberações como ponto de partida
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleMudarTipoUsuario('USUARIO_PADRAO')}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                            tipoUsuario === 'USUARIO_PADRAO'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          Usuário Padrão
                        </button>
                        <button
                          onClick={() => handleMudarTipoUsuario('ADMIN')}
                          disabled={copiandoPermissoes}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 ${
                            tipoUsuario === 'ADMIN'
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {copiandoPermissoes ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Copiando...
                            </span>
                          ) : 'Admin'}
                        </button>
                      </div>
                      {tipoUsuario === 'ADMIN' && !copiandoPermissoes && (
                        <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                          ✓ Permissões e liberações copiadas do seu perfil. Ajuste nas abas correspondentes se necessário.
                        </p>
                      )}
                    </div>
                  )}

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
                            <button
                              onClick={() => handleRemoverSelecao(index)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                              title="Remover acesso"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

                  {/* Caixa "Adicionar Acesso" */}
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