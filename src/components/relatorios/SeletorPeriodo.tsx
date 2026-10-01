'use client';

// =====================================================================
// SELETOR DE PERÍODO DOS RELATÓRIOS
// =====================================================================
//
// Dois campos de data e quatro atalhos. Os atalhos existem porque o uso real é
// "este mês" e "mês passado" quase sempre — digitar duas datas para a pergunta
// mais comum é atrito puro.
//
// As datas são tratadas como `YYYY-MM-DD` em string do começo ao fim, sem
// passar por `Date` para formatar. É a mesma razão de sempre neste projeto:
// `new Date('2026-09-01')` é meia-noite UTC e, na Colômbia (UTC−5), volta um
// dia. Aqui a aritmética de mês usa `Date` em horário LOCAL, nunca o parse de
// string ISO.

import { Calendar } from 'lucide-react';

interface Props {
  de: string;
  ate: string;
  onChange: (de: string, ate: string) => void;
}

/** `Date` local → `YYYY-MM-DD`, sem passar por UTC. */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function atalhos() {
  const hoje = new Date();
  const a = hoje.getFullYear();
  const m = hoje.getMonth();

  // Semana começando no domingo, como o calendário da rota.
  const inicioSemana = new Date(a, m, hoje.getDate() - hoje.getDay());

  return [
    { rotulo: 'Esta semana', de: iso(inicioSemana), ate: iso(hoje) },
    { rotulo: 'Este mês', de: iso(new Date(a, m, 1)), ate: iso(hoje) },
    {
      rotulo: 'Mês passado',
      de: iso(new Date(a, m - 1, 1)),
      // Dia 0 do mês atual é o último dia do anterior.
      ate: iso(new Date(a, m, 0)),
    },
    {
      rotulo: 'Últimos 30 dias',
      de: iso(new Date(a, m, hoje.getDate() - 29)),
      ate: iso(hoje),
    },
  ];
}

export default function SeletorPeriodo({ de, ate, onChange }: Props) {
  const opcoes = atalhos();
  const invalido = !!de && !!ate && ate < de;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
          <input
            type="date"
            value={de}
            max={ate || undefined}
            onChange={(e) => onChange(e.target.value, ate)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Até</label>
          <input
            type="date"
            value={ate}
            min={de || undefined}
            onChange={(e) => onChange(de, e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {opcoes.map((o) => {
          const ativo = o.de === de && o.ate === ate;
          return (
            <button
              key={o.rotulo}
              type="button"
              onClick={() => onChange(o.de, o.ate)}
              className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                ativo
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {o.rotulo}
            </button>
          );
        })}
      </div>

      {invalido && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700 mt-2">
          <Calendar className="w-3.5 h-3.5" />
          A data final é anterior à inicial.
        </p>
      )}
    </div>
  );
}
