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
  MapPinOff,
  Tag,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';

interface MenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  sempreAtivo?: boolean; // funciona mesmo sem localização
}

const menuItems: MenuItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, sempreAtivo: true },
  { name: 'Vendedores', href: '/vendedores', icon: Users },
  { name: 'Organização', href: '/organizacao', icon: Building2, sempreAtivo: true },
  { name: 'Clientes', href: '/clientes', icon: UserCog },
  { name: 'Empréstimos', href: '/emprestimos', icon: CreditCard },
  { name: 'Liquidação', href: '/liquidacao', icon: FileText },
  { name: 'Categorias Financeiras', href: '/categorias-financeiras', icon: Tag, roles: ['SUPER_ADMIN'], sempreAtivo: true },
  { name: 'Rotas', href: '/rotas', icon: MapPin },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
  { name: 'Usuários', href: '/usuarios', icon: Shield, roles: ['SUPER_ADMIN', 'ADMIN'], sempreAtivo: true },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, sempreAtivo: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile, localizacao } = useUser();

  const locale = pathname.split('/')[1] || 'pt';
  const temLocalizacao = !!localizacao.empresa_id;

  const filteredMenuItems = menuItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(profile?.tipo_usuario || '');
  });

  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <nav className="p-4 space-y-1">

        {/* Aviso de localização não selecionada */}
        {!temLocalizacao && (
          <div className="flex items-start gap-2 px-3 py-2.5 mb-3 bg-amber-50 border border-amber-200 rounded-xl">
            <MapPinOff className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-snug">
              Selecione uma empresa no topo para acessar os módulos.
            </p>
          </div>
        )}

        {filteredMenuItems.map((item) => {
          const isActive = pathname.includes(item.href);
          const Icon = item.icon;
          const habilitado = temLocalizacao || item.sempreAtivo;

          if (!habilitado) {
            return (
              <div
                key={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-300 cursor-not-allowed select-none"
                title="Selecione uma empresa para acessar"
              >
                <Icon className="w-5 h-5 text-gray-300" />
                <span>{item.name}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={`/${locale}${item.href}`}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                ${isActive
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

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