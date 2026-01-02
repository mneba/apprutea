'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, User, Phone, Building2, MapPin, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button, Input, Logo, LanguageSwitcher } from '@/components/ui';
import { Link, useRouter } from '@/i18n/routing';
import { authService, hierarquiaService } from '@/services/auth';
import type { Hierarquia } from '@/types/database';

// Schema Etapa 1
const etapa1Schema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(6, 'passwordMinLength'),
  confirmPassword: z.string().min(6, 'passwordMinLength'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'passwordMismatch',
  path: ['confirmPassword'],
});

// Schema Etapa 2
const etapa2Schema = z.object({
  nome: z.string().min(3, 'nameMinLength'),
  telefone: z.string().min(10, 'phoneMinLength'),
  pais: z.string().min(1, 'required'),
  hierarquia_id: z.string().min(1, 'required'),
  empresa_pretendida: z.string().min(2, 'required'),
});

type Etapa1Form = z.infer<typeof etapa1Schema>;
type Etapa2Form = z.infer<typeof etapa2Schema>;

export default function RegistroPage() {
  const t = useTranslations('auth.register');
  const tValidation = useTranslations('validation');
  const [etapa, setEtapa] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [paises, setPaises] = useState<string[]>([]);
  const [cidades, setCidades] = useState<Hierarquia[]>([]);
  const [paisSelecionado, setPaisSelecionado] = useState('');
  const router = useRouter();

  // Form Etapa 1
  const formEtapa1 = useForm<Etapa1Form>({
    resolver: zodResolver(etapa1Schema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  // Form Etapa 2
  const formEtapa2 = useForm<Etapa2Form>({
    resolver: zodResolver(etapa2Schema),
    defaultValues: { nome: '', telefone: '', pais: '', hierarquia_id: '', empresa_pretendida: '' },
  });

  // Carregar países ao montar
  useEffect(() => {
    async function carregarPaises() {
      try {
        const data = await hierarquiaService.listarPaises();
        setPaises(data);
      } catch (err) {
        console.error('Erro ao carregar países:', err);
      }
    }
    carregarPaises();
  }, []);

  // Carregar cidades quando país mudar
  useEffect(() => {
    async function carregarCidades() {
      if (!paisSelecionado) {
        setCidades([]);
        return;
      }
      try {
        const data = await hierarquiaService.listarCidadesPorPais(paisSelecionado);
        setCidades(data);
      } catch (err) {
        console.error('Erro ao carregar cidades:', err);
      }
    }
    carregarCidades();
  }, [paisSelecionado]);

  // Handler Etapa 1
  const handleEtapa1 = async (data: Etapa1Form) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.registrarUsuario(data.email, data.password);
      
      if (result.user) {
        setUserId(result.user.id);
        setEtapa(2);
      }
    } catch (err: any) {
      if (err.message.includes('already registered')) {
        setError('Este e-mail já está cadastrado.');
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handler Etapa 2
  const handleEtapa2 = async (data: Etapa2Form) => {
    if (!userId) {
      setError('Erro: usuário não identificado. Recomece o cadastro.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.completarPerfil(userId, {
        nome: data.nome,
        telefone: data.telefone,
        hierarquia_id: data.hierarquia_id,
        empresa_pretendida: data.empresa_pretendida,
      });

      // Redirecionar para página de aguardar código
      router.push('/aguardando-codigo');
    } catch (err: any) {
      setError('Erro ao completar cadastro. Tente novamente.');
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
          <Logo size="lg" showText={false} className="mb-6" />
          <h1 className="text-4xl xl:text-5xl font-bold mb-4">Apprutea</h1>
          <p className="text-xl text-blue-100 max-w-md mb-12">
            Crie sua conta e comece a gerenciar suas operações de microcrédito
          </p>

          {/* Indicador de Etapas */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${etapa >= 1 ? 'text-white' : 'text-blue-300'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${etapa >= 1 ? 'bg-white text-blue-700' : 'bg-blue-500/50'}`}>
                {etapa > 1 ? <Check className="w-5 h-5" /> : '1'}
              </div>
              <span className="font-medium">Conta</span>
            </div>
            <div className="w-12 h-0.5 bg-blue-400" />
            <div className={`flex items-center gap-2 ${etapa >= 2 ? 'text-white' : 'text-blue-300'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${etapa >= 2 ? 'bg-white text-blue-700' : 'bg-blue-500/50'}`}>
                2
              </div>
              <span className="font-medium">Dados</span>
            </div>
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
            {/* Indicador mobile */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-6">
              <div className={`w-3 h-3 rounded-full ${etapa === 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-3 h-3 rounded-full ${etapa === 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {etapa === 1 ? t('title') : t('titleStep2')}
              </h2>
              <p className="text-gray-500">
                {etapa === 1 ? t('subtitle') : t('subtitleStep2')}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* ETAPA 1 - Email e Senha */}
            {etapa === 1 && (
              <form onSubmit={formEtapa1.handleSubmit(handleEtapa1)} className="space-y-5">
                <Input
                  label={t('email')}
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  icon={<Mail className="w-5 h-5" />}
                  error={formEtapa1.formState.errors.email?.message ? tValidation(formEtapa1.formState.errors.email.message as any) : undefined}
                  {...formEtapa1.register('email')}
                />

                <Input
                  label={t('password')}
                  type="password"
                  placeholder={t('passwordPlaceholder')}
                  error={formEtapa1.formState.errors.password?.message ? tValidation(formEtapa1.formState.errors.password.message as any) : undefined}
                  {...formEtapa1.register('password')}
                />

                <Input
                  label={t('confirmPassword')}
                  type="password"
                  placeholder={t('confirmPasswordPlaceholder')}
                  error={formEtapa1.formState.errors.confirmPassword?.message ? tValidation(formEtapa1.formState.errors.confirmPassword.message as any) : undefined}
                  {...formEtapa1.register('confirmPassword')}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={isLoading}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  {t('nextButton')}
                </Button>
              </form>
            )}

            {/* ETAPA 2 - Dados Complementares */}
            {etapa === 2 && (
              <form onSubmit={formEtapa2.handleSubmit(handleEtapa2)} className="space-y-5">
                <Input
                  label={t('name')}
                  type="text"
                  placeholder={t('namePlaceholder')}
                  icon={<User className="w-5 h-5" />}
                  error={formEtapa2.formState.errors.nome?.message ? tValidation(formEtapa2.formState.errors.nome.message as any) : undefined}
                  {...formEtapa2.register('nome')}
                />

                <Input
                  label={t('phone')}
                  type="tel"
                  placeholder={t('phonePlaceholder')}
                  icon={<Phone className="w-5 h-5" />}
                  error={formEtapa2.formState.errors.telefone?.message ? tValidation(formEtapa2.formState.errors.telefone.message as any) : undefined}
                  {...formEtapa2.register('telefone')}
                />

                {/* Seletor de País */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('country')}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none"
                      {...formEtapa2.register('pais')}
                      onChange={(e) => {
                        formEtapa2.setValue('pais', e.target.value);
                        setPaisSelecionado(e.target.value);
                        formEtapa2.setValue('hierarquia_id', '');
                      }}
                    >
                      <option value="">{t('selectCountry')}</option>
                      {paises.map((pais) => (
                        <option key={pais} value={pais}>{pais}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Seletor de Cidade */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {t('city')}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                      disabled={!paisSelecionado}
                      {...formEtapa2.register('hierarquia_id')}
                    >
                      <option value="">{t('selectCity')}</option>
                      {cidades.map((cidade) => (
                        <option key={cidade.id} value={cidade.id}>{cidade.estado}</option>
                      ))}
                    </select>
                  </div>
                  {formEtapa2.formState.errors.hierarquia_id && (
                    <p className="mt-1.5 text-sm text-red-600">{tValidation('required')}</p>
                  )}
                </div>

                <Input
                  label={t('companyName')}
                  type="text"
                  placeholder={t('companyPlaceholder')}
                  icon={<Building2 className="w-5 h-5" />}
                  error={formEtapa2.formState.errors.empresa_pretendida?.message ? tValidation(formEtapa2.formState.errors.empresa_pretendida.message as any) : undefined}
                  {...formEtapa2.register('empresa_pretendida')}
                />

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setEtapa(1)}
                    icon={<ArrowLeft className="w-4 h-4" />}
                  >
                    {t('backButton')}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    size="lg"
                    loading={isLoading}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    {t('submitButton')}
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                {t('hasAccount')}{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  {t('login')}
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
