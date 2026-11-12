import { Socket } from 'node:net';

/** Verificação de vírus (ClamAV). Um arquivo infectado nunca é guardado. */
export interface ResultadoDaVarredura {
  readonly limpo: boolean;
  /** Nome da ameaça, quando encontrada. */
  readonly ameaca?: string;
}

export interface Antivirus {
  verificar(bytes: Buffer): Promise<ResultadoDaVarredura>;
}

export class ErroDeAntivirus extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeAntivirus';
  }
}

const tamanhoDoPedaco = 64 * 1024;

/**
 * Cliente do `clamd` pelo protocolo INSTREAM: envia `zINSTREAM\0`, depois pedaços (4 bytes com o
 * tamanho, em ordem de rede, mais os dados) e termina com um pedaço de tamanho zero. A resposta é
 * `stream: OK` ou `stream: <ameaça> FOUND`. Qualquer outra coisa é erro: quem chama recusa o envio
 * (falha fechada), nunca aceita um arquivo que não pôde ser verificado.
 */
export class AntivirusClamd implements Antivirus {
  constructor(
    private readonly host: string,
    private readonly porta = 3310,
    private readonly limiteDeTempoEmMs = 30_000,
  ) {}

  verificar(bytes: Buffer): Promise<ResultadoDaVarredura> {
    return new Promise((resolver, rejeitar) => {
      const conexao = new Socket();
      const partes: Buffer[] = [];
      let encerrado = false;

      const terminar = (acao: () => void) => {
        if (encerrado) return;
        encerrado = true;
        conexao.destroy();
        acao();
      };

      conexao.setTimeout(this.limiteDeTempoEmMs, () =>
        terminar(() => rejeitar(new ErroDeAntivirus('Tempo esgotado ao falar com o antivírus.'))),
      );
      conexao.on('error', (erro) =>
        terminar(() =>
          rejeitar(new ErroDeAntivirus(`Falha ao falar com o antivírus: ${erro.message}`)),
        ),
      );
      conexao.on('data', (pedaco: Buffer) => partes.push(pedaco));
      conexao.on('close', () =>
        terminar(() => {
          const resposta = Buffer.concat(partes).toString('utf8').replace(/\0/g, '').trim();
          if (/\bOK$/.test(resposta)) return resolver({ limpo: true });
          const encontrada = /^stream:\s*(.+)\s+FOUND$/.exec(resposta);
          if (encontrada?.[1]) return resolver({ limpo: false, ameaca: encontrada[1] });
          return rejeitar(
            new ErroDeAntivirus(`Resposta inesperada do antivírus: ${resposta || '(vazia)'}`),
          );
        }),
      );

      conexao.connect(this.porta, this.host, () => {
        conexao.write('zINSTREAM\0');
        for (let i = 0; i < bytes.length; i += tamanhoDoPedaco) {
          const pedaco = bytes.subarray(i, i + tamanhoDoPedaco);
          const cabecalho = Buffer.alloc(4);
          cabecalho.writeUInt32BE(pedaco.length);
          conexao.write(cabecalho);
          conexao.write(pedaco);
        }
        conexao.write(Buffer.alloc(4)); // fim do fluxo
      });
    });
  }
}
