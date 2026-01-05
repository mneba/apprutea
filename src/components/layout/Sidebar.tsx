'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  LayoutDashboard,
  FileText,
  Users,
  DollarSign,
  Building2,
  UserCog,
  Settings,
  ChevronDown,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface MenuItem {
  name: string;
  href: string;
  icon: LucideIcon;
  roles?: string[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// ============================================
// ESTRUTURA DO MENU - ORDEM CORRIGIDA
// ============================================
const menuSections: MenuSection[] = [
  {
    title: 'OPERAÇÕES',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Liquidação Diária', href: '/liquidacao', icon: FileText },
      { name: 'Clientes', href: '/clientes', icon: Users },
      { name: 'Financeiro', href: '/financeiro', icon: DollarSign },
    ],
  },
  {
    title: 'ESTRUTURA',
    items: [
      // ✅ CORREÇÃO: Vendedores ANTES de Organização
      { name: 'Vendedores', href: '/vendedores', icon: UserCog },
      { name: 'Organização', href: '/organizacao', icon: Building2 },
    ],
  },
  {
    title: 'ADMINISTRAÇÃO',
    items: [
      { 
        name: 'Usuários', 
        href: '/usuarios', 
        icon: Users,
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
      { 
        name: 'Configurações', 
        href: '/configuracoes', 
        icon: Settings,
        roles: ['SUPER_ADMIN', 'ADMIN'],
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const { user } = useAuth();

  const userRole = user?.role || 'VIEWER';

  const isActive = (href: string) => {
    const fullPath = `/${locale}${href}`;
    return pathname === fullPath || pathname.startsWith(`${fullPath}/`);
  };

  const canAccessItem = (item: MenuItem) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.includes(userRole);
  };

  return (
    <aside className="w-64 bg-[#1e293b] text-white min-h-screen flex flex-col">
      {/* Logo / Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <span className="text-xl font-semibold">Apprutea</span>
        </div>
      </div>

      {/* Menu Sections */}
      <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
        {menuSections.map((section) => {
          // Filtrar itens que o usuário pode acessar
          const accessibleItems = section.items.filter(canAccessItem);
          
          // Não renderizar seção se não houver itens acessíveis
          if (accessibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <ul className="space-y-1">
                {accessibleItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <li key={item.href}>
                      <Link
                        href={`/${locale}${item.href}`}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                          active
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer (opcional) */}
      <div className="p-4 border-t border-slate-700">
        <div className="text-xs text-slate-400 text-center">
          © 2025 Apprutea
        </div>
      </div>
    </aside>
  );
}
