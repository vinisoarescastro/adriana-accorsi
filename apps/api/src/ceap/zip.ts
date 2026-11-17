import { crc32 } from 'node:zlib';

export interface ArquivoParaOZip {
  readonly nome: string;
  readonly bytes: Buffer;
  readonly data: Date;
}

/** Hora e data no formato do ZIP (DOS). */
function dataDoZip(d: Date): { hora: number; dia: number } {
  const ano = Math.max(1980, d.getUTCFullYear());
  return {
    hora: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    dia: ((ano - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

/**
 * Um arquivo ZIP simples, sem compressão (os comprovantes já são PDF ou imagem): cabeçalhos locais, os dados e o
 * diretório central, com os nomes em UTF-8. Basta para o pacote de comprovantes e evita uma dependência.
 */
export function montarZip(arquivos: readonly ArquivoParaOZip[]): Buffer {
  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;
  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome, 'utf8');
    const { hora, dia } = dataDoZip(arquivo.data);
    const crc = crc32(arquivo.bytes);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(0, 8); // sem compressão
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(dia, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(arquivo.bytes.length, 18);
    local.writeUInt32LE(arquivo.bytes.length, 22);
    local.writeUInt16LE(nome.length, 26);
    local.writeUInt16LE(0, 28);
    partes.push(local, nome, arquivo.bytes);

    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4);
    entrada.writeUInt16LE(20, 6);
    entrada.writeUInt16LE(0x0800, 8);
    entrada.writeUInt16LE(0, 10);
    entrada.writeUInt16LE(hora, 12);
    entrada.writeUInt16LE(dia, 14);
    entrada.writeUInt32LE(crc, 16);
    entrada.writeUInt32LE(arquivo.bytes.length, 20);
    entrada.writeUInt32LE(arquivo.bytes.length, 24);
    entrada.writeUInt16LE(nome.length, 28);
    entrada.writeUInt32LE(deslocamento, 42);
    central.push(entrada, nome);

    deslocamento += local.length + nome.length + arquivo.bytes.length;
  }
  const tamanhoDoCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(tamanhoDoCentral, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...partes, ...central, fim]);
}
