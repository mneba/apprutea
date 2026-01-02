'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, KeyRound, ArrowRight, Sparkles } from 'lucide-react';
import { Button, Input, Logo, LanguageSwitcher } from '@/components/ui';
import { cn } from '@/lib/utils';

// Schemas de validação
const emailLoginSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(6, 'passwordMinLength'),
});

const codeLoginSchema = z.object({
  code: z.string().min(1, 'codeRequired'),
});

type EmailLoginForm = z.infer<typeof emailLoginSchema>;
type CodeLoginForm = z.infer<typeof codeLoginSchema>;

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const tValidation = useTranslations('auth.login.errors');
  const [loginMode, setLoginMode] = useState<'email' | 'code'>('email');
  const [isLoading, setIsLoading] = useState(false);

  // Form para login com e-mail
  const emailForm = useForm<EmailLoginForm>({
    resolver: zodResolver(emailLoginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Form para login com código
  const codeForm = useForm<CodeLoginForm>({
    resolver: zodResolver(codeLoginSchema),
    defaultValues: { code: '' },
  });

  const handleEmailLogin = async (data: EmailLoginForm) => {
    setIsLoading(true);
    try {
      // TODO: Implementar login com Supabase
      console.log('Email login:', data);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeLogin = async (data: CodeLoginForm) => {
    setIsLoading(true);
    try {
      // TODO: Implementar login com código de acesso
      console.log('Code login:', data);
      await new Promise((resolve) => setTimeout(resolve, 1500));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado Esquerdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 relative overflow-hidden">
        {/* Padrão decorativo */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <div className="mb-8">
            <Logo size="lg" showText={false} className="mb-6" />
            <h1 className="text-4xl xl:text-5xl font-bold mb-4">
              Apprutea
            </h1>
            <p className="text-xl text-primary-100 max-w-md">
              Sistema completo de gestão de microcrédito e rotas de cobrança
            </p>
          </div>

          {/* Features */}
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
                <span className="text-primary-100">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex flex-col">
        {/* Header com seletor de idioma */}
        <div className="flex justify-between items-center p-6">
          <div className="lg:hidden">
            <Logo size="sm" />
          </div>
          <div className="ml-auto">
            <LanguageSwitcher variant="buttons" />
          </div>
        </div>

        {/* Formulário centralizado */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
            {/* Título */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {t('title')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                {t('subtitle')}
              </p>
            </div>

            {/* Tabs de modo de login */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-8">
              <button
                onClick={() => setLoginMode('email')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all',
                  loginMode === 'email'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <Mail className="w-4 h-4" />
                {t('loginWithEmail')}
              </button>
              <button
                onClick={() => setLoginMode('code')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all',
                  loginMode === 'code'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <KeyRound className="w-4 h-4" />
                {t('loginWithCode')}
              </button>
            </div>

            {/* Formulário de E-mail */}
            {loginMode === 'email' && (
              <form
                onSubmit={emailForm.handleSubmit(handleEmailLogin)}
                className="space-y-5 animate-fade-in"
              >
                <Input
                  label={t('email')}
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  icon={<Mail className="w-5 h-5" />}
                  error={
                    emailForm.formState.errors.email?.message
                      ? tValidation(emailForm.formState.errors.email.message as any)
                      : undefined
                  }
                  {...emailForm.register('email')}
                />

                <Input
                  label={t('password')}
                  type="password"
                  placeholder={t('passwordPlaceholder')}
                  error={
                    emailForm.formState.errors.password?.message
                      ? tValidation(emailForm.formState.errors.password.message as any)
                      : undefined
                  }
                  {...emailForm.register('password')}
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {t('rememberMe')}
                    </span>
                  </label>
                  <button
                    type="button"
                    className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
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
            )}

            {/* Formulário de Código */}
            {loginMode === 'code' && (
              <form
                onSubmit={codeForm.handleSubmit(handleCodeLogin)}
                className="space-y-5 animate-fade-in"
              >
                <Input
                  label={t('accessCode')}
                  type="text"
                  placeholder={t('accessCodePlaceholder')}
                  icon={<KeyRound className="w-5 h-5" />}
                  error={
                    codeForm.formState.errors.code?.message
                      ? tValidation(codeForm.formState.errors.code.message as any)
                      : undefined
                  }
                  className="text-center text-lg tracking-widest"
                  {...codeForm.register('code')}
                />

                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Digite o código de acesso fornecido pelo seu administrador
                </p>

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
            )}

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('noAccount')}{' '}
                <button className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium">
                  {t('register')}
                </button>
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="py-4 text-center text-sm text-gray-400">
          © 2025 Apprutea. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
