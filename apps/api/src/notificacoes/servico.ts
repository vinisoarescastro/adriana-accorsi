import {
  cancelarEnviosPendentes,
  consentimentoNotificacao,
  consentimentoVigente,
  demanda,
  envioNotificacao,
  formatarProtocolo,
  pessoa,
  registrarConsentimento,
  usuario,
  type BancoDeDados,
  type EstadoDeEnvio,
} from '@gabinete/banco';
import {
  estadosDeEnvio,
  type CorpoConsentimento,
  type EnvioDeEmail,
  type EstadoDeEnvioDto,
  type NotificacaoDaPessoa,
  type PaginaDeEnvios,
  type RegistroDeConsentimento,
} from '@gabinete/compartilhado';
import { count, desc, eq } from 'drizzle-orm';
import { paginar } from '../atendimento/comum.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

/**
 * Consentimento de notificação (LGPD) e a fila de e-mails visível ao Supervisor.
 * O consentimento começa desmarcado; cada mudança entra no histórico com data, origem e versão do
 * texto, e na trilha SEM dado pessoal (RN-NOT-01 a 03).
 */
export class ServicoDeNotificacoes {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  private async pessoaAtiva(id: number) {
    const [p] = await this.bd.select().from(pessoa).where(eq(pessoa.id, id)).limit(1);
    if (!p) throw erros.naoEncontrado();
    if (p.situacao === 'dados_eliminados') {
      throw erros.conflito('Os dados desta pessoa foram eliminados.');
    }
    return p;
  }

  private async situacaoDe(pessoaId: number): Promise<NotificacaoDaPessoa> {
    const p = await this.pessoaAtiva(pessoaId);
    const [ultimo] = await this.bd
      .select()
      .from(consentimentoNotificacao)
      .where(eq(consentimentoNotificacao.pessoaId, pessoaId))
      .orderBy(desc(consentimentoNotificacao.id))
      .limit(1);
    return {
      pessoaId,
      temEmail: !!p.email,
      emailInvalido: p.emailInvalido,
      consentimento: await consentimentoVigente(this.bd, pessoaId),
      registradoEm: ultimo?.registradoEm.toISOString() ?? null,
      origem: ultimo?.origem ?? null,
    };
  }

  async consultar(pessoaId: number): Promise<NotificacaoDaPessoa> {
    return this.situacaoDe(pessoaId);
  }

  /** Dar ou cancelar o consentimento (a equipe registra o pedido do cidadão por outro canal). */
  async registrar(
    ator: Ator,
    pessoaId: number,
    dados: CorpoConsentimento,
  ): Promise<NotificacaoDaPessoa> {
    const p = await this.pessoaAtiva(pessoaId);
    if (dados.consentido && !p.email) {
      throw erros.conflito('Cadastre o e-mail da pessoa antes de registrar o consentimento.');
    }
    if (dados.consentido && p.emailInvalido) {
      throw erros.conflito('O e-mail desta pessoa foi recusado pelo provedor. Corrija-o primeiro.');
    }
    await this.bd.transaction(async (tx) => {
      const mudou = await registrarConsentimento(tx, {
        pessoaId,
        consentido: dados.consentido,
        origem: dados.origem,
        registradoPor: ator.usuarioId,
        registradoEm: this.agora(),
        ...(dados.consentido ? { versaoTexto: dados.versaoTexto } : {}),
      });
      // Cancelar vale na hora: o que ainda não saiu não sai (RN-NOT-03).
      if (mudou && !dados.consentido) {
        await cancelarEnviosPendentes(tx, pessoaId, 'Consentimento cancelado');
      }
    });
    return this.situacaoDe(pessoaId);
  }

  async historico(pessoaId: number): Promise<RegistroDeConsentimento[]> {
    await this.pessoaAtiva(pessoaId);
    const linhas = await this.bd
      .select({
        id: consentimentoNotificacao.id,
        consentido: consentimentoNotificacao.consentido,
        origem: consentimentoNotificacao.origem,
        versaoTexto: consentimentoNotificacao.versaoTexto,
        registradoPor: usuario.nome,
        registradoEm: consentimentoNotificacao.registradoEm,
      })
      .from(consentimentoNotificacao)
      .leftJoin(usuario, eq(usuario.id, consentimentoNotificacao.registradoPor))
      .where(eq(consentimentoNotificacao.pessoaId, pessoaId))
      .orderBy(desc(consentimentoNotificacao.id));
    return linhas.map((l) => ({ ...l, registradoEm: l.registradoEm.toISOString() }));
  }

  // -------------------------------------------------------------------------
  // Fila de e-mails (Supervisor): enviado, falhou, cancelado (RN-NOT-08)
  // -------------------------------------------------------------------------

  async fila(filtro: {
    estado?: EstadoDeEnvioDto;
    pagina: number;
    porPagina: number;
  }): Promise<PaginaDeEnvios> {
    const onde = filtro.estado
      ? eq(envioNotificacao.estado, filtro.estado as EstadoDeEnvio)
      : undefined;
    const { limite, deslocamento } = paginar(filtro.pagina, filtro.porPagina);

    const itens = await this.bd
      .select({
        id: envioNotificacao.id,
        protocolo: demanda.protocolo,
        evento: envioNotificacao.evento,
        estado: envioNotificacao.estado,
        tentativas: envioNotificacao.tentativas,
        proximaTentativaEm: envioNotificacao.proximaTentativaEm,
        erro: envioNotificacao.erro,
        criadoEm: envioNotificacao.criadoEm,
        enviadoEm: envioNotificacao.enviadoEm,
      })
      .from(envioNotificacao)
      .innerJoin(demanda, eq(demanda.id, envioNotificacao.demandaId))
      .where(onde)
      .orderBy(desc(envioNotificacao.id))
      .limit(limite)
      .offset(deslocamento);

    const contagens = await this.bd
      .select({ estado: envioNotificacao.estado, total: count() })
      .from(envioNotificacao)
      .groupBy(envioNotificacao.estado);
    const porEstado = Object.fromEntries(estadosDeEnvio.map((e) => [e, 0])) as Record<
      EstadoDeEnvioDto,
      number
    >;
    for (const c of contagens) porEstado[c.estado] = c.total;
    const total = filtro.estado
      ? porEstado[filtro.estado]
      : Object.values(porEstado).reduce((a, b) => a + b, 0);

    return {
      itens: itens.map((i): EnvioDeEmail => ({
        id: i.id,
        protocolo: formatarProtocolo(i.protocolo),
        evento: i.evento,
        estado: i.estado,
        tentativas: i.tentativas,
        proximaTentativa: i.estado === 'pendente' ? i.proximaTentativaEm.toISOString() : null,
        erro: i.erro,
        criadoEm: i.criadoEm.toISOString(),
        enviadoEm: i.enviadoEm?.toISOString() ?? null,
      })),
      total,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
      porEstado,
    };
  }
}
