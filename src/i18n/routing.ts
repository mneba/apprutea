import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // Lista de locales suportados
  locales: ['pt-BR', 'es'],

  // Locale padrão
  defaultLocale: 'pt-BR',

  // Prefixo de locale na URL
  localePrefix: 'as-needed'
});

// Exporta funções de navegação tipadas
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
