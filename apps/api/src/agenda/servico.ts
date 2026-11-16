import { pode } from '@gabinete/autorizacao';
import {
  bloqueioIndisponibilidade,
  compromisso,
  criarAvisos,
  participanteExterno,
  participanteInterno,
  registrarTrilha,
  type BancoDeDados,
  type Transacao,
} from '@gabinete/banco';
import {
  type CompromissoSalvo,
  type ConflitoDeAgenda,
  type CorpoAtualizarCompromisso,
  type CorpoNovoBloqueio,
  type CorpoNovoCompromisso,
  type RespostaDeParticipanteDto,
} from '@gabinete/compartilhado';
import { and, eq, inArray } from 'drizzle-orm';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import type { ConsultasDeAgenda } from './consultas.js';
import { validarExternos, validarInternos } from './participantes.js';
import { nivelDeVisao } from './visibilidade.js';

export interface OpcoesDoServicoDeAgenda {
  readonly bd: BancoDeDados;
  readonly consultas: ConsultasDeAgenda;
  readonly agora: () => Date;
}

const unicos = (ids: readonly number[]) => [...new Set(ids)];

export class ServicoDeAgenda {
  constructor(private readonly o: OpcoesDoServicoDeAgenda) {}

  private get bd() {
    return this.o.bd;
  }

  private exigirPodeRestrito(ator: Ator): void {
    if (!pode('agenda.criar_restrito', { perfil: ator.perfil, habilitacoes: ator.habilitacoes })) {
      throw erros.semPermissao('Só o Supervisor ou superior cria ou altera compromisso Restrito.');
    }
  }

  /** O compromisso, se o ator o vê por inteiro; senão "não encontrado" (igual a um que não existe). */
  private async carregar(tx: Transacao, ator: Ator, id: number) {
    const [linha] = await tx
      .select()
      .from(compromisso)
      .where(eq(compromisso.id, id))
      .limit(1)
      .for('update');
    if (!linha) throw erros.naoEncontrado();
    const [participa] = await tx
      .select({ u: participanteInterno.usuarioId })
      .from(participanteInterno)
      .where(
        and(
          eq(participanteInterno.compromissoId, id),
          eq(participanteInterno.usuarioId, ator.usuarioId),
        ),
      )
      .limit(1);
    if (nivelDeVisao(linha, ator, participa !== undefined) !== 'completo') {
      throw erros.naoEncontrado();
    }
    return linha;
  }

  private exigirNaoCancelado(canceladoEm: Date | null): void {
    if (canceladoEm) throw erros.conflito('Compromisso cancelado não se altera.');
  }

  async criar(ator: Ator, dados: CorpoNovoCompromisso): Promise<CompromissoSalvo> {
    if (dados.visibilidade === 'restrito') this.exigirPodeRestrito(ator);
    const internos = unicos(dados.participantesInternos);
    const externos = unicos(dados.participantesExternos);
    const inicio = new Date(dados.inicio);
    const fim = new Date(dados.fim);

    const id = await this.bd.transaction(async (tx) => {
      await validarInternos(tx, internos);
      await validarExternos(tx, externos);
      const [criado] = await tx
        .insert(compromisso)
        .values({
          criadorId: ator.usuarioId,
          titulo: dados.titulo,
          descricao: dados.descricao || null,
          local: dados.local ?? null,
          inicio,
          fim,
          diaInteiro: dados.diaInteiro,
          visibilidade: dados.visibilidade,
          envolveParlamentar: dados.envolveParlamentar,
          criadoEm: this.o.agora(),
        })
        .returning({ id: compromisso.id });
      const novoId = (criado as { id: number }).id;
      if (internos.length > 0) {
        await tx
          .insert(participanteInterno)
          .values(internos.map((usuarioId) => ({ compromissoId: novoId, usuarioId })));
      }
      if (externos.length > 0) {
        await tx
          .insert(participanteExterno)
          .values(externos.map((pessoaId) => ({ compromissoId: novoId, pessoaId })));
      }
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'compromisso.criar',
        entidade: 'compromisso',
        registroId: novoId,
        valorNovo: {
          inicio: dados.inicio,
          fim: dados.fim,
          visibilidade: dados.visibilidade,
          envolveParlamentar: dados.envolveParlamentar,
          participantesInternos: internos,
          participantesExternos: externos,
        },
      });
      // Só a indicação explícita avisa. A marca "envolve a Parlamentar" nunca gera aviso (RN-AGE-08).
      await criarAvisos(
        tx,
        ator.usuarioId,
        internos.map((destinatarioId) => ({
          destinatarioId,
          natureza: 'compromisso_indicacao' as const,
          registroTipo: 'compromisso' as const,
          registroId: novoId,
          geradoEm: this.o.agora(),
        })),
      );
      return novoId;
    });
    return this.salvo(ator, id);
  }

  private async salvo(ator: Ator, id: number): Promise<CompromissoSalvo> {
    const dto = await this.o.consultas.obter(ator, id);
    const conflitos = await this.o.consultas.conflitos(ator, {
      id,
      inicio: new Date(dto.inicio),
      fim: new Date(dto.fim),
      envolveParlamentar: dto.envolveParlamentar,
      participantesInternos: dto.participantesInternos.map((p) => p.id),
    });
    return { compromisso: dto, conflitos };
  }

  /**
   * Altera, remarca e troca participantes. Os NOVOS indicados recebem o aviso de indicação; os que
   * já estavam, o de remarcação (se o horário mudou). A resposta dos que ficam é preservada.
   */
  async editar(
    ator: Ator,
    id: number,
    dados: CorpoAtualizarCompromisso,
  ): Promise<CompromissoSalvo> {
    await this.bd.transaction(async (tx) => {
      const atual = await this.carregar(tx, ator, id);
      this.exigirNaoCancelado(atual.canceladoEm);
      if (atual.visibilidade === 'restrito' || dados.visibilidade === 'restrito') {
        this.exigirPodeRestrito(ator);
      }
      const inicio = dados.inicio ? new Date(dados.inicio) : atual.inicio;
      const fim = dados.fim ? new Date(dados.fim) : atual.fim;
      if (fim < inicio) throw erros.conflito('O fim não pode ser anterior ao início.');

      const mudancas: Partial<typeof compromisso.$inferInsert> = { inicio, fim };
      if (dados.titulo !== undefined) mudancas.titulo = dados.titulo;
      if (dados.descricao !== undefined) mudancas.descricao = dados.descricao || null;
      if (dados.local !== undefined) mudancas.local = dados.local;
      if (dados.diaInteiro !== undefined) mudancas.diaInteiro = dados.diaInteiro;
      if (dados.visibilidade !== undefined) mudancas.visibilidade = dados.visibilidade;
      if (dados.envolveParlamentar !== undefined) {
        mudancas.envolveParlamentar = dados.envolveParlamentar;
      }
      await tx.update(compromisso).set(mudancas).where(eq(compromisso.id, id));

      const antes = (
        await tx
          .select({ usuarioId: participanteInterno.usuarioId })
          .from(participanteInterno)
          .where(eq(participanteInterno.compromissoId, id))
      ).map((p) => p.usuarioId);
      let depois = antes;
      if (dados.participantesInternos) {
        depois = unicos(dados.participantesInternos);
        const novos = depois.filter((u) => !antes.includes(u));
        const removidos = antes.filter((u) => !depois.includes(u));
        await validarInternos(tx, novos);
        if (removidos.length > 0) {
          await tx
            .delete(participanteInterno)
            .where(
              and(
                eq(participanteInterno.compromissoId, id),
                inArray(participanteInterno.usuarioId, removidos),
              ),
            );
        }
        if (novos.length > 0) {
          await tx
            .insert(participanteInterno)
            .values(novos.map((usuarioId) => ({ compromissoId: id, usuarioId })));
        }
      }
      if (dados.participantesExternos) {
        const externos = unicos(dados.participantesExternos);
        await validarExternos(tx, externos);
        await tx.delete(participanteExterno).where(eq(participanteExterno.compromissoId, id));
        if (externos.length > 0) {
          await tx
            .insert(participanteExterno)
            .values(externos.map((pessoaId) => ({ compromissoId: id, pessoaId })));
        }
      }

      const remarcado =
        inicio.getTime() !== atual.inicio.getTime() || fim.getTime() !== atual.fim.getTime();
      const novos = depois.filter((u) => !antes.includes(u));
      const quemFicou = depois.filter((u) => antes.includes(u));
      const geradoEm = this.o.agora();
      await criarAvisos(tx, ator.usuarioId, [
        ...novos.map((destinatarioId) => ({
          destinatarioId,
          natureza: 'compromisso_indicacao' as const,
          registroTipo: 'compromisso' as const,
          registroId: id,
          geradoEm,
        })),
        ...(remarcado
          ? quemFicou.map((destinatarioId) => ({
              destinatarioId,
              natureza: 'compromisso_remarcado' as const,
              registroTipo: 'compromisso' as const,
              registroId: id,
              geradoEm,
            }))
          : []),
      ]);
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: remarcado ? 'compromisso.remarcar' : 'compromisso.editar',
        entidade: 'compromisso',
        registroId: id,
        valorAnterior: {
          inicio: atual.inicio.toISOString(),
          fim: atual.fim.toISOString(),
          visibilidade: atual.visibilidade,
          participantesInternos: antes,
        },
        valorNovo: {
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          visibilidade: mudancas.visibilidade ?? atual.visibilidade,
          participantesInternos: depois,
        },
      });
    });
    return this.salvo(ator, id);
  }

  async cancelar(ator: Ator, id: number): Promise<CompromissoSalvo> {
    await this.bd.transaction(async (tx) => {
      const atual = await this.carregar(tx, ator, id);
      this.exigirNaoCancelado(atual.canceladoEm);
      if (atual.visibilidade === 'restrito') this.exigirPodeRestrito(ator);
      const participantes = (
        await tx
          .select({ usuarioId: participanteInterno.usuarioId })
          .from(participanteInterno)
          .where(eq(participanteInterno.compromissoId, id))
      ).map((p) => p.usuarioId);
      await tx
        .update(compromisso)
        .set({ canceladoEm: this.o.agora(), canceladoPor: ator.usuarioId })
        .where(eq(compromisso.id, id));
      await criarAvisos(
        tx,
        ator.usuarioId,
        participantes.map((destinatarioId) => ({
          destinatarioId,
          natureza: 'compromisso_cancelado' as const,
          registroTipo: 'compromisso' as const,
          registroId: id,
          geradoEm: this.o.agora(),
        })),
      );
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'compromisso.cancelar',
        entidade: 'compromisso',
        registroId: id,
        valorAnterior: { inicio: atual.inicio.toISOString(), fim: atual.fim.toISOString() },
      });
    });
    return { compromisso: await this.o.consultas.obter(ator, id), conflitos: [] };
  }

  /**
   * A resposta é só informativa: recusar NÃO cancela o compromisso nem remove o participante
   * (RN-AGE-04). Só responde quem foi indicado como participante interno.
   */
  async responder(
    ator: Ator,
    id: number,
    resposta: RespostaDeParticipanteDto,
  ): Promise<CompromissoSalvo> {
    await this.bd.transaction(async (tx) => {
      const [indicado] = await tx
        .select({ c: compromisso.canceladoEm })
        .from(participanteInterno)
        .innerJoin(compromisso, eq(compromisso.id, participanteInterno.compromissoId))
        .where(
          and(
            eq(participanteInterno.compromissoId, id),
            eq(participanteInterno.usuarioId, ator.usuarioId),
          ),
        )
        .limit(1);
      if (!indicado) throw erros.naoEncontrado();
      this.exigirNaoCancelado(indicado.c);
      await tx
        .update(participanteInterno)
        .set({ resposta, respondidoEm: resposta === 'sem_resposta' ? null : this.o.agora() })
        .where(
          and(
            eq(participanteInterno.compromissoId, id),
            eq(participanteInterno.usuarioId, ator.usuarioId),
          ),
        );
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'compromisso.responder',
        entidade: 'compromisso',
        registroId: id,
        valorNovo: { resposta },
      });
    });
    return this.salvo(ator, id);
  }

  // -------------------------------------------------------------------------
  // Bloqueios de indisponibilidade: entram na agenda e no conflito, sem motivo (RN-AGE-06).
  // -------------------------------------------------------------------------

  async criarBloqueio(
    ator: Ator,
    dados: CorpoNovoBloqueio,
  ): Promise<{ id: number; inicio: string; fim: string; conflitos: ConflitoDeAgenda[] }> {
    const inicio = new Date(dados.inicio);
    const fim = new Date(dados.fim);
    if (fim <= inicio) throw erros.conflito('O fim precisa ser depois do início.');
    const conflitos = await this.o.consultas.conflitos(ator, {
      inicio,
      fim,
      envolveParlamentar: true,
      participantesInternos: [],
    });
    const id = await this.bd.transaction(async (tx) => {
      const [criado] = await tx
        .insert(bloqueioIndisponibilidade)
        .values({ criadorId: ator.usuarioId, inicio, fim, criadoEm: this.o.agora() })
        .returning({ id: bloqueioIndisponibilidade.id });
      const novoId = (criado as { id: number }).id;
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'bloqueio.criar',
        entidade: 'bloqueio',
        registroId: novoId,
        valorNovo: { inicio: dados.inicio, fim: dados.fim },
      });
      return novoId;
    });
    return { id, inicio: inicio.toISOString(), fim: fim.toISOString(), conflitos };
  }

  async cancelarBloqueio(ator: Ator, id: number): Promise<void> {
    await this.bd.transaction(async (tx) => {
      const [atual] = await tx
        .select()
        .from(bloqueioIndisponibilidade)
        .where(eq(bloqueioIndisponibilidade.id, id))
        .limit(1)
        .for('update');
      if (!atual) throw erros.naoEncontrado();
      if (atual.canceladoEm) throw erros.conflito('O bloqueio já foi cancelado.');
      await tx
        .update(bloqueioIndisponibilidade)
        .set({ canceladoEm: this.o.agora(), canceladoPor: ator.usuarioId })
        .where(eq(bloqueioIndisponibilidade.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'bloqueio.cancelar',
        entidade: 'bloqueio',
        registroId: id,
      });
    });
  }
}
