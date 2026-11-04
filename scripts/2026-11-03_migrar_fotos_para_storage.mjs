// =====================================================================
// Fotos de cliente em base64 -> Storage. Dois modos.
// =====================================================================
//
// POR QUE UM SCRIPT E NAO UM .sql: o arquivo do Storage vive no S3, nao no
// Postgres. Nao existe funcao SQL que grave um objeto no bucket, entao a
// migracao tem de passar por um cliente da API com a service role.
//
// Mora em `apprutea/scripts/` e nao em `sql/` porque precisa resolver
// `@supabase/supabase-js`, que esta no `node_modules` deste projeto.
//
// ---------------------------------------------------------------------
// MODO 1 (padrao) -- a coluna `clientes.foto_url`
// ---------------------------------------------------------------------
// Feito em 03/11/2026: 114 clientes, 24,6 MB saindo do payload das
// listas. Por cliente: le `foto_url`, decodifica, grava copia local,
// sobe, CONFERE que a URL publica responde 200 com o mesmo tamanho, e so
// entao troca a coluna.
//
// O passo da conferencia nao e zelo: entre "o upload nao deu erro" e "a
// imagem abre" cabe bucket privado, politica de RLS no Storage e caminho
// errado. Como o passo seguinte APAGA a unica copia da imagem, conferir
// antes e o que separa migracao de perda de dado.
//
// ---------------------------------------------------------------------
// MODO 2 -- `--quarentena`, a partir de 04/11/2026
// ---------------------------------------------------------------------
// `sql/2026-11-03_guarda_contra_base64.sql` pos um gatilho na porta de
// `clientes.foto_url` e `vendas_pendentes.cliente_foto_url`: base64 que
// chega e desviado para a tabela `public.foto_quarentena` e a coluna fica
// `NULL`. A venda passa, nada se perde -- mas A FOTO NAO APARECE em tela
// nenhuma ate alguem drenar.
//
// Este modo e o dreno. **Ele existe porque build antiga e condicao
// duradoura, nao transicao**: em 04/11/2026, as 02:11:42, entrou um
// cliente com foto em base64 -- 2 minutos e 42 segundos ANTES de a guarda
// subir. Enquanto houver aparelho na 1.1.5 ou 1.1.91 em campo, a
// quarentena recebe, e este dreno tem de rodar de vez em quando.
//
// Por linha pendente (`drenado_em IS NULL`): decodifica, grava copia
// local, sobe, CONFERE com HEAD, devolve a URL para a coluna de ORIGEM
// (so se ela estiver vazia -- ver abaixo) e marca `drenado_em` + `url`.
//
// ---------------------------------------------------------------------
// COMO RODAR, de dentro de `apprutea/`
// ---------------------------------------------------------------------
//   # simulacao (nao escreve nada) -- e o padrao nos dois modos
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/2026-11-03_migrar_fotos_para_storage.mjs
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/2026-11-03_migrar_fotos_para_storage.mjs --quarentena
//
//   # valendo
//   ... --aplicar
//   ... --quarentena --aplicar
//
// No PowerShell, `VAR=valor cmd` nao existe -- use `$env:VAR = '...'`
// antes, nunca a chave em argumento de linha de comando (fica no
// historico do shell).
//
// OS DOIS MODOS SAO IDEMPOTENTES E RETOMAVEIS: trabalham so sobre o que
// ainda falta. Se pararem no meio, rode de novo.
// =====================================================================

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APLICAR = process.argv.includes('--aplicar');
const QUARENTENA = process.argv.includes('--quarentena');
const BUCKET = 'fotos';
// Nao vai para o git: `apprutea/.gitignore` tem esta pasta. Guarde fora
// do repo depois de conferir.
const PASTA = '_fotos_base64_20261103';

if (!URL || !KEY) {
  console.error('Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  console.error('A service role NÃO vai em argumento de linha de comando: fica no histórico do shell.');
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

const fmt = (n) => (n / 1024).toFixed(0).padStart(5) + ' kB';

/** A extensão sai dos BYTES, não do rótulo da data URL.
 *
 *  Há 7 registros gravados como `image/png` cujo conteúdo começa em
 *  `/9j/`, que é assinatura de JPEG: o `mimeType` do ImagePicker foi
 *  repassado sem conferência. Gravar .png com bytes de JPEG funciona na
 *  maioria dos visualizadores e quebra em alguns, então aqui quem manda
 *  é o arquivo. */
function tipoReal(bytes) {
  const ehPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  return { ext: ehPng ? 'png' : 'jpg', mime: ehPng ? 'image/png' : 'image/jpeg' };
}

/** Sobe, confere que a URL pública responde, devolve a URL ou `null`.
 *
 *  A conferência é `HEAD` + `content-length`. Ausência de
 *  `content-length` não reprova -- nem todo CDN devolve --, mas
 *  divergência reprova. */
async function subirEConferir(caminho, bytes, mime, rotulo) {
  const { error: erroUpload } = await db.storage
    .from(BUCKET).upload(caminho, bytes, { contentType: mime, upsert: true });
  if (erroUpload) { console.log(`${rotulo} FALHA no upload: ${erroUpload.message}`); return null; }

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(caminho);

  let resp;
  try { resp = await fetch(pub.publicUrl, { method: 'HEAD' }); }
  catch (e) { console.log(`${rotulo} FALHA: não deu para ler de volta (${e.message})`); return null; }

  if (!resp.ok) { console.log(`${rotulo} FALHA: a URL devolveu ${resp.status}`); return null; }
  const tam = Number(resp.headers.get('content-length') || 0);
  if (tam && tam !== bytes.length) {
    console.log(`${rotulo} FALHA: subiu ${bytes.length} e voltou ${tam}`);
    return null;
  }
  return pub.publicUrl;
}


// =====================================================================
// MODO 1 -- a coluna `clientes.foto_url`
// =====================================================================
async function migrarColuna() {
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
  // Este modo APAGA a única cópia da imagem, e a tabela de backup PODE
  // ESTAR DESATUALIZADA: enquanto há build antiga em campo, o app segue
  // gravando base64 a cada cliente novo, então o conjunto cresce entre o
  // backup e a migração. Aconteceu na primeira execução, em 03/11/2026 --
  // o backup pegou 113 e a simulação achou 114, porque entrou uma foto às
  // 19:36, depois do backup.
  //
  // Conferir contra a tabela não resolveria com segurança: ela vive no
  // schema `backup`, que o PostgREST não expõe, então o script nem
  // consegue lê-la. Gravar o arquivo aqui resolve sem depender de nada --
  // e é a cópia mais útil das duas, porque já é a imagem, não o base64.
  if (APLICAR) {
    await mkdir(PASTA, { recursive: true });
    console.log(`Cópia local de segurança em: ${PASTA}`);
  }
  console.log('');

  let ok = 0, pulados = 0, falhas = 0, bytesAntes = 0;

  for (const [i, cliente] of alvos.entries()) {
    const rotulo = `[${String(i + 1).padStart(3)}/${alvos.length}] ${cliente.nome.slice(0, 32).padEnd(32)}`;

    // Relê a foto agora, individualmente. Se outro processo já migrou
    // este cliente entre a listagem e aqui, o `startsWith` o descarta.
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
    const { ext, mime } = tipoReal(bytes);
    const caminho = `clientes/${cliente.id}.${ext}`;

    if (!APLICAR) {
      console.log(`${rotulo} ${fmt(bytes.length)} -> ${caminho} (${mime}, rótulo dizia ${casa[1]})`);
      ok++;
      continue;
    }

    // Disco PRIMEIRO. Se a máquina ficar sem espaço ou a pasta não puder
    // ser escrita, nada é migrado -- e é o certo: sem cópia, não se apaga.
    try {
      await writeFile(join(PASTA, `${cliente.id}.${ext}`), bytes);
    } catch (e) {
      console.log(`${rotulo} FALHA ao gravar cópia local: ${e.message} -- NÃO migrado`);
      falhas++;
      continue;
    }

    const url = await subirEConferir(caminho, bytes, mime, rotulo);
    if (!url) { falhas++; continue; }

    const { error: erroUpdate } = await db
      .from('clientes').update({ foto_url: url }).eq('id', cliente.id);
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
}


// =====================================================================
// MODO 2 -- o dreno da quarentena
// =====================================================================
async function drenarQuarentena() {
  // `foto_quarentena` tem RLS ligada e ZERO política, de propósito. O
  // script a lê porque `service_role` tem `rolbypassrls = true`
  // (conferido em 04/11/2026 antes de escrever isto). Com a chave anon
  // esta consulta devolveria lista vazia -- e vazia é indistinguível de
  // "nada a drenar", que é o jeito mais silencioso de este dreno nunca
  // funcionar. Se vier 0 linha com a quarentena cheia, é a chave.
  const { data: linhas, error } = await db
    .from('foto_quarentena')
    .select('id, tabela, registro_id, coluna, bytes, recebido_em')
    .is('drenado_em', null)
    .order('recebido_em');

  if (error) { console.error('Erro ao ler a quarentena:', error.message); process.exit(1); }
  console.log(`${linhas.length} linha(s) a drenar.`);
  if (!linhas.length) return;

  if (APLICAR) {
    await mkdir(PASTA, { recursive: true });
    console.log(`Cópia local de segurança em: ${PASTA}`);
  }
  console.log('');

  let ok = 0, semColuna = 0, falhas = 0, bytesTotal = 0;

  for (const [i, q] of linhas.entries()) {
    const rotulo = `[${String(i + 1).padStart(3)}/${linhas.length}] ${q.tabela}.${q.coluna} ${q.registro_id.slice(0, 8)}`;

    // O conteúdo vem AGORA, uma linha por vez: são até 1 MB cada.
    const { data: cheia, error: erroLeitura } = await db
      .from('foto_quarentena').select('conteudo').eq('id', q.id).single();
    if (erroLeitura || !cheia?.conteudo) {
      console.log(`${rotulo} FALHA ao ler o conteúdo: ${erroLeitura?.message || 'vazio'}`);
      falhas++;
      continue;
    }

    const casa = cheia.conteudo.match(/^data:([^;]+);base64,(.*)$/s);
    if (!casa) { console.log(`${rotulo} FALHA: data URL malformada`); falhas++; continue; }

    const bytes = Buffer.from(casa[2], 'base64');
    bytesTotal += cheia.conteudo.length;
    const { ext, mime } = tipoReal(bytes);

    // ⚠ O CAMINHO SAI DO ID DA LINHA DE QUARENTENA, não do id do
    // registro. Duas razões, e as duas importam:
    //
    //   1. NÃO SOBRESCREVE. `clientes/<id>.jpg` é o caminho que o MODO 1
    //      usou. Se um aparelho antigo tira foto NOVA de um cliente já
    //      migrado, gravar no mesmo caminho apagaria o arquivo anterior
    //      -- e aí o `upsert: true` deixaria de ser inofensivo.
    //   2. É DETERMINÍSTICO. Retomar depois de uma queda sobe no mesmo
    //      lugar, então a repetição é idempotente em vez de espalhar
    //      arquivos órfãos a cada tentativa.
    const curto = q.id.replace(/-/g, '').slice(0, 8);
    const prefixo = q.tabela === 'clientes' ? 'clientes' : 'vendas-pendentes';
    const caminho = `${prefixo}/${q.registro_id}-q${curto}.${ext}`;

    if (!APLICAR) {
      console.log(`${rotulo} ${fmt(bytes.length)} -> ${caminho} (${mime}, rótulo dizia ${casa[1]})`);
      ok++;
      continue;
    }

    try {
      await writeFile(join(PASTA, `q-${q.id}.${ext}`), bytes);
    } catch (e) {
      console.log(`${rotulo} FALHA ao gravar cópia local: ${e.message} -- NÃO drenado`);
      falhas++;
      continue;
    }

    const url = await subirEConferir(caminho, bytes, mime, rotulo);
    if (!url) { falhas++; continue; }

    // ⚠ SÓ DEVOLVE A URL SE A COLUNA ESTIVER VAZIA.
    //
    // Entre a quarentena e o dreno pode ter passado tempo, e nesse meio
    // alguém pode ter posto uma foto nova por um caminho que funciona --
    // o modal de detalhes do mobile, que sobe para o Storage desde
    // 04/06/2026. Sobrescrever ali trocaria a foto ATUAL pela que estava
    // na fila, que é mais velha. O arquivo fica no bucket e a `url` fica
    // registrada na quarentena de todo jeito, então nada se perde.
    const { data: destino, error: erroDestino } = await db
      .from(q.tabela).select(q.coluna).eq('id', q.registro_id).maybeSingle();

    let situacao;
    if (erroDestino) {
      console.log(`${rotulo} FALHA ao ler a coluna de origem: ${erroDestino.message}`);
      falhas++;
      continue;
    } else if (!destino) {
      // O registro foi apagado depois de a foto entrar na fila. A linha
      // é marcada como drenada de todo jeito: a imagem está no bucket e
      // a `url` fica guardada, para não voltar nesta lista para sempre.
      situacao = 'registro de origem não existe mais';
      semColuna++;
    } else if (destino[q.coluna] == null) {
      const { error: erroUpdate } = await db
        .from(q.tabela).update({ [q.coluna]: url }).eq('id', q.registro_id);
      if (erroUpdate) {
        console.log(`${rotulo} FALHA ao devolver a URL: ${erroUpdate.message}`);
        falhas++;
        continue;
      }
      situacao = 'URL devolvida à coluna';
    } else {
      situacao = 'coluna já tem valor -- NÃO sobrescrita';
      semColuna++;
    }

    // ⚠ POR ÚLTIMO. Se o processo cair antes daqui, a linha segue
    // pendente e a próxima execução a repete -- que é o que se quer.
    // Marcar antes faria uma queda no meio esconder a linha para sempre.
    const { error: erroMarca } = await db
      .from('foto_quarentena')
      .update({ drenado_em: new Date().toISOString(), url })
      .eq('id', q.id);
    if (erroMarca) {
      console.log(`${rotulo} ATENÇÃO: subiu e gravou, mas não marcou drenado (${erroMarca.message}).`);
      console.log('          Rodar de novo é inofensivo: o caminho no bucket é o mesmo.');
      falhas++;
      continue;
    }

    console.log(`${rotulo} ${fmt(bytes.length)} -> ok (${situacao})`);
    ok++;
  }

  // O verbo muda com o modo. Na simulação, dizer "7 drenado(s)" é falso
  // -- e não basta a linha final avisar que nada foi escrito: é a
  // contagem que a pessoa lê e guarda.
  console.log(`\n${ok} ${APLICAR ? 'drenado(s)' : 'conferido(s), nenhum drenado'}, ${falhas} falha(s).`);
  if (semColuna) console.log(`${semColuna} sem devolver à coluna (já preenchida ou registro apagado) -- a imagem está no bucket e a URL ficou na quarentena.`);
  console.log(`Base64 ${APLICAR ? 'retirado do' : 'a retirar do'} banco: ${(bytesTotal / 1024 / 1024).toFixed(1)} MB.`);
  if (APLICAR) {
    console.log('\nAs linhas drenadas FICAM, com `drenado_em` e `url`. Apagar só depois');
    console.log('de conferir que as URLs respondem:');
    console.log("  DELETE FROM foto_quarentena WHERE drenado_em IS NOT NULL AND url IS NOT NULL;");
  }
}


async function main() {
  console.log(QUARENTENA ? '>> MODO QUARENTENA (dreno)' : '>> MODO COLUNA (clientes.foto_url)');
  console.log(APLICAR ? '>> VALENDO: vai escrever.' : '>> SIMULAÇÃO: não escreve nada. Use --aplicar para valer.');
  console.log('');

  if (QUARENTENA) await drenarQuarentena();
  else await migrarColuna();

  if (!APLICAR) console.log('\nNada foi escrito. Rode com --aplicar depois de conferir a lista acima.');
}

main().catch((e) => { console.error(e); process.exit(1); });
