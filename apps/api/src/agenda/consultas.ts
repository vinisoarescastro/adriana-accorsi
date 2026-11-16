import {
  bloqueioIndisponibilidade,
  compromisso,
  participanteExterno,
  participanteInterno,
  pessoa,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import type {
  AgendaConsultada,
  CompromissoDto,
  ConflitoDeAgenda,
  ItemDaAgenda,
} from '@gabinete/compartilhado';
import { and, asc, eq, gte, inArray, isNull, lte, ne, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import { nivelDeVisao } from './visibilidade.js';

type LinhaDeCompromisso = typeof compromisso.$inferSelect;

export interface PeriodoDaAgenda {
  readonly de: Date;
  readonly ate: Date;
  readonly minha?: boolean | undefined;
}

/**
 * Leituras da agenda. A visibilidade (aberto, participantes, restrito) é decidida em UM lugar,
 * `nivelDeVisao`: quem não pode ver um compromisso Restrito não o recebe, nem como horário ocupado.
 */
export class ConsultasDeAgenda {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  /** Em quais destes compromissos o usuário foi indicado. */
  async participacoesDe(usuarioId: number, ids: readonly number[]): Promise<Set<number>> {
    if (ids.length === 0) return new Set();
    const linhas = await this.bd
      .select({ id: participanteInterno.compromissoId })
      .from(participanteInterno)
      .where(
        and(
          inArray(participanteInterno.compromissoId, [...ids]),
          eq(participanteInterno.usuarioId, usuarioId),
        ),
      );
    return new Set(linhas.map((l) => l.id));
  }

  /** O compromisso inteiro, com participantes. Só se chama para quem já pode vê-lo por inteiro. */
  async dtos(ator: Ator, linhas: readonly LinhaDeCompromisso[]): Promise<CompromissoDto[]> {
    if (linhas.length === 0) return [];
    const ids = linhas.map((l) => l.id);
    const criadores = alias(usuario, 'criadores');
    const [internos, externos, nomes] = await Promise.all([
      this.bd
        .select({
          compromissoId: participanteInterno.compromissoId,
          id: usuario.id,
          nome: usuario.nome,
          resposta: participanteInterno.resposta,
        })
        .from(participanteInterno)
        .innerJoin(usuario, eq(usuario.id, participanteInterno.usuarioId))
        .where(inArray(participanteInterno.compromissoId, ids))
        .orderBy(asc(usuario.nome)),
      this.bd
        .select({
          compromissoId: participanteExterno.compromissoId,
          id: pessoa.id,
          nome: pessoa.nomeCompleto,
        })
        .from(participanteExterno)
        .innerJoin(pessoa, eq(pessoa.id, participanteExterno.pessoaId))
        .where(inArray(participanteExterno.compromissoId, ids))
        .orderBy(asc(pessoa.nomeCompleto)),
      this.bd
        .select({ id: criadores.id, nome: criadores.nome })
        .from(criadores)
        .where(
          inArray(
            criadores.id,
            linhas.map((l) => l.criadorId),
          ),
        ),
    ]);
    const nomeDe = new Map(nomes.map((n) => [n.id, n.nome]));

    return linhas.map((l) => {
      const meus = internos.filter((i) => i.compromissoId === l.id);
      return {
        id: l.id,
        titulo: l.titulo,
        local: l.local,
        inicio: l.inicio.toISOString(),
        fim: l.fim.toISOString(),
        diaInteiro: l.diaInteiro,
        visibilidade: l.visibilidade,
        envolveParlamentar: l.envolveParlamentar,
        criador: nomeDe.get(l.criadorId) ?? '',
        cancelado: l.canceladoEm !== null,
        participantesInternos: meus.map((i) => ({ id: i.id, nome: i.nome, resposta: i.resposta })),
        participantesExternos: externos
          .filter((x) => x.compromissoId === l.id)
          .map((x) => ({ id: x.id, nome: x.nome })),
        minhaResposta: meus.find((i) => i.id === ator.usuarioId)?.resposta ?? null,
      };
    });
  }

  /** Cada compromisso vira o que o ator pode ver dele: tudo, só o horário, ou nada. */
  private async paraAgenda(
    ator: Ator,
    linhas: readonly LinhaDeCompromisso[],
  ): Promise<ItemDaAgenda[]> {
    const participa = await this.participacoesDe(
      ator.usuarioId,
      linhas.map((l) => l.id),
    );
    const completos: LinhaDeCompromisso[] = [];
    const itens = new Map<number, ItemDaAgenda>();
    for (const l of linhas) {
      const nivel = nivelDeVisao(l, ator, participa.has(l.id));
      if (nivel === 'completo') completos.push(l);
      else if (nivel === 'ocupado') {
        // Só o horário: nenhum id, título, local ou participante.
        itens.set(l.id, {
          tipo: 'ocupado',
          inicio: l.inicio.toISOString(),
          fim: l.fim.toISOString(),
          diaInteiro: l.diaInteiro,
        });
      }
    }
    for (const d of await this.dtos(ator, completos)) {
      itens.set(d.id, { tipo: 'compromisso', ...d });
    }
    return linhas.flatMap((l) => itens.get(l.id) ?? []);
  }

  async consultar(ator: Ator, periodo: PeriodoDaAgenda): Promise<AgendaConsultada> {
    const noPeriodo: SQL[] = [
      isNull(compromisso.canceladoEm),
      lte(compromisso.inicio, periodo.ate),
      gte(compromisso.fim, periodo.de),
    ];
    const linhas = await this.bd
      .select()
      .from(compromisso)
      .where(and(...noPeriodo))
      .orderBy(asc(compromisso.inicio), asc(compromisso.id));

    let selecionadas = linhas;
    if (periodo.minha) {
      const participa = await this.participacoesDe(
        ator.usuarioId,
        linhas.map((l) => l.id),
      );
      // "Minha agenda": onde fui indicado e, para a Parlamentar, o que a envolve (RN-AGE-08).
      selecionadas = linhas.filter(
        (l) => participa.has(l.id) || (ator.perfil === 'parlamentar' && l.envolveParlamentar),
      );
    }
    const itens = await this.paraAgenda(ator, selecionadas);

    const bloqueios =
      periodo.minha && ator.perfil !== 'parlamentar'
        ? []
        : await this.bd
            .select()
            .from(bloqueioIndisponibilidade)
            .where(
              and(
                isNull(bloqueioIndisponibilidade.canceladoEm),
                lte(bloqueioIndisponibilidade.inicio, periodo.ate),
                gte(bloqueioIndisponibilidade.fim, periodo.de),
              ),
            );
    const todos: ItemDaAgenda[] = [
      ...itens,
      ...bloqueios.map((b): ItemDaAgenda => ({
        tipo: 'bloqueio',
        id: b.id,
        inicio: b.inicio.toISOString(),
        fim: b.fim.toISOString(),
      })),
    ];
    todos.sort((x, y) => x.inicio.localeCompare(y.inicio));
    return { itens: todos };
  }

  /** Os próximos compromissos a partir de agora, no que o ator pode ver. */
  async proximos(ator: Ator, limite = 10): Promise<AgendaConsultada> {
    const linhas = await this.bd
      .select()
      .from(compromisso)
      .where(and(isNull(compromisso.canceladoEm), gte(compromisso.fim, this.agora())))
      .orderBy(asc(compromisso.inicio), asc(compromisso.id))
      .limit(limite * 3);
    const itens = (await this.paraAgenda(ator, linhas)).slice(0, limite);
    return { itens };
  }

  /** Um compromisso por inteiro. Para quem não o vê por inteiro, é "não encontrado". */
  async obter(ator: Ator, id: number): Promise<CompromissoDto> {
    const [linha] = await this.bd.select().from(compromisso).where(eq(compromisso.id, id)).limit(1);
    if (!linha) throw erros.naoEncontrado();
    const participa = await this.participacoesDe(ator.usuarioId, [id]);
    if (nivelDeVisao(linha, ator, participa.has(id)) !== 'completo') throw erros.naoEncontrado();
    const [dto] = await this.dtos(ator, [linha]);
    return dto as CompromissoDto;
  }

  /**
   * Conflitos de horário de um compromisso: com outro que envolva a mesma gente (ou a Parlamentar,
   * se este a envolve) e com bloqueios. É só aviso: não impede. Mostra apenas horário, e nunca o
   * que o ator não poderia ver (um Restrito alheio não vira "conflito").
   */
  async conflitos(
    ator: Ator,
    novo: {
      readonly id?: number;
      readonly inicio: Date;
      readonly fim: Date;
      readonly envolveParlamentar: boolean;
      readonly participantesInternos: readonly number[];
    },
  ): Promise<ConflitoDeAgenda[]> {
    const sobrepostos: SQL[] = [
      isNull(compromisso.canceladoEm),
      lte(compromisso.inicio, novo.fim),
      gte(compromisso.fim, novo.inicio),
    ];
    if (novo.id !== undefined) sobrepostos.push(ne(compromisso.id, novo.id));

    const candidatos = await this.bd
      .select()
      .from(compromisso)
      .where(and(...sobrepostos));
    const comParticipantes = novo.participantesInternos.length
      ? await this.bd
          .select({ id: participanteInterno.compromissoId })
          .from(participanteInterno)
          .where(
            and(
              inArray(
                participanteInterno.compromissoId,
                candidatos.map((c) => c.id),
              ),
              inArray(participanteInterno.usuarioId, [...novo.participantesInternos]),
            ),
          )
      : [];
    const mesmaGente = new Set(comParticipantes.map((p) => p.id));
    const participa = await this.participacoesDe(
      ator.usuarioId,
      candidatos.map((c) => c.id),
    );

    const conflitos: ConflitoDeAgenda[] = [];
    for (const c of candidatos) {
      const envolvidos = mesmaGente.has(c.id) || (novo.envolveParlamentar && c.envolveParlamentar);
      if (!envolvidos) continue;
      if (nivelDeVisao(c, ator, participa.has(c.id)) === 'oculto') continue;
      conflitos.push({
        tipo: 'compromisso',
        inicio: c.inicio.toISOString(),
        fim: c.fim.toISOString(),
      });
    }
    const bloqueios = await this.bd
      .select()
      .from(bloqueioIndisponibilidade)
      .where(
        and(
          isNull(bloqueioIndisponibilidade.canceladoEm),
          or(
            and(
              lte(bloqueioIndisponibilidade.inicio, novo.fim),
              gte(bloqueioIndisponibilidade.fim, novo.inicio),
            ),
          ),
        ),
      );
    for (const b of bloqueios) {
      conflitos.push({
        tipo: 'bloqueio',
        inicio: b.inicio.toISOString(),
        fim: b.fim.toISOString(),
      });
    }
    return conflitos;
  }
}
