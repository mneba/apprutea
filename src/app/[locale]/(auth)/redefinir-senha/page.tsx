'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, KeyRound, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button, Input, Logo, LanguageSwitcher } from '@/components/ui';
import { Link } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

const redefinirSchema = z
  .object({
    password: z.string().min(6, 'passwordMinLength'),
    confirmPassword: z.string().min(1, 'passwordMismatch'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'passwordMismatch',
    path: ['confirmPassword'],
  });

type RedefinirForm = z.infer<typeof redefinirSchema>;

type Etapa = 'verificando' | 'pronto' | 'invalido' | 'concluido';

// Link com cara de botão: <a><button> aninhados não é HTML válido.
const LINK_BOTAO =
  'flex w-full items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 transition-colors';

/**
 * Lê o erro que o Supabase devolve quando o link não serve (expirado, já
 * usado). No fluxo PKCE ele vem na query; no implícito, no hash.
 */
function erroNaUrl(): string | null {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return (
    query.get('error_description') ||
    hash.get('error_description') ||
    query.get('error') ||
    hash.get('error')
  );
}

export default function RedefinirSenhaPage() {
  const t = useTranslations('auth.resetPassword');
  const tErros = useTranslations('auth.resetPassword.errors');
  const [etapa, setEtapa] = useState<Etapa>('verificando');
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const form = useForm<RedefinirForm>({
    resolver: zodResolver(redefinirSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    const supabase = createClient();
    let ativo = true;

    if (erroNaUrl()) {
      setEtapa('invalido');
      return;
    }

    // O cliente do navegador troca o `?code=` do link por uma sessão de
    // recuperação sozinho, ao iniciar (detectSessionInUrl). `getSession`
    // espera essa inicialização terminar, então depois dele a resposta é
    // definitiva: com sessão, pode trocar a senha; sem, o link não serviu —
    // expirado, já usado ou aberto em outro navegador (o PKCE guarda a chave
    // no navegador que PEDIU a recuperação).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && ativo) setEtapa('pronto');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!ativo) return;
      setEtapa((atual) => (atual === 'verificando' ? (session ? 'pronto' : 'invalido') : atual));
      // Tira o código da barra de endereço: ele é de uso único.
      if (window.location.search.includes('code=')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleRedefinir = async (data: RedefinirForm) => {
    setIsLoading(true);
    setErro(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: data.password });

      if (error) {
        console.error('❌ updateUser(password):', error);
        if (error.code === 'same_password') setErro(t('samePassword'));
        else if (error.code === 'weak_password') setErro(t('weakPassword'));
        else if (error.status === 401 || error.code === 'session_not_found') setEtapa('invalido');
        else setErro(t('error'));
        return;
      }

      // Sai da sessão de recuperação: o login refaz o caminho normal
      // (perfil, status, código) com a senha nova.
      await supabase.auth.signOut();
      setEtapa('concluido');
    } catch (err) {
      console.error('❌ updateUser(password):', err);
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
          {etapa === 'verificando' && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 mx-auto mb-4 text-blue-600 animate-spin" />
              <p className="text-gray-500">{t('checking')}</p>
            </div>
          )}

          {etapa === 'invalido' && (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                <XCircle className="w-7 h-7 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('invalidLink')}</h2>
              <p className="text-gray-500 mb-8">{t('invalidLinkHint')}</p>
              <Link href="/esqueci-senha" className={LINK_BOTAO}>
                {t('requestNew')}
              </Link>
              <div className="mt-6">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('backToLogin')}
                </Link>
              </div>
            </div>
          )}

          {etapa === 'concluido' && (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('success')}</h2>
              <p className="text-gray-500 mb-8">{t('successHint')}</p>
              <Link href="/login" className={LINK_BOTAO}>
                {t('goToLogin')}
              </Link>
            </div>
          )}

          {etapa === 'pronto' && (
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

              <form onSubmit={form.handleSubmit(handleRedefinir)} className="space-y-5">
                <Input
                  label={t('password')}
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('passwordPlaceholder')}
                  error={
                    form.formState.errors.password?.message
                      ? tErros(form.formState.errors.password.message as any)
                      : undefined
                  }
                  {...form.register('password')}
                />

                <Input
                  label={t('confirmPassword')}
                  type="password"
                  autoComplete="new-password"
                  placeholder={t('confirmPasswordPlaceholder')}
                  error={
                    form.formState.errors.confirmPassword?.message
                      ? tErros(form.formState.errors.confirmPassword.message as any)
                      : undefined
                  }
                  {...form.register('confirmPassword')}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={isLoading}
                  icon={<KeyRound className="w-4 h-4" />}
                >
                  {isLoading ? t('submitting') : t('submitButton')}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
