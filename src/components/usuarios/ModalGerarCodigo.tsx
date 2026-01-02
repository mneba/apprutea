'use client';

import { useState } from 'react';
import { X, Key, Copy, Check, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { usuariosService } from '@/services/usuarios';
import type { UserProfile } from '@/types/database';

interface Props {
  usuario: UserProfile;
  onClose: () => void;
  onSave: () => void;
}

export function ModalGerarCodigo({ usuario, onClose, onSave }: Props) {
  const [codigo, setCodigo] = useState(usuario.token_acesso || '');
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Gerar código usando RPC do Supabase
  const gerarCodigo = async () => {
    setGerando(true);
    try {
      const novoCodigo = await usuariosService.gerarCodigoAcesso(usuario.user_id);
      setCodigo(novoCodigo);
      setCopiado(false);
    } catch (err) {
      console.error('Erro ao gerar código:', err);
      alert('Erro ao gerar código. Tente novamente.');
    } finally {
      setGerando(false);
    }
  };

  // Copiar para clipboard
  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  // O código já é salvo automaticamente pela function gerarCodigoAcesso
  // Este botão apenas fecha o modal após gerar
  const handleConcluir = () => {
    if (!codigo) {
      alert('Gere um código primeiro');
      return;
    }
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Código de Acesso</h2>
              <p className="text-sm text-gray-500">{usuario.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Info do usuário */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Telefone:</span>
              <span className="text-sm font-medium text-gray-700">
                {usuario.telefone || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Empresa:</span>
              <span className="text-sm font-medium text-gray-700">
                {usuario.empresa_pretendida || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Status:</span>
              <span
                className={`text-sm font-medium ${
                  usuario.status === 'APROVADO'
                    ? 'text-green-600'
                    : usuario.status === 'PENDENTE'
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {usuario.status}
              </span>
            </div>
          </div>

          {/* Código */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Código de Acesso
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={codigo}
                  readOnly
                  placeholder="Clique em gerar"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-center text-xl tracking-widest font-mono uppercase"
                />
              </div>
              <button
                onClick={gerarCodigo}
                disabled={gerando}
                className="px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Gerar novo código"
              >
                {gerando ? (
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                ) : (
                  <RefreshCw className="w-5 h-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={copiarCodigo}
                disabled={!codigo}
                className="px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                title="Copiar código"
              >
                {copiado ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Formato: TK + 6 dígitos (gerado automaticamente pelo sistema)
            </p>
          </div>

          {/* Aviso */}
          {usuario.token_acesso && codigo !== usuario.token_acesso && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700">
                ✓ Novo código gerado e salvo com sucesso!
              </p>
            </div>
          )}

          {usuario.token_acesso && codigo === usuario.token_acesso && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                Este é o código atual do usuário. Clique no botão de refresh para gerar um novo.
              </p>
            </div>
          )}

          {/* Status de validação */}
          {usuario.token_validado && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700">
                ✓ O usuário já validou seu código de acesso e está ativo no sistema.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleConcluir}
            disabled={!codigo}
            icon={<Key className="w-4 h-4" />}
          >
            Concluir
          </Button>
        </div>
      </div>
    </div>
  );
}
