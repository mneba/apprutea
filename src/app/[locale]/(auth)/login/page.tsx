'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowRight, Sparkles } from 'lucide-react';
import { Button, Input, Logo, LanguageSwitcher } from '@/components/ui';
import { Link } from '@/i18n/routing';
import { authService } from '@/services/auth';
import { useRouter } from '@/i18n/routing';

const loginSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(6, 'passwordMinLength'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const tValidation = useTranslations('auth.login.errors');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleLogin = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const { user, profile } = await authService.login(data.email, data.password);

      if (!profile) {
        // Usuário não tem perfil - redirecionar para completar cadastro
        router.push('/registro?etapa=2');
        return;
      }

      if (profile.status === 'PENDENTE') {
        // Usuário pendente - redirecionar para aguardar código
        router.push('/aguardando-codigo');
        return;
      }

      if (profile.status === 'APROVADO' && !profile.token_validado) {
        // Usuário aprovado mas não validou código
        router.push('/aguardando-codigo');
        return;
      }

      if (profile.status === 'REJEITADO') {
        setError('Sua solicitação foi rejeitada. Entre em contato com o administrador.');
        return;
      }

      // Usuário aprovado e validado - redirecionar para dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(tValidation('invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <div className="mb-8">
            <Logo size="lg" showText={false} className="mb-6" />
            <h1 className="text-4xl xl:text-5xl font-bold mb-4">Apprutea</h1>
            <p className="text-xl text-blue-100 max-w-md">
              Sistema completo de gestão de microcrédito e rotas de cobrança
            </p>
          </div>

          <div className="space-y-4 mt-8">
            {[
              'Liquidação diária em tempo real',
              'Controle total de clientes e empréstimos',
              'GPS e auditoria completa',
              'Multi-idioma: Português e Espanhol',
            ].map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-blue-100">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <div className="flex justify-between items-center p-6">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <div className="ml-auto">
            <LanguageSwitcher variant="buttons" />
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h2>
              <p className="text-gray-500">{t('subtitle')}</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-5">
              <Input
                label={t('email')}
                type="email"
                placeholder={t('emailPlaceholder')}
                icon={<Mail className="w-5 h-5" />}
                error={
                  form.formState.errors.email?.message
                    ? tValidation(form.formState.errors.email.message as any)
                    : undefined
                }
                {...form.register('email')}
              />

              <Input
                label={t('password')}
                type="password"
                placeholder={t('passwordPlaceholder')}
                error={
                  form.formState.errors.password?.message
                    ? tValidation(form.formState.errors.password.message as any)
                    : undefined
                }
                {...form.register('password')}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">{t('rememberMe')}</span>
                </label>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t('forgotPassword')}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={isLoading}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                {isLoading ? t('submitting') : t('submitButton')}
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                {t('noAccount')}{' '}
                <Link
                  href="/registro"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {t('register')}
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="py-4 text-center text-sm text-gray-400">
          © 2025 Apprutea. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
