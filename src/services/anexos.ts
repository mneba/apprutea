import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// ANEXOS (evidências) — documentos do cliente e comprovantes de pagamento
//
// Espelho do serviço do app (apprutea_android/src/services/anexos.ts). Mesma
// tabela, mesmo bucket, mesmo formato de caminho — se um mudar, o outro tem
// que mudar junto.
//
// Bucket `documentos` é PRIVADO. Nada de `getPublicUrl`: foto de CPF e
// comprovante de endereço em URL pública ficam acessíveis para sempre a quem
// tiver o link. Exibição por URL assinada de validade curta.
//
// O caminho carrega o cliente_id no 2º segmento porque é isso que a policy do
// storage lê (fn_pode_acessar_anexo_path). Mudar o formato quebra a permissão,
// não só a organização das pastas.
//   documentos/clientes/{cliente_id}/{uuid}.jpg
//   documentos/pagamentos/{cliente_id}/{pagamento_id}/{uuid}.jpg
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = 'documentos';

/** Teto do arquivo ORIGINAL escolhido, antes do redimensionamento. */
export const TAMANHO_MAX_BYTES = 5 * 1024 * 1024;

/** Lado maior da imagem depois do redimensionamento. */
const LADO_MAX_PX = 1600;

/** Validade da URL assinada, em segundos. */
const VALIDADE_URL_SEG = 300;

export interface Anexo {
  id: string;
  cliente_id: string;
  pagamento_id: string | null;
  descricao: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  enviado_por_nome: string | null;
  created_at: string;
}

/**
 * Redimensiona e recomprime no browser, via canvas — sem dependência nova.
 * Uma foto de celular enviada pelo admin pesa o mesmo 3–8 MB que a do campo.
 */
async function prepararImagem(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.7)
  );
  if (!blob) throw new Error('Não foi possível processar a imagem.');
  return blob;
}

/** Documentos do cliente (não inclui comprovantes de pagamento). */
export async function listarDoCliente(clienteId: string): Promise<Anexo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('anexos')
    .select('*')
    .eq('cliente_id', clienteId)
    .is('pagamento_id', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Anexo[];
}

/** Comprovantes de um pagamento específico. */
export async function listarDoPagamento(pagamentoId: string): Promise<Anexo[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('anexos')
    .select('*')
    .eq('pagamento_id', pagamentoId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Anexo[];
}

/** URL temporária para exibir o arquivo. Expira em VALIDADE_URL_SEG. */
export async function urlAssinada(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, VALIDADE_URL_SEG);
  if (error) {
    console.error('❌ [anexos] URL assinada:', error);
    return null;
  }
  return data?.signedUrl ?? null;
}

interface EnviarParams {
  clienteId: string;
  /** Ausente = documento do cliente. Presente = comprovante daquele pagamento. */
  pagamentoId?: string | null;
  file: File;
  descricao: string;
  enviadoPor?: string | null;
  enviadoPorNome?: string | null;
}

export async function enviar({
  clienteId,
  pagamentoId = null,
  file,
  descricao,
  enviadoPor = null,
  enviadoPorNome = null,
}: EnviarParams): Promise<Anexo> {
  const supabase = createClient();

  const desc = descricao.trim();
  if (!desc) throw new Error('Descreva o que é este anexo.');
  if (!file.type.startsWith('image/')) throw new Error('Envie uma imagem (JPG ou PNG).');
  if (file.size > TAMANHO_MAX_BYTES) {
    throw new Error(
      `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo ${TAMANHO_MAX_BYTES / 1024 / 1024} MB.`
    );
  }

  const blob = await prepararImagem(file);
  const path = pagamentoId
    ? `pagamentos/${clienteId}/${pagamentoId}/${crypto.randomUUID()}.jpg`
    : `clientes/${clienteId}/${crypto.randomUUID()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) {
    console.error('❌ [anexos] upload:', upErr);
    throw upErr;
  }

  const { data, error } = await supabase
    .from('anexos')
    .insert({
      cliente_id: clienteId,
      pagamento_id: pagamentoId,
      descricao: desc,
      storage_path: path,
      mime_type: 'image/jpeg',
      tamanho_bytes: blob.size,
      enviado_por: enviadoPor,
      enviado_por_nome: enviadoPorNome,
    })
    .select()
    .single();

  if (error) {
    // Registro falhou: o arquivo já subiu e ficaria órfão no bucket.
    await supabase.storage.from(BUCKET).remove([path]);
    console.error('❌ [anexos] insert:', error);
    throw error;
  }

  return data as Anexo;
}

export async function remover(anexo: Anexo): Promise<void> {
  const supabase = createClient();

  // Registro primeiro: sem ele o arquivo é inalcançável de qualquer forma.
  // Na ordem inversa, uma falha ao apagar a linha deixaria um anexo listado
  // apontando para arquivo inexistente.
  const { error } = await supabase.from('anexos').delete().eq('id', anexo.id);
  if (error) throw error;

  const { error: stErr } = await supabase.storage.from(BUCKET).remove([anexo.storage_path]);
  if (stErr) console.error('⚠️ [anexos] registro removido, arquivo permaneceu:', stErr);
}
