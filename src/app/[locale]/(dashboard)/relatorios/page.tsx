'use client';

// =====================================================================
// ÍNDICE DA ÁREA DE RELATÓRIOS
// =====================================================================
//
// A grade de cartões existe porque é boa para descoberta — o usuário bate o
// olho e acha o que quer, como na tela de Reportes do sistema legado.
//
// Os dez relatórios de clientes do legado viraram UM, em 09/10/2026, como
// este cabeçalho previa. Eles diferiam só pelo predicado; dez telas seriam dez
// lugares para manter em sincronia, e o usuário não conseguiria combinar —
// não tinha como pedir "atrasados com crédito acima de mil". Agora tem: são
// presets de uma `fn_clientes` só, e os prazos que faltavam definir (janela
// do "sem renovar", dias do "por vencer") viraram campo na tela, com 30 e 15
// de padrão, em vez de constante no código.

import { BarChart3, Lock, Users } from 'lucide-react';
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
    titulo: 'Clientes',
    descricao:
      'Ativos, inativos, atrasados, sem renovar, vencidos ou por vencer, que pagaram, crédito acima de um valor, por taxa de juro, cancelados e histórico — e qualquer combinação deles.',
    href: '/relatorios/clientes',
    icon: Users,
    cor: 'bg-emerald-100 text-emerald-600',
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
