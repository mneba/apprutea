'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Clock, CheckCircle2, XCircle, LogOut } from 'lucide-react';
import { Button, Input, Logo, LanguageSwitcher } from '@/components/ui';
import { authService } from '@/services/auth';
import { useRouter } from '@/i18n/routing';

const codigoSchema = z.object({
  codigo: z.string().min(1, 'codeRequired'),
});

type CodigoForm = z.infer<typeof codigoSchema>;

export default function AguardandoCodigoPage() {
  const t = useTranslations('auth.waitingCode');
  const tValidation = useTranslations('validation');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [status, setStatus] = useState<'PENDENTE' | 'APROVADO' | 'REJEITADO' | null>(null);
  const [temCodigo, setTemCodigo] = useState(false);
  const router = useRouter();

  const form = useForm<CodigoForm>({
    resolver: zodResolver(codigoSchema),
    defaultValues: { codigo: '' },
  });

  // Verificar status do usuário ao carregar
  useEffect(() => {
    async function verificarStatus() {
      try {
        const user = await authService.getUsuarioAtual();
        if (!user) {
          router.push('/login');
          return;
        }

        const profileStatus = await authService.verificarStatus(user.id);
        if (profileStatus) {
          setStatus(profileStatus.status);
          setTemCodigo(!!profileStatus.token_acesso);

          // Se já está aprovado e validado, redirecionar
          if (profileStatus.status === 'APROVADO' && profileStatus.token_validado) {
            router.push('/dashboard');
          }
        }
      } catch (err) {
        console.error('Erro ao verificar status:', err);
      }
    }

    verificarStatus();
    // Verificar a cada 30 segundos
    const interval = setInterval(verificarStatus, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const handleValidarCodigo = async (data: CodigoForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await authService.getUsuarioAtual();
      if (!user) {
        router.push('/login');
        return;
      }

      await authService.validarCodigo(user.id, data.codigo);
      setSuccess(true);
      
      // Redirecionar após 2 segundos
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(t('invalidCode'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-6">
        <Logo size="sm" />
        <div className="flex items-center gap-4">
          <LanguageSwitcher variant="buttons" />
          <Button variant="ghost" onClick={handleLogout} icon={<LogOut className="w-4 h-4" />}>
            {t('logout')}
          </Button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Card Principal */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            {/* Ícone de Status */}
            <div className="flex justify-center mb-6">
              {success ? (
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
              ) : status === 'REJEITADO' ? (
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
              ) : temCodigo ? (
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <KeyRound className="w-10 h-10 text-blue-600" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center animate-pulse">
                  <Clock className="w-10 h-10 text-yellow-600" />
                </div>
              )}
            </div>

            {/* Título e Mensagem */}
            <div className="text-center mb-8">
              {success ? (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('successTitle')}</h2>
                  <p className="text-gray-500">{t('successMessage')}</p>
                </>
              ) : status === 'REJEITADO' ? (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('rejectedTitle')}</h2>
                  <p className="text-gray-500">{t('rejectedMessage')}</p>
                </>
              ) : temCodigo ? (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('codeReadyTitle')}</h2>
                  <p className="text-gray-500">{t('codeReadyMessage')}</p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('waitingTitle')}</h2>
                  <p className="text-gray-500">{t('waitingMessage')}</p>
                </>
              )}
            </div>

            {/* Status Badge */}
            {!success && status && (
              <div className="flex justify-center mb-6">
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium
                  ${status === 'PENDENTE' ? 'bg-yellow-100 text-yellow-800' : ''}
                  ${status === 'APROVADO' ? 'bg-green-100 text-green-800' : ''}
                  ${status === 'REJEITADO' ? 'bg-red-100 text-red-800' : ''}
                `}>
                  {status === 'PENDENTE' && t('statusPending')}
                  {status === 'APROVADO' && t('statusApproved')}
                  {status === 'REJEITADO' && t('statusRejected')}
                </span>
              </div>
            )}

            {/* Formulário de Código */}
            {!success && (status === 'APROVADO' || temCodigo) && (
              <form onSubmit={form.handleSubmit(handleValidarCodigo)} className="space-y-5">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}

                <Input
                  label={t('codeLabel')}
                  type="text"
                  placeholder={t('codePlaceholder')}
                  icon={<KeyRound className="w-5 h-5" />}
                  className="text-center text-lg tracking-widest uppercase"
                  error={form.formState.errors.codigo?.message ? tValidation('required') : undefined}
                  {...form.register('codigo')}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={isLoading}
                >
                  {t('validateButton')}
                </Button>
              </form>
            )}

            {/* Mensagem de aguardo */}
            {!success && status === 'PENDENTE' && !temCodigo && (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-4">{t('waitingHint')}</p>
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Info adicional */}
          <div className="mt-6 text-center text-sm text-gray-500">
            <p>{t('helpText')}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center text-sm text-gray-400">
        © 2025 Apprutea. Todos os direitos reservados.
      </div>
    </div>
  );
}
