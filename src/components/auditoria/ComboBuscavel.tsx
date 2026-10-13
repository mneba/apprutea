'use client';

// =====================================================================
// SELETOR DIGITÁVEL
// =====================================================================
//
// Um `<select>` nativo com trinta rotas obriga a rolar procurando pelo nome.
// Este aceita digitar para filtrar, que é como se procura quando se sabe o
// que se quer.
//
// Fecha ao clicar fora e ao Esc. Sem isso, a lista fica aberta por cima do
// resto da tela e o único jeito de fechá-la é escolher alguma coisa — o que
// força uma escolha que o usuário talvez não queira fazer.

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

export interface OpcaoCombo {
  valor: string;
  rotulo: string;
  /** Linha secundária, cinza — ex.: o vendedor da rota. */
  detalhe?: string | null;
}

interface Props {
  opcoes: OpcaoCombo[];
  valor: string;
  onChange: (valor: string) => void;
  /** Texto da opção vazia. Ausente, o campo passa a ser obrigatório. */
  rotuloVazio?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function ComboBuscavel({
  opcoes,
  valor,
  onChange,
  rotuloVazio,
  placeholder = 'Digite para buscar...',
  disabled,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const caixaRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  const selecionada = opcoes.find((o) => o.valor === valor);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  // A busca zera ao abrir: reaproveitar o texto anterior esconderia opções sem
  // o usuário entender por quê.
  const abrir = () => {
    if (disabled) return;
    setBusca('');
    setAberto(true);
    setTimeout(() => campoRef.current?.focus(), 0);
  };

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? opcoes.filter(
        (o) =>
          o.rotulo.toLowerCase().includes(termo) ||
          (o.detalhe || '').toLowerCase().includes(termo)
      )
    : opcoes;

  const escolher = (v: string) => {
    onChange(v);
    setAberto(false);
  };

  return (
    <div ref={caixaRef} className="relative">
      <button
        type="button"
        onClick={abrir}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white text-left flex items-center justify-between gap-2 disabled:bg-gray-50 disabled:text-gray-400"
      >
        <span className={`truncate ${selecionada ? 'text-gray-900' : 'text-gray-400'}`}>
          {selecionada ? selecionada.rotulo : rotuloVazio ?? 'Selecione'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>

      {aberto && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100 relative">
            <input
              ref={campoRef}
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                // Enter com uma única opção filtrada escolhe direto: digitar
                // três letras e apertar Enter é o caminho de quem já sabe.
                if (e.key === 'Enter' && filtradas.length === 1) escolher(filtradas[0].valor);
              }}
              placeholder={placeholder}
              className="w-full pl-3 pr-8 py-1.5 rounded border border-gray-200 text-sm"
            />
            {busca && (
              <button
                type="button"
                onClick={() => { setBusca(''); campoRef.current?.focus(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {rotuloVazio && (
              <Linha
                rotulo={rotuloVazio}
                marcada={valor === ''}
                onClick={() => escolher('')}
              />
            )}

            {filtradas.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400">Nada encontrado.</p>
            ) : (
              filtradas.map((o) => (
                <Linha
                  key={o.valor}
                  rotulo={o.rotulo}
                  detalhe={o.detalhe}
                  marcada={o.valor === valor}
                  onClick={() => escolher(o.valor)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Linha({
  rotulo, detalhe, marcada, onClick,
}: { rotulo: string; detalhe?: string | null; marcada: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-gray-50 ${
        marcada ? 'bg-blue-50' : ''
      }`}
    >
      <span className="min-w-0">
        <span className={`block text-sm truncate ${marcada ? 'text-blue-700 font-medium' : 'text-gray-900'}`}>
          {rotulo}
        </span>
        {detalhe && <span className="block text-xs text-gray-400 truncate">{detalhe}</span>}
      </span>
      {marcada && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
    </button>
  );
}
