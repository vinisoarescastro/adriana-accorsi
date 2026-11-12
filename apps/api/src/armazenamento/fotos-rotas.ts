import type { FastifyReply, FastifyRequest } from 'fastify';
import { erros } from '../erros.js';
import { novaChave, type Armazenamento } from './armazenamento.js';
import { reconhecerImagem, tamanhoMaximoDaFoto, type TipoDeImagem } from './foto.js';

/**
 * Valida o corpo de um envio de foto. O corpo chega como Buffer quando o Content-Type é
 * image/png ou image/jpeg; o tipo é decidido pelo CONTEÚDO, não pelo cabeçalho.
 */
export function lerFoto(request: FastifyRequest): { bytes: Buffer; imagem: TipoDeImagem } {
  const corpo = request.body;
  if (!Buffer.isBuffer(corpo) || corpo.length === 0) {
    throw erros.arquivoInvalido('Envie a imagem como PNG ou JPEG.');
  }
  if (corpo.length > tamanhoMaximoDaFoto) {
    throw erros.arquivoInvalido('A foto deve ter no máximo 2 MB.');
  }
  const imagem = reconhecerImagem(corpo);
  if (!imagem) throw erros.arquivoInvalido('O arquivo não é uma imagem PNG ou JPEG válida.');
  return { bytes: corpo, imagem };
}

export async function guardarFoto(
  armazenamento: Armazenamento,
  prefixo: string,
  foto: { bytes: Buffer; imagem: TipoDeImagem },
): Promise<string> {
  const chave = novaChave(prefixo, foto.imagem.extensao);
  await armazenamento.guardar(chave, foto.bytes, foto.imagem.tipo);
  return chave;
}

/** Entrega uma foto pela API (nunca há URL direta do armazenamento). */
export async function enviarFoto(
  armazenamento: Armazenamento,
  chave: string | null,
  reply: FastifyReply,
) {
  if (!chave) throw erros.naoEncontrado();
  const objeto = await armazenamento.ler(chave);
  if (!objeto) throw erros.naoEncontrado();
  return reply
    .header('Content-Type', objeto.tipo)
    .header('X-Content-Type-Options', 'nosniff')
    .send(objeto.bytes);
}
