// =====================================================
// GERADOR DE .XLSX — sem dependência externa
// Arquivo: src/utils/xlsx.ts
// =====================================================
//
// POR QUE ESTE ARQUIVO EXISTE
//
// A exportação de clientes gerava SpreadsheetML 2003 (XML da era Office XP)
// salvo com extensão .xls. O Excel moderno recusa ou exibe o XML cru — foi o
// que o campo reportou em 25/05, 15/06 e 17/07 de 2026:
//
//     <Cell><Data ss:Type="String">1077</Data></Cell>
//
// Havia um segundo defeito, latente: nada era escapado. Um cliente com `&` ou
// `<` no nome ou endereço corrompia o arquivo inteiro, porque `&` sozinho é
// XML inválido. Endereço com "A & B" basta.
//
// COMO FUNCIONA
//
// Um .xlsx é um ZIP contendo XMLs. O mínimo que o Excel aceita:
//
//     [Content_Types].xml        tipos MIME das partes
//     _rels/.rels                aponta para o workbook
//     xl/workbook.xml            lista as abas
//     xl/_rels/workbook.xml.rels aponta para a planilha
//     xl/styles.xml              formatação (só o negrito do cabeçalho)
//     xl/worksheets/sheet1.xml   os dados
//
// O ZIP é escrito sem compressão (método "store"). Excel aceita, e evita
// trazer uma implementação de deflate junto. Um arquivo de 1.000 clientes fica
// na casa de centenas de KB — irrelevante para download.
//
// Os textos vão como `inlineStr`, o que dispensa a tabela sharedStrings.xml.

// ─── Escape ─────────────────────────────────────────────────────────────────

/** `&` PRIMEIRO, senão as entidades geradas depois seriam escapadas de novo. */
const escXml = (v: string): string =>
  v.replace(/&/g, '&amp;')
   .replace(/</g, '&lt;')
   .replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;')
   // Caracteres de controle são ilegais em XML 1.0 e fazem o Excel recusar o
   // arquivo. Aparecem em dados colados de outros sistemas.
   // eslint-disable-next-line no-control-regex
   .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

/** 0 → A, 25 → Z, 26 → AA … */
const colLetra = (i: number): string => {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

// ─── ZIP (método store, sem compressão) ─────────────────────────────────────

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (dados: Uint8Array): number => {
  let c = 0xffffffff;
  for (let i = 0; i < dados.length; i++) c = TABELA_CRC[(c ^ dados[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

interface ArquivoZip { nome: string; dados: Uint8Array; }

/** ZIP mínimo: cabeçalho local por arquivo + diretório central + EOCD. */
function montarZip(arquivos: ArquivoZip[]): Blob {
  const enc = new TextEncoder();
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let offset = 0;

  for (const arq of arquivos) {
    const nome = enc.encode(arq.nome);
    const crc = crc32(arq.dados);
    const tam = arq.dados.length;

    const local = new Uint8Array(30 + nome.length);
    const dvL = new DataView(local.buffer);
    dvL.setUint32(0, 0x04034b50, true);   // assinatura
    dvL.setUint16(4, 20, true);           // versão necessária
    dvL.setUint16(6, 0x0800, true);       // flag: nome em UTF-8
    dvL.setUint16(8, 0, true);            // método: store
    dvL.setUint16(10, 0, true);           // hora (fixa — build reproduzível)
    dvL.setUint16(12, 0x2821, true);      // data: 2020-01-01
    dvL.setUint32(14, crc, true);
    dvL.setUint32(18, tam, true);         // tamanho comprimido
    dvL.setUint32(22, tam, true);         // tamanho original
    dvL.setUint16(26, nome.length, true);
    dvL.setUint16(28, 0, true);           // sem campo extra
    local.set(nome, 30);

    const central = new Uint8Array(46 + nome.length);
    const dvC = new DataView(central.buffer);
    dvC.setUint32(0, 0x02014b50, true);
    dvC.setUint16(4, 20, true);           // versão de origem
    dvC.setUint16(6, 20, true);           // versão necessária
    dvC.setUint16(8, 0x0800, true);
    dvC.setUint16(10, 0, true);
    dvC.setUint16(12, 0, true);
    dvC.setUint16(14, 0x2821, true);
    dvC.setUint32(16, crc, true);
    dvC.setUint32(20, tam, true);
    dvC.setUint32(24, tam, true);
    dvC.setUint16(28, nome.length, true);
    dvC.setUint16(30, 0, true);           // extra
    dvC.setUint16(32, 0, true);           // comentário
    dvC.setUint16(34, 0, true);           // disco
    dvC.setUint16(36, 0, true);           // atributos internos
    dvC.setUint32(38, 0, true);           // atributos externos
    dvC.setUint32(42, offset, true);      // onde está o cabeçalho local
    central.set(nome, 46);

    locais.push(local, arq.dados);
    centrais.push(central);
    offset += local.length + tam;
  }

  const tamCentral = centrais.reduce((s, c) => s + c.length, 0);
  const fim = new Uint8Array(22);
  const dvF = new DataView(fim.buffer);
  dvF.setUint32(0, 0x06054b50, true);
  dvF.setUint16(8, arquivos.length, true);
  dvF.setUint16(10, arquivos.length, true);
  dvF.setUint32(12, tamCentral, true);
  dvF.setUint32(16, offset, true);        // início do diretório central

  // Concatena tudo num buffer só. Passar o array de Uint8Array direto ao Blob
  // funciona em runtime, mas o TS 5.7 tipou Uint8Array como genérico sobre o
  // buffer e a variância não fecha com BlobPart.
  const partes = [...locais, ...centrais, fim];
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) { saida.set(p, pos); pos += p.length; }

  return new Blob([saida.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

// ─── Planilha ───────────────────────────────────────────────────────────────

export interface ColunaPlanilha<T> {
  titulo: string;
  /** Largura em caracteres. Sem isto o Excel usa a padrão e trunca visualmente. */
  largura?: number;
  valor: (linha: T) => string | number | null | undefined;
  /** Grava como número, permitindo somar e ordenar no Excel. */
  numero?: boolean;
}

/**
 * Monta um .xlsx com uma aba.
 *
 * Valores `null`/`undefined` viram célula vazia. Colunas marcadas com
 * `numero` que receberem algo não-numérico caem para texto, em vez de gerar
 * um arquivo que o Excel recusa.
 */
export function gerarXlsx<T>(
  nomeAba: string,
  colunas: ColunaPlanilha<T>[],
  linhas: T[],
): Blob {
  const enc = new TextEncoder();
  const arq = (nome: string, texto: string): ArquivoZip => ({ nome, dados: enc.encode(texto) });

  const cols = colunas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura ?? 18}" customWidth="1"/>`)
    .join('');

  const celula = (ref: string, valor: unknown, numero: boolean, estilo?: number): string => {
    const s = estilo ? ` s="${estilo}"` : '';
    if (valor === null || valor === undefined || valor === '') return `<c r="${ref}"${s}/>`;
    if (numero) {
      const n = typeof valor === 'number' ? valor : Number(valor);
      if (Number.isFinite(n)) return `<c r="${ref}"${s}><v>${n}</v></c>`;
      // Não-numérico numa coluna numérica: vai como texto em vez de quebrar.
    }
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(String(valor))}</t></is></c>`;
  };

  const cabecalho =
    `<row r="1">` +
    colunas.map((c, i) => celula(`${colLetra(i)}1`, c.titulo, false, 1)).join('') +
    `</row>`;

  const corpo = linhas
    .map((linha, r) => {
      const n = r + 2;
      return `<row r="${n}">` +
        colunas.map((c, i) => celula(`${colLetra(i)}${n}`, c.valor(linha), !!c.numero)).join('') +
        `</row>`;
    })
    .join('');

  const sheet =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<cols>${cols}</cols>` +
    `<sheetData>${cabecalho}${corpo}</sheetData>` +
    `</worksheet>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escXml(nomeAba).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`;

  // Só dois estilos: 0 = normal (implícito), 1 = negrito para o cabeçalho.
  const styles =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>` +
    `<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
    `<fills count="1"><fill><patternFill patternType="none"/></fill></fills>` +
    `<borders count="1"><border/></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="2">` +
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
    `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `</cellXfs></styleSheet>`;

  return montarZip([
    arq('[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `</Types>`),
    arq('_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`),
    arq('xl/workbook.xml', workbook),
    arq('xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`),
    arq('xl/styles.xml', styles),
    arq('xl/worksheets/sheet1.xml', sheet),
  ]);
}

/** Gera e dispara o download. */
export function baixarXlsx<T>(
  nomeArquivo: string,
  nomeAba: string,
  colunas: ColunaPlanilha<T>[],
  linhas: T[],
): void {
  const blob = gerarXlsx(nomeAba, colunas, linhas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo.endsWith('.xlsx') ? nomeArquivo : `${nomeArquivo}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
