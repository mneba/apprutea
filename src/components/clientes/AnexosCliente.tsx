'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  FolderOpen,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import * as anexosSvc from '@/services/anexos';
import type { Anexo } from '@/services/anexos';

// ─────────────────────────────────────────────────────────────────────────────
// Anexos (evidências) de um cliente ou de um pagamento — versão web.
//
// A descrição é digitada pelo usuário: lista livre, sem tipos fixos, e
// obrigatória — sem ela isso vira uma pilha de fotos sem significado meses
// depois. As miniaturas usam URL assinada, que expira; por isso o mapa de URLs
// é remontado a cada carga e nunca persistido.
// ─────────────────────────────────────────────────────────────────────────────

interface AnexosClienteProps {
  clienteId: string;
  /** Ausente = documentos do cliente. Presente = comprovantes do pagamento. */
  pagamentoId?: string | null;
  enviadoPor?: string | null;
  enviadoPorNome?: string | null;
  /** false esconde enviar/remover (visualização apenas). */
  podeEditar?: boolean;
}

const fmtTamanho = (b?: number | null) =>
  !b ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const fmtQuando = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} · ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export function AnexosCliente({
  clienteId,
  pagamentoId = null,
  enviadoPor = null,
  enviadoPorNome = null,
  podeEditar = true,
}: AnexosClienteProps) {
  const [itens, setItens] = useState<Anexo[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [visualizando, setVisualizando] = useState<string | null>(null);
  const [aRemover, setARemover] = useState<Anexo | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setCarregando(true);
    setErro(null);
    try {
      const lista = pagamentoId
        ? await anexosSvc.listarDoPagamento(pagamentoId)
        : await anexosSvc.listarDoCliente(clienteId);
      setItens(lista);

      const pares = await Promise.all(
        lista.map(async (a) => [a.id, await anexosSvc.urlAssinada(a.storage_path)] as const)
      );
      const mapa: Record<string, string> = {};
      for (const [id, url] of pares) if (url) mapa[id] = url;
      setUrls(mapa);
    } catch (e: unknown) {
      console.error('❌ [AnexosCliente] carregar:', e);
      setErro(e instanceof Error ? e.message : 'Falha ao carregar anexos.');
    } finally {
      setCarregando(false);
    }
  }, [clienteId, pagamentoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // A prévia é um object URL: precisa ser revogado, senão vaza memória a cada
  // arquivo escolhido.
  useEffect(() => {
    if (!arquivo) {
      setPrevia(null);
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setArquivo(f);
      setDescricao('');
      setErro(null);
    }
    // Limpa para permitir escolher o mesmo arquivo de novo
    if (inputRef.current) inputRef.current.value = '';
  };

  const confirmarEnvio = async () => {
    if (!arquivo || !descricao.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await anexosSvc.enviar({
        clienteId,
        pagamentoId,
        file: arquivo,
        descricao,
        enviadoPor,
        enviadoPorNome,
      });
      setArquivo(null);
      setDescricao('');
      await carregar();
    } catch (e: unknown) {
      console.error('❌ [AnexosCliente] enviar:', e);
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const confirmarRemocao = async () => {
    const alvo = aRemover;
    setARemover(null);
    if (!alvo) return;
    try {
      await anexosSvc.remover(alvo);
      await carregar();
    } catch (e: unknown) {
      console.error('❌ [AnexosCliente] remover:', e);
      setErro(e instanceof Error ? e.message : 'Falha ao remover.');
    }
  };

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
        Documentos e evidências
      </h3>

      {erro && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {carregando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : itens.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-10 text-center">
          <FolderOpen className="w-9 h-9 text-gray-300" />
          <p className="text-sm font-semibold text-gray-500">Nenhum anexo enviado</p>
          <p className="text-xs text-gray-400">
            Comprovante de endereço, documento, foto do local ou do negócio.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {itens.map((a) => (
            <div key={a.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5">
              <button
                type="button"
                onClick={() => urls[a.id] && setVisualizando(urls[a.id])}
                className="shrink-0"
              >
                {urls[a.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[a.id]}
                    alt={a.descricao}
                    className="w-14 h-14 rounded-lg object-cover bg-gray-200"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gray-200 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-gray-400" />
                  </div>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{a.descricao}</p>
                <p className="text-xs text-gray-400">
                  {fmtQuando(a.created_at)}
                  {a.tamanho_bytes ? ` · ${fmtTamanho(a.tamanho_bytes)}` : ''}
                </p>
                {a.enviado_por_nome && (
                  <p className="text-xs text-gray-400 truncate">por {a.enviado_por_nome}</p>
                )}
              </div>

              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setARemover(a)}
                  className="shrink-0 w-9 h-9 rounded-lg bg-red-50 text-red-700 flex items-center justify-center hover:bg-red-100 transition-colors"
                  title="Remover anexo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {podeEditar && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={escolher}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Adicionar anexo
          </button>
        </>
      )}

      {/* Descrição + confirmação do envio */}
      {arquivo && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-5 w-full max-w-md">
            <h4 className="text-base font-bold text-gray-800 mb-3">O que é este anexo?</h4>
            {previa && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previa} alt="Prévia" className="w-full h-40 object-cover rounded-lg bg-gray-100 mb-3" />
            )}
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Comprovante de endereço"
              disabled={enviando}
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setArquivo(null)}
                disabled={enviando}
                className="flex-1 py-3 rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEnvio}
                disabled={!descricao.trim() || enviando}
                className="flex-1 py-3 rounded-lg bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:bg-gray-300"
              >
                {enviando ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualização */}
      {visualizando && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setVisualizando(null)}
        >
          <button
            type="button"
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center"
            onClick={() => setVisualizando(null)}
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={visualizando}
            alt="Anexo"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Confirmação de remoção */}
      {aRemover && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
            <h4 className="text-base font-bold text-gray-800 mb-2">Remover anexo</h4>
            <p className="text-sm text-gray-600 mb-1">{aRemover.descricao}</p>
            <p className="text-sm text-gray-500 mb-5">Este anexo será apagado definitivamente.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setARemover(null)}
                className="flex-1 py-3 rounded-lg bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarRemocao}
                className="flex-1 py-3 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
