'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { Button, Input, Logo, LanguageSwitcher } from '@/components/ui';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

const esqueciSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
});

type EsqueciForm = z.infer<typeof esqueciSchema>;

export default function EsqueciSenhaPage() {
  const t = useTranslations('auth.forgotPassword');
  const tErros = useTranslations('auth.forgotPassword.errors');
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  const form = useForm<EsqueciForm>({
    resolver: zodResolver(esqueciSchema),
    defaultValues: { email: '' },
  });

  const handleEnviar = async (data: EsqueciForm) => {
    setIsLoading(true);
    setErro(null);

    try {
      // A origem é a da própria aba, e não NEXT_PUBLIC_APP_URL: assim o link
      // volta para onde o pedido foi feito (localhost em dev, domínio em
      // produção). As duas precisam estar em Auth > URL Configuration >
      // Redirect URLs no Supabase, senão ele manda para o Site URL.
      const redirectTo = `${window.location.origin}/${locale}/redefinir-senha`;
      const { error } = await createClient().auth.resetPasswordForEmail(
        data.email.trim(),
        { redirectTo }
      );

      if (error) {
        console.error('❌ resetPasswordForEmail:', error);
        if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
          setErro(t('rateLimit'));
        } else {
          setErro(t('error'));
        }
        return;
      }

      // Mensagem neutra de propósito: o Supabase não diz se o e-mail existe,
      // e a tela também não deve dizer.
      setEnviado(true);
    } catch (err) {
      console.error('❌ resetPasswordForEmail:', err);
      setErro(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex justify-between items-center p-6">
        <Logo size="sm" />
        <LanguageSwitcher variant="buttons" />
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {enviado ? (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('emailSent')}</h2>
              <p className="text-gray-500 mb-8">{t('emailSentHint')}</p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h2>
                <p className="text-gray-500">{t('subtitle')}</p>
              </div>

              {erro && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {erro}
                </div>
              )}

              <form onSubmit={form.handleSubmit(handleEnviar)} className="space-y-5">
                <Input
                  label={t('email')}
                  type="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  icon={<Mail className="w-5 h-5" />}
                  error={
                    form.formState.errors.email?.message
                      ? tErros(form.formState.errors.email.message as any)
                      : undefined
                  }
                  {...form.register('email')}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={isLoading}
                  icon={<Send className="w-4 h-4" />}
                >
                  {isLoading ? t('submitting') : t('submitButton')}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('backToLogin')}
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
