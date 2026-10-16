'use client';

/**
 * Pergunta o motivo antes de suspender (ou reativar) um cliente.
 *
 * Existe porque o `window.confirm` que estava aqui não tem onde digitar, e
 * o pedido do Julio em 23/09/2026 é justamente guardar o motivo junto da
 * data. A exigência de verdade está no banco — `fn_definir_status_cliente`
 * recusa SUSPENDER com motivo vazio —, e esta tela só evita a ida inútil
 * ao servidor. Se a recusa vier de lá mesmo assim, a mensagem do Postgres
 * aparece como está: ela é escrita para ser lida.
 */

import { useState } from 'react';
import { X, Ban, RotateCcw, Loader2, AlertCircle } from 'lucide-react';

interface ModalSuspenderClienteProps {
  isOpen: boolean;
  acao: 'SUSPENDER' | 'REATIVAR';
  clienteNome: string;
  onClose: () => void;
  /** Resolve quando o banco confirmou. Lançar erro mantém o modal aberto. */
  onConfirmar: (motivo: string) => Promise<void>;
}

export function ModalSuspenderCliente({
  isOpen,
  acao,
  clienteNome,
  onClose,
  onConfirmar,
}: ModalSuspenderClienteProps) {
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!isOpen) return null;

  const suspender = acao === 'SUSPENDER';
  // Motivo obrigatório só ao suspender: o status de volta é calculado
  // pelos empréstimos do cliente, não declarado por quem clica.
  const faltaMotivo = suspender && !motivo.trim();

  const handleConfirmar = async () => {
    if (faltaMotivo) return;
    setSalvando(true);
    setErro(null);
    try {
      await onConfirmar(motivo.trim());
      setMotivo('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro(msg || 'Não foi possível alterar o status do cliente.');
    } finally {
      setSalvando(false);
    }
  };

  const handleFechar = () => {
    if (salvando) return;
    setMotivo('');
    setErro(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Cabeçalho */}
        <div className={`flex items-center justify-between px-5 py-4 ${
          suspender ? 'bg-red-50' : 'bg-green-50'
        }`}>
          <div className="flex items-center gap-2">
            {suspender
              ? <Ban className="w-5 h-5 text-red-600" />
              : <RotateCcw className="w-5 h-5 text-green-600" />}
            <h3 className={`font-semibold ${suspender ? 'text-red-800' : 'text-green-800'}`}>
              {suspender ? 'Suspender cliente' : 'Reativar cliente'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleFechar}
            disabled={salvando}
            className="p-1 rounded-md hover:bg-black/5 disabled:opacity-50"
            title="Fechar"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Corpo */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-700">
            {suspender ? (
              <>
                <span className="font-semibold">{clienteNome}</span> ficará marcado
                como SUSPENSO até ser reativado. O app do vendedor passa a bloquear
                renovação e novo empréstimo para ele.
              </>
            ) : (
              <>
                <span className="font-semibold">{clienteNome}</span> volta a ATIVO ou
                INATIVO conforme os empréstimos dele.
              </>
            )}
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo {suspender
                ? <span className="text-red-600">*</span>
                : <span className="text-xs font-normal text-gray-400">(opcional)</span>}
            </label>
            <textarea
              id="motivo-status-cliente"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              autoFocus
              disabled={salvando}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
              placeholder={suspender
                ? 'Ex.: cliente mudou de endereço sem avisar; sem contato há 15 dias'
                : 'Ex.: cliente regularizou a situação'}
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Fica no histórico do cliente, com a data e o seu nome.
            </p>
          </div>

          {erro && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            onClick={handleFechar}
            disabled={salvando}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={salvando || faltaMotivo}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
              suspender ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
            title={faltaMotivo ? 'Informe o motivo da suspensão' : undefined}
          >
            {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
            {suspender ? 'Suspender' : 'Reativar'}
          </button>
        </div>
      </div>
    </div>
  );
}
