'use client';

// =====================================================================
// A BARRA DE FILTROS DOS RELATÓRIOS
// =====================================================================
//
// Escopo + período + botão de gerar. Toda tela de relatório começa com os
// mesmos três, e manter três cópias disso é como as telas acabam divergindo:
// uma ganha a busca na árvore, outra não; uma lembra a última seleção, outra
// esquece.
//
// ⚠ A tela de Liquidação por Período ainda tem a versão embutida dela, de
// antes desta extração. Foi deixada assim de propósito em 07/10/2026: ela está
// em produção e testada, e migrar as três de uma vez significaria que um
// defeito aqui derrubaria todas. A migração é tarefa própria, com a tela
// aberta na frente.
//
// DOIS MODOS
//   `periodo` — de e até, para relatórios de fluxo.
//   `data`    — uma data só, para relatórios de FOTO. Atraso é estado, não
//               fluxo: "quanto atraso houve em setembro" não tem resposta.

import { ChevronDown, Globe, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ArvoreEscopo from '@/components/relatorios/ArvoreEscopo';
import SeletorPeriodo from '@/components/relatorios/SeletorPeriodo';
import { relatoriosService } from '@/services/relatorios';
import type { EstruturaVisivel, RotaNo } from '@/types/relatorios';

export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const primeiroDoMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

/** Todas as rotas da árvore, achatadas, para resolver nome e vendedor. */
export const achatarRotas = (e: EstruturaVisivel | null): RotaNo[] =>
  (e?.paises ?? []).flatMap((p) =>
    p.estados.flatMap((es) =>
      es.cidades.flatMap((c) => c.empresas.flatMap((em) => em.rotas))
    )
  );

interface Props {
  modo?: 'periodo' | 'data';
  carregando?: boolean;
  /** Chamado ao clicar em Gerar. No modo `data`, `ate` repete `de`. */
  onGerar: (rotas: string[], de: string, ate: string, nomesDasRotas: RotaNo[]) => void;
}

export default function BarraFiltros({ modo = 'periodo', carregando, onGerar }: Props) {
  const [estrutura, setEstrutura] = useState<EstruturaVisivel | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [de, setDe] = useState(modo === 'data' ? hojeIso() : primeiroDoMes());
  const [ate, setAte] = useState(hojeIso());
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => setEstrutura(await relatoriosService.buscarEstrutura()))();
  }, []);

  // Fecha ao clicar fora ou com Esc. A árvore de 52 rotas é alta, e sem isto
  // ela fica presa sobre a tela.
  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(ev.target as Node)) setAberto(false);
    };
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const todasAsRotas = useMemo(() => achatarRotas(estrutura), [estrutura]);

  // Nome quando dá para nomear, contagem quando são muitas: "23 rotas" diz
  // mais que uma lista cortada no meio.
  const rotulo = useMemo(() => {
    if (selecionadas.size === 0) return 'Selecione o escopo';
    if (todasAsRotas.length > 0 && selecionadas.size === todasAsRotas.length) return 'Tudo';
    if (selecionadas.size === 1) {
      const r = todasAsRotas.find((x) => selecionadas.has(x.rota_id));
      return r?.nome ?? '1 rota';
    }
    return `${selecionadas.size} rotas`;
  }, [selecionadas, todasAsRotas]);

  const podeGerar = selecionadas.size > 0 && !!de && (modo === 'data' || (!!ate && ate >= de));

  const gerar = () => {
    if (!podeGerar) return;
    const rotas = Array.from(selecionadas);
    const escolhidas = todasAsRotas.filter((r) => selecionadas.has(r.rota_id));
    onGerar(rotas, de, modo === 'data' ? de : ate, escolhidas);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 flex flex-wrap items-center gap-2">
      <div className="relative" ref={caixa}>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="inline-flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white hover:bg-gray-50 min-w-[180px]"
        >
          <Globe className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 truncate max-w-[220px]">{rotulo}</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
        </button>

        {aberto && (
          <div className="absolute z-30 mt-1 w-[380px] max-w-[90vw] bg-white rounded-lg border border-gray-200 shadow-lg p-3">
            {!estrutura ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando estrutura…
              </div>
            ) : (
              <ArvoreEscopo
                estrutura={estrutura}
                selecionadas={selecionadas}
                onChange={setSelecionadas}
              />
            )}
          </div>
        )}
      </div>

      {modo === 'periodo' ? (
        <SeletorPeriodo de={de} ate={ate} onChange={(d, a) => { setDe(d); setAte(a); }} compacto />
      ) : (
        <>
          <label htmlFor="foto-data" className="text-sm text-gray-500">Posição em</label>
          <input
            id="foto-data"
            type="date"
            value={de}
            max={hojeIso()}
            onChange={(e) => setDe(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setDe(hojeIso())}
            className="text-xs font-medium px-2.5 py-1 rounded-full border bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Hoje
          </button>
        </>
      )}

      <button
        onClick={gerar}
        disabled={!podeGerar || carregando}
        className="ml-auto inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
      >
        {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
        Gerar
      </button>
    </div>
  );
}
