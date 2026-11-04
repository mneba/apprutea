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
// LAYOUT É O DA TELA DE CLIENTES, de propósito (pedido do Mauricio em
// 04/11/2026): cabeçalho fixo com título, cartões que FILTRAM e a linha de
// controles; só a tabela rola, com cabeçalho e rodapé grudados. Sem `p-6`
// próprio — o espaçamento vem do layout do dashboard, e somar outro deixava
// esta tela desalinhada das demais.
//
// SEM CACHE de módulo, de propósito: é tela de consulta rara, e o que ela
// mostra (acesso de agora) envelhece em minutos.

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
  PauseCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  UserX,
  X,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  painelControleService,
  compararVersao,
  type EmpresaControle,
  type RotaControle,
} from '@/services/painelControle';

type Filtro = 'TODAS' | 'COM_ATIVA' | 'SEM_DONO' | 'COM_PARADA' | 'SEM_ATIVA' | 'VERSAO_ANTIGA';

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
    : undefined;

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

// =====================================================
// COMPONENTES — mesmo desenho dos da tela de Clientes
// =====================================================

function CardEstatistica({
  titulo,
  valor,
  icone: Icone,
  corIcone,
  corFundo,
  ativo = false,
  onClick,
}: {
  titulo: string;
  valor: number;
  icone: React.ElementType;
  corIcone: string;
  corFundo: string;
  ativo?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border p-3 hover:shadow-md transition-all ${
        ativo ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${corFundo} flex items-center justify-center flex-shrink-0`}>
          <Icone className={`w-5 h-5 ${corIcone}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-gray-900">{valor}</p>
          <p className="text-xs text-gray-500 truncate">{titulo}</p>
        </div>
      </div>
    </button>
  );
}

function BadgeSituacao({ situacao }: { situacao: RotaControle['situacao'] }) {
  const config = {
    ATIVA: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ativa' },
    PARADA: { bg: 'bg-red-100', text: 'text-red-700', label: 'Parada' },
    NUNCA_ABRIU: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Nunca abriu' },
  }[situacao];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

/** Tela inteira centralizada: ícone em círculo, título e texto — como os avisos de Clientes. */
function Aviso({ icone: Icone, cor, fundo, titulo, texto }: {
  icone: React.ElementType; cor: string; fundo: string; titulo: string; texto: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      <div className={`w-16 h-16 ${fundo} rounded-full flex items-center justify-center mb-4`}>
        <Icone className={`w-8 h-8 ${cor}`} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{titulo}</h3>
      <p className="text-gray-500 text-center max-w-md">{texto}</p>
    </div>
  );
}

// =====================================================
// PÁGINA PRINCIPAL
// =====================================================

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

  /** A regra de cada filtro num lugar só: o cartão conta com ela e a lista filtra com ela. */
  const passa = (e: EmpresaControle, f: Filtro) => {
    switch (f) {
      case 'COM_ATIVA': return e.rotas_ativas > 0;
      case 'SEM_DONO': return e.rotas_ativas > 0 && !e.dono_user_id;
      case 'COM_PARADA': return e.rotas_paradas > 0;
      case 'SEM_ATIVA': return e.rotas_ativas === 0;
      case 'VERSAO_ANTIGA': return e.rotas.some((r) => r.situacao === 'ATIVA' && versaoAntiga(r));
      default: return true;
    }
  };

  const contagem = useMemo(() => {
    const lista = empresas ?? [];
    const conta = (f: Filtro) => lista.filter((e) => passa(e, f)).length;
    return {
      TODAS: lista.length,
      COM_ATIVA: conta('COM_ATIVA'),
      SEM_DONO: conta('SEM_DONO'),
      COM_PARADA: conta('COM_PARADA'),
      VERSAO_ANTIGA: conta('VERSAO_ANTIGA'),
      SEM_ATIVA: conta('SEM_ATIVA'),
    };
    // passa depende só de versaoAtual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresas, versaoAtual]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (empresas ?? [])
      .filter((e) => passa(e, filtro))
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresas, filtro, busca, versaoAtual]);

  /** Totais do que está em tela — acompanham filtro e busca, como o rodapé de Clientes. */
  const totais = useMemo(() => {
    const rotas = visiveis.flatMap((e) => e.rotas);
    const ativas = rotas.filter((r) => r.situacao === 'ATIVA');
    return {
      rotas: rotas.length,
      ativas: ativas.length,
      clientes: ativas.reduce((s, r) => s + r.clientes_ativos, 0),
      naVersao: ativas.filter((r) => r.app_versao && versaoAtual && compararVersao(r.app_versao, versaoAtual) === 0).length,
    };
  }, [visiveis, versaoAtual]);

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
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!operador) {
    return (
      <Aviso
        icone={ShieldAlert}
        cor="text-amber-600"
        fundo="bg-amber-100"
        titulo="Acesso restrito"
        texto="O painel de controle é exclusivo dos operadores do sistema."
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ===== HEADER FIXO ===== */}
      <div className="flex-shrink-0 space-y-4 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Controle</h1>
            <p className="text-gray-500 text-sm">
              Empresas, rotas, últimos acessos e versão do app · rota ativa = liquidação nos últimos 30 dias
            </p>
          </div>
        </div>

        {/* Cartões que filtram, como os de status em Clientes. Contam EMPRESAS. */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <CardEstatistica
            titulo="Com rota ativa"
            valor={contagem.COM_ATIVA}
            icone={CheckCircle2}
            corIcone="text-green-600"
            corFundo="bg-green-100"
            ativo={filtro === 'COM_ATIVA'}
            onClick={() => setFiltro('COM_ATIVA')}
          />
          <CardEstatistica
            titulo="Ativas sem dono"
            valor={contagem.SEM_DONO}
            icone={UserX}
            corIcone="text-amber-600"
            corFundo="bg-amber-100"
            ativo={filtro === 'SEM_DONO'}
            onClick={() => setFiltro('SEM_DONO')}
          />
          <CardEstatistica
            titulo="Com rota parada"
            valor={contagem.COM_PARADA}
            icone={PauseCircle}
            corIcone="text-red-600"
            corFundo="bg-red-100"
            ativo={filtro === 'COM_PARADA'}
            onClick={() => setFiltro('COM_PARADA')}
          />
          <CardEstatistica
            titulo={versaoAtual ? `App abaixo da ${versaoAtual}` : 'App desatualizado'}
            valor={contagem.VERSAO_ANTIGA}
            icone={Smartphone}
            corIcone="text-purple-600"
            corFundo="bg-purple-100"
            ativo={filtro === 'VERSAO_ANTIGA'}
            onClick={() => setFiltro('VERSAO_ANTIGA')}
          />
          <CardEstatistica
            titulo="Sem rota ativa"
            valor={contagem.SEM_ATIVA}
            icone={XCircle}
            corIcone="text-gray-600"
            corFundo="bg-gray-100"
            ativo={filtro === 'SEM_ATIVA'}
            onClick={() => setFiltro('SEM_ATIVA')}
          />
          <CardEstatistica
            titulo="Todas as empresas"
            valor={contagem.TODAS}
            icone={Building2}
            corIcone="text-blue-600"
            corFundo="bg-blue-100"
            ativo={filtro === 'TODAS'}
            onClick={() => setFiltro('TODAS')}
          />
        </div>

        {/* Busca e controles */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <div className="relative flex-1 min-w-[18rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por empresa, dono, e-mail, rota ou vendedor..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={carregar}
            disabled={carregando}
            title="Recarregar do banco"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          {(busca || filtro !== 'COM_ATIVA') && (
            <button
              onClick={() => { setBusca(''); setFiltro('COM_ATIVA'); }}
              className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>

        {erro && (
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{erro}</p>
          </div>
        )}
      </div>

      {/* ===== ÁREA DE CONTEÚDO COM SCROLL ===== */}
      <div className="flex-1 overflow-auto pt-4">
        {empresas === null && carregando ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : visiveis.length === 0 ? (
          <Aviso
            icone={Building2}
            cor="text-gray-400"
            fundo="bg-gray-100"
            titulo="Nenhuma empresa encontrada"
            texto={busca ? 'Tente ajustar a busca.' : 'Nenhuma empresa neste filtro.'}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-3 text-left font-semibold text-gray-700 bg-gray-50 w-10"></th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700 bg-gray-50">Empresa</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700 bg-gray-50">Dono</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700 bg-gray-50">Rotas</th>
                    <th className="px-3 py-3 text-right font-semibold text-gray-700 bg-gray-50">Clientes</th>
                    <th className="hidden lg:table-cell px-3 py-3 text-left font-semibold text-gray-700 bg-gray-50">Acesso web</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700 bg-gray-50">Acesso app</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visiveis.map((e) => (
                    <LinhasEmpresa
                      key={e.empresa_id}
                      empresa={e}
                      aberta={abertas.has(e.empresa_id)}
                      onAlternar={() => alternar(e.empresa_id)}
                      versaoAntiga={versaoAntiga}
                    />
                  ))}
                </tbody>

                {/* Uma célula por coluna, com a MESMA classe responsiva do
                    cabeçalho — `colSpan` atravessando coluna escondida
                    desalinha o rodapé (ver TabelaClientes). */}
                <tfoot className="sticky bottom-0 z-10">
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold text-gray-800">
                    <td className="px-3 py-3" />
                    <td className="px-3 py-3 whitespace-nowrap" colSpan={2}>
                      {visiveis.length} empresa{visiveis.length === 1 ? '' : 's'} no filtro
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap tabular-nums">
                      {totais.ativas} / {totais.rotas}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                      {totais.clientes.toLocaleString('pt-BR')}
                    </td>
                    <td className="hidden lg:table-cell px-3 py-3" />
                    <td className="px-3 py-3 whitespace-nowrap font-normal text-xs text-gray-600">
                      {versaoAtual ? `${totais.naVersao} de ${totais.ativas} na ${versaoAtual}` : 'versão ainda não registrada'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LinhasEmpresa({
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
      <tr className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={onAlternar}>
        <td className="px-3 py-3">
          {e.rotas.length > 0 &&
            (aberta ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />)}
        </td>
        <td className="px-3 py-3 min-w-0 max-w-[16rem]">
          <p className="font-medium text-gray-900 truncate">{e.empresa_nome}</p>
          <p className="text-xs text-gray-500 truncate">{[e.cidade, e.pais].filter(Boolean).join(' · ') || '—'}</p>
        </td>
        <td className="px-3 py-3 min-w-0 max-w-[16rem]">
          {e.dono_user_id ? (
            <>
              <p className="text-gray-700 truncate">{e.dono_nome}</p>
              <p className="text-xs text-gray-500 truncate">{e.dono_email ?? '—'}</p>
            </>
          ) : e.rotas_ativas > 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
              <AlertTriangle className="w-3 h-3" />
              Sem dono
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        <td className="px-3 py-3 text-center whitespace-nowrap">
          <span className="font-medium text-green-600">{e.rotas_ativas}</span>
          <span className="text-gray-400"> / {e.rotas.length}</span>
          {e.rotas_paradas > 0 && (
            <p className="text-xs text-red-600">{e.rotas_paradas} parada{e.rotas_paradas > 1 ? 's' : ''}</p>
          )}
        </td>
        <td className="px-3 py-3 text-right font-medium text-gray-900 whitespace-nowrap tabular-nums">
          {e.clientes_ativos.toLocaleString('pt-BR')}
        </td>
        <td className="hidden lg:table-cell px-3 py-3 whitespace-nowrap">
          <p className={corAcesso(e.usuarios_web_ultimo_acesso)} title={fmtInstante(e.usuarios_web_ultimo_acesso)}>
            {fmtHa(e.usuarios_web_ultimo_acesso)}
          </p>
          <p className="text-xs text-gray-500">
            {e.usuarios_web} usuário{e.usuarios_web === 1 ? '' : 's'}
            {e.dono_user_id && <> · dono {fmtHa(e.dono_ultimo_acesso)}</>}
          </p>
        </td>
        <td className="px-3 py-3 whitespace-nowrap">
          <span className={corAcesso(e.app_ultimo_acesso)} title={fmtInstante(e.app_ultimo_acesso)}>
            {e.rotas.length ? fmtHa(e.app_ultimo_acesso) : '-'}
          </span>
        </td>
      </tr>

      {aberta && e.rotas.length > 0 && (
        <tr className="bg-gray-50">
          <td />
          <td colSpan={6} className="px-3 pb-4 pt-1">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Rota</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Vendedor</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Situação</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Liquidação</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Clientes</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Acesso app</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Versão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {e.rotas.map((r) => {
                    const atrasada = r.situacao === 'ATIVA' && (r.dias_sem_liquidacao ?? 0) > 3;
                    return (
                      <tr key={r.rota_id}>
                        <td className="px-3 py-2 min-w-0 max-w-[16rem]">
                          <p className="font-medium text-gray-900 truncate" title={r.rota_nome}>{r.rota_nome}</p>
                        </td>
                        <td className="px-3 py-2 min-w-0 max-w-[14rem]">
                          <p className="text-gray-700 truncate">{r.vendedor_nome ?? <span className="text-gray-400">sem vendedor</span>}</p>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <BadgeSituacao situacao={r.situacao} />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.ultima_liquidacao ? (
                            <>
                              <p className={atrasada ? 'text-amber-700 font-medium' : 'text-gray-700'}>
                                {r.dia_aberto ? `Aberto ${fmtData(r.dia_aberto)}` : `Última ${fmtData(r.ultima_liquidacao)}`}
                                {(r.dias_sem_liquidacao ?? 0) > 0 && ` · ${r.dias_sem_liquidacao} d`}
                              </p>
                              <p className="text-xs text-gray-500">desde {fmtData(r.primeira_liquidacao)}</p>
                            </>
                          ) : (
                            <p className="text-gray-500">criada {fmtData(r.rota_criada_em)}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900 tabular-nums">{r.clientes_ativos}</td>
                        <td className={`px-3 py-2 whitespace-nowrap ${corAcesso(r.app_ultimo_acesso)}`} title={fmtInstante(r.app_ultimo_acesso)}>
                          {fmtHa(r.app_ultimo_acesso)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {r.app_versao ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                versaoAntiga(r) ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'
                              }`}
                              title={`desde ${fmtInstante(r.app_versao_desde) ?? '—'}${r.app_plataforma ? ' · ' + r.app_plataforma : ''}`}
                            >
                              <Smartphone className="w-3 h-3" />
                              {r.app_versao}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
