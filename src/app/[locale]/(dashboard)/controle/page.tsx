'use client';

// =====================================================================
// PAINEL DE CONTROLE — OPERADORES DO SISTEMA
// =====================================================================
//
// O sistema inteiro numa tela: cada empresa, seu dono, suas rotas, quando
// cada um usou pela última vez e que versão do app o vendedor tem. É o
// primeiro passo do módulo comercial; a cobrança vem por cima desta tela.
//
// QUEM VÊ: `licenca_operadores`, checado no banco. Não é por tipo de usuário
// — há SUPER_ADMIN que é dono de empresa (ver sql/2026-11-04_painel_controle.sql).
//
// "ATIVA" É A RÉGUA DA LIQUIDAÇÃO, não `rotas.status` (74/74 em ATIVA, campo
// morto): liquidação nos últimos 30 dias, contados de `fn_data_hoje_rota`. A
// régua vive na função, para a cobrança ler a mesma.
//
// SEM CACHE de módulo, de propósito: é tela de consulta rara, e o que ela
// mostra (acesso de agora) envelhece em minutos.

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import {
  painelControleService,
  compararVersao,
  type EmpresaControle,
  type RotaControle,
} from '@/services/painelControle';

type Filtro = 'TODAS' | 'COM_ATIVA' | 'SEM_DONO' | 'COM_PARADA' | 'SEM_ATIVA' | 'VERSAO_ANTIGA';

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: 'COM_ATIVA', rotulo: 'Com rota ativa' },
  { valor: 'SEM_DONO', rotulo: 'Ativas sem dono' },
  { valor: 'COM_PARADA', rotulo: 'Com rota parada' },
  { valor: 'VERSAO_ANTIGA', rotulo: 'App desatualizado' },
  { valor: 'SEM_ATIVA', rotulo: 'Sem rota ativa' },
  { valor: 'TODAS', rotulo: 'Todas' },
];

/** `date` puro do banco: fatiado como texto para não recuar um dia no fuso. */
const fmtData = (d: string | null) => {
  if (!d) return '—';
  const [a, m, dia] = d.substring(0, 10).split('-');
  return `${dia}/${m}/${a}`;
};

/** Instante (timestamptz): o navegador mostra no fuso local. */
const fmtInstante = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** Tempo decorrido desde um instante. É duração, não data de negócio. */
const fmtHa = (iso: string | null) => {
  if (!iso) return 'nunca';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d === 1 ? '' : 's'}`;
};

/** Cor pelo tempo sem acesso: verde hoje, âmbar até 3 dias, vermelho além. */
const corAcesso = (iso: string | null) => {
  if (!iso) return 'text-gray-400';
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h < 24) return 'text-green-700';
  if (h < 72) return 'text-amber-700';
  return 'text-red-700';
};

const BADGE_SITUACAO: Record<RotaControle['situacao'], { rotulo: string; cls: string }> = {
  ATIVA: { rotulo: 'Ativa', cls: 'bg-green-100 text-green-700' },
  PARADA: { rotulo: 'Parada', cls: 'bg-red-100 text-red-700' },
  NUNCA_ABRIU: { rotulo: 'Nunca abriu', cls: 'bg-gray-100 text-gray-600' },
};

export default function ControlePage() {
  const [operador, setOperador] = useState<boolean | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaControle[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('COM_ATIVA');
  const [busca, setBusca] = useState('');
  const [abertas, setAbertas] = useState<Set<string>>(new Set());

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setEmpresas(await painelControleService.carregar());
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o painel.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    (async () => {
      const ok = await painelControleService.souOperador();
      setOperador(ok);
      if (ok) await carregar();
    })();
  }, []);

  /** A versão mais nova vista entre as rotas ativas é a referência. */
  const versaoAtual = useMemo(() => {
    let v: string | null = null;
    for (const e of empresas ?? [])
      for (const r of e.rotas)
        if (r.situacao === 'ATIVA' && r.app_versao && (!v || compararVersao(r.app_versao, v) > 0))
          v = r.app_versao;
    return v;
  }, [empresas]);

  const versaoAntiga = (r: RotaControle) =>
    !!versaoAtual && !!r.app_versao && compararVersao(r.app_versao, versaoAtual) < 0;

  const resumo = useMemo(() => {
    const lista = empresas ?? [];
    const rotas = lista.flatMap((e) => e.rotas);
    const ativas = rotas.filter((r) => r.situacao === 'ATIVA');
    return {
      empresas: lista.length,
      empresasAtivas: lista.filter((e) => e.rotas_ativas > 0).length,
      semDono: lista.filter((e) => e.rotas_ativas > 0 && !e.dono_user_id).length,
      ativas: ativas.length,
      paradas: rotas.filter((r) => r.situacao === 'PARADA').length,
      nuncaAbriram: rotas.filter((r) => r.situacao === 'NUNCA_ABRIU').length,
      clientes: ativas.reduce((s, r) => s + r.clientes_ativos, 0),
      comVersao: ativas.filter((r) => r.app_versao).length,
      naVersaoAtual: ativas.filter((r) => r.app_versao && versaoAtual && compararVersao(r.app_versao, versaoAtual) === 0).length,
    };
  }, [empresas, versaoAtual]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (empresas ?? [])
      .filter((e) => {
        switch (filtro) {
          case 'COM_ATIVA': return e.rotas_ativas > 0;
          case 'SEM_DONO': return e.rotas_ativas > 0 && !e.dono_user_id;
          case 'COM_PARADA': return e.rotas_paradas > 0;
          case 'SEM_ATIVA': return e.rotas_ativas === 0;
          case 'VERSAO_ANTIGA': return e.rotas.some((r) => r.situacao === 'ATIVA' && versaoAntiga(r));
          default: return true;
        }
      })
      .filter((e) => {
        if (!termo) return true;
        const textos = [
          e.empresa_nome,
          e.dono_nome,
          e.dono_email,
          e.cidade,
          ...e.rotas.flatMap((r) => [r.rota_nome, r.vendedor_nome]),
        ];
        return textos.some((t) => t?.toLowerCase().includes(termo));
      })
      .sort((a, b) => b.rotas_ativas - a.rotas_ativas || b.clientes_ativos - a.clientes_ativos || a.empresa_nome.localeCompare(b.empresa_nome));
    // versaoAntiga depende só de versaoAtual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresas, filtro, busca, versaoAtual]);

  const alternar = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ── Retornos antecipados: DEPOIS de todos os hooks (React #310) ──
  if (operador === null) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!operador) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 p-6 text-center">
          <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Acesso restrito</h2>
          <p className="text-sm text-gray-600 mt-1">O painel de controle é exclusivo dos operadores do sistema.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Controle</h1>
          <p className="text-sm text-gray-500 mt-1">
            Empresas, rotas, últimos acessos e versão do app. Rota ativa = liquidação nos últimos 30 dias.
          </p>
        </div>
        <button
          onClick={carregar}
          disabled={carregando}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* ── Resumo ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Cartao rotulo="Empresas com rota ativa" valor={`${resumo.empresasAtivas}`} detalhe={`de ${resumo.empresas} cadastradas`} />
        <Cartao rotulo="Rotas ativas" valor={`${resumo.ativas}`} detalhe={`${resumo.paradas} paradas · ${resumo.nuncaAbriram} nunca abriram`} />
        <Cartao rotulo="Clientes ativos" valor={resumo.clientes.toLocaleString('pt-BR')} detalhe="nas rotas ativas" />
        <Cartao
          rotulo="Ativas sem dono"
          valor={`${resumo.semDono}`}
          detalhe="empresas sem pagador definido"
          alerta={resumo.semDono > 0}
        />
        <Cartao
          rotulo={`App na versão ${versaoAtual ?? '—'}`}
          valor={`${resumo.naVersaoAtual} de ${resumo.ativas}`}
          detalhe={`${resumo.ativas - resumo.comVersao} ainda sem versão registrada`}
        />
      </div>

      {/* ── Filtros ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Empresa, dono, e-mail, rota ou vendedor"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border ${
                filtro === f.valor ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* ── Lista ── */}
      {empresas === null && carregando ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Empresa</th>
                <th className="text-left px-4 py-2 font-medium">Dono</th>
                <th className="text-center px-4 py-2 font-medium">Rotas</th>
                <th className="text-right px-4 py-2 font-medium">Clientes</th>
                <th className="text-left px-4 py-2 font-medium">Acesso web</th>
                <th className="text-left px-4 py-2 font-medium">Acesso app</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Nenhuma empresa neste filtro.</td>
                </tr>
              )}
              {visiveis.map((e) => {
                const aberta = abertas.has(e.empresa_id);
                return (
                  <FragmentoEmpresa
                    key={e.empresa_id}
                    empresa={e}
                    aberta={aberta}
                    onAlternar={() => alternar(e.empresa_id)}
                    versaoAntiga={versaoAntiga}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400">
        Acesso = o mais recente entre o último login e a última renovação de sessão. A versão do app aparece depois
        que o vendedor abre uma build que a registra.
      </p>
    </div>
  );
}

function Cartao({ rotulo, valor, detalhe, alerta }: { rotulo: string; valor: string; detalhe: string; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${alerta ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
      <div className="text-xs text-gray-500">{rotulo}</div>
      <div className={`text-2xl font-bold mt-1 ${alerta ? 'text-amber-800' : 'text-gray-900'}`}>{valor}</div>
      <div className="text-xs text-gray-500 mt-0.5">{detalhe}</div>
    </div>
  );
}

function FragmentoEmpresa({
  empresa: e,
  aberta,
  onAlternar,
  versaoAntiga,
}: {
  empresa: EmpresaControle;
  aberta: boolean;
  onAlternar: () => void;
  versaoAntiga: (r: RotaControle) => boolean;
}) {
  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={onAlternar}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {e.rotas.length > 0 ? (
              aberta ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <div>
              <div className="font-medium text-gray-900">{e.empresa_nome}</div>
              <div className="text-xs text-gray-500">{[e.cidade, e.pais].filter(Boolean).join(' · ') || '—'}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {e.dono_user_id ? (
            <>
              <div className="text-gray-900">{e.dono_nome}</div>
              <div className="text-xs text-gray-500">{e.dono_email ?? '—'}</div>
            </>
          ) : (
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${e.rotas_ativas > 0 ? 'bg-amber-100 text-amber-800' : 'text-gray-400'}`}>
              sem dono
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-center whitespace-nowrap">
          <span className="font-semibold text-green-700">{e.rotas_ativas}</span>
          <span className="text-gray-400"> / {e.rotas.length}</span>
          {e.rotas_paradas > 0 && <span className="ml-1 text-xs text-red-600">({e.rotas_paradas} parada{e.rotas_paradas > 1 ? 's' : ''})</span>}
        </td>
        <td className="px-4 py-3 text-right tabular-nums">{e.clientes_ativos.toLocaleString('pt-BR')}</td>
        <td className="px-4 py-3">
          <div className={corAcesso(e.usuarios_web_ultimo_acesso)} title={fmtInstante(e.usuarios_web_ultimo_acesso)}>
            {fmtHa(e.usuarios_web_ultimo_acesso)}
          </div>
          <div className="text-xs text-gray-500">
            {e.usuarios_web} usuário{e.usuarios_web === 1 ? '' : 's'}
            {e.dono_user_id && <> · dono {fmtHa(e.dono_ultimo_acesso)}</>}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={corAcesso(e.app_ultimo_acesso)} title={fmtInstante(e.app_ultimo_acesso)}>
            {e.rotas.length ? fmtHa(e.app_ultimo_acesso) : '—'}
          </span>
        </td>
      </tr>

      {aberta && e.rotas.length > 0 && (
        <tr className="bg-gray-50/60">
          <td colSpan={6} className="px-4 pb-4 pt-1">
            <table className="w-full text-xs bg-white rounded-lg border border-gray-200">
              <thead className="text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Rota</th>
                  <th className="text-left px-3 py-2 font-medium">Vendedor</th>
                  <th className="text-left px-3 py-2 font-medium">Situação</th>
                  <th className="text-left px-3 py-2 font-medium">Liquidação</th>
                  <th className="text-right px-3 py-2 font-medium">Clientes</th>
                  <th className="text-left px-3 py-2 font-medium">Acesso app</th>
                  <th className="text-left px-3 py-2 font-medium">Versão</th>
                </tr>
              </thead>
              <tbody>
                {e.rotas.map((r) => {
                  const b = BADGE_SITUACAO[r.situacao];
                  const atrasada = r.situacao === 'ATIVA' && (r.dias_sem_liquidacao ?? 0) > 3;
                  return (
                    <tr key={r.rota_id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-900">{r.rota_nome}</td>
                      <td className="px-3 py-2 text-gray-700">{r.vendedor_nome ?? <span className="text-gray-400">sem vendedor</span>}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded font-medium ${b.cls}`}>{b.rotulo}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.ultima_liquidacao ? (
                          <>
                            <div className={atrasada ? 'text-amber-700 font-medium' : 'text-gray-700'}>
                              {r.dia_aberto ? `aberto ${fmtData(r.dia_aberto)}` : `última ${fmtData(r.ultima_liquidacao)}`}
                              {(r.dias_sem_liquidacao ?? 0) > 0 && ` · ${r.dias_sem_liquidacao} d`}
                            </div>
                            <div className="text-gray-400">desde {fmtData(r.primeira_liquidacao)}</div>
                          </>
                        ) : (
                          <span className="text-gray-400">criada {fmtData(r.rota_criada_em)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.clientes_ativos}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${corAcesso(r.app_ultimo_acesso)}`} title={fmtInstante(r.app_ultimo_acesso)}>
                        {fmtHa(r.app_ultimo_acesso)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.app_versao ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${versaoAntiga(r) ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}
                            title={`desde ${fmtInstante(r.app_versao_desde)}${r.app_plataforma ? ' · ' + r.app_plataforma : ''}`}
                          >
                            <Smartphone className="w-3 h-3" />
                            {r.app_versao}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
