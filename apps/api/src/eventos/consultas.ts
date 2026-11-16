import { pode } from '@gabinete/autorizacao';
import { evento, participacaoEvento, pessoa, usuario, type BancoDeDados } from '@gabinete/banco';
import {
  formatarTelefone,
  janelaDeCorrecaoDaPresencaEmMinutos,
  type EventoDto,
  type EventoFicha,
  type PaginaDeEventos,
  type PresencaDto,
} from '@gabinete/compartilhado';
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { paginar } from '../atendimento/comum.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

const criador = alias(usuario, 'criador');
const registrador = alias(usuario, 'registrador');

/** Quem registrou corrige a própria presença só dentro da janela; depois, Assessor Interno ou superior. */
export function presencaCorrigivel(
  ator: Ator,
  presenca: { registradoPor: number; registradoEm: Date },
  agora: Date,
): boolean {
  if (pode('eventos.organizar', { perfil: ator.perfil, habilitacoes: ator.habilitacoes })) {
    return true;
  }
  const decorridoMs = agora.getTime() - presenca.registradoEm.getTime();
  return (
    presenca.registradoPor === ator.usuarioId &&
    decorridoMs <= janelaDeCorrecaoDaPresencaEmMinutos * 60_000
  );
}

export class ConsultasDeEventos {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  private presentes = sql<number>`(SELECT count(*)::int FROM participacao_evento p WHERE p.evento_id = ${evento.id})`;

  private selecao() {
    return this.bd
      .select({
        id: evento.id,
        nome: evento.nome,
        inicio: evento.inicio,
        local: evento.local,
        situacao: evento.situacao,
        encerradoEm: evento.encerradoEm,
        criadorNome: criador.nome,
        presentes: this.presentes,
      })
      .from(evento)
      .innerJoin(criador, eq(criador.id, evento.criadorId));
  }

  private mapear(l: Awaited<ReturnType<ConsultasDeEventos['selecao']>>[number]): EventoDto {
    return {
      id: l.id,
      nome: l.nome,
      inicio: l.inicio.toISOString(),
      local: l.local,
      situacao: l.situacao,
      encerradoEm: l.encerradoEm?.toISOString() ?? null,
      criador: l.criadorNome,
      presentes: Number(l.presentes),
    };
  }

  async listar(filtro: {
    pagina: number;
    porPagina: number;
    situacao?: 'aberto' | 'encerrado' | undefined;
  }): Promise<PaginaDeEventos> {
    const onde: SQL | undefined = filtro.situacao
      ? and(eq(evento.situacao, filtro.situacao))
      : undefined;
    const [total] = await this.bd.select({ total: count() }).from(evento).where(onde);
    const { limite, deslocamento } = paginar(filtro.pagina, filtro.porPagina);
    const linhas = await this.selecao()
      .where(onde)
      .orderBy(desc(evento.inicio), desc(evento.id))
      .limit(limite)
      .offset(deslocamento);
    return {
      itens: linhas.map((l) => this.mapear(l)),
      total: total?.total ?? 0,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  /** O evento aberto mais próximo de agora, antes ou depois (encerrar é decisão de alguém, não da data). */
  async maisProximo(): Promise<EventoDto | null> {
    const [linha] = await this.selecao()
      .where(eq(evento.situacao, 'aberto'))
      .orderBy(
        sql`abs(extract(epoch FROM (${evento.inicio} - ${this.agora().toISOString()}::timestamptz)))`,
        asc(evento.id),
      )
      .limit(1);
    return linha ? this.mapear(linha) : null;
  }

  async presencas(ator: Ator, eventoId: number): Promise<PresencaDto[]> {
    const listaNominal = pode('eventos.lista_nominal', {
      perfil: ator.perfil,
      habilitacoes: ator.habilitacoes,
    });
    const linhas = await this.bd
      .select({
        pessoaId: pessoa.id,
        nome: pessoa.nomeCompleto,
        telefone: pessoa.telefoneNormalizado,
        observacao: participacaoEvento.observacao,
        registradoPorId: participacaoEvento.registradoPor,
        registradoPorNome: registrador.nome,
        registradoEm: participacaoEvento.registradoEm,
      })
      .from(participacaoEvento)
      .innerJoin(pessoa, eq(pessoa.id, participacaoEvento.pessoaId))
      .innerJoin(registrador, eq(registrador.id, participacaoEvento.registradoPor))
      .where(
        and(
          eq(participacaoEvento.eventoId, eventoId),
          listaNominal ? undefined : eq(participacaoEvento.registradoPor, ator.usuarioId),
        ),
      )
      .orderBy(asc(participacaoEvento.registradoEm), asc(pessoa.id));

    const [aberto] = await this.bd
      .select({ situacao: evento.situacao })
      .from(evento)
      .where(eq(evento.id, eventoId))
      .limit(1);
    return linhas.map((l) => ({
      pessoaId: l.pessoaId,
      nome: l.nome,
      telefone: l.telefone ? formatarTelefone(l.telefone) : null,
      observacao: l.observacao,
      registradoPor: l.registradoPorNome,
      registradoEm: l.registradoEm.toISOString(),
      corrigivel:
        aberto?.situacao === 'aberto' &&
        presencaCorrigivel(
          ator,
          { registradoPor: l.registradoPorId, registradoEm: l.registradoEm },
          this.agora(),
        ),
    }));
  }

  async ficha(ator: Ator, id: number): Promise<EventoFicha> {
    const [linha] = await this.selecao().where(eq(evento.id, id)).limit(1);
    if (!linha) throw erros.naoEncontrado();
    return {
      ...this.mapear(linha),
      presencas: await this.presencas(ator, id),
      listaNominalCompleta: pode('eventos.lista_nominal', {
        perfil: ator.perfil,
        habilitacoes: ator.habilitacoes,
      }),
    };
  }

  async existentes(ids: readonly number[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const linhas = await this.bd
      .select({ id: evento.id })
      .from(evento)
      .where(inArray(evento.id, [...ids]));
    return linhas.map((l) => l.id);
  }
}
