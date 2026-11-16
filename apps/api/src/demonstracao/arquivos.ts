import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

/** Arquivos pequenos e válidos para a aba de documentos: PDF, PNG e ZIP gerados aqui, sem dependências. */

const escaparPdf = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\()]/g, '\\$&');

export function gerarPdf(titulo: string, linhas: readonly string[]): Buffer {
  const conteudo = [
    'BT /F1 16 Tf 56 780 Td (' + escaparPdf(titulo) + ') Tj ET',
    ...linhas.map((l, i) => `BT /F1 11 Tf 56 ${740 - i * 18} Td (${escaparPdf(l)}) Tj ET`),
  ].join('\n');
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let saida = '%PDF-1.4\n';
  const posicoes: number[] = [];
  objetos.forEach((o, i) => {
    posicoes.push(Buffer.byteLength(saida));
    saida += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const inicioDaTabela = Buffer.byteLength(saida);
  saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posicoes) saida += `${String(p).padStart(10, '0')} 00000 n \n`;
  saida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioDaTabela}\n%%EOF\n`;
  return Buffer.from(saida, 'latin1');
}

const tabelaCrc = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const crc32 = (bytes: Buffer): number => {
  let c = 0xffffffff;
  for (const b of bytes) c = (tabelaCrc[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function bloco(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

/** PNG colorido (degradê com faixas): serve de "foto" fictícia. `semente` muda as cores. */
export function gerarPng(largura: number, altura: number, semente: number): Buffer {
  const linhas: Buffer[] = [];
  for (let y = 0; y < altura; y += 1) {
    const linha = Buffer.alloc(1 + largura * 3);
    for (let x = 0; x < largura; x += 1) {
      const faixa = Math.floor((x + y) / 24) % 2 === 0 ? 0 : 28;
      linha[1 + x * 3] = (40 + semente * 37 + (x * 120) / largura + faixa) % 256;
      linha[2 + x * 3] = (90 + semente * 53 + (y * 110) / altura + faixa) % 256;
      linha[3 + x * 3] = (150 + semente * 29 + ((x + y) * 60) / (largura + altura)) % 256;
    }
    linhas.push(linha);
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(largura, 0);
  cabecalho.writeUInt32BE(altura, 4);
  cabecalho[8] = 8;
  cabecalho[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(Buffer.concat(linhas))),
    bloco('IEND', Buffer.alloc(0)),
  ]);
}

/** ZIP sem compressão ("stored") com os arquivos de texto dados. */
export function gerarZip(arquivos: ReadonlyArray<{ nome: string; texto: string }>): Buffer {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;
  for (const a of arquivos) {
    const nome = Buffer.from(a.nome, 'utf8');
    const dados = Buffer.from(a.texto, 'utf8');
    const crc = crc32(dados);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nome.length, 26);
    partes.push(local, nome, dados);
    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4);
    entrada.writeUInt16LE(20, 6);
    entrada.writeUInt16LE(0x0800, 8);
    entrada.writeUInt32LE(crc, 16);
    entrada.writeUInt32LE(dados.length, 20);
    entrada.writeUInt32LE(dados.length, 24);
    entrada.writeUInt16LE(nome.length, 28);
    entrada.writeUInt32LE(deslocamento, 42);
    central.push(entrada, nome);
    deslocamento += local.length + nome.length + dados.length;
  }
  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...partes, diretorio, fim]);
}

export const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
