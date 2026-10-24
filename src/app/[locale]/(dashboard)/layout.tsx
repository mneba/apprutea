'use client';

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  DollarSign, 
  Building2, 
  UserCog,
  Settings,
  ChevronDown,
  Menu,
  X,
  LogOut,
  User,
  ShieldCheck,
  Tag,
  ScrollText,
  BarChart3,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { lembrarSubmodulo, ultimoSubmodulo } from '@/lib/estadoTela';
import { UserProvider, useUser } from '@/contexts/UserContext';
import { MenuNotificacoes } from '@/components/layout/MenuNotificacoes';
import { SeletorLocalizacao } from '@/components/layout/SeletorLocalizacao';
import { ModalGerenciarUsuario } from '@/components/usuarios';

interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  sempreAtivo?: boolean;
  roles?: string[];
  modulo?: string; // código do módulo para verificar permissão
  /**
   * Visível apenas para estes `auth.users.id`.
   *
   * Usado por ferramenta interna, que não tem módulo em
   * `modulos_sistema` nem faz sentido para um tipo de usuário inteiro.
   *
   * ⚠ ISTO É COSMÉTICO, e está registrado como dívida no CLAUDE.md:
   * esconder o item não impede ninguém de chamar as funções direto com a
   * chave anon. O gate de verdade tem de estar no banco, e por decisão do
   * Mauricio em 15/10/2026 ficou para depois.
   */
  userIds?: string[];
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: 'Operações',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, href: '/dashboard', sempreAtivo: true },
      { key: 'liquidacao', label: 'Liquidação Diária', icon: <FileText className="w-5 h-5" />, href: '/liquidacao', modulo: 'LIQUIDACAO_DIARIA' },
      { key: 'clientes', label: 'Clientes', icon: <Users className="w-5 h-5" />, href: '/clientes', modulo: 'GESTAO_CLIENTES' },
      { key: 'financeiro', label: 'Financeiro', icon: <DollarSign className="w-5 h-5" />, href: '/financeiro', modulo: 'FINANCEIRO' },
      // `sempreAtivo` de propósito: os demais itens ficam travados enquanto
      // `localizacao.empresa_id` for nulo, e Relatórios existe justamente para
      // NÃO depender do seletor global — cada relatório escolhe o próprio
      // recorte, de uma rota ao país inteiro. Sem isso, o seletor trancaria a
      // tela feita para dispensá-lo.
      //
      // `modulo` e nao `roles`: Relatorios era o unico item do grupo que
      // dependia do TIPO do usuario, e por isso nao havia caixa nenhuma
      // para liberar a secretaria do Julio em 19/10/2026 — ela e
      // USUARIO_PADRAO. O modulo RELATORIOS ja existia em
      // `modulos_sistema`, so estava `ativo = false`, e a tela de
      // permissoes lista apenas os ativos. Ver
      // sql/2026-10-19_relatorios_por_permissao.sql, que tambem concede a
      // permissao a quem entrava pelo tipo — senao a troca tiraria o menu
      // dos admins e do monitor.
      { key: 'relatorios', label: 'Relatórios', icon: <BarChart3 className="w-5 h-5" />, href: '/relatorios', modulo: 'RELATORIOS', sempreAtivo: true },
    ],
  },
  {
    title: 'Estrutura',
    items: [
      { key: 'vendedores', label: 'Vendedores', icon: <UserCog className="w-5 h-5" />, href: '/vendedores', modulo: 'GESTAO_VENDEDORES' },
      { key: 'organizacao', label: 'Organização', icon: <Building2 className="w-5 h-5" />, href: '/organizacao', modulo: 'ORGANIZACAO' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { key: 'liberacoes', label: 'Central de Liberações', icon: <ShieldCheck className="w-5 h-5" />, href: '/liberacoes', roles: ['SUPER_ADMIN', 'ADMIN'], modulo: 'CENTRAL_LIBERACOES' },
      { key: 'usuarios', label: 'Usuários e Permissões', icon: <Settings className="w-5 h-5" />, href: '/usuarios', roles: ['SUPER_ADMIN', 'ADMIN'], modulo: 'GESTAO_USUARIOS' },
      { key: 'categorias-financeiras', label: 'Categorias Financeiras', icon: <Tag className="w-5 h-5" />, href: '/categorias-financeiras', roles: ['SUPER_ADMIN'], sempreAtivo: true },
      // `sempreAtivo` pelo mesmo motivo de Relatórios: a tela escolhe o
      // próprio recorte (empresa e rota), então travá-la no seletor global
      // seria trancar justamente quem precisa olhar o sistema inteiro.
      { key: 'auditoria', label: 'Auditoria', icon: <ScrollText className="w-5 h-5" />, href: '/auditoria', roles: ['SUPER_ADMIN'], sempreAtivo: true },
      // Ferramenta interna de migração do sistema legado. `sempreAtivo`
      // porque ela escolhe a própria rota, e `userIds` porque é operação
      // de desenvolvedor, não função do produto.
      {
        key: 'importacao',
        label: 'Importação SmartPay',
        icon: <FileSpreadsheet className="w-5 h-5" />,
        href: '/importacao',
        sempreAtivo: true,
        userIds: ['f1a47b2a-1089-46c6-bfa1-397fced89db0'],
      },
    ],
  },
];

// Componente interno que usa o contexto
function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // `usePathname` do next/navigation traz o prefixo de locale — ver CLAUDE.md,
  // "Routing".
  const ehRelatorios = pathname.replace(/^\/(pt-BR|es)/, '').startsWith('/relatorios');
  const router = useRouter();
  const { user, profile, localizacao, temPermissao } = useUser();
  const temLocalizacao = !!localizacao.empresa_id;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Feedback imediato no toque do menu ───────────────────────────────
  // O PROBLEMA: `ativo` saía só de `usePathname()`, que atualiza DEPOIS de a
  // navegação assentar. Entre o clique e a página nova montar, a página
  // velha seguia na tela E o item velho seguia destacado — nada se movia no
  // lugar onde o dedo tocou, então parecia que o clique não registrou.
  //
  // E a espera é real: as páginas disparam as próprias consultas ao montar
  // (a liquidação, ~13), e `fn_liquidacao_dia_completa` tem média de 558 ms
  // com cauda até 7 s. O pacote não é o gargalo — a liquidação tem 34,7 kB.
  //
  // Guardar o DESTINO PRETENDIDO resolve sem tocar na velocidade: o item
  // clicado fica ativo na hora e ganha um giro, e `pathname` limpa o estado
  // quando a rota de fato troca.
  //
  // Por que não `useTransition`: ele não envolve a navegação do `<Link>`, que
  // o Next trata por dentro. E trocar `<Link>` por botão com `router.push`
  // custaria o que o anchor dá de graça — abrir em nova aba, clique do meio,
  // leitor de tela. Next 15.1.9 aqui; `useLinkStatus`, que resolveria isso
  // nativamente, só existe a partir do 15.3.
  const [indoPara, setIndoPara] = useState<string | null>(null);
  useEffect(() => { setIndoPara(null); }, [pathname]);

  // ── O menu volta para o sub-relatorio que estava aberto ──────────────
  // Pedido do Mauricio em 22/10/2026. O item Relatorios aponta para
  // `/relatorios`, que e uma pagina INDICE: quem gerou um relatorio, saiu
  // para conferir outro e clicou em Relatorios caia na tela de escolha e
  // tinha de gerar tudo de novo. Foi o que o Julio reportou como "os dados
  // foram apagados" -- o estado nunca foi apagado, ele e que nao voltava a
  // tela que o tinha.
  //
  // O REGISTRO FICA AQUI, lido do `pathname`, e nao em cada sub-pagina.
  // Uma pagina nova dentro de /relatorios passa a ser lembrada sem precisar
  // lembrar de se anunciar -- e lista que cada tela tem de alimentar a mao
  // e exatamente o formato de erro que este projeto ja pagou varias vezes.
  const caminhoSemLocale = pathname.replace(/^\/(pt-BR|es)/, '');
  useEffect(() => {
    if (caminhoSemLocale.startsWith('/relatorios/')) {
      lembrarSubmodulo('relatorios', caminhoSemLocale);
    }
  }, [caminhoSemLocale]);

  // Ja estando DENTRO de um sub-relatorio, o destino sai do caminho atual e
  // nao da memoria: a sub-pagina monta DEPOIS de o layout renderizar, entao
  // na primeira visita a memoria ainda estaria vazia e o item apontaria para
  // o indice -- atrasado em uma navegacao.
  const hrefRelatorios = caminhoSemLocale.startsWith('/relatorios/')
    ? caminhoSemLocale
    : (ultimoSubmodulo('relatorios') || '/relatorios');

  /**
   * A barra recolhida: só os ícones, 64px em vez de 256.
   *
   * Pedido de 09/10/2026, para telas pequenas — e as telas deste sistema são
   * largas por natureza: o dia a dia do relatório tem doze colunas e o extrato
   * do financeiro divide a tela em duas. Os 192px que a barra devolve são
   * duas colunas a mais.
   *
   * SÓ VALE DO `lg` PARA CIMA. No celular a barra já é gaveta: ou está
   * fechada, ou está aberta por cima do conteúdo, e recolher não devolve
   * espaço nenhum.
   *
   * Começa aberta e lê a preferência num efeito, não no estado inicial: ler
   * `localStorage` na primeira renderização faria o servidor e o navegador
   * produzirem HTML diferente, e o React reclama. O custo é um piscar para
   * quem recolheu.
   */
  const [recolhida, setRecolhida] = useState(false);

  useEffect(() => {
    try {
      setRecolhida(localStorage.getItem('apprutea:barra-recolhida') === '1');
    } catch {
      // Navegação anônima com armazenamento bloqueado: segue aberta.
    }
  }, []);

  const alternarBarra = () => {
    setRecolhida((v) => {
      const proxima = !v;
      try { localStorage.setItem('apprutea:barra-recolhida', proxima ? '1' : '0'); } catch { /* idem */ }
      return proxima;
    });
  };
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (user) {
      setUserEmail(user.email || '');
    }
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isActive = (href: string) => {
    const cleanPath = pathname.replace(/^\/(pt-BR|es)/, '');
    return cleanPath === href || cleanPath.startsWith(href + '/');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-[#1e2a3b] text-white flex flex-col
        transform transition-all duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${recolhida ? 'lg:w-16' : 'lg:w-64'}
      `}>
        {/* Logo. Recolhida, sobra o distintivo — e ele continua do mesmo
            tamanho, para a barra não parecer outra coisa. */}
        <div className={`flex items-center h-16 border-b border-white/10 flex-shrink-0 ${
          recolhida ? 'lg:justify-center lg:px-0 px-4 justify-between' : 'justify-between px-4'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className={`text-xl font-bold ${recolhida ? 'lg:hidden' : ''}`}>Apprutea</span>
          </div>
          <button 
            className="lg:hidden p-1 hover:bg-white/10 rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuGroups.map((group) => (
            <div key={group.title} className="mb-6">
              {/* Recolhida, o título do grupo não cabe — vira uma divisória,
                  que preserva o agrupamento sem o texto. */}
              <div className={`px-4 mb-2 ${recolhida ? 'lg:hidden' : ''}`}>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.title}
                </span>
              </div>
              <div className={`hidden mx-3 mb-2 border-t border-white/10 ${recolhida ? 'lg:block' : ''}`} />
              <ul className="space-y-1 px-2">
                {group.items
                  .filter(item => !item.roles || item.roles.includes(profile?.tipo_usuario || ''))
                  // `user.id` e nao `profile.user_id`: os dois servem, mas o
                  // do contexto de auth e a fonte, e nao depende de o perfil
                  // ter carregado. Sem id ainda, o item fica escondido — o
                  // lado seguro do erro.
                  .filter(item => !item.userIds || item.userIds.includes(user?.id || ''))
                  .map((item) => {
                  const habilitado = (temLocalizacao || item.sempreAtivo) &&
                    (!item.modulo || temPermissao(item.modulo));
                  const ativo = isActive(item.href);

                  // Recolhida, o ícone é tudo o que resta — então o nome vai
                  // para o `title`, senão quem não decora os símbolos fica sem
                  // saber onde clicar.
                  const caixa = `flex items-center gap-3 rounded-lg transition-colors ${
                    recolhida ? 'lg:justify-center lg:px-0 px-3' : 'px-3'
                  } py-2.5`;
                  const rotulo = `font-medium ${recolhida ? 'lg:hidden' : ''}`;

                  if (!habilitado) {
                    return (
                      <li key={item.key}>
                        <div
                          className={`${caixa} text-gray-500 cursor-not-allowed select-none opacity-40`}
                          title={recolhida ? `${item.label} — selecione uma empresa` : 'Selecione uma empresa para acessar'}
                        >
                          {item.icon}
                          <span className={rotulo}>{item.label}</span>
                        </div>
                      </li>
                    );
                  }

                  // `ativo` segue saindo de `item.href` (`/relatorios`), que
                  // casa com os sub-caminhos por prefixo -- so o DESTINO muda.
                  const destino = item.key === 'relatorios' ? hrefRelatorios : item.href;

                  // Ativo OTIMISTA: o item clicado acende antes de a rota
                  // trocar. `indoPara` some sozinho quando `pathname` muda.
                  const indo = indoPara === destino && !ativo;

                  return (
                    <li key={item.key}>
                      <Link
                        href={destino}
                        title={recolhida ? item.label : undefined}
                        className={`
                          ${caixa}
                          ${ativo || indo
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-300 hover:bg-white/10 hover:text-white'}
                          ${indo ? 'cursor-progress' : ''}
                        `}
                        onClick={() => { setIndoPara(destino); setSidebarOpen(false); }}
                      >
                        {/* O giro SUBSTITUI o ícone em vez de entrar ao lado:
                            com a barra recolhida só o ícone aparece, e um
                            segundo elemento não caberia nos 64px. */}
                        {indo
                          ? <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                          : item.icon}
                        <span className={rotulo}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* O botão fica no rodapé e não no cabeçalho: recolhida, a barra tem
            64px e o cabeçalho já é do distintivo. Aqui ele sempre cabe, e
            sempre no mesmo lugar. */}
        <button
          onClick={alternarBarra}
          aria-label={recolhida ? 'Expandir a barra' : 'Recolher a barra'}
          title={recolhida ? 'Expandir' : 'Recolher'}
          className={`hidden lg:flex items-center gap-3 py-3 border-t border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0 ${
            recolhida ? 'justify-center px-0' : 'px-5'
          }`}
        >
          {recolhida
            ? <PanelLeftOpen className="w-5 h-5" />
            : <PanelLeftClose className="w-5 h-5" />}
          {!recolhida && <span className="text-sm">Recolher</span>}
        </button>
      </aside>

      {/* Main Content Area */}
      <div className={`flex flex-col h-full transition-all duration-300 ${recolhida ? 'lg:pl-16' : 'lg:pl-64'}`}>
        {/* Header - Fixed */}
        <header className="flex-shrink-0 bg-white border-b border-gray-200 z-30">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button 
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              
              {/* Seletor de Localização
                  Fica de fora dos Relatórios: lá cada relatório escolhe o
                  próprio recorte — de uma rota ao país inteiro — e o seletor
                  global não tem efeito nenhum sobre o que está na tela.
                  Deixá-lo ali faria o usuário mexer nele esperando filtrar o
                  relatório, e não filtraria nada.

                  MAS A AUSÊNCIA INCOMODA. O usuário está acostumado a ver
                  alguma coisa nesse canto, e o vazio parece defeito —
                  reclamação de 09/10/2026. Então o lugar fica ocupado por um
                  aviso esmaecido, que diz para onde o controle foi em vez de
                  deixar o usuário procurando. */}
              {ehRelatorios ? (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 text-gray-400 select-none cursor-default"
                  title="Em Relatórios o recorte vem do próprio relatório — cada um escolhe de uma rota ao país inteiro, no botão Exibindo."
                >
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">
                    Escopo{' '}
                    <span className="hidden sm:inline">no próprio relatório</span>
                  </span>
                </div>
              ) : (
                <SeletorLocalizacao />
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {/* Notificações */}
              <MenuNotificacoes />

              {/* User Menu */}
              <div className="relative">
                <button
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg"
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <span className="hidden sm:block text-sm text-gray-700">{userEmail}</span>
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    {(profile as any)?.url_foto_usuario ? (
                      <img src={(profile as any).url_foto_usuario} alt="" className="w-8 h-8 object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{profile?.nome || 'Usuário'}</p>
                        <p className="text-xs text-gray-500">{profile?.tipo_usuario}</p>
                      </div>
                      <button
                        onClick={() => { setUserMenuOpen(false); setModalPerfilAberto(true); }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <User className="w-4 h-4" />
                        Meu Perfil
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="w-4 h-4" />
                        Sair
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - Scrollable */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      {/* Modal Próprio Perfil */}
      {modalPerfilAberto && profile && (
        <ModalGerenciarUsuario
          usuario={profile as any}
          modoProprioPerfil={true}
          onClose={() => setModalPerfilAberto(false)}
          onSave={() => setModalPerfilAberto(false)}
        />
      )}
    </div>
  );
}

// Layout principal que envolve com o Provider
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <DashboardContent>{children}</DashboardContent>
    </UserProvider>
  );
}