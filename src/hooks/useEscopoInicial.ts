'use client';

// =====================================================================
// O RELATÓRIO ABRE NA ROTA QUE A PESSOA JÁ ESCOLHEU
// =====================================================================
//
// Reclamação do Julio em 12/10/2026: "em Relatórios > Liquidação por período,
// mesmo com a rota já selecionada no menu superior, o relatório abre com
// 'Selecione o escopo' e é preciso buscar a rota de novo entre as 54."
//
// Ele está certo, e o incômodo é maior do que parece: a árvore tem mais de
// cinquenta rotas e abrir o relatório obrigava a refazer uma escolha que o
// sistema já conhecia e já tinha gravado em `user_profiles.ultima_rota_id`.
//
// A ESCOLHA CONTINUA LIVRE. Isto é um ponto de partida, não uma trava: o
// seletor de escopo segue inteiro, e trocar de rota funciona como antes. É a
// diferença entre sugerir e impor.
//
// SÓ NA PRIMEIRA VEZ. O `ref` existe porque este efeito depende da estrutura,
// que chega depois do primeiro render — sem ele, qualquer mudança posterior na
// localização global puxaria a seleção de volta e desfaria a escolha que a
// pessoa acabou de fazer na tela.

import { useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';
import type { EstruturaVisivel } from '@/types/relatorios';

/**
 * Sugere o escopo inicial a partir da localização global.
 *
 * Em ordem: a rota escolhida; não havendo rota, todas as rotas da empresa
 * escolhida; não havendo empresa, nada — e aí a tela pede o escopo, como
 * sempre fez.
 *
 * A rota só é sugerida se estiver na estrutura VISÍVEL. Uma rota revogada
 * continua em `ultima_rota_id` até o usuário trocar (ver UserContext), e
 * sugerir o que ele não pode ver produziria um relatório vazio sem explicação.
 */
export function useEscopoInicial(
  estrutura: EstruturaVisivel | null,
  selecionadas: Set<string>,
  setSelecionadas: (s: Set<string>) => void,
) {
  const { localizacao } = useUser();
  const jaSugeriu = useRef(false);

  useEffect(() => {
    if (jaSugeriu.current) return;
    if (!estrutura) return;
    // Já há escolha na tela — veio de onde vier, ela manda.
    if (selecionadas.size > 0) { jaSugeriu.current = true; return; }

    const empresas = (estrutura.paises ?? []).flatMap((p) =>
      p.estados.flatMap((es) => es.cidades.flatMap((c) => c.empresas))
    );

    let sugestao: string[] = [];

    if (localizacao.rota_id) {
      const existe = empresas.some((em) =>
        em.rotas.some((r) => r.rota_id === localizacao.rota_id)
      );
      if (existe) sugestao = [localizacao.rota_id];
    }

    if (sugestao.length === 0 && localizacao.empresa_id) {
      const emp = empresas.find((em) => em.empresa_id === localizacao.empresa_id);
      if (emp) sugestao = emp.rotas.map((r) => r.rota_id);
    }

    // Marca como feito mesmo sem sugestão: a estrutura já chegou, e tentar de
    // novo a cada render só repetiria o mesmo resultado.
    jaSugeriu.current = true;
    if (sugestao.length > 0) setSelecionadas(new Set(sugestao));
  }, [estrutura, selecionadas, setSelecionadas, localizacao.rota_id, localizacao.empresa_id]);
}
