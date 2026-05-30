'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  User,
  UserPlus,
  Users,
  Building2,
  Loader2,
  Smartphone,
  Copy,
  Check,
  Link,
  ChevronDown,
} from 'lucide-react';
import { usuariosService } from '@/services/usuarios';
import { useUser } from '@/contexts/UserContext';
import { ModalGerenciarUsuario } from '@/components/usuarios';
import type { UserProfile, Empresa } from '@/types/database';

// =====================================================
// COMPONENTES AUXILIARES
// =====================================================

function CardEstatistica({
  titulo,
  valor,
  icone: Icone,
  corIcone,
  corFundo,
  ativo = false,
  onClick,
}: {
  titulo: string;
  valor: number;
  icone: React.ElementType;
  corIcone: string;
  corFundo: string;
  ativo?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border p-3 hover:shadow-md transition-all ${
        ativo ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${corFundo} flex items-center justify-center flex-shrink-0`}>
          <Icone className={`w-5 h-5 ${corIcone}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-gray-900">{valor}</p>
          <p className="text-xs text-gray-500 truncate">{titulo}</p>
        </div>
      </div>
    </button>
  );
}

function BadgeStatus({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    APROVADO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Aprovado' },
    PENDENTE: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendente' },
    REJEITADO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejeitado' },
  };
  const c = config[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// =====================================================
// PÁGINA
// =====================================================

export default function UsuariosPage() {
  const { profile, localizacao, loading: loadingUser } = useUser();
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UserProfile | null>(null);
  const [modalAberto, setModalAberto] = useState(false);

  // Modal convite
  const [modalConviteAberto, setModalConviteAberto] = useState(false);
  const [conviteEmail, setConviteEmail] = useState('');
  const [conviteEmpresaId, setConviteEmpresaId] = useState('');
  const [linkGerado, setLinkGerado] = useState('');
  const [linkCopiado, setLinkCopiado] = useState(false);

  const ehSuperAdmin = profile?.tipo_usuario === 'SUPER_ADMIN';

  useEffect(() => {
    if (!loadingUser && profile) carregarDados();
  }, [loadingUser, profile]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [usuariosData, empresasData] = await Promise.all([
        usuariosService.listarUsuarios({
          isSuperAdmin: ehSuperAdmin,
          empresaId: ehSuperAdmin
            ? undefined
            : (localizacao.empresa_id || profile?.empresas_ids?.[0] || undefined),
        }),
        usuariosService.listarEmpresas(),
      ]);
      setUsuarios(usuariosData);
      setEmpresas(empresasData);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEmpresaNome = (usuario: UserProfile) => {
    if (!usuario.empresas_ids?.length) return usuario.empresa_pretendida || '-';
    return empresas.find((e) => e.id === usuario.empresas_ids![0])?.nome || usuario.empresa_pretendida || '-';
  };

  const getFotoUrl = (usuario: UserProfile): string =>
    (usuario as any).url_foto_usuario || (usuario as any).Url_foto_usuario || '';

  const estatisticas = {
    total: usuarios.length,
    aprovados: usuarios.filter((u) => u.status === 'APROVADO').length,
    pendentes: usuarios.filter((u) => u.status === 'PENDENTE').length,
    monitores: usuarios.filter((u) => u.tipo_usuario === 'MONITOR').length,
  };

  const handleFiltroStatus = (status: string) => {
    setStatusFiltro((prev) => (prev === status ? '' : status));
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchBusca =
      !busca ||
      u.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      u.telefone?.toLowerCase().includes(busca.toLowerCase()) ||
      u.empresa_pretendida?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus =
      !statusFiltro ||
      (statusFiltro === 'MONITOR' ? u.tipo_usuario === 'MONITOR' : u.status === statusFiltro);
    const matchEmpresa =
      !empresaFiltro ||
      u.empresas_ids?.includes(empresaFiltro) ||
      (!u.empresas_ids?.length && empresaFiltro === 'sem_empresa');
    return matchBusca && matchStatus && matchEmpresa;
  });

  const handleAbrirConvite = () => {
    setConviteEmail('');
    setConviteEmpresaId(ehSuperAdmin ? '' : (localizacao.empresa_id || ''));
    setLinkGerado('');
    setLinkCopiado(false);
    setModalConviteAberto(true);
  };

  const handleGerarLink = () => {
    if (!conviteEmpresaId) { alert('Selecione uma empresa.'); return; }
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    setLinkGerado(`${base}/cadastro?empresa_id=${conviteEmpresaId}`);
    setLinkCopiado(false);
  };

  const handleCopiarLink = async () => {
    try {
      await navigator.clipboard.writeText(linkGerado);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2000);
    } catch { alert('Copie manualmente.'); }
  };

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* ===== HEADER FIXO ===== */}
      <div className="flex-shrink-0 space-y-4 pb-4 border-b border-gray-200">

        {/* Título + Botão */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
            <p className="text-gray-500 text-sm">Gerencie os usuários e suas permissões</p>
          </div>
          <button
            onClick={handleAbrirConvite}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Novo Usuário
          </button>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CardEstatistica titulo="Total" valor={estatisticas.total} icone={Users} corIcone="text-blue-600" corFundo="bg-blue-100" ativo={!statusFiltro} onClick={() => handleFiltroStatus('')} />
          <CardEstatistica titulo="Aprovados" valor={estatisticas.aprovados} icone={CheckCircle} corIcone="text-green-600" corFundo="bg-green-100" ativo={statusFiltro === 'APROVADO'} onClick={() => handleFiltroStatus('APROVADO')} />
          <CardEstatistica titulo="Pendentes" valor={estatisticas.pendentes} icone={Clock} corIcone="text-yellow-600" corFundo="bg-yellow-100" ativo={statusFiltro === 'PENDENTE'} onClick={() => handleFiltroStatus('PENDENTE')} />
          <CardEstatistica titulo="Apenas Móvel" valor={estatisticas.monitores} icone={Smartphone} corIcone="text-orange-600" corFundo="bg-orange-100" ativo={statusFiltro === 'MONITOR'} onClick={() => handleFiltroStatus('MONITOR')} />
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, telefone ou empresa..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {ehSuperAdmin && (
            <div className="relative">
              <select
                value={empresaFiltro}
                onChange={(e) => setEmpresaFiltro(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Todas as Empresas</option>
                <option value="sem_empresa">Sem Empresa</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            </div>
          )}

          <div className="relative">
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">Todos os Status</option>
              <option value="APROVADO">Aprovados</option>
              <option value="PENDENTE">Pendentes</option>
              <option value="REJEITADO">Rejeitados</option>
              <option value="MONITOR">Apenas Móvel</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ===== TABELA COM SCROLL ===== */}
      <div className="flex-1 overflow-hidden mt-4">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Usuário</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Empresa</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Código</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 bg-gray-50">Cadastro</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700 bg-gray-50 w-28">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Carregando usuários...</p>
                    </td>
                  </tr>
                ) : usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <User className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                      <p className="text-gray-500 text-sm">Nenhum usuário encontrado</p>
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map((usuario) => {
                    const fotoUrl = getFotoUrl(usuario);
                    return (
                      <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">

                        {/* Usuário */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                                {fotoUrl ? (
                                  <img src={fotoUrl} alt={usuario.nome} className="w-9 h-9 object-cover" />
                                ) : (
                                  <User className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                              {usuario.tipo_usuario === 'MONITOR' && (
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center border-2 border-white">
                                  <Smartphone className="w-2.5 h-2.5 text-white" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{usuario.nome}</p>
                              <p className="text-xs text-gray-500">
                                {(usuario as any).email || usuario.telefone}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Empresa */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Building2 className="w-4 h-4 text-gray-300 flex-shrink-0" />
                            {getEmpresaNome(usuario)}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <BadgeStatus status={usuario.status} />
                        </td>

                        {/* Código */}
                        <td className="px-4 py-3">
                          {usuario.token_acesso ? (
                            <div className="flex items-center gap-2">
                              <code className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">
                                {usuario.token_acesso}
                              </code>
                              {usuario.token_validado && (
                                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* Cadastro */}
                        <td className="px-4 py-3 text-gray-600">
                          {usuario.created_at
                            ? new Date(usuario.created_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </td>

                        {/* Ações */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => { setUsuarioSelecionado(usuario); setModalAberto(true); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Gerenciar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===== MODAL GERENCIAR ===== */}
      {modalAberto && usuarioSelecionado && (
        <ModalGerenciarUsuario
          usuario={usuarioSelecionado}
          onClose={() => { setModalAberto(false); setUsuarioSelecionado(null); }}
          onStatusChange={() => carregarDados()}
          onSave={() => { carregarDados(); setModalAberto(false); setUsuarioSelecionado(null); }}
        />
      )}

      {/* ===== MODAL CONVITE ===== */}
      {modalConviteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalConviteAberto(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Convidar Usuário</h2>
                  <p className="text-xs text-gray-500">Gere um link de cadastro para enviar</p>
                </div>
              </div>
              <button onClick={() => setModalConviteAberto(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  E-mail do convidado
                  <span className="ml-2 text-xs text-gray-400 font-normal">(opcional por enquanto)</span>
                </label>
                <input
                  type="email"
                  value={conviteEmail}
                  onChange={(e) => setConviteEmail(e.target.value)}
                  placeholder="usuario@exemplo.com"
                  className="w-full pl-4 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {ehSuperAdmin ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Empresa <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={conviteEmpresaId}
                      onChange={(e) => { setConviteEmpresaId(e.target.value); setLinkGerado(''); }}
                      className="appearance-none w-full pl-4 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="">Selecione uma empresa...</option>
                      {empresas.map((e) => (
                        <option key={e.id} value={e.id}>{e.nome}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Empresa</label>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700">
                    <Building2 className="w-4 h-4 text-gray-400" />
                    {empresas.find((e) => e.id === conviteEmpresaId)?.nome || '-'}
                  </div>
                </div>
              )}

              {linkGerado && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Link de Cadastro</label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono text-gray-600 truncate">
                      {linkGerado}
                    </div>
                    <button
                      onClick={handleCopiarLink}
                      className="px-3 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex-shrink-0"
                      title="Copiar link"
                    >
                      {linkCopiado ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                    </button>
                  </div>
                  <p className="text-xs text-amber-600">
                    ⚠ Envio automático por e-mail ainda não implementado. Copie o link e envie manualmente.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <button onClick={() => setModalConviteAberto(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm">
                Cancelar
              </button>
              <button
                onClick={handleGerarLink}
                disabled={!conviteEmpresaId}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                <Link className="w-4 h-4" />
                Gerar Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}