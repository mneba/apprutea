'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export default function DashboardPage() {
  // Cards de resumo
  const cards = [
    {
      title: 'Total de Clientes',
      value: '1.234',
      change: '+12%',
      changeType: 'positive' as const,
      icon: Users,
      color: 'blue',
    },
    {
      title: 'Recaudo do Mês',
      value: 'R$ 45.320,00',
      change: '+8.2%',
      changeType: 'positive' as const,
      icon: DollarSign,
      color: 'green',
    },
    {
      title: 'Sessões Abertas',
      value: '12',
      change: '3 aguardando',
      changeType: 'neutral' as const,
      icon: Clock,
      color: 'yellow',
    },
    {
      title: 'Taxa de Recaudo',
      value: '87.5%',
      change: '-2.1%',
      changeType: 'negative' as const,
      icon: TrendingUp,
      color: 'purple',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Visão geral do sistema</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 rounded-xl ${colorClasses[card.color as keyof typeof colorClasses]} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
                {card.changeType !== 'neutral' && (
                  <span className={`flex items-center text-sm font-medium ${
                    card.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {card.changeType === 'positive' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
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

      {/* Grid de Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessões do Dia */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Sessões do Dia</h2>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Ver todas
            </button>
          </div>
          
          <div className="space-y-4">
            {/* Sessão Item */}
            {[
              { vendedor: 'João Alberto Gonçalves', status: 'ABERTO', meta: 1580.53, atual: 1002.50, progresso: 64 },
              { vendedor: 'Maria Santos', status: 'FECHADO', meta: 2100.00, atual: 1890.00, progresso: 90 },
              { vendedor: 'Carlos Lima', status: 'ABERTO', meta: 1800.00, atual: 720.00, progresso: 40 },
            ].map((sessao, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">{sessao.vendedor}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      sessao.status === 'ABERTO' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {sessao.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-gray-500">
                      Meta: R$ {sessao.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm text-gray-500">
                      Atual: R$ {sessao.atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        sessao.progresso >= 80 ? 'bg-green-500' : 
                        sessao.progresso >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${sessao.progresso}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{sessao.progresso}%</p>
                  <p className="text-xs text-gray-500">Progresso</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Atividade Recente */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Atividade Recente</h2>
          
          <div className="space-y-4">
            {[
              { acao: 'Novo cliente cadastrado', tempo: '5 min', icon: Users, color: 'blue' },
              { acao: 'Pagamento recebido', tempo: '12 min', icon: DollarSign, color: 'green' },
              { acao: 'Sessão fechada', tempo: '25 min', icon: CheckCircle, color: 'green' },
              { acao: 'Empréstimo aprovado', tempo: '1h', icon: FileText, color: 'purple' },
              { acao: 'Cliente inadimplente', tempo: '2h', icon: XCircle, color: 'red' },
            ].map((item, index) => {
              const Icon = item.icon;
              const colors = {
                blue: 'bg-blue-100 text-blue-600',
                green: 'bg-green-100 text-green-600',
                purple: 'bg-purple-100 text-purple-600',
                red: 'bg-red-100 text-red-600',
              };
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${colors[item.color as keyof typeof colors]} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{item.acao}</p>
                  </div>
                  <span className="text-xs text-gray-400">{item.tempo}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
