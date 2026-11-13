import { createTransport } from 'nodemailer';

/**
 * Canal de notificação plugável (ADR 0004, tarefa 3.16). Hoje há o e-mail; o WhatsApp (fase 9)
 * seria outra implementação, sem mudar o processador nem o outbox.
 */
export interface MensagemDeEmail {
  /** Identificador do envio: o provedor o usa para não duplicar (idempotência). */
  readonly idDoEnvio: number;
  readonly para: string;
  readonly assunto: string;
  readonly texto: string;
  readonly html: string;
  /** Endereço de descadastro em um clique (cabeçalhos List-Unsubscribe). */
  readonly linkDeDescadastro: string;
}

export interface ResultadoDoEnvio {
  readonly idNoProvedor: string | null;
}

/**
 * `temporario`: tentar de novo depois (rede, limite do provedor, indisponibilidade).
 * `permanente`: o provedor recusou o endereço ou o conteúdo; repetir não adianta.
 */
export class ErroDeEnvio extends Error {
  constructor(
    mensagem: string,
    readonly tipo: 'temporario' | 'permanente',
  ) {
    super(mensagem);
    this.name = 'ErroDeEnvio';
  }
}

export interface CanalDeNotificacao {
  enviar(mensagem: MensagemDeEmail): Promise<ResultadoDoEnvio>;
}

/** Provedor transacional Resend (P7), pela API HTTP. A chave nunca vai para log nem para erro. */
export class CanalResend implements CanalDeNotificacao {
  constructor(
    private readonly chaveDaApi: string,
    private readonly remetente: string,
    private readonly nomeDoRemetente: string,
    private readonly buscar: typeof fetch = fetch,
  ) {}

  async enviar(m: MensagemDeEmail): Promise<ResultadoDoEnvio> {
    let resposta: Response;
    try {
      resposta = await this.buscar('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.chaveDaApi}`,
          'Content-Type': 'application/json',
          // Reprocessar o mesmo envio não duplica o e-mail.
          'Idempotency-Key': `envio-${m.idDoEnvio}`,
        },
        body: JSON.stringify({
          from: `${this.nomeDoRemetente} <${this.remetente}>`,
          to: [m.para],
          subject: m.assunto,
          text: m.texto,
          html: m.html,
          headers: {
            'List-Unsubscribe': `<${m.linkDeDescadastro}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (erro) {
      throw new ErroDeEnvio(
        `Falha de rede ao falar com o provedor: ${erro instanceof Error ? erro.name : 'erro'}`,
        'temporario',
      );
    }
    if (resposta.ok) {
      const corpo = (await resposta.json().catch(() => ({}))) as { id?: string };
      return { idNoProvedor: corpo.id ?? null };
    }
    // 429 e 5xx: tentar depois. 4xx: o provedor recusou (endereço inválido, domínio não verificado...).
    const temporario = resposta.status === 429 || resposta.status >= 500;
    throw new ErroDeEnvio(
      `O provedor respondeu ${resposta.status}.`,
      temporario ? 'temporario' : 'permanente',
    );
  }
}

/** SMTP: Mailpit em desenvolvimento, ou um servidor do próprio gabinete. */
export class CanalSmtp implements CanalDeNotificacao {
  private readonly transporte;

  constructor(
    host: string,
    porta: number,
    private readonly remetente: string,
    private readonly nomeDoRemetente: string,
  ) {
    this.transporte = createTransport({
      host,
      port: porta,
      secure: false,
      ignoreTLS: porta === 1025,
    });
  }

  async enviar(m: MensagemDeEmail): Promise<ResultadoDoEnvio> {
    try {
      const info = await this.transporte.sendMail({
        from: { name: this.nomeDoRemetente, address: this.remetente },
        to: m.para,
        subject: m.assunto,
        text: m.texto,
        html: m.html,
        messageId: `<envio-${m.idDoEnvio}@${this.remetente.split('@')[1] ?? 'localhost'}>`,
        headers: {
          'List-Unsubscribe': `<${m.linkDeDescadastro}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      return { idNoProvedor: info.messageId };
    } catch (erro) {
      const codigo = (erro as { responseCode?: number }).responseCode;
      // 5xx do SMTP (exceto 54x de rede) = recusa definitiva; o resto é temporário.
      const permanente = typeof codigo === 'number' && codigo >= 500 && codigo < 600;
      throw new ErroDeEnvio(
        `Falha no envio por SMTP${codigo ? ` (${codigo})` : ''}.`,
        permanente ? 'permanente' : 'temporario',
      );
    }
  }
}
