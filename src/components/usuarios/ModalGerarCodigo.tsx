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

  // Gerar código aleatório
  const gerarCodigo = () => {
    setGerando(true);
    // Gerar código de 8 caracteres alfanumérico
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let novoCodigo = '';
    for (let i = 0; i < 8; i++) {
      novoCodigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    setCodigo(novoCodigo);
    setGerando(false);
    setCopiado(false);
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

  // Salvar código
  const handleSalvar = async () => {
    if (!codigo) {
      alert('Gere um código primeiro');
      return;
    }

    setSalvando(true);
    try {
      await usuariosService.salvarCodigoAcesso(usuario.user_id, codigo);
      onSave();
    } catch (err) {
      console.error('Erro ao salvar código:', err);
      alert('Erro ao salvar código. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
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
              <span className="text-sm font-medium text-gray-700">{usuario.telefone || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Empresa:</span>
              <span className="text-sm font-medium text-gray-700">{usuario.empresa_pretendida || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Status:</span>
              <span className={`text-sm font-medium ${
                usuario.status === 'APROVADO' ? 'text-green-600' : 
                usuario.status === 'PENDENTE' ? 'text-yellow-600' : 'text-red-600'
              }`}>
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
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Gere ou digite um código"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 text-center text-xl tracking-widest font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={8}
                />
              </div>
              <button
                onClick={gerarCodigo}
                disabled={gerando}
                className="px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                title="Gerar novo código"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 ${gerando ? 'animate-spin' : ''}`} />
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
          </div>

          {/* Aviso */}
          {usuario.token_acesso && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-700">
                <strong>Atenção:</strong> Este usuário já possui um código de acesso. 
                Ao salvar um novo código, o anterior será substituído.
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
            onClick={handleSalvar} 
            loading={salvando}
            disabled={!codigo}
            icon={<Key className="w-4 h-4" />}
          >
            Salvar Código
          </Button>
        </div>
      </div>
    </div>
  );
}
