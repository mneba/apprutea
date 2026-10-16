'use client';

// =====================================================================
// IMPORTAÇÃO SMARTPAY — FERRAMENTA INTERNA
// =====================================================================
//
// Substitui um processo de ~8 etapas feito à mão, com SQL colado no editor
// do Supabase e conferência por olhar número.
//
// A TELA NÃO DECIDE NADA. Toda regra vive nas funções `fn_importacao_*`,
// e isso é deliberado: a validação precisa ver os clientes JÁ cadastrados
// na empresa, que o navegador não vê. Aqui há leitura de CSV, conferência
// de cabeçalho e orquestração.
//
// A REGRA DE OURO, que vale para quem mexer nisto depois: **a ferramenta
// não decide quem é a mesma pessoa.** O corte de semelhança de nome
// aponta e ordena; a confirmação é humana. Em 15/10/2026 a rota Seu Giro
// importou 347 linhas e duas fundiram pessoas diferentes, porque a
// planilha trazia o mesmo documento para as duas — os empréstimos do
// Rosykler e do Rafael foram para a Larissa e a Elisangela, e o vendedor
// cobraria a parcela errada na porta errada.
//
// Por isso o botão de avançar fica DESABILITADO enquanto houver BLOQUEIA.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Ban, CheckCircle2, ChevronDown, ChevronRight,
  FileSpreadsheet, History, Loader2, Play, ShieldCheck, Upload, XCircle,
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import * as imp from '@/services/importacao';

type Passo = 'ESCOLHA' | 'DIAGNOSTICO' | 'EXECUCAO' | 'ACEITE';

const fmtMoeda = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(v || 0));

export default function ImportacaoPage() {
  const { user } = useUser();

  const [passo, setPasso] = useState<Passo>('ESCOLHA');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // ── escolha ──────────────────────────────────────────────────────
  const [rotas, setRotas] = useState<Awaited<ReturnType<typeof imp.listarRotas>>>([]);
  const [rotaId, setRotaId] = useState('');
  const [liquidacoes, setLiquidacoes] = useState<Awaited<ReturnType<typeof imp.listarLiquidacoesAbertas>>>([]);
  const [liquidacaoId, setLiquidacaoId] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<imp.LeituraCsv | null>(null);
  const [forcarHash, setForcarHash] = useState(false);

  // ── execução corrente ────────────────────────────────────────────
  const [execucao, setExecucao] = useState<imp.Execucao | null>(null);
  const [achados, setAchados] = useState<imp.Achado[]>([]);
  const [prev, setPrev] = useState<Awaited<ReturnType<typeof imp.previsto>> | null>(null);
  const [liberacao, setLiberacao] = useState<Awaited<ReturnType<typeof imp.podeAvancar>> | null>(null);
  const [registro, setRegistro] = useState<string[]>([]);
  const [conferencia, setConferencia] = useState<imp.ItemConferencia[]>([]);

  // ── histórico ────────────────────────────────────────────────────
  const [historico, setHistorico] = useState<Awaited<ReturnType<typeof imp.listarExecucoes>>>([]);
  const [verHistorico, setVerHistorico] = useState(false);

  const rota = useMemo(() => rotas.find(r => r.id === rotaId), [rotas, rotaId]);

  const anotar = (t: string) =>
    setRegistro(r => [...r, `${new Date().toLocaleTimeString('pt-BR')}  ${t}`]);

  const comErro = useCallback(async (etiqueta: string, fn: () => Promise<void>) => {
    setErro(null);
    setOcupado(etiqueta);
    try { await fn(); }
    catch (e: any) {
      const msg = e?.message || 'Falha inesperada';
      setErro(msg);
      // A recusa por execução em andamento manda "conclua ou aborte", e os
      // dois botões estão no Histórico, que começa fechado. Abrir aqui é o
      // que faltava para a mensagem levar a algum lugar.
      if (/em andamento/i.test(msg)) setVerHistorico(true);
    }
    finally { setOcupado(null); }
  }, []);

  useEffect(() => {
    imp.listarRotas().then(setRotas).catch(e => setErro(e.message));
    imp.listarExecucoes().then(setHistorico).catch(() => {});
  }, []);

  useEffect(() => {
    setLiquidacaoId('');
    if (!rotaId) { setLiquidacoes([]); return; }
    imp.listarLiquidacoesAbertas(rotaId).then(setLiquidacoes).catch(e => setErro(e.message));
  }, [rotaId]);

  // ── ler o arquivo ────────────────────────────────────────────────
  const escolherArquivo = (f: File | null) => {
    setArquivo(f); setLeitura(null); setErro(null);
    if (!f) return;
    comErro('lendo', async () => { setLeitura(await imp.lerArquivo(f)); });
  };

  const cabecalhoOk = !!leitura && leitura.faltando.length === 0;
  const prontoParaComecar = !!rotaId && !!liquidacaoId && cabecalhoOk && !!leitura?.linhas.length;

  // ── começar: cria a execução, carrega e valida ────────────────────
  const comecar = () =>
    comErro('comecando', async () => {
      if (!leitura || !rota || !arquivo) return;
      setRegistro([]);

      const id = await imp.criarExecucao({
        rotaId, empresaId: rota.empresa_id, vendedorId: rota.vendedor_id!,
        liquidacaoId, arquivoNome: arquivo.name, arquivoHash: leitura.hash,
        forcarHash,
      });
      anotar(`Execução criada: ${id}`);

      const c = await imp.carregarLinhas(id, leitura.linhas);
      anotar(`Carregadas ${c.inseridas} linhas · ${c.descartadas_sem_nome} sem nome descartada(s) · ${c.parcelas_previstas} parcelas previstas`);

      setAchados(await imp.validar(id));
      setLiberacao(await imp.podeAvancar(id));
      setPrev(await imp.previsto(id));
      setExecucao(await imp.buscarExecucao(id));
      setPasso('DIAGNOSTICO');
    });

  const revalidar = () =>
    comErro('validando', async () => {
      if (!execucao) return;
      setAchados(await imp.validar(execucao.id));
      // Em comandos SEPARADOS, e de propósito: a liberação lê o
      // diagnóstico GRAVADO, e numa só ida ela veria o estado anterior.
      setLiberacao(await imp.podeAvancar(execucao.id));
      setPrev(await imp.previsto(execucao.id));
      setExecucao(await imp.buscarExecucao(execucao.id));
    });

  const rodarFases = () =>
    comErro('importando', async () => {
      if (!execucao || !user?.id) return;
      setPasso('EXECUCAO');

      const f1 = await imp.fase1(execucao);
      anotar(`FASE 1 — ${f1.mensagem}`);
      if (f1.erros > 0) throw new Error(`Fase 1 com ${f1.erros} erro(s). Pare e investigue antes da Fase 2.`);

      const f2 = await imp.fase2(execucao, user.id);
      anotar(`FASE 2 — ${f2.mensagem}`);
      if (f2.erros > 0) throw new Error(`Fase 2 com ${f2.erros} erro(s). Não siga para o pós.`);

      const ps = await imp.pos(execucao.id);
      anotar(`PÓS — ${ps.mensagem}`);

      setConferencia(await imp.conferir(execucao.id));
      setExecucao(await imp.buscarExecucao(execucao.id));
      setPasso('ACEITE');
    });

  // A tela de EXECUÇÃO era um beco sem saída. Em 16/10/2026 as duas fases
  // rodaram inteiras — 42 clientes, 42 empréstimos — e o pós recusou
  // porque ninguém avançava a `etapa`; com o erro na tela não havia como
  // voltar àquela execução, e recarregar a página levava para o começo.
  // O conserto da etapa está em sql/2026-10-16_importacao_etapa_avanca.sql;
  // este botão é a saída que faltava quando um passo falha no meio.
  //
  // Ele NÃO roda as fases de novo: só retoma do ponto que a etapa declara.
  const retomar = (id: string) =>
    comErro('retomando', async () => {
      const e = await imp.buscarExecucao(id);
      setExecucao(e);
      setVerHistorico(false);
      setRegistro([]);
      anotar(`Retomando execução ${id} em ${e.etapa}`);

      // Diagnóstico GRAVADO, não revalidado: validar de novo é escrita, e
      // quem retoma quer ver o que foi decidido, não um estado novo. O
      // botão "Validar de novo" está ali para isso.
      setAchados((e.diagnostico?.achados || []) as imp.Achado[]);

      if (['UPLOAD', 'STAGING', 'VALIDACAO', 'FASE1'].includes(e.etapa)) {
        // FASE1 cai aqui de propósito: os empréstimos não entraram, então
        // o caminho é o botão Importar, não o pós.
        setPrev(await imp.previsto(id));
        setLiberacao(await imp.podeAvancar(id));
        setPasso('DIAGNOSTICO');
        return;
      }

      if (e.etapa === 'FASE2') {
        setPasso('EXECUCAO');
        const ps = await imp.pos(id);
        anotar(`PÓS — ${ps.mensagem}`);
      }

      // POS e ACEITE: a conferência é só leitura, e em ACEITE a tela já
      // mostra o selo em vez do botão.
      setConferencia(await imp.conferir(id));
      setExecucao(await imp.buscarExecucao(id));
      setPasso('ACEITE');
    });

  const aceitar = () =>
    comErro('aceitando', async () => {
      if (!execucao) return;
      const r = await imp.aceitar(execucao.id);
      anotar(`ACEITE — ${r.mensagem}`);
      setExecucao(await imp.buscarExecucao(execucao.id));
      setHistorico(await imp.listarExecucoes());
    });

  // Recebe o id em vez de usar só a execução corrente, porque abortar
  // também tem de ser possível a partir do Histórico: quem recarrega a
  // página perde a execução de vista e a criação da próxima é recusada
  // enquanto a anterior estiver em andamento. Era um impasse que só saía
  // por SQL, e aborto é operação da ferramenta, não de banco.
  const abortarExecucao = (id: string) =>
    comErro('abortando', async () => {
      const motivo = window.prompt('Motivo do aborto (fica registrado):') || '';
      if (!motivo.trim()) return;
      const r = await imp.abortar(id, motivo.trim());
      anotar(`ABORTADA — ${r.mensagem}`);
      if (execucao?.id === id) {
        setExecucao(null); setAchados([]); setPrev(null); setLiberacao(null);
        setPasso('ESCOLHA');
      }
      setHistorico(await imp.listarExecucoes());
    });

  const abortar = () => {
    if (!execucao) return;
    abortarExecucao(execucao.id);
  };

  const bloqueios = achados.filter(a => a.gravidade === 'BLOQUEIA');
  const conferir_ = achados.filter(a => a.gravidade === 'CONFERIR');
  const conferenciaFalha = conferencia.filter(c => !c.ok);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <FileSpreadsheet className="w-6 h-6 text-blue-600" />
        <h1 className="text-2xl font-bold text-gray-900">Importação SmartPay</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Ferramenta interna. Uma rota por vez, e nenhuma escrita acontece antes do diagnóstico.
      </p>

      {/* trilha */}
      <div className="flex items-center gap-2 mb-6 text-xs">
        {(['ESCOLHA', 'DIAGNOSTICO', 'EXECUCAO', 'ACEITE'] as Passo[]).map((p, i) => (
          <div key={p} className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full font-semibold ${
              passo === p ? 'bg-blue-600 text-white'
              : (['ESCOLHA','DIAGNOSTICO','EXECUCAO','ACEITE'] as Passo[]).indexOf(passo) > i
                ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
              {i + 1}. {p === 'ESCOLHA' ? 'Arquivo' : p === 'DIAGNOSTICO' ? 'Diagnóstico'
                : p === 'EXECUCAO' ? 'Execução' : 'Aceite'}
            </span>
            {i < 3 && <ChevronRight className="w-3 h-3 text-gray-300" />}
          </div>
        ))}
      </div>

      {erro && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3">
          <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Não foi possível seguir</p>
            {/* A mensagem do Postgres é o diagnóstico: as funções dizem o
                motivo e o que fazer. Trocá-la por uma genérica perderia a
                única informação útil. */}
            <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{erro}</p>
          </div>
        </div>
      )}

      {/* ═══ 1. ESCOLHA ═══ */}
      {passo === 'ESCOLHA' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Destino</h2>

            <label className="block text-xs font-medium text-gray-600 mb-1">Rota</label>
            <select
              value={rotaId}
              onChange={e => setRotaId(e.target.value)}
              className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Selecione a rota…</option>
              {rotas.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>

            {/* Nomes resolvidos, nunca uuid: na rota Supra os INSERTs
                saíram com empresa errada e só se descobriu depois. */}
            {rota && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-900 space-y-0.5">
                <p><span className="text-blue-600">Empresa:</span> {rota.empresas?.nome || '(sem nome)'}</p>
                <p><span className="text-blue-600">Vendedor:</span> {rota.vendedores?.nome || '(rota sem vendedor)'}</p>
                {!rota.vendedor_id && (
                  <p className="text-red-700 font-medium">
                    Esta rota não tem vendedor. A importação exige um — corrija a rota antes.
                  </p>
                )}
              </div>
            )}

            <label className="block text-xs font-medium text-gray-600 mb-1">
              Liquidação (só abertas ou reabertas)
            </label>
            <select
              value={liquidacaoId}
              onChange={e => setLiquidacaoId(e.target.value)}
              disabled={!rotaId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50"
            >
              <option value="">Selecione…</option>
              {liquidacoes.map(l => (
                <option key={l.id} value={l.id}>
                  {new Date(l.data_liquidacao + 'T12:00:00').toLocaleDateString('pt-BR')} — {l.status}
                </option>
              ))}
            </select>
            {rotaId && liquidacoes.length === 0 && (
              <p className="mt-2 text-sm text-amber-700">
                Esta rota não tem liquidação aberta. Abra o dia antes de importar — é dela que
                saem a data dos empréstimos e o vínculo dos pagamentos históricos.
              </p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Arquivo CSV</h2>
            <input
              type="file" accept=".csv,text/csv"
              onChange={e => escolherArquivo(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4
                         file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700
                         file:text-sm file:font-medium hover:file:bg-blue-100"
            />

            {ocupado === 'lendo' && (
              <p className="mt-3 text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Lendo o arquivo…
              </p>
            )}

            {leitura && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <Cartao rotulo="Linhas de cliente" valor={leitura.linhas.length} />
                  <Cartao rotulo="Linha de totais" valor={leitura.linhasTotais}
                          nota="ignorada, e esperada" />
                  <Cartao rotulo="Colunas lidas" valor={leitura.encontrados.length} />
                  <Cartao rotulo="Colunas ignoradas" valor={leitura.ignorados.length} />
                </div>

                {/* A conferência de cabeçalho é a única proteção real
                    contra arquivo em codificação errada. Sem ela, um CSV
                    em Latin-1 entraria com documento nulo em todos os
                    clientes, sem nenhum erro. */}
                {leitura.faltando.length > 0 ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-semibold text-red-800 mb-2">
                      Faltam {leitura.faltando.length} coluna(s) obrigatória(s)
                    </p>
                    <p className="text-xs text-red-700 mb-2">
                      <strong>Não enviado.</strong> Coluna com acento faltando (IDENTIFICACIÓN,
                      SANCIÓN) é quase sempre codificação errada no arquivo — e sem esta
                      checagem a importação entraria com documento vazio em todos os clientes.
                    </p>
                    <p className="text-xs text-red-800 font-mono">
                      Faltando: {leitura.faltando.join(' · ')}
                    </p>
                    <p className="text-xs text-red-600 mt-2 font-mono break-all">
                      Encontrado no arquivo: {leitura.encontrados.join(' · ')}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-green-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Cabeçalho completo.
                  </p>
                )}

                <label className="flex items-start gap-2 text-xs text-gray-600">
                  <input type="checkbox" checked={forcarHash}
                         onChange={e => setForcarHash(e.target.checked)} className="mt-0.5" />
                  <span>
                    Reimportar mesmo que este arquivo já tenha sido importado nesta rota.
                    Sem isto, arquivo repetido é recusado — durante a migração a mesma rota
                    foi importada duas vezes e não havia como saber se o CSV era o mesmo.
                  </span>
                </label>
              </div>
            )}
          </div>

          <button
            onClick={comecar}
            disabled={!prontoParaComecar || !!ocupado || !rota?.vendedor_id}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm
                       disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {ocupado === 'comecando'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Carregando e validando…</>
              : <><Upload className="w-4 h-4" /> Carregar e validar</>}
          </button>
        </div>
      )}

      {/* ═══ 2. DIAGNÓSTICO ═══ */}
      {passo === 'DIAGNOSTICO' && execucao && (
        <div className="space-y-5">
          {prev && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Previsto</h2>
              {/* Sem o previsto calculado da ORIGEM não existe conferência,
                  existe palpite: 504 parcelas para 347 empréstimos pareceu
                  defeito e era correto — eram mensais de parcela única. */}
              <p className="text-xs text-gray-500 mb-4">
                Calculado do CSV. É o que a etapa de aceite vai comparar.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                <Cartao rotulo="Linhas" valor={prev.linhas} />
                <Cartao rotulo="Documentos" valor={prev.documentos_distintos} />
                <Cartao rotulo="Parcelas" valor={prev.parcelas_previstas} />
                <Cartao rotulo="Sem documento" valor={prev.sem_documento} />
                <Cartao rotulo="Emprestado" valor={fmtMoeda(prev.total_emprestado)} />
                <Cartao rotulo="Saldo" valor={fmtMoeda(prev.total_saldo)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {Object.entries(prev.por_frequencia || {}).map(([k, v]) => (
                  <span key={k} className="px-2 py-1 bg-gray-100 rounded">{k}: {v}</span>
                ))}
              </div>
            </div>
          )}

          <ListaAchados titulo="Bloqueios" itens={bloqueios} grave />
          <ListaAchados titulo="Para conferir" itens={conferir_} />

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={revalidar} disabled={!!ocupado}
              className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-medium
                         text-gray-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {ocupado === 'validando' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Validar de novo
            </button>
            <button onClick={abortar} disabled={!!ocupado}
              className="py-3 px-5 border border-red-200 text-red-700 rounded-xl text-sm
                         font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              <Ban className="w-4 h-4" /> Abortar
            </button>
            <button
              onClick={rodarFases}
              disabled={!!ocupado || !liberacao?.pode}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm
                         disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {liberacao?.pode ? 'Importar' : liberacao?.motivo || 'Bloqueado'}
            </button>
          </div>
          {!liberacao?.pode && (
            <p className="text-xs text-gray-500 text-center">
              Resolva os bloqueios em <code>importacao_smartpay</code> e valide de novo.
              Linha com documento de duas pessoas pede o documento certo de uma delas, ou
              limpar a identificação de quem estiver errado — quem ficar sem recebe
              <code> SD-</code> derivado do crédito.
            </p>
          )}
        </div>
      )}

      {/* ═══ 3. EXECUÇÃO ═══ */}
      {passo === 'EXECUCAO' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            {ocupado ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : null}
            Importando
          </h2>
          <Registro linhas={registro} />
        </div>
      )}

      {/* ═══ 4. ACEITE ═══ */}
      {passo === 'ACEITE' && execucao && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Previsto × realizado</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                O aceite só marca se TODOS os itens fecharem.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Previsto</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Realizado</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Bate</th>
                  </tr>
                </thead>
                <tbody>
                  {conferencia.map(c => (
                    <tr key={c.item} className={`border-t border-gray-100 ${c.ok ? '' : 'bg-red-50'}`}>
                      <td className="px-4 py-2">
                        <p className="text-gray-900">{c.item}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.observacao}</p>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs">{c.previsto}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs">{c.realizado}</td>
                      <td className="px-4 py-2 text-center">
                        {c.ok ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" />
                              : <XCircle className="w-4 h-4 text-red-600 inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Registro linhas={registro} />

          {execucao.etapa === 'ACEITE' ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
              <p className="text-sm text-green-800">
                Importação aceita. A conferência ficou guardada na execução — é a prova de
                que no dia do aceite os números batiam.
              </p>
            </div>
          ) : (
            <button
              onClick={aceitar}
              disabled={!!ocupado || conferenciaFalha.length > 0}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm
                         disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {conferenciaFalha.length > 0
                ? `${conferenciaFalha.length} item(ns) não fecham`
                : 'Aceitar importação'}
            </button>
          )}

          <button onClick={() => { setPasso('ESCOLHA'); setExecucao(null); setArquivo(null); setLeitura(null); }}
            className="w-full py-2 text-sm text-gray-500 flex items-center justify-center gap-1">
            Nova importação <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ═══ HISTÓRICO ═══ */}
      <div className="mt-8">
        <button onClick={() => setVerHistorico(v => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600">
          <History className="w-4 h-4" />
          Histórico ({historico.length})
          <ChevronDown className={`w-4 h-4 transition-transform ${verHistorico ? 'rotate-180' : ''}`} />
        </button>

        {verHistorico && (
          <div className="mt-3 bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Quando', 'Rota', 'Arquivo', 'Etapa', 'Linhas', 'Parcelas', ''].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historico.map(h => (
                  <tr key={h.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {new Date(h.criado_em).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-2">{h.rotas?.nome || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {h.arquivo_nome || <span className="italic text-gray-400">feita à mão</span>}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        h.etapa === 'ACEITE' ? 'bg-green-100 text-green-700'
                        : h.etapa === 'ABORTADO' ? 'bg-gray-100 text-gray-500'
                        : 'bg-amber-100 text-amber-700'}`}>{h.etapa}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{h.registros_csv ?? '—'}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{h.parcelas_previstas ?? '—'}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {h.etapa === 'ABORTADO' ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => retomar(h.id)}
                            disabled={!!ocupado}
                            className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50
                                       rounded-md hover:bg-blue-100 disabled:opacity-50"
                          >
                            {h.etapa === 'ACEITE' ? 'Ver' : 'Retomar'}
                          </button>
                          {/* Aceita não aborta: o aceite é o fim da linha, e
                              apagar a staging de uma importação aceita
                              jogaria fora a prova de onde os cadastros
                              vieram. */}
                          {h.etapa !== 'ACEITE' && (
                            <button
                              onClick={() => abortarExecucao(h.id)}
                              disabled={!!ocupado}
                              className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50
                                         rounded-md hover:bg-red-100 disabled:opacity-50"
                              title="Abortar esta execução e liberar a rota"
                            >
                              Abortar
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// PEDAÇOS
// =====================================================================

function Cartao({ rotulo, valor, nota }: { rotulo: string; valor: React.ReactNode; nota?: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className="text-lg font-bold text-gray-900 tabular-nums">{valor}</p>
      {nota && <p className="text-[10px] text-gray-400">{nota}</p>}
    </div>
  );
}

function Registro({ linhas }: { linhas: string[] }) {
  if (linhas.length === 0) return null;
  return (
    <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs text-gray-100 space-y-1
                    max-h-64 overflow-y-auto">
      {linhas.map((l, i) => <p key={i} className="whitespace-pre-wrap">{l}</p>)}
    </div>
  );
}

function ListaAchados({ titulo, itens, grave }: { titulo: string; itens: imp.Achado[]; grave?: boolean }) {
  if (itens.length === 0) {
    return (
      <div className="p-4 bg-white rounded-xl border border-gray-200 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <p className="text-sm text-gray-600">{titulo}: nenhum.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${
      grave ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="px-5 py-3 flex items-center gap-2">
        <AlertTriangle className={`w-4 h-4 ${grave ? 'text-red-600' : 'text-amber-600'}`} />
        <h2 className={`text-sm font-semibold ${grave ? 'text-red-800' : 'text-amber-800'}`}>
          {titulo} ({itens.length})
        </h2>
      </div>
      <div className="bg-white">
        {itens.map((a, i) => (
          <div key={i} className="px-5 py-3 border-t border-gray-100">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                grave ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {a.tipo}
              </span>
              <span className="text-xs text-gray-400 font-mono">linha {a.ref_linhas}</span>
              {a.ref_documento && a.ref_documento !== '—' && (
                <span className="text-xs text-gray-400 font-mono">doc {a.ref_documento}</span>
              )}
            </div>
            <p className="text-sm text-gray-900 mt-1">{a.detalhe}</p>
            <p className="text-xs text-gray-500 mt-0.5">{a.acao}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
