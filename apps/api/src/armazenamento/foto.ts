/** Foto de perfil e do gabinete: PNG ou JPEG até 2 MB, verificada pelo CONTEÚDO (RN-ACE-10). */

export const tamanhoMaximoDaFoto = 2 * 1024 * 1024;

export interface TipoDeImagem {
  readonly tipo: 'image/png' | 'image/jpeg';
  readonly extensao: 'png' | 'jpg';
}

const assinaturaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const assinaturaJpeg = Buffer.from([0xff, 0xd8, 0xff]);

/** Reconhece pelos primeiros bytes. O cabeçalho Content-Type e a extensão não valem nada. */
export function reconhecerImagem(bytes: Buffer): TipoDeImagem | null {
  if (bytes.length >= assinaturaPng.length && bytes.subarray(0, 8).equals(assinaturaPng)) {
    return { tipo: 'image/png', extensao: 'png' };
  }
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(assinaturaJpeg)) {
    return { tipo: 'image/jpeg', extensao: 'jpg' };
  }
  return null;
}
