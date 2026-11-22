'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Repositório de anexos do vendedor — aba "Anexos" do ModalVendedor
// (22/11/2026). Documento, contrato, comprovante, foto… guardados pela
// administração. O vendedor não vê pelo app.
//
// Descrição obrigatória, como nos anexos do cliente: sem ela isto vira uma
// pilha de arquivos sem significado meses depois. Miniatura e abertura por URL
// assinada, que expira — por isso as URLs são refeitas a cada carga.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, ExternalLink, FileText, FolderOpen, Loader2, Trash2, Upload } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import * as svc from '@/services/anexosVendedor';
import type { AnexoVendedor, CategoriaAnexoVendedor } from '@/services/anexosVendedor';
import { formatarDataHoraCurto } from '@/utils/dateFormat';

const fmtTamanho = (b?: number | null) =>
  !b ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const ROTULO = Object.fromEntries(svc.CATEGORIAS_ANEXO_VENDEDOR.map((c) => [c.valor, c.rotulo])) as Record<string, string>;

export function AnexosVendedor({ vendedorId }: { vendedorId: string }) {
  const { profile } = useUser();
  const [itens, setItens] = useState<AnexoVendedor[]>([]);
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [categoria, setCategoria] = useState<CategoriaAnexoVendedor>('DOCUMENTO');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await svc.listar(vendedorId);
      setItens(lista);
      const pares = await Promise.all(
        lista
          .filter((a) => a.mime_type?.startsWith('image/'))
          .map(async (a) => [a.id, await svc.urlAssinada(a.storage_path)] as const)
      );
      setMiniaturas(Object.fromEntries(pares.filter(([, u]) => !!u)) as Record<string, string>);
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível carregar os anexos.');
    } finally {
      setCarregando(false);
    }
  }, [vendedorId]);

  useEffect(() => { carregar(); }, [carregar]);

  const enviar = async () => {
    if (!arquivo) return;
    setEnviando(true);
    setErro(null);
    try {
      await svc.enviar({
        vendedorId, file: arquivo, categoria, descricao,
        enviadoPorNome: (profile as any)?.nome ?? null,
      });
      setArquivo(null);
      setDescricao('');
      if (inputRef.current) inputRef.current.value = '';
      await carregar();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível enviar o anexo.');
    } finally {
      setEnviando(false);
    }
  };

  // A janela abre NO CLIQUE e recebe o endereço depois: aberta só após o
  // `await`, o bloqueador de pop-up do navegador a recusaria.
  const abrir = async (a: AnexoVendedor, baixar = false) => {
    const janela = window.open('about:blank', '_blank');
    const url = await svc.urlAssinada(a.storage_path, baixar ? (a.nome_arquivo || 'anexo') : undefined);
    if (url && janela) {
      janela.opener = null;
      janela.location.href = url;
    } else {
      janela?.close();
      setErro('Não foi possível abrir o arquivo.');
    }
  };

  const remover = async (a: AnexoVendedor) => {
    if (!window.confirm(`Excluir o anexo "${a.descricao}"?`)) return;
    try {
      await svc.remover(a);
      await carregar();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível excluir o anexo.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Envio */}
      <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="anexo-vend-arquivo" className="block text-sm font-medium text-gray-700 mb-1">Arquivo</label>
            <input
              id="anexo-vend-arquivo"
              ref={inputRef}
              type="file"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-[11px] text-gray-400 mt-1">Foto, PDF ou outro documento, até 10 MB.</p>
          </div>
          <div>
            <label htmlFor="anexo-vend-categoria" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              id="anexo-vend-categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaAnexoVendedor)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
            >
              {svc.CATEGORIAS_ANEXO_VENDEDOR.map((c) => (
                <option key={c.valor} value={c.valor}>{c.rotulo}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            id="anexo-vend-descricao"
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (ex.: RG frente e verso, contrato assinado em 10/11)"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={!arquivo || !descricao.trim() || enviando}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Enviar
          </button>
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {erro}
        </div>
      )}

      {/* Lista */}
      {carregando ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
      ) : itens.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <FolderOpen className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">Nenhum anexo para este vendedor.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
          {itens.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3 bg-white">
              <button
                type="button"
                onClick={() => abrir(a)}
                className="w-12 h-12 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center"
                title="Abrir"
              >
                {miniaturas[a.id]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={miniaturas[a.id]} alt="" className="w-full h-full object-cover" />
                  : <FileText className="w-5 h-5 text-gray-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate">{a.descricao}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                    {ROTULO[a.categoria] || a.categoria}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {[a.nome_arquivo, fmtTamanho(a.tamanho_bytes), formatarDataHoraCurto(a.created_at), a.enviado_por_nome]
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" onClick={() => abrir(a)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg" title="Abrir">
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => abrir(a, true)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg" title="Baixar">
                  <Download className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => remover(a)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
