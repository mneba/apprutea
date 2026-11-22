import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// ANEXOS DO VENDEDOR — repositório geral (22/11/2026)
//
// Documento, contrato, comprovante, foto… do vendedor, guardados pela
// administração. Ver sql/2026-11-22_anexos_do_vendedor.sql.
//
// Mesmo bucket PRIVADO dos anexos do cliente (`documentos`), exibição só por
// URL assinada. O caminho carrega o vendedor_id no 2º segmento porque é isso
// que a policy do storage lê — mudar o formato quebra a PERMISSÃO:
//   documentos/vendedores/{vendedor_id}/{uuid}.{ext}
//
// Só a administração vê e envia (RLS + storage). O vendedor não vê pelo app.
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = 'documentos';

/** O limite do bucket. Imagem é reduzida antes; o resto sobe como veio. */
export const TAMANHO_MAX_BYTES = 10 * 1024 * 1024;

const LADO_MAX_PX = 1600;
const VALIDADE_URL_SEG = 300;

export type CategoriaAnexoVendedor = 'DOCUMENTO' | 'COMPROVANTE_ENDERECO' | 'CONTRATO' | 'FOTO' | 'OUTRO';

export const CATEGORIAS_ANEXO_VENDEDOR: { valor: CategoriaAnexoVendedor; rotulo: string }[] = [
  { valor: 'DOCUMENTO', rotulo: 'Documento pessoal' },
  { valor: 'COMPROVANTE_ENDERECO', rotulo: 'Comprovante de endereço' },
  { valor: 'CONTRATO', rotulo: 'Contrato' },
  { valor: 'FOTO', rotulo: 'Foto' },
  { valor: 'OUTRO', rotulo: 'Outro' },
];

export interface AnexoVendedor {
  id: string;
  vendedor_id: string;
  categoria: CategoriaAnexoVendedor;
  descricao: string;
  nome_arquivo: string | null;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  enviado_por_nome: string | null;
  created_at: string;
}

/** Reduz imagem no browser (canvas), sem dependência nova. */
async function reduzirImagem(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.75));
  if (!blob) throw new Error('Não foi possível processar a imagem.');
  return blob;
}

export async function listar(vendedorId: string): Promise<AnexoVendedor[]> {
  const { data, error } = await createClient()
    .from('vendedor_anexos')
    .select('*')
    .eq('vendedor_id', vendedorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as AnexoVendedor[];
}

export async function urlAssinada(storagePath: string, baixarComo?: string): Promise<string | null> {
  const { data, error } = await createClient()
    .storage.from(BUCKET)
    .createSignedUrl(storagePath, VALIDADE_URL_SEG, baixarComo ? { download: baixarComo } : undefined);
  if (error) {
    console.error('❌ [anexos vendedor] URL assinada:', error);
    return null;
  }
  return data?.signedUrl ?? null;
}

interface EnviarParams {
  vendedorId: string;
  file: File;
  categoria: CategoriaAnexoVendedor;
  descricao: string;
  enviadoPorNome?: string | null;
}

export async function enviar({ vendedorId, file, categoria, descricao, enviadoPorNome = null }: EnviarParams): Promise<AnexoVendedor> {
  const supabase = createClient();
  const desc = descricao.trim();
  if (!desc) throw new Error('Descreva o que é este anexo.');

  // Imagem (menos GIF/SVG) é reduzida e vira JPG; o resto sobe como veio.
  const ehImagem = file.type.startsWith('image/') && !/gif|svg/.test(file.type);
  const corpo: Blob = ehImagem ? await reduzirImagem(file) : file;
  if (corpo.size > TAMANHO_MAX_BYTES) {
    throw new Error(`Arquivo muito grande (${(corpo.size / 1024 / 1024).toFixed(1)} MB). Máximo 10 MB.`);
  }
  const tipo = ehImagem ? 'image/jpeg' : (file.type || 'application/octet-stream');
  const ext = ehImagem ? 'jpg' : ((file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin');
  const path = `vendedores/${vendedorId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, corpo, { contentType: tipo, upsert: false });
  if (upErr) {
    console.error('❌ [anexos vendedor] upload:', upErr);
    throw upErr;
  }

  const { data, error } = await supabase
    .from('vendedor_anexos')
    .insert({
      vendedor_id: vendedorId,
      categoria,
      descricao: desc,
      nome_arquivo: file.name,
      storage_path: path,
      mime_type: tipo,
      tamanho_bytes: corpo.size,
      enviado_por_nome: enviadoPorNome,
    })
    .select()
    .single();

  if (error) {
    // O arquivo já subiu e ficaria órfão no bucket.
    await supabase.storage.from(BUCKET).remove([path]);
    console.error('❌ [anexos vendedor] insert:', error);
    throw error;
  }
  return data as AnexoVendedor;
}

export async function remover(anexo: AnexoVendedor): Promise<void> {
  const supabase = createClient();
  // Registro primeiro: sem ele o arquivo é inalcançável de qualquer forma.
  const { error } = await supabase.from('vendedor_anexos').delete().eq('id', anexo.id);
  if (error) throw error;
  const { error: stErr } = await supabase.storage.from(BUCKET).remove([anexo.storage_path]);
  if (stErr) console.error('⚠️ [anexos vendedor] registro removido, arquivo permaneceu:', stErr);
}
