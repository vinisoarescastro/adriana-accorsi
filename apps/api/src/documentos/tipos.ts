import type { TipoDeDocumento } from '@gabinete/banco';

/**
 * Documentos: PDF, PNG, JPEG e ZIP. O tipo é reconhecido pelos PRIMEIROS BYTES; o cabeçalho
 * Content-Type e a extensão do nome não valem nada (um executável renomeado para .pdf é recusado).
 */
export interface TipoReconhecido {
  readonly tipo: TipoDeDocumento;
  readonly extensao: 'pdf' | 'png' | 'jpg' | 'zip';
}

const pdf = Buffer.from('%PDF-');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff]);
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const zipVazio = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

const comeca = (bytes: Buffer, assinatura: Buffer) =>
  bytes.length >= assinatura.length && bytes.subarray(0, assinatura.length).equals(assinatura);

export function reconhecerDocumento(bytes: Buffer): TipoReconhecido | null {
  if (comeca(bytes, pdf)) return { tipo: 'application/pdf', extensao: 'pdf' };
  if (comeca(bytes, png)) return { tipo: 'image/png', extensao: 'png' };
  if (comeca(bytes, jpeg)) return { tipo: 'image/jpeg', extensao: 'jpg' };
  if (comeca(bytes, zip) || comeca(bytes, zipVazio))
    return { tipo: 'application/zip', extensao: 'zip' };
  return null;
}

/** Nome seguro para guardar e mostrar: sem caminho, sem caracteres de controle, com tamanho limitado. */
export function limparNomeDoArquivo(nome: string): string {
  // eslint-disable-next-line no-control-regex
  const semControle = nome.replace(/[\u0000-\u001f\u007f]/g, '');
  const semCaminho = semControle.split(/[\\/]/).pop() ?? '';
  const aparado = semCaminho.trim().replace(/^\.+/, '').slice(0, 200).trim();
  return aparado.length > 0 ? aparado : 'documento';
}
