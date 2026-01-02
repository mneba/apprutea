'use client';

import { Users, DollarSign, TrendingUp, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function DashboardPage() {
  const cards = [
    { title: 'Total de Clientes', value: '1.234', change: '+12%', changeType: 'positive' as const, icon: Users, color: 'blue' },
    { title: 'Recaudo do Mês', value: 'R$ 45.320', change: '+8.2%', changeType: 'positive' as const, icon: DollarSign, color: 'green' },
    { title: 'Sessões Abertas', value: '12', change: '3 aguardando', changeType: 'neutral' as const, icon: Clock, color: 'yellow' },
    { title: 'Taxa de Recaudo', value: '87.5%', change: '-2.1%', changeType: 'negative' as const, icon: TrendingUp, color: 'purple' },
  ];

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl ${colorClasses[card.color]} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
                {card.changeType !== 'neutral' && (
                  <span className={`flex items-center text-sm font-medium ${
                    card.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {card.changeType === 'positive' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {card.change}
                  </span>
                )}
                {card.changeType === 'neutral' && (
                  <span className="text-sm text-gray-500">{card.change}</span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-sm text-gray-500 mt-1">{card.title}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
