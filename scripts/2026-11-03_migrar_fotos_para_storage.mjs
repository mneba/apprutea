// =====================================================================
// Migra as fotos de cliente que estão em base64 na coluna para o Storage
// =====================================================================
//
// POR QUE UM SCRIPT E NÃO UM .sql: o arquivo do Storage vive no S3, não no
// Postgres. Não existe função SQL que grave um objeto no bucket, então a
// migração tem de passar por um cliente da API com a service role.
//
// Mora em `apprutea/scripts/` e não em `sql/` porque precisa resolver
// `@supabase/supabase-js`, que está no `node_modules` deste projeto.
//
// O QUE ELE FAZ, por cliente:
//   1. lê `foto_url` (um por vez -- juntos são 24 MB);
//   2. decodifica o base64 e sobe para `fotos/clientes/<id>.<ext>`;
//   3. CONFERE que a URL pública responde 200 e com o mesmo tamanho;
//   4. só então troca a coluna pela URL.
//
// O passo 3 não é zelo: entre "o upload não deu erro" e "a imagem abre"
// cabe bucket privado, política de RLS no Storage e caminho errado. Como
// o passo 4 APAGA a única cópia da imagem, conferir antes é o que separa
// migração de perda de dado.
//
// ANTES DE RODAR: `sql/2026-11-03_backup_fotos_base64.sql`, e confira que
// ele gravou 113 linhas. Sem backup, não rode.
//
// COMO RODAR, de dentro de `apprutea/`:
//
//   # 1. simulação (não escreve nada) -- é o padrão
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/2026-11-03_migrar_fotos_para_storage.mjs
//
//   # 2. valendo
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/2026-11-03_migrar_fotos_para_storage.mjs --aplicar
//
// No PowerShell, `VAR=valor cmd` não existe -- use `$env:VAR = '...'` antes.
//
// É IDEMPOTENTE E RETOMÁVEL: trabalha só sobre quem ainda está em base64.
// Se parar no meio, rode de novo; quem já migrou não é tocado.
// =====================================================================

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APLICAR = process.argv.includes('--aplicar');
const BUCKET = 'fotos';
// Nao vai para o git: `apprutea/.gitignore` so tem `node_modules`, entao
// esta pasta aparece no `git status` com 24 MB. Guarde fora do repo depois
// de conferir, ou acrescente ao .gitignore.
const PASTA = '_fotos_base64_20261103';

if (!URL || !KEY) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('A service role NÃO vai em argumento de linha de comando: fica no histórico do shell.');
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

const fmt = (n) => (n / 1024).toFixed(0).padStart(5) + ' kB';

async function main() {
  console.log(APLICAR ? '>> VALENDO: vai escrever.' : '>> SIMULAÇÃO: não escreve nada. Use --aplicar para valer.');

  // Só os ids. Trazer `foto_url` de todos de uma vez são 24 MB numa
  // resposta só -- que é exatamente o problema que este script conserta.
  const { data: alvos, error: erroLista } = await db
    .from('clientes')
    .select('id, nome')
    .like('foto_url', 'data:%')
    .order('id');

  if (erroLista) { console.error('Erro ao listar:', erroLista.message); process.exit(1); }
  console.log(`${alvos.length} cliente(s) com foto em base64.`);

  // ⚠ CADA IMAGEM É GRAVADA EM DISCO ANTES DE A COLUNA SER TROCADA.
  //
  // Este script APAGA a única cópia da imagem, e a tabela de backup PODE
  // ESTAR DESATUALIZADA: enquanto a build 1.1.92 não sai, o app segue
  // gravando base64 a cada cliente novo, então o conjunto cresce entre o
  // backup e a migração. Aconteceu na primeira execução, em 03/11/2026 --
  // o backup pegou 113 e a simulação achou 114, porque entrou uma foto às
  // 19:36, depois do backup.
  //
  // Conferir contra a tabela não resolveria com segurança: a tabela vive no
  // schema `backup`, que o PostgREST não expõe, então o script nem consegue
  // lê-la. Gravar o arquivo aqui resolve sem depender de nada -- e é a
  // cópia mais útil das duas, porque já é a imagem, não o base64.
  if (APLICAR) {
    await mkdir(PASTA, { recursive: true });
    console.log(`Cópia local de segurança em: ${PASTA}`);
  }
  console.log('');

  let ok = 0, pulados = 0, falhas = 0, bytesAntes = 0;

  for (const [i, cliente] of alvos.entries()) {
    const rotulo = `[${String(i + 1).padStart(3)}/${alvos.length}] ${cliente.nome.slice(0, 32).padEnd(32)}`;

    // Relê a foto agora, individualmente. Se outro processo já migrou este
    // cliente entre a listagem e aqui, o `startsWith` abaixo o descarta.
    const { data: linha, error: erroLeitura } = await db
      .from('clientes').select('foto_url').eq('id', cliente.id).single();
    if (erroLeitura || !linha?.foto_url?.startsWith('data:')) {
      console.log(`${rotulo} pulado (já não é base64)`);
      pulados++;
      continue;
    }

    const casa = linha.foto_url.match(/^data:([^;]+);base64,(.*)$/s);
    if (!casa) { console.log(`${rotulo} FALHA: data URL malformada`); falhas++; continue; }

    const bytes = Buffer.from(casa[2], 'base64');
    bytesAntes += linha.foto_url.length;

    // A extensão sai dos BYTES, não do rótulo. Há 7 registros gravados como
    // `image/png` cujo conteúdo começa em `/9j/`, que é assinatura de JPEG:
    // o `mimeType` do ImagePicker foi repassado sem conferência. Gravar .png
    // com bytes de JPEG funciona na maioria dos visualizadores e quebra em
    // alguns, então aqui quem manda é o arquivo.
    const ehPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const ext = ehPng ? 'png' : 'jpg';
    const tipo = ehPng ? 'image/png' : 'image/jpeg';
    const caminho = `clientes/${cliente.id}.${ext}`;

    if (!APLICAR) {
      console.log(`${rotulo} ${fmt(bytes.length)} -> ${caminho} (${tipo}, rótulo dizia ${casa[1]})`);
      ok++;
      continue;
    }

    // Disco PRIMEIRO. Se a maquina ficar sem espaco ou a pasta nao puder
    // ser escrita, nada e migrado -- e o certo: sem copia, nao se apaga.
    try {
      await writeFile(join(PASTA, `${cliente.id}.${ext}`), bytes);
    } catch (e) {
      console.log(`${rotulo} FALHA ao gravar copia local: ${e.message} -- NAO migrado`);
      falhas++;
      continue;
    }

    const { error: erroUpload } = await db.storage
      .from(BUCKET).upload(caminho, bytes, { contentType: tipo, upsert: true });
    if (erroUpload) { console.log(`${rotulo} FALHA no upload: ${erroUpload.message}`); falhas++; continue; }

    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(caminho);

    // CONFERÊNCIA antes de apagar a única cópia: a URL responde, e com o
    // mesmo tamanho. `content-length` ausente não reprova -- nem todo CDN
    // devolve -- mas divergente reprova.
    let resp;
    try { resp = await fetch(pub.publicUrl, { method: 'HEAD' }); }
    catch (e) { console.log(`${rotulo} FALHA: não deu para ler de volta (${e.message})`); falhas++; continue; }

    if (!resp.ok) { console.log(`${rotulo} FALHA: a URL devolveu ${resp.status} -- NÃO migrado`); falhas++; continue; }
    const tam = Number(resp.headers.get('content-length') || 0);
    if (tam && tam !== bytes.length) {
      console.log(`${rotulo} FALHA: subiu ${bytes.length} e voltou ${tam} -- NÃO migrado`);
      falhas++;
      continue;
    }

    const { error: erroUpdate } = await db
      .from('clientes').update({ foto_url: pub.publicUrl }).eq('id', cliente.id);
    if (erroUpdate) { console.log(`${rotulo} FALHA ao gravar a URL: ${erroUpdate.message}`); falhas++; continue; }

    console.log(`${rotulo} ${fmt(bytes.length)} -> ok`);
    ok++;
  }

  console.log(`\n${ok} migrado(s), ${pulados} pulado(s), ${falhas} falha(s).`);
  console.log(`Payload retirado das listas: ${(bytesAntes / 1024 / 1024).toFixed(1)} MB.`);
  if (falhas) {
    console.log('\nAs falhas NÃO perderam nada: a coluna só é trocada depois da conferência.');
    console.log('Rode de novo para tentar os que sobraram.');
  }
  if (!APLICAR) console.log('\nNada foi escrito. Rode com --aplicar depois de conferir a lista acima.');
}

main().catch((e) => { console.error(e); process.exit(1); });
