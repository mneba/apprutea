import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // Lista de locales suportados
  locales: ['pt-BR', 'es'],

  // Locale padrão
  defaultLocale: 'pt-BR',

  // Sempre mostra o prefixo na URL (evita loops)
  localePrefix: 'always'
});

// Exporta funções de navegação tipadas
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
