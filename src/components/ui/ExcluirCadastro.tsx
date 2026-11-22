'use client';

// =====================================================================
// EXCLUIR EMPRESA, ROTA OU VENDEDOR CRIADO POR ENGANO (22/11/2026)
// =====================================================================
//
// Pedido do Julio: criou empresa duplicada e não tinha como apagar. Regra do
// Mauricio: pode excluir QUANDO NÃO HOUVER MOVIMENTAÇÃO, e vale igual para
// rota e vendedor. Ver sql/2026-11-22_excluir_empresa_rota_vendedor.sql.
//
// A tela PERGUNTA AO BANCO — se pode, o que bloqueia, o que sai junto — e não
// decide nada: `fn_excluir_cadastro` confere permissão, nome e bloqueios de
// novo. Quem não é SUPER_ADMIN não vê o bloco.
//
// ⚠ Sem menção a backup no texto, de propósito: mesma decisão do reset de
// rota (09/11/2026) — rede de proteção anunciada muda o peso do clique.

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Tipo = 'EMPRESA' | 'ROTA' | 'VENDEDOR';

interface Previa {
  permitido: boolean;
  nome?: string;
  bloqueios?: { o_que: string; qtd: number }[];
  leva_junto?: { rotas?: string[]; vendedores?: string[] };
}

const ROTULO: Record<Tipo, { artigo: string; nome: string }> = {
  EMPRESA: { artigo: 'a', nome: 'empresa' },
  ROTA: { artigo: 'a', nome: 'rota' },
  VENDEDOR: { artigo: 'o', nome: 'vendedor' },
};

interface Props {
  tipo: Tipo;
  id: string;
  /** Chamado depois de excluir: fechar o modal e recarregar a lista. */
  onExcluido: () => void;
}

export function ExcluirCadastro({ tipo, id, onExcluido }: Props) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const r = ROTULO[tipo];

  useEffect(() => {
    let vivo = true;
    setPrevia(null);
    createClient()
      .rpc('fn_cadastro_exclusao_previa', { p_tipo: tipo, p_id: id })
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) { console.error('❌ Prévia de exclusão:', error); return; }
        setPrevia(data as Previa);
      });
    return () => { vivo = false; };
  }, [tipo, id]);

  if (!previa?.permitido) return null;

  const bloqueios = previa.bloqueios ?? [];
  const rotas = previa.leva_junto?.rotas ?? [];
  const vendedores = previa.leva_junto?.vendedores ?? [];

  const excluir = async () => {
    const digitado = window.prompt(
      `Excluir ${r.artigo} ${r.nome} "${previa.nome}" não pode ser desfeito.\n\nDigite o nome exatamente como está para confirmar:`
    );
    if (digitado === null) return;
    setExcluindo(true);
    const { data, error } = await createClient().rpc('fn_excluir_cadastro', {
      p_tipo: tipo, p_id: id, p_confirmacao: digitado,
    });
    setExcluindo(false);
    if (error) {
      alert(`Erro ao excluir: ${error.message}`);
      return;
    }
    alert(data?.mensagem || (data?.sucesso ? 'Excluído.' : 'Não foi possível excluir.'));
    if (data?.sucesso) onExcluido();
  };

  return (
    <div className="pt-4 border-t border-red-100">
      <h3 className="text-sm font-semibold text-red-700 mb-1.5 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" />
        Excluir {r.nome}
      </h3>
      {bloqueios.length > 0 ? (
        <p className="text-xs text-gray-600 mb-3 leading-relaxed">
          Não pode ser excluíd{r.artigo}: tem{' '}
          {bloqueios.map((b) => `${b.qtd} ${b.o_que}`).join(', ')}. Só se exclui
          cadastro sem nenhuma movimentação.
        </p>
      ) : (
        <p className="text-xs text-gray-600 mb-3 leading-relaxed">
          Sem movimentação: pode ser excluíd{r.artigo}.
          {tipo === 'EMPRESA' && (rotas.length > 0 || vendedores.length > 0) && (
            <>
              {' '}Sai junto:
              {rotas.length > 0 && <> {rotas.length} rota(s) ({rotas.join(', ')})</>}
              {rotas.length > 0 && vendedores.length > 0 && ' e'}
              {vendedores.length > 0 && <> {vendedores.length} vendedor(es) ({vendedores.join(', ')})</>}
              .
            </>
          )}
          {(tipo === 'VENDEDOR' || (tipo === 'EMPRESA' && vendedores.length > 0)) &&
            ' O código de acesso do vendedor deixa de funcionar.'}
          {' '}A exclusão fica registrada com seu usuário.
        </p>
      )}
      <button
        type="button"
        onClick={excluir}
        disabled={bloqueios.length > 0 || excluindo}
        className="flex items-center gap-2 px-4 py-2.5 border border-red-300 text-red-700 rounded-xl hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        Excluir {r.nome}
      </button>
    </div>
  );
}
