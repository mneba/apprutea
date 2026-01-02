'use client';

import { cn } from '@/lib/utils';
import { Route } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const sizes = {
    sm: { icon: 'w-6 h-6', text: 'text-lg' },
    md: { icon: 'w-8 h-8', text: 'text-xl' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl' },
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg',
          size === 'sm' && 'p-1.5',
          size === 'md' && 'p-2',
          size === 'lg' && 'p-3'
        )}
      >
        <Route className={sizes[size].icon} />
      </div>
      {showText && (
        <span
          className={cn(
            'font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent',
            sizes[size].text
          )}
        >
          Apprutea
        </span>
      )}
    </div>
  );
}
