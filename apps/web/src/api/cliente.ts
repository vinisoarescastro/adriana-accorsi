import type { RespostaDeErro } from '@gabinete/compartilhado';

/** Erro devolvido pela API, com o código estável que a tela pode tratar. */
export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly detalhes?: readonly string[],
  ) {
    super(mensagem);
    this.name = 'ErroDaApi';
  }
}

interface Opcoes {
  /** Corpo JSON. */
  readonly corpo?: unknown;
  /** Bytes de uma imagem (envio de foto). */
  readonly bytes?: Blob;
}

/**
 * Chamada à API. Front e API ficam na mesma origem; o cookie de sessão é HttpOnly e o
 * navegador o envia sozinho (a SPA nunca o vê).
 */
export async function chamar<T>(metodo: string, caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const cabecalhos: Record<string, string> = { Accept: 'application/json' };
  let corpo: BodyInit | undefined;
  if (opcoes.bytes) {
    cabecalhos['Content-Type'] = opcoes.bytes.type;
    corpo = opcoes.bytes;
  } else if (opcoes.corpo !== undefined) {
    cabecalhos['Content-Type'] = 'application/json';
    corpo = JSON.stringify(opcoes.corpo);
  }

  const resposta = await fetch(caminho, {
    method: metodo,
    headers: cabecalhos,
    credentials: 'same-origin',
    ...(corpo !== undefined ? { body: corpo } : {}),
  });

  if (resposta.status === 204) return undefined as T;

  const texto = await resposta.text();
  const dados = lerJson(texto);

  if (!resposta.ok) {
    const erro = dados as Partial<RespostaDeErro> | null;
    throw new ErroDaApi(
      resposta.status,
      erro?.codigo ?? 'erro_interno',
      erro?.mensagem ?? 'Não foi possível concluir a operação.',
      erro?.detalhes,
    );
  }
  return dados as T;
}

function lerJson(texto: string): unknown {
  if (!texto) return null;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return null;
  }
}
