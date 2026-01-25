'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Loader2, User, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface FotoClienteUploadProps {
  clienteId?: string;
  fotoUrl?: string | null;
  onFotoChange: (url: string | null) => void;
  disabled?: boolean;
  tamanho?: 'sm' | 'md' | 'lg';
}

const TAMANHOS = {
  sm: { container: 'w-16 h-16', icone: 'w-6 h-6', botao: 'text-xs' },
  md: { container: 'w-20 h-20', icone: 'w-8 h-8', botao: 'text-sm' },
  lg: { container: 'w-24 h-24', icone: 'w-10 h-10', botao: 'text-sm' },
};

export function FotoClienteUpload({
  clienteId,
  fotoUrl,
  onFotoChange,
  disabled = false,
  tamanho = 'md',
}: FotoClienteUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(fotoUrl || null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const config = TAMANHOS[tamanho];

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setErro('Selecione um arquivo de imagem válido');
      return;
    }

    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErro('A imagem deve ter no máximo 5MB');
      return;
    }

    setErro(null);
    setUploading(true);

    try {
      const supabase = createClient();
      
      // Gerar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `${clienteId || 'temp'}-${Date.now()}.${fileExt}`;
      const filePath = `clientes/${fileName}`;

      // Fazer upload para o Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('fotos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        // Se o bucket não existir, tentar criar
        if (uploadError.message.includes('not found')) {
          setErro('Bucket de fotos não configurado. Configure o Storage no Supabase.');
        } else {
          throw uploadError;
        }
        return;
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('fotos')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;
      
      // Atualizar preview e notificar componente pai
      setPreviewUrl(publicUrl);
      onFotoChange(publicUrl);

      // Se tinha foto anterior, deletar (opcional)
      if (fotoUrl && fotoUrl.includes('fotos/clientes/')) {
        const oldPath = fotoUrl.split('fotos/')[1];
        if (oldPath) {
          await supabase.storage.from('fotos').remove([oldPath]);
        }
      }

    } catch (error) {
      console.error('Erro no upload:', error);
      setErro('Erro ao fazer upload da imagem');
    } finally {
      setUploading(false);
      // Limpar input para permitir selecionar o mesmo arquivo novamente
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemoverFoto = async () => {
    if (!previewUrl) return;

    setUploading(true);
    try {
      const supabase = createClient();
      
      // Deletar do Storage se for uma URL do Supabase
      if (previewUrl.includes('fotos/clientes/')) {
        const path = previewUrl.split('fotos/')[1];
        if (path) {
          await supabase.storage.from('fotos').remove([path]);
        }
      }

      setPreviewUrl(null);
      onFotoChange(null);
    } catch (error) {
      console.error('Erro ao remover foto:', error);
      setErro('Erro ao remover foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Preview da Foto */}
      <div className={`relative ${config.container}`}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Foto do cliente"
            className={`${config.container} rounded-full object-cover border-2 border-gray-200`}
          />
        ) : (
          <div className={`${config.container} rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200`}>
            <User className={`${config.icone} text-gray-400`} />
          </div>
        )}

        {/* Overlay de loading */}
        {uploading && (
          <div className={`absolute inset-0 ${config.container} rounded-full bg-black/50 flex items-center justify-center`}>
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}

        {/* Botão de remover (se tem foto) */}
        {previewUrl && !disabled && !uploading && (
          <button
            type="button"
            onClick={handleRemoverFoto}
            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors shadow-md"
            title="Remover foto"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Botões de Ação */}
      {!disabled && (
        <div className="flex gap-2">
          <label
            className={`flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer ${config.botao} ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Camera className="w-4 h-4" />
            {previewUrl ? 'Trocar' : 'Adicionar'}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading || disabled}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Mensagem de erro */}
      {erro && (
        <p className="text-xs text-red-500 text-center">{erro}</p>
      )}

      {/* Input hidden para URL manual (fallback) */}
      <input type="hidden" value={previewUrl || ''} />
    </div>
  );
}

// =====================================================
// COMPONENTE THUMBNAIL PARA LISTAGEM
// =====================================================

interface FotoClienteThumbnailProps {
  fotoUrl?: string | null;
  nome: string;
  tamanho?: 'xs' | 'sm' | 'md';
  className?: string;
}

const TAMANHOS_THUMB = {
  xs: { container: 'w-8 h-8', texto: 'text-xs' },
  sm: { container: 'w-10 h-10', texto: 'text-sm' },
  md: { container: 'w-12 h-12', texto: 'text-base' },
};

export function FotoClienteThumbnail({
  fotoUrl,
  nome,
  tamanho = 'sm',
  className = '',
}: FotoClienteThumbnailProps) {
  const config = TAMANHOS_THUMB[tamanho];
  const inicial = nome?.charAt(0)?.toUpperCase() || '?';

  if (fotoUrl) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        className={`${config.container} rounded-full object-cover border border-gray-200 ${className}`}
        onError={(e) => {
          // Se a imagem falhar ao carregar, mostra inicial
          (e.target as HTMLImageElement).style.display = 'none';
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div
      className={`${config.container} rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium ${config.texto} ${className}`}
    >
      {inicial}
    </div>
  );
}

// =====================================================
// COMPONENTE AVATAR COM FALLBACK
// =====================================================

interface AvatarClienteProps {
  fotoUrl?: string | null;
  nome: string;
  tamanho?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  corFundo?: string;
}

const TAMANHOS_AVATAR = {
  xs: { container: 'w-6 h-6', texto: 'text-[10px]' },
  sm: { container: 'w-8 h-8', texto: 'text-xs' },
  md: { container: 'w-10 h-10', texto: 'text-sm' },
  lg: { container: 'w-14 h-14', texto: 'text-lg' },
  xl: { container: 'w-20 h-20', texto: 'text-2xl' },
};

export function AvatarCliente({
  fotoUrl,
  nome,
  tamanho = 'md',
  className = '',
  corFundo = 'bg-blue-100 text-blue-700',
}: AvatarClienteProps) {
  const [imageError, setImageError] = useState(false);
  const config = TAMANHOS_AVATAR[tamanho];
  const inicial = nome?.charAt(0)?.toUpperCase() || '?';

  if (fotoUrl && !imageError) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        className={`${config.container} rounded-full object-cover border-2 border-white shadow-sm ${className}`}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={`${config.container} rounded-full ${corFundo} flex items-center justify-center font-semibold ${config.texto} ${className}`}
    >
      {inicial}
    </div>
  );
}
