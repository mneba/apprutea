'use client';

// =====================================================================
// ÁRVORE DE ESCOPO DOS RELATÓRIOS
// =====================================================================
//
// País › estado › cidade › empresa › rota, com checkbox de três estados.
//
// POR QUE SELEÇÃO MÚLTIPLA E NÃO "PARAR NUM NÍVEL"
// O sistema legado do cliente permite marcar quatro rotas de São Paulo e uma
// da Colômbia ao mesmo tempo. Navegação que para num nó só não cobre isso.
// Marcar um país marca os descendentes; desmarcar uma rota deixa os pais
// meio-marcados — e o que sai daqui é sempre a lista plana de rotas, que é o
// que `fn_liquidacoes_periodo` recebe.
//
// POR QUE A ÁRVORE INTEIRA DE UMA VEZ
// O seletor global do webapp carrega nível a nível e exige escolha terminal,
// então "só o estado" ou "só o país" não existem lá como estado possível. Com
// a estrutura toda em memória — ela vem num `jsonb` só — marcar um nó é marcar
// as folhas abaixo dele, e o tri-state sai de graça.
//
// O componente não decide visibilidade: a árvore já chega recortada pelo
// perfil, de `fn_estrutura_visivel`.

import { ChevronDown, ChevronRight, Minus, Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { EstruturaVisivel, PaisNo } from '@/types/relatorios';

interface Props {
  estrutura: EstruturaVisivel;
  /** Rotas marcadas. O pai é dono do estado — aqui não há cópia local. */
  selecionadas: Set<string>;
  onChange: (rotas: Set<string>) => void;
}

/** Todas as rotas abaixo de um nó, em qualquer profundidade. */
function rotasDoPais(p: PaisNo): string[] {
  return p.estados.flatMap((e) =>
    e.cidades.flatMap((c) => c.empresas.flatMap((em) => em.rotas.map((r) => r.rota_id)))
  );
}

type Estado = 'vazio' | 'parcial' | 'cheio';

function estadoDe(ids: string[], sel: Set<string>): Estado {
  if (ids.length === 0) return 'vazio';
  let n = 0;
  for (const id of ids) if (sel.has(id)) n++;
  if (n === 0) return 'vazio';
  return n === ids.length ? 'cheio' : 'parcial';
}

/** Caixa de três estados. O "parcial" é um traço, não um check pálido. */
function Caixa({ estado }: { estado: Estado }) {
  const base = 'w-4 h-4 rounded border flex items-center justify-center shrink-0';
  if (estado === 'cheio') {
    return (
      <span className={`${base} bg-blue-600 border-blue-600`}>
        <Check className="w-3 h-3 text-white" strokeWidth={3} />
      </span>
    );
  }
  if (estado === 'parcial') {
    return (
      <span className={`${base} bg-blue-600 border-blue-600`}>
        <Minus className="w-3 h-3 text-white" strokeWidth={3} />
      </span>
    );
  }
  return <span className={`${base} bg-white border-gray-300`} />;
}

/** Uma linha da árvore: seta de abrir, caixa, rótulo e contagem. */
function Linha({
  nivel,
  rotulo,
  ids,
  selecionadas,
  onToggle,
  aberto,
  onAbrir,
  temFilhos,
  negrito,
}: {
  nivel: number;
  rotulo: string;
  ids: string[];
  selecionadas: Set<string>;
  onToggle: (ids: string[], marcar: boolean) => void;
  aberto?: boolean;
  onAbrir?: () => void;
  temFilhos?: boolean;
  negrito?: boolean;
}) {
  const estado = estadoDe(ids, selecionadas);
  return (
    <div
      className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded"
      style={{ paddingLeft: nivel * 18 + 4 }}
    >
      {temFilhos ? (
        <button
          type="button"
          onClick={onAbrir}
          className="p-0.5 text-gray-400 hover:text-gray-700 shrink-0"
          aria-label={aberto ? 'Recolher' : 'Expandir'}
        >
          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}

      <button
        type="button"
        onClick={() => onToggle(ids, estado !== 'cheio')}
        className="flex items-center gap-2 text-left min-w-0 flex-1"
      >
        <Caixa estado={estado} />
        <span
          className={`text-sm truncate ${negrito ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
        >
          {rotulo}
        </span>
        {ids.length > 1 && (
          <span className="text-xs text-gray-400 shrink-0">{ids.length}</span>
        )}
      </button>
    </div>
  );
}

/** Sem acento e em minúscula, para "São Paulo" casar com "sao paulo". */
const chave = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function ArvoreEscopo({ estrutura, selecionadas, onChange }: Props) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState('');

  const alternarAberto = (chave: string) => {
    setAbertos((prev) => {
      const n = new Set(prev);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });
  };

  const toggle = (ids: string[], marcar: boolean) => {
    const n = new Set(selecionadas);
    for (const id of ids) {
      if (marcar) n.add(id);
      else n.delete(id);
    }
    onChange(n);
  };

  const todasAsRotas = useMemo(
    () => estrutura.paises.flatMap(rotasDoPais),
    [estrutura]
  );

  // A busca poda a árvore em vez de produzir uma lista achatada: o usuário
  // precisa continuar vendo de qual empresa e cidade a rota é — é o que
  // distingue "Prueba 1" de "Prueba 2". Casa com rota, vendedor, empresa,
  // cidade, estado e país, porque qualquer um deles é um jeito legítimo de
  // procurar.
  const visivel = useMemo(() => {
    const q = chave(busca.trim());
    if (!q) return estrutura.paises;

    return estrutura.paises
      .map((p) => {
        const paisCasa = chave(p.pais).includes(q);
        const estados = p.estados
          .map((e) => {
            const estadoCasa = paisCasa || chave(e.estado).includes(q);
            const cidades = e.cidades
              .map((c) => {
                const cidadeCasa = estadoCasa || chave(c.nome).includes(q);
                const empresas = c.empresas
                  .map((em) => {
                    const empresaCasa = cidadeCasa || chave(em.nome).includes(q);
                    const rotas = empresaCasa
                      ? em.rotas
                      : em.rotas.filter(
                          (r) =>
                            chave(r.nome).includes(q) ||
                            chave(r.vendedor_nome ?? '').includes(q)
                        );
                    return { ...em, rotas };
                  })
                  .filter((em) => em.rotas.length > 0);
                return { ...c, empresas };
              })
              .filter((c) => c.empresas.length > 0);
            return { ...e, cidades };
          })
          .filter((e) => e.cidades.length > 0);
        return { ...p, estados };
      })
      .filter((p) => p.estados.length > 0);
  }, [estrutura, busca]);

  // Procurar e ter de abrir nó por nó seria absurdo: com busca ativa tudo
  // já vem aberto.
  const estaAberto = (k: string) => !!busca.trim() || abertos.has(k);

  if (!estrutura.sucesso) {
    return (
      <p className="text-sm text-red-600">
        {estrutura.mensagem || 'Não foi possível carregar a estrutura.'}
      </p>
    );
  }

  if (todasAsRotas.length === 0) {
    return <p className="text-sm text-gray-500">Nenhuma rota disponível para o seu acesso.</p>;
  }

  return (
    <div>
      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input
          id="escopo-busca"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar rota, vendedor, empresa ou cidade"
          className="w-full border border-gray-300 rounded-lg pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
        <button
          type="button"
          onClick={() => toggle(todasAsRotas, true)}
          className="text-xs font-medium px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100"
        >
          Todos
        </button>
        <button
          type="button"
          onClick={() => toggle(todasAsRotas, false)}
          className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          Nenhum
        </button>
        <span className="ml-auto text-xs text-gray-500">
          {selecionadas.size} de {todasAsRotas.length}
        </span>
      </div>

      {busca.trim() && visivel.length === 0 && (
        <p className="text-sm text-gray-500 py-3">Nada encontrado para “{busca}”.</p>
      )}

      <div className="max-h-80 overflow-y-auto pr-1">
        {visivel.map((p) => {
          const chaveP = `p:${p.pais}`;
          const idsP = rotasDoPais(p);
          const abertoP = estaAberto(chaveP);
          return (
            <div key={chaveP}>
              <Linha
                nivel={0}
                rotulo={p.pais}
                ids={idsP}
                selecionadas={selecionadas}
                onToggle={toggle}
                aberto={abertoP}
                onAbrir={() => alternarAberto(chaveP)}
                temFilhos
                negrito
              />

              {abertoP &&
                p.estados.map((e) => {
                  const chaveE = `e:${e.hierarquia_id}`;
                  const idsE = e.cidades.flatMap((c) =>
                    c.empresas.flatMap((em) => em.rotas.map((r) => r.rota_id))
                  );
                  const abertoE = estaAberto(chaveE);
                  return (
                    <div key={chaveE}>
                      <Linha
                        nivel={1}
                        rotulo={e.estado}
                        ids={idsE}
                        selecionadas={selecionadas}
                        onToggle={toggle}
                        aberto={abertoE}
                        onAbrir={() => alternarAberto(chaveE)}
                        temFilhos
                      />

                      {abertoE &&
                        e.cidades.map((c) => {
                          const chaveC = `c:${e.hierarquia_id}:${c.cidade_id ?? 'sem'}`;
                          const idsC = c.empresas.flatMap((em) =>
                            em.rotas.map((r) => r.rota_id)
                          );
                          const abertoC = estaAberto(chaveC);
                          return (
                            <div key={chaveC}>
                              <Linha
                                nivel={2}
                                rotulo={c.nome}
                                ids={idsC}
                                selecionadas={selecionadas}
                                onToggle={toggle}
                                aberto={abertoC}
                                onAbrir={() => alternarAberto(chaveC)}
                                temFilhos
                              />

                              {abertoC &&
                                c.empresas.map((em) => {
                                  const chaveEm = `em:${em.empresa_id}`;
                                  const idsEm = em.rotas.map((r) => r.rota_id);
                                  const abertoEm = estaAberto(chaveEm);
                                  return (
                                    <div key={chaveEm}>
                                      <Linha
                                        nivel={3}
                                        rotulo={em.nome}
                                        ids={idsEm}
                                        selecionadas={selecionadas}
                                        onToggle={toggle}
                                        aberto={abertoEm}
                                        onAbrir={() => alternarAberto(chaveEm)}
                                        temFilhos
                                      />

                                      {abertoEm &&
                                        em.rotas.map((r) => (
                                          <Linha
                                            key={r.rota_id}
                                            nivel={4}
                                            // O nome da rota sozinho não
                                            // identifica: há "Prueba 1",
                                            // "Prueba 2" e "Andrea 3" no
                                            // cadastro real.
                                            rotulo={
                                              r.vendedor_nome
                                                ? `${r.nome} (${r.vendedor_nome})`
                                                : r.nome
                                            }
                                            ids={[r.rota_id]}
                                            selecionadas={selecionadas}
                                            onToggle={toggle}
                                          />
                                        ))}
                                    </div>
                                  );
                                })}
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
