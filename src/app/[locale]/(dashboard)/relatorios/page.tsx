'use client';

// =====================================================================
// ÍNDICE DA ÁREA DE RELATÓRIOS
// =====================================================================
//
// A grade de cartões existe porque é boa para descoberta — o usuário bate o
// olho e acha o que quer, como na tela de Reportes do sistema legado.
//
// Mas, ao contrário do legado, os cartões de Clientes serão ATALHOS para um
// relatório único com painel de filtros, não dez relatórios separados. Os dez
// cartões de lá diferem só pelo predicado; dez telas seriam dez lugares para
// manter em sincronia, e o usuário não conseguiria combinar — hoje ele não tem
// como pedir "atrasados com crédito acima de mil".
//
// Os cartões desabilitados ficam à vista de propósito: o lugar já existe, e
// quando as definições chegarem (janela do "sem renovar", dias do "por vencer",
// o parcial do "que pagaram") eles acendem sem a tela mudar de forma.

import { BarChart3, Clock, FileText, Lock, UserCheck, Users, UserX } from 'lucide-react';
import { Link } from '@/i18n/routing';

interface Cartao {
  titulo: string;
  descricao: string;
  href?: string;
  icon: React.ElementType;
  cor: string;
  /** Sem `href` o cartão não navega: o motivo aparece no lugar. */
  pendente?: string;
}

const cartoes: Cartao[] = [
  {
    titulo: 'Liquidação por período',
    descricao:
      'Consolidado, dia a dia e por rota. Recebido, emprestado, ganancia, caixa e carteira de qualquer recorte — de uma rota ao país inteiro.',
    href: '/relatorios/liquidacao-periodo',
    icon: BarChart3,
    cor: 'bg-blue-100 text-blue-600',
  },
  {
    titulo: 'Clientes ativos e inativos',
    descricao: 'Quem tem empréstimo em aberto e quem não tem, com a contagem de suspensos.',
    icon: Users,
    cor: 'bg-emerald-100 text-emerald-600',
    pendente: 'Em definição',
  },
  {
    titulo: 'Clientes atrasados',
    descricao:
      'Quem está devendo, há quanto tempo e quanto — em dias de cobrança, que é como o app conta.',
    icon: UserX,
    cor: 'bg-red-100 text-red-600',
    pendente: 'Em definição',
  },
  {
    titulo: 'Clientes sem renovar',
    descricao: 'Quitou e não voltou. Falta definir a janela em dias.',
    icon: UserCheck,
    cor: 'bg-amber-100 text-amber-600',
    pendente: 'Aguardando a janela',
  },
  {
    titulo: 'Vencidos ou por vencer',
    descricao:
      'A fila de renovação: quem está a poucos dias de terminar. Falta definir quantos dias.',
    icon: Clock,
    cor: 'bg-purple-100 text-purple-600',
    pendente: 'Aguardando o prazo',
  },
  {
    titulo: 'Pagamentos e vendas',
    descricao:
      'Listagem de pagamentos (inclusive não pagos) e de vendas do período, com a renovação classificada em igual, maior ou menor valor.',
    icon: FileText,
    cor: 'bg-indigo-100 text-indigo-600',
    pendente: 'Em definição',
  },
];

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-gray-500 mt-1">
          Cada relatório tem seu próprio recorte — país, estado, cidade, empresa ou rota — e
          seu próprio intervalo de datas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cartoes.map((k) => {
          const conteudo = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className={`p-2 rounded-lg ${k.cor}`}>
                  <k.icon className="w-5 h-5" />
                </span>
                {k.pendente && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    <Lock className="w-3 h-3" />
                    {k.pendente}
                  </span>
                )}
              </div>
              <h2
                className={`font-semibold mt-3 ${
                  k.href ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {k.titulo}
              </h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{k.descricao}</p>
            </>
          );

          if (!k.href) {
            return (
              <div
                key={k.titulo}
                className="bg-white rounded-xl border border-gray-200 p-5 opacity-70"
              >
                {conteudo}
              </div>
            );
          }

          return (
            <Link
              key={k.titulo}
              href={k.href}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              {conteudo}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
