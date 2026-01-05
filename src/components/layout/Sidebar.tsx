'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCog,
  Settings,
  FileText,
  CreditCard,
  MapPin,
  BarChart3,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

interface MenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const menuItems: MenuItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Vendedores',
    href: '/vendedores',
    icon: Users,
  },
  {
    name: 'Organização',
    href: '/organizacao',
    icon: Building2,
  },
  {
    name: 'Clientes',
    href: '/clientes',
    icon: UserCog,
  },
  {
    name: 'Empréstimos',
    href: '/emprestimos',
    icon: CreditCard,
  },
  {
    name: 'Liquidação',
    href: '/liquidacao',
    icon: FileText,
  },
  {
    name: 'Rotas',
    href: '/rotas',
    icon: MapPin,
  },
  {
    name: 'Relatórios',
    href: '/relatorios',
    icon: BarChart3,
  },
  {
    name: 'Usuários',
    href: '/usuarios',
    icon: Shield,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    name: 'Configurações',
    href: '/configuracoes',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useUser();
  
  // Extrair locale do pathname
  const locale = pathname.split('/')[1] || 'pt';

  // Filtrar itens de menu baseado no role do usuário
  const filteredMenuItems = menuItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(profile?.tipo_usuario || '');
  });

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <nav className="p-4 space-y-1">
        {filteredMenuItems.map((item) => {
          const isActive = pathname.includes(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                ${isActive 
                  ? 'bg-blue-50 text-blue-600 font-medium' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Ajuda no rodapé */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <Link
          href={`/${locale}/ajuda`}
          className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-xl transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-gray-400" />
          <span>Ajuda</span>
        </Link>
      </div>
    </aside>
  );
}
