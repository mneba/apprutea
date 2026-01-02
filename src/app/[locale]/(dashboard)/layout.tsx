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
  User
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserProvider, useUser } from '@/contexts/UserContext';
import { MenuNotificacoes } from '@/components/layout/MenuNotificacoes';
import { SeletorLocalizacao } from '@/components/layout/SeletorLocalizacao';

interface MenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: 'Operações',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, href: '/dashboard' },
      { key: 'liquidacao', label: 'Liquidação Diária', icon: <FileText className="w-5 h-5" />, href: '/liquidacao' },
      { key: 'clientes', label: 'Clientes', icon: <Users className="w-5 h-5" />, href: '/clientes' },
      { key: 'financeiro', label: 'Financeiro', icon: <DollarSign className="w-5 h-5" />, href: '/financeiro' },
    ],
  },
  {
    title: 'Estrutura',
    items: [
      { key: 'organizacao', label: 'Organização', icon: <Building2 className="w-5 h-5" />, href: '/organizacao' },
      { key: 'vendedores', label: 'Vendedores', icon: <UserCog className="w-5 h-5" />, href: '/vendedores' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { key: 'usuarios', label: 'Usuários e Permissões', icon: <Settings className="w-5 h-5" />, href: '/usuarios' },
    ],
  },
];

// Componente interno que usa o contexto
function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

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
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-[#1e2a3b] text-white transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-xl font-bold">Apprutea</span>
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
              <div className="px-4 mb-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.title}
                </span>
              </div>
              <ul className="space-y-1 px-2">
                {group.items.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
                        ${isActive(item.href) 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-300 hover:bg-white/10 hover:text-white'
                        }
                      `}
                      onClick={() => setSidebarOpen(false)}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-4 lg:px-6">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button 
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              
              {/* Seletor de Localização */}
              <SeletorLocalizacao />
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
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {userMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{profile?.nome || 'Usuário'}</p>
                        <p className="text-xs text-gray-500">{profile?.tipo_usuario}</p>
                      </div>
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

        {/* Page Content */}
        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
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
