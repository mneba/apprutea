import { createClient } from '@/lib/supabase/client';

// =====================================================================
// FERRAMENTA DE IMPORTAÇÃO SMARTPAY
// =====================================================================
//
// Substitui o processo manual de ~8 etapas com SQL colado no editor do
// Supabase. O CSV é lido AQUI, no navegador, e as linhas vão por RPC.
//
// O banco faz o trabalho pesado — validação, conversão, as duas fases, o
// pós e o aceite. Este arquivo tem três responsabilidades e nenhuma
// regra de negócio:
//
//   1. ler o CSV corretamente (aspas, acento, a linha de totais);
//   2. CONFERIR O CABEÇALHO antes de enviar qualquer coisa;
//   3. embrulhar as RPCs.
//
// A regra de negócio vive nas funções `fn_importacao_*`, e o motivo está
// no CLAUDE.md: a validação é a peça que impede o estrago, e ela precisa
// ver os clientes JÁ cadastrados — coisa que o navegador não vê.

const supabase = createClient();

// ── Os cabeçalhos que a função do banco lê ─────────────────────────
//
// `ID. VENTA` existe no arquivo e não é usado, então fica fora.
//
// **Os acentos são literais.** `IDENTIFICACIÓN` e `SANCIÓN` têm acento no
// CSV, e é por eles que a conferência de cabeçalho pega arquivo em
// codificação errada: em Latin-1 lido como UTF-8 o nome vira outra coisa,
// a chave não casa, e sem esta conferência a importação entraria com
// documento NULO em todos os clientes, sem um erro.
export const CABECALHOS_EXIGIDOS = [
  'PAIS', 'VENDEDOR', 'FECHA VENTA', 'CONSECUTIVO', 'NOMBRE DEL CLIENTE',
  'IDENTIFICACIÓN', 'TELEFONO', 'DIRECCION', 'VALOR PRESTADO', 'VALOR A PAGAR',
  'VALOR INTERES', '%', 'V.CUOTA', 'CUOTAS', 'C.PAGAS', 'C.RESTA', 'SALDO',
  'SANCIÓN', 'VISITAS', 'FREC.', 'ULT.PAGO',
] as const;

export interface LeituraCsv {
  linhas: Record<string, string>[];
  /** sha256 do arquivo, em hex. Evita reimportar o mesmo sem perceber. */
  hash: string;
  /** Cabeçalhos exigidos que não apareceram. Vazio = pode seguir. */
  faltando: string[];
  /** Cabeçalhos do arquivo que a importação ignora. Só informativo. */
  ignorados: string[];
  /** Os cabeçalhos como vieram, para mostrar quando algo falta. */
  encontrados: string[];
  /**
   * A linha de TOTAIS do arquivo, contada à parte.
   *
   * O CSV do SmartPay termina com `"TOTAL","","",…,"$56,300.00",…`. Ela
   * cairia no descarte "sem nome" do banco — o que funciona, mas
   * treinaria quem usa a ferramenta a ignorar o contador de descartadas,
   * que é justamente onde um problema de VERDADE apareceria. Separada
   * aqui, "1 linha de totais ignorada" é esperado e "1 linha sem nome
   * descartada" é para investigar.
   */
  linhasTotais: number;
}

// =====================================================================
// O PARSER
// =====================================================================
//
// `split(',')` não serve: `DIRECCION` é texto digitado por operador e
// pode conter vírgula dentro das aspas. Este trata aspas, aspas
// escapadas (`""`), CRLF e a última linha sem quebra.
function lerCsv(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let dentroDeAspas = false;

  // BOM no começo do arquivo não é conteúdo — e colado em `PAIS` faria o
  // primeiro cabeçalho não casar.
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];

    if (dentroDeAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }  // aspas escapadas
        else dentroDeAspas = false;
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === ',') { linha.push(campo); campo = ''; continue; }
    if (c === '\r') continue;                          // CRLF
    if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue; }
    campo += c;
  }

  // Última linha sem quebra no fim do arquivo.
  if (campo !== '' || linha.length > 0) { linha.push(campo); linhas.push(linha); }

  return linhas.filter(l => l.some(c => c.trim() !== ''));
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(h))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Lê o arquivo e CONFERE o cabeçalho. Não envia nada.
 *
 * Os valores vão para o banco como TEXTO ORIGINAL — a limpeza numérica e
 * de data acontece lá, para as colunas `*_raw` guardarem a origem de
 * verdade e a regra de conversão viver num lugar só.
 */
export async function lerArquivo(arquivo: File): Promise<LeituraCsv> {
  const bytes = await arquivo.arrayBuffer();
  const hash = await sha256(bytes);
  // UTF-8 explícito: o `fatal` faz byte inválido virar erro em vez de
  // virar caractere de substituição, que é como um Latin-1 passaria
  // calado e só apareceria no cabeçalho com acento.
  let texto: string;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      'O arquivo não está em UTF-8. Reexporte do SmartPay ou converta antes: ' +
      'em outra codificação os cabeçalhos com acento (IDENTIFICACIÓN, SANCIÓN) ' +
      'não são reconhecidos e os documentos entrariam vazios.'
    );
  }

  const bruto = lerCsv(texto);
  if (bruto.length < 2) {
    throw new Error('O arquivo não tem cabeçalho e ao menos uma linha de dados.');
  }

  const encontrados = bruto[0].map(h => h.trim());
  const faltando = CABECALHOS_EXIGIDOS.filter(h => !encontrados.includes(h));
  const ignorados = encontrados.filter(
    h => h !== '' && !CABECALHOS_EXIGIDOS.includes(h as typeof CABECALHOS_EXIGIDOS[number])
  );

  const linhas: Record<string, string>[] = [];
  let linhasTotais = 0;

  for (const l of bruto.slice(1)) {
    const reg: Record<string, string> = {};
    encontrados.forEach((h, i) => { if (h !== '') reg[h] = (l[i] ?? '').trim(); });

    // A linha de totais: primeira coluna "TOTAL" e sem nome de cliente.
    // Exige as duas coisas — um cliente chamado "TOTAL" com nome
    // preenchido continua sendo um cliente.
    const ehTotais =
      (reg['PAIS'] || '').toUpperCase() === 'TOTAL' &&
      (reg['NOMBRE DEL CLIENTE'] || '') === '';

    if (ehTotais) { linhasTotais++; continue; }
    linhas.push(reg);
  }

  return { linhas, hash, faltando, ignorados, encontrados, linhasTotais };
}

// =====================================================================
// AS RPCs
// =====================================================================

export interface Execucao {
  id: string;
  rota_id: string;
  empresa_id: string;
  vendedor_id: string;
  liquidacao_id: string | null;
  user_id: string;
  arquivo_nome: string | null;
  arquivo_hash: string | null;
  etapa: 'UPLOAD' | 'VALIDACAO' | 'STAGING' | 'FASE1' | 'FASE2' | 'POS' | 'ACEITE' | 'ABORTADO';
  registros_csv: number | null;
  parcelas_previstas: number | null;
  resultado: any;
  diagnostico: any;
  criado_em: string;
  atualizado_em: string;
}

export interface Achado {
  gravidade: 'BLOQUEIA' | 'CONFERIR';
  tipo: string;
  ref_linhas: string;
  ref_documento: string;
  detalhe: string;
  acao: string;
}

export interface ItemConferencia {
  item: string;
  previsto: string;
  realizado: string;
  ok: boolean;
  observacao: string;
}

function erro(e: any, onde: string): never {
  // A mensagem do Postgres é o diagnóstico: as funções de importação
  // explicam o motivo e o que fazer. Engoli-la por uma genérica é perder
  // a única informação útil.
  throw new Error(e?.message || e?.hint || `Falha em ${onde}`);
}

export async function criarExecucao(p: {
  rotaId: string; empresaId: string; vendedorId: string; liquidacaoId: string;
  arquivoNome: string; arquivoHash: string; forcarHash?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc('fn_importacao_criar', {
    p_rota_id: p.rotaId,
    p_empresa_id: p.empresaId,
    p_vendedor_id: p.vendedorId,
    p_liquidacao_id: p.liquidacaoId,
    p_arquivo_nome: p.arquivoNome,
    p_arquivo_hash: p.arquivoHash,
    p_forcar_hash: p.forcarHash ?? false,
  });
  if (error) erro(error, 'criar execução');
  return data as string;
}

export async function carregarLinhas(execucaoId: string, linhas: Record<string, string>[]) {
  const { data, error } = await supabase.rpc('fn_importacao_carregar', {
    p_execucao_id: execucaoId,
    p_linhas: linhas,
  });
  if (error) erro(error, 'carregar linhas');
  const r = Array.isArray(data) ? data[0] : data;
  return r as { inseridas: number; descartadas_sem_nome: number; parcelas_previstas: number };
}

export async function validar(execucaoId: string): Promise<Achado[]> {
  const { data, error } = await supabase.rpc('fn_importacao_validar', { p_execucao_id: execucaoId });
  if (error) erro(error, 'validar');
  return (data || []) as Achado[];
}

export async function podeAvancar(execucaoId: string) {
  const { data, error } = await supabase.rpc('fn_importacao_pode_avancar', { p_execucao_id: execucaoId });
  if (error) erro(error, 'consultar liberação');
  const r = Array.isArray(data) ? data[0] : data;
  return r as { pode: boolean; motivo: string; bloqueios: number; validado_em: string | null };
}

export async function previsto(execucaoId: string) {
  const { data, error } = await supabase.rpc('fn_importacao_previsto', { p_execucao_id: execucaoId });
  if (error) erro(error, 'calcular previsto');
  const r = Array.isArray(data) ? data[0] : data;
  return r as {
    linhas: number; documentos_distintos: number; parcelas_previstas: number;
    total_emprestado: number; total_saldo: number; sem_documento: number;
    por_frequencia: Record<string, number>; por_parcelas: Record<string, number>;
  };
}

export async function fase1(e: Execucao) {
  const { data, error } = await supabase.rpc('fn_importar_clientes_smartpay', {
    p_rota_id: e.rota_id, p_empresa_id: e.empresa_id, p_execucao_id: e.id,
  });
  if (error) erro(error, 'Fase 1');
  const r = Array.isArray(data) ? data[0] : data;
  return r as {
    sucesso: boolean; mensagem: string; total_registros: number;
    clientes_criados: number; clientes_existentes: number; erros: number;
  };
}

export async function fase2(e: Execucao, userId: string) {
  const { data, error } = await supabase.rpc('fn_importar_emprestimos_smartpay', {
    p_rota_id: e.rota_id, p_empresa_id: e.empresa_id, p_vendedor_id: e.vendedor_id,
    p_user_id: userId, p_liquidacao_id: e.liquidacao_id, p_execucao_id: e.id,
  });
  if (error) erro(error, 'Fase 2');
  const r = Array.isArray(data) ? data[0] : data;
  return r as {
    sucesso: boolean; mensagem: string; total_registros: number;
    emprestimos_criados: number; parcelas_ajustadas: number; erros: number;
  };
}

export async function pos(execucaoId: string) {
  const { data, error } = await supabase.rpc('fn_importacao_pos', { p_execucao_id: execucaoId });
  if (error) erro(error, 'pós-importação');
  const r = Array.isArray(data) ? data[0] : data;
  return r as {
    na_ordem_inseridos: number; na_ordem_total: number;
    planejados: number; data_liquidacao: string; mensagem: string;
  };
}

export async function conferir(execucaoId: string): Promise<ItemConferencia[]> {
  const { data, error } = await supabase.rpc('fn_importacao_conferir', { p_execucao_id: execucaoId });
  if (error) erro(error, 'conferir');
  return (data || []) as ItemConferencia[];
}

export async function aceitar(execucaoId: string) {
  const { data, error } = await supabase.rpc('fn_importacao_aceitar', { p_execucao_id: execucaoId });
  if (error) erro(error, 'aceitar');
  const r = Array.isArray(data) ? data[0] : data;
  return r as { aceita: boolean; mensagem: string };
}

export async function abortar(execucaoId: string, motivo: string) {
  const { data, error } = await supabase.rpc('fn_importacao_abortar', {
    p_execucao_id: execucaoId, p_motivo: motivo,
  });
  if (error) erro(error, 'abortar');
  const r = Array.isArray(data) ? data[0] : data;
  return r as { abortada: boolean; linhas_apagadas: number; mensagem: string };
}

// ── Leituras diretas, de dado de referência ────────────────────────

export async function buscarExecucao(id: string): Promise<Execucao> {
  const { data, error } = await supabase
    .from('importacao_execucao').select('*').eq('id', id).single();
  if (error) erro(error, 'buscar execução');
  return data as Execucao;
}

/** O histórico — a resposta para "de onde veio esse cadastro". */
export async function listarExecucoes(limite = 50) {
  const { data, error } = await supabase
    .from('importacao_execucao')
    .select('*, rotas:rota_id(nome), empresas:empresa_id(nome)')
    .order('criado_em', { ascending: false })
    .limit(limite);
  if (error) erro(error, 'listar execuções');
  return (data || []) as (Execucao & { rotas: { nome: string } | null; empresas: { nome: string } | null })[];
}

/**
 * Rotas com os nomes resolvidos, para a tela mostrar nome e não uuid.
 *
 * Na rota Supra os INSERTs foram gerados com `empresa_id` errado e só se
 * descobriu depois. A tela exibe nome de rota, empresa e vendedor
 * justamente para esse erro ser visível antes de rodar.
 */
export async function listarRotas() {
  const { data, error } = await supabase
    .from('rotas')
    .select('id, nome, empresa_id, vendedor_id, empresas:empresa_id(nome), vendedores:vendedor_id(nome)')
    .eq('status', 'ATIVA')
    .order('nome');
  if (error) erro(error, 'listar rotas');
  // Cast por `unknown`: o PostgREST devolve OBJETO numa relacao para-um
  // (`empresa_id(nome)`), mas sem os tipos gerados do banco o TypeScript
  // infere array. O formato em tempo de execucao e o declarado aqui.
  return (data || []) as unknown as {
    id: string; nome: string; empresa_id: string; vendedor_id: string | null;
    empresas: { nome: string } | null; vendedores: { nome: string } | null;
  }[];
}

/** Só liquidação ABERTA ou REABERTA da rota: é o que a importação exige. */
export async function listarLiquidacoesAbertas(rotaId: string) {
  const { data, error } = await supabase
    .from('liquidacoes_diarias')
    .select('id, data_liquidacao, status')
    .eq('rota_id', rotaId)
    .in('status', ['ABERTO', 'REABERTO'])
    .order('data_liquidacao', { ascending: false });
  if (error) erro(error, 'listar liquidações');
  return (data || []) as { id: string; data_liquidacao: string; status: string }[];
}
