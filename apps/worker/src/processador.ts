import { decifrarSegredoDeLink, montarLinkDeAcompanhamento } from '@gabinete/banco';
import type { EventoDeNotificacaoDto } from '@gabinete/compartilhado';
import type postgres from 'postgres';
import { ErroDeEnvio, type CanalDeNotificacao } from './canal.js';
import { montarEmail } from './modelos.js';

export interface OpcoesDoProcessador {
  /** Conexão com o papel `app_worker`. */
  readonly sql: postgres.Sql;
  readonly canal: CanalDeNotificacao;
  readonly segredoDaAplicacao: string;
  readonly hostnamePublico: string;
  /** Proteção da reputação do domínio (RN-NOT-07). */
  readonly limitePorHora: number;
  readonly agora?: () => Date;
  readonly tentativasMaximas?: number;
  readonly tamanhoDoLote?: number;
}

export interface ResumoDoLote {
  readonly reivindicados: number;
  readonly enviados: number;
  readonly cancelados: number;
  readonly adiados: number;
  readonly falhas: number;
  /** O limite por hora foi atingido: nada foi enviado além dele. */
  readonly limitado: boolean;
}

interface Envio {
  id: string;
  evento: EventoDeNotificacaoDto;
  payload: { rotulo?: string | null; texto?: string; descadastro?: string };
  tentativas: number;
  pessoa_id: string;
  email: string | null;
  email_invalido: boolean;
  pessoa_situacao: string;
  primeiro_nome: string;
  consentimento_vigente: boolean;
  protocolo: string;
  publicacao_link: string;
  segredo_link_cifrado: string;
  gabinete_telefone: string | null;
  gabinete_email: string | null;
  gabinete_nome: string | null;
}

const minuto = 60_000;
/** Instante como texto ISO: serve a qualquer configuração de tipos do cliente Postgres. */
const iso = (d: Date) => d.toISOString();
const formatarProtocolo = (p: string) => `${p.slice(0, 4)}-${p.slice(4, 8)}-${p.slice(8, 12)}`;

/**
 * Envia os e-mails da fila (outbox). NUNCA decide nada: só entrega o que o ato gravou, depois de
 * reconferir, no último instante, que o cidadão ainda consente e que o link ainda vale. Falha de
 * envio nunca desfaz o ato que a gerou: o envio é repetido com recuo, e o resultado fica na fila.
 */
export class ProcessadorDeEnvios {
  private readonly agora: () => Date;
  private readonly tentativasMaximas: number;
  private readonly tamanhoDoLote: number;

  constructor(private readonly o: OpcoesDoProcessador) {
    this.agora = o.agora ?? (() => new Date());
    this.tentativasMaximas = o.tentativasMaximas ?? 5;
    this.tamanhoDoLote = o.tamanhoDoLote ?? 20;
  }

  async processarLote(): Promise<ResumoDoLote> {
    const { sql } = this.o;
    const agora = this.agora();

    // Envio que ficou "enviando" além do prazo (o processo caiu no meio) volta para a fila.
    await sql`
      UPDATE envio_notificacao SET estado = 'pendente'
      WHERE estado = 'enviando' AND proxima_tentativa_em < ${iso(agora)}::timestamptz`;

    // Limite de envio por hora.
    const [enviadosNaHora] = await sql<{ total: string }[]>`
      SELECT count(*) AS total FROM envio_notificacao
      WHERE estado = 'enviado' AND enviado_em > ${iso(new Date(agora.getTime() - 60 * minuto))}::timestamptz`;
    const folga = this.o.limitePorHora - Number(enviadosNaHora?.total ?? 0);
    if (folga <= 0) {
      return {
        reivindicados: 0,
        enviados: 0,
        cancelados: 0,
        adiados: 0,
        falhas: 0,
        limitado: true,
      };
    }

    // Reivindica um lote (outro worker, se houver, não pega os mesmos).
    const ids = await sql.begin(async (tx) => {
      const linhas = await tx<{ id: string }[]>`
        SELECT id FROM envio_notificacao
        WHERE estado = 'pendente' AND proxima_tentativa_em <= ${iso(agora)}::timestamptz
        ORDER BY id LIMIT ${Math.min(this.tamanhoDoLote, folga)}
        FOR UPDATE SKIP LOCKED`;
      if (linhas.length === 0) return [];
      const lista = linhas.map((l) => l.id);
      await tx`
        UPDATE envio_notificacao
        SET estado = 'enviando', tentativas = tentativas + 1,
            proxima_tentativa_em = ${iso(new Date(agora.getTime() + 10 * minuto))}::timestamptz
        WHERE id IN ${tx(lista)}`;
      return lista;
    });

    const resumo = { reivindicados: ids.length, enviados: 0, cancelados: 0, adiados: 0, falhas: 0 };
    for (const id of ids) {
      const resultado = await this.processarUm(id);
      if (resultado === 'enviado') resumo.enviados += 1;
      else if (resultado === 'cancelado') resumo.cancelados += 1;
      else if (resultado === 'adiado') resumo.adiados += 1;
      else resumo.falhas += 1;
    }
    return { ...resumo, limitado: false };
  }

  private async processarUm(id: string): Promise<'enviado' | 'cancelado' | 'adiado' | 'falhou'> {
    const { sql } = this.o;
    const [envio] = await sql<Envio[]>`SELECT * FROM vw_envio_para_enviar WHERE id = ${id}`;
    if (!envio) return 'falhou';

    // Reconferência no último instante: o consentimento pode ter sido cancelado depois do ato.
    const motivo = this.motivoParaNaoEnviar(envio);
    if (motivo) {
      await sql`UPDATE envio_notificacao SET estado = 'cancelado', erro = ${motivo} WHERE id = ${id}`;
      return 'cancelado';
    }

    let linkDeAcompanhamento: string;
    try {
      linkDeAcompanhamento = montarLinkDeAcompanhamento(
        this.o.hostnamePublico,
        decifrarSegredoDeLink(envio.segredo_link_cifrado, this.o.segredoDaAplicacao),
      );
    } catch {
      await sql`UPDATE envio_notificacao SET estado = 'cancelado', erro = 'Link de acompanhamento indisponível' WHERE id = ${id}`;
      return 'cancelado';
    }
    const linkDeDescadastro = `https://${this.o.hostnamePublico}/d/${envio.payload.descadastro ?? ''}`;

    const conteudo = montarEmail({
      evento: envio.evento,
      primeiroNome: envio.primeiro_nome,
      protocolo: formatarProtocolo(envio.protocolo),
      rotulo: envio.payload.rotulo ?? null,
      texto: envio.payload.texto ?? null,
      linkDeAcompanhamento,
      linkDeDescadastro,
      gabinete: {
        nome: envio.gabinete_nome,
        telefone: envio.gabinete_telefone,
        email: envio.gabinete_email,
      },
    });

    try {
      const resultado = await this.o.canal.enviar({
        idDoEnvio: Number(id),
        para: envio.email as string,
        assunto: conteudo.assunto,
        texto: conteudo.texto,
        html: conteudo.html,
        linkDeDescadastro,
      });
      await sql`
        UPDATE envio_notificacao
        SET estado = 'enviado', enviado_em = ${iso(this.agora())}::timestamptz, provedor_id_mensagem = ${resultado.idNoProvedor}, erro = NULL
        WHERE id = ${id}`;
      return 'enviado';
    } catch (erro) {
      return this.registrarFalha(envio, erro);
    }
  }

  private motivoParaNaoEnviar(e: Envio): string | null {
    if (!e.consentimento_vigente) return 'Consentimento cancelado';
    if (e.pessoa_situacao !== 'ativa') return 'Pessoa inativa ou com dados eliminados';
    if (!e.email) return 'Sem e-mail cadastrado';
    if (e.email_invalido) return 'E-mail marcado como inválido';
    if (e.publicacao_link !== 'ativa') return 'O link de acompanhamento não está ativo';
    return null;
  }

  private async registrarFalha(e: Envio, erro: unknown): Promise<'adiado' | 'falhou'> {
    const { sql } = this.o;
    const mensagem = erro instanceof ErroDeEnvio ? erro.message : 'Erro inesperado no envio.';
    const permanente = erro instanceof ErroDeEnvio && erro.tipo === 'permanente';

    if (permanente) {
      await sql`UPDATE envio_notificacao SET estado = 'falhou', erro = ${mensagem} WHERE id = ${e.id}`;
      // O provedor recusou o endereço: a pessoa fica marcada até a equipe corrigir o e-mail.
      await sql`SELECT marcar_email_invalido(${e.pessoa_id})`;
      return 'falhou';
    }
    // `tentativas` já foi incrementada ao reivindicar.
    if (Number(e.tentativas) >= this.tentativasMaximas) {
      await sql`UPDATE envio_notificacao SET estado = 'falhou', erro = ${mensagem} WHERE id = ${e.id}`;
      return 'falhou';
    }
    // Recuo exponencial: 1, 2, 4, 8... minutos, no máximo 60.
    const espera = Math.min(2 ** (Number(e.tentativas) - 1), 60) * minuto;
    await sql`
      UPDATE envio_notificacao
      SET estado = 'pendente', erro = ${mensagem}, proxima_tentativa_em = ${iso(new Date(this.agora().getTime() + espera))}::timestamptz
      WHERE id = ${e.id}`;
    return 'adiado';
  }
}
