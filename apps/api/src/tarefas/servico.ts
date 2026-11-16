import { nivelDoPerfil, pode } from '@gabinete/autorizacao';
import {
  compromisso,
  criarAvisos,
  demanda,
  etapa,
  etapaDeEntrada,
  evento,
  participanteInterno,
  pessoa,
  registrarMovimentacao,
  registrarTrilha,
  tarefa,
  tipoProcesso,
  usuario,
  type BancoDeDados,
  type Transacao,
} from '@gabinete/banco';
import type {
  CorpoAtualizarTarefa,
  CorpoNovaTarefa,
  Perfil,
  TarefaFicha,
} from '@gabinete/compartilhado';
import { and, eq } from 'drizzle-orm';
import { nivelDeVisao } from '../agenda/visibilidade.js';
import { carregarDemandaAlcancavel, hojeNoGabinete } from '../atendimento/comum.js';
import { mensagemDoPostgres } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import type { ConsultasDeTarefas } from './consultas.js';

export interface OpcoesDoServicoDeTarefas {
  readonly bd: BancoDeDados;
  readonly consultas: ConsultasDeTarefas;
  readonly agora: () => Date;
}

/** Quem pode editar, mover e cancelar: Supervisor ou superior, ou o responsável (RN-TAR-04). */
function exigirPodeAlterar(ator: Ator, responsavelId: number): void {
  if (nivelDoPerfil[ator.perfil] >= 3 || responsavelId === ator.usuarioId) return;
  throw erros.semPermissao('Só o responsável, o Supervisor ou superior alteram esta tarefa.');
}

const papeisDeSaida = ['conclusao', 'arquivamento'] as const;

export class ServicoDeTarefas {
  constructor(private readonly o: OpcoesDoServicoDeTarefas) {}

  private get bd() {
    return this.o.bd;
  }

  /** O usuário pode receber tarefa: ativo. (Tarefa não tem habilitação própria.) */
  private async carregarResponsavel(
    leitor: Pick<Transacao, 'select'>,
    usuarioId: number,
  ): Promise<{ id: number; perfil: Perfil }> {
    const [alvo] = await leitor
      .select({ id: usuario.id, perfil: usuario.perfil, situacao: usuario.situacao })
      .from(usuario)
      .where(eq(usuario.id, usuarioId))
      .limit(1);
    if (!alvo || alvo.situacao !== 'ativo') {
      throw erros.conflito('O responsável precisa ser um usuário ativo da equipe.');
    }
    return { id: alvo.id, perfil: alvo.perfil };
  }

  /**
   * O vínculo herda o alcance do registro: quem não o alcança não vincula (RN-TAR-03), e o
   * responsável Assessor Externo só recebe tarefa ligada a uma demanda sua.
   */
  private async validarVinculo(
    tx: Transacao,
    ator: Ator,
    responsavel: { id: number; perfil: Perfil },
    vinculo: NonNullable<CorpoNovaTarefa['vinculo']>,
  ): Promise<void> {
    const autoridade = { perfil: ator.perfil, habilitacoes: ator.habilitacoes };
    switch (vinculo.tipo) {
      case 'demanda': {
        if (!pode('demandas.consultar', autoridade)) throw erros.naoEncontrado();
        const d = await carregarDemandaAlcancavel(tx, ator, vinculo.id);
        if (d.canceladaEm) throw erros.conflito('Demanda cancelada não recebe tarefa nova.');
        if (responsavel.perfil === 'assessor_externo' && d.responsavelId !== responsavel.id) {
          throw erros.conflito('O responsável não alcança esta demanda.');
        }
        return;
      }
      case 'pessoa': {
        if (!pode('pessoas.consultar', autoridade)) throw erros.naoEncontrado();
        const [p] = await tx
          .select({ situacao: pessoa.situacao })
          .from(pessoa)
          .where(eq(pessoa.id, vinculo.id))
          .limit(1);
        if (!p || p.situacao === 'dados_eliminados') throw erros.naoEncontrado();
        return;
      }
      case 'evento': {
        if (!pode('eventos.consultar', autoridade)) throw erros.naoEncontrado();
        const [e] = await tx
          .select({ id: evento.id })
          .from(evento)
          .where(eq(evento.id, vinculo.id))
          .limit(1);
        if (!e) throw erros.naoEncontrado();
        return;
      }
      case 'compromisso': {
        if (!pode('agenda.consultar', autoridade)) throw erros.naoEncontrado();
        const [c] = await tx
          .select()
          .from(compromisso)
          .where(eq(compromisso.id, vinculo.id))
          .limit(1);
        if (!c || c.canceladoEm) throw erros.naoEncontrado();
        const [participa] = await tx
          .select({ u: participanteInterno.usuarioId })
          .from(participanteInterno)
          .where(
            and(
              eq(participanteInterno.compromissoId, c.id),
              eq(participanteInterno.usuarioId, ator.usuarioId),
            ),
          )
          .limit(1);
        if (nivelDeVisao(c, ator, participa !== undefined) !== 'completo') {
          throw erros.naoEncontrado();
        }
        return;
      }
    }
  }

  /** O Assessor Externo cria só para si; designar outra pessoa exige Assessor Interno (RN-TAR-01). */
  async criar(ator: Ator, dados: CorpoNovaTarefa): Promise<TarefaFicha> {
    const responsavelId = dados.responsavelId ?? ator.usuarioId;
    if (responsavelId !== ator.usuarioId && nivelDoPerfil[ator.perfil] < 2) {
      throw erros.semPermissao('Você só pode criar tarefas para si mesmo.');
    }
    // O prazo não pode ser anterior a hoje na criação (RN-TAR-02). Alterar depois pode.
    if (dados.prazo && dados.prazo < hojeNoGabinete(this.o.agora())) {
      throw erros.conflito('O prazo não pode ser anterior a hoje.');
    }

    const id = await this.bd.transaction(async (tx) => {
      const responsavel = await this.carregarResponsavel(tx, responsavelId);
      if (dados.vinculo) await this.validarVinculo(tx, ator, responsavel, dados.vinculo);

      const entrada = await etapaDeEntrada(tx, 'tarefa');
      const [criada] = await tx
        .insert(tarefa)
        .values({
          criadorId: ator.usuarioId,
          responsavelId,
          titulo: dados.titulo,
          descricao: dados.descricao ?? null,
          prioridade: dados.prioridade,
          prazo: dados.prazo ?? null,
          etapaAtualId: entrada.id,
          vinculoTipo: dados.vinculo?.tipo ?? null,
          vinculoId: dados.vinculo?.id ?? null,
          criadoEm: this.o.agora(),
        })
        .returning({ id: tarefa.id });
      const novaId = (criada as { id: number }).id;

      await registrarMovimentacao(tx, {
        registroTipo: 'tarefa',
        registroId: novaId,
        etapaOrigemId: null,
        etapaDestinoId: entrada.id,
        autorId: ator.usuarioId,
        criadaEm: this.o.agora(),
      });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'tarefa.criar',
        entidade: 'tarefa',
        registroId: novaId,
        valorNovo: {
          responsavelId,
          prioridade: dados.prioridade,
          prazo: dados.prazo ?? null,
          vinculo: dados.vinculo ?? null,
        },
      });
      await criarAvisos(tx, ator.usuarioId, [
        {
          destinatarioId: responsavelId,
          natureza: 'tarefa_designada',
          registroTipo: 'tarefa',
          registroId: novaId,
          geradoEm: this.o.agora(),
        },
      ]);
      return novaId;
    });
    return this.o.consultas.ficha(ator, id);
  }

  private async carregar(tx: Transacao, ator: Ator, id: number) {
    const [linha] = await tx.select().from(tarefa).where(eq(tarefa.id, id)).limit(1).for('update');
    if (!linha) throw erros.naoEncontrado();
    // Quem não alcança a tarefa recebe "não encontrada", igual a uma que não existe.
    if (nivelDoPerfil[ator.perfil] < 2 && linha.responsavelId !== ator.usuarioId) {
      throw erros.naoEncontrado();
    }
    return linha;
  }

  private exigirNaoCancelada(canceladaEm: Date | null): void {
    if (canceladaEm) throw erros.conflito('Tarefa cancelada não se altera.');
  }

  async editar(ator: Ator, id: number, dados: CorpoAtualizarTarefa): Promise<TarefaFicha> {
    const mudancas: Partial<typeof tarefa.$inferInsert> = {};
    if (dados.titulo !== undefined) mudancas.titulo = dados.titulo;
    if (dados.descricao !== undefined) mudancas.descricao = dados.descricao;
    if (dados.prioridade !== undefined) mudancas.prioridade = dados.prioridade;
    if (dados.prazo !== undefined) mudancas.prazo = dados.prazo;

    await this.bd.transaction(async (tx) => {
      const atual = await this.carregar(tx, ator, id);
      exigirPodeAlterar(ator, atual.responsavelId);
      this.exigirNaoCancelada(atual.canceladaEm);
      await tx.update(tarefa).set(mudancas).where(eq(tarefa.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'tarefa.editar',
        entidade: 'tarefa',
        registroId: id,
        valorAnterior: { prioridade: atual.prioridade, prazo: atual.prazo },
        valorNovo: { prioridade: mudancas.prioridade, prazo: mudancas.prazo },
      });
    });
    return this.o.consultas.ficha(ator, id);
  }

  /**
   * Move pelo mecanismo ÚNICO de movimentação. Reabrir (sair de concluída ou arquivada para uma
   * etapa em andamento) é do Supervisor ou superior (RN-TAR-04). Concluir a última tarefa de uma
   * demanda NÃO conclui a demanda: a tarefa não mexe em nenhum outro registro (RN-DEM-10).
   */
  async mover(ator: Ator, id: number, etapaId: number, observacao?: string): Promise<TarefaFicha> {
    await this.bd.transaction(async (tx) => {
      const atual = await this.carregar(tx, ator, id);
      exigirPodeAlterar(ator, atual.responsavelId);
      this.exigirNaoCancelada(atual.canceladaEm);
      if (atual.etapaAtualId === etapaId) throw erros.conflito('A tarefa já está nesta etapa.');

      const [origem] = await tx
        .select({ papel: etapa.papel })
        .from(etapa)
        .where(eq(etapa.id, atual.etapaAtualId))
        .limit(1);
      const [destino] = await tx
        .select({ id: etapa.id, situacao: etapa.situacao, papel: etapa.papel })
        .from(etapa)
        .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
        .where(and(eq(etapa.id, etapaId), eq(tipoProcesso.tipo, 'tarefa')))
        .limit(1);
      if (!destino) throw erros.requisicaoInvalida();
      if (destino.situacao !== 'ativa') throw erros.conflito('A etapa de destino está inativa.');

      const reabre =
        origem !== undefined &&
        papeisDeSaida.some((p) => p === origem.papel) &&
        (destino.papel === 'entrada' || destino.papel === 'intermediaria');
      if (reabre && nivelDoPerfil[ator.perfil] < 3) {
        throw erros.semPermissao('Só o Supervisor ou superior reabre uma tarefa concluída.');
      }

      await tx.update(tarefa).set({ etapaAtualId: etapaId }).where(eq(tarefa.id, id));
      await registrarMovimentacao(tx, {
        registroTipo: 'tarefa',
        registroId: id,
        etapaOrigemId: atual.etapaAtualId,
        etapaDestinoId: etapaId,
        autorId: ator.usuarioId,
        observacao: observacao ?? null,
        criadaEm: this.o.agora(),
      });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: reabre ? 'tarefa.reabrir' : 'tarefa.mover',
        entidade: 'tarefa',
        registroId: id,
        valorAnterior: { etapa: atual.etapaAtualId },
        valorNovo: { etapa: etapaId },
      });
    });
    return this.o.consultas.ficha(ator, id);
  }

  /** Designar a outra pessoa exige Assessor Interno (a operação). O novo responsável é avisado. */
  async reatribuir(ator: Ator, id: number, responsavelId: number): Promise<TarefaFicha> {
    await this.bd.transaction(async (tx) => {
      const atual = await this.carregar(tx, ator, id);
      this.exigirNaoCancelada(atual.canceladaEm);
      if (atual.responsavelId === responsavelId) throw erros.conflito('Este já é o responsável.');
      const novo = await this.carregarResponsavel(tx, responsavelId);
      if (atual.vinculoTipo === 'demanda' && novo.perfil === 'assessor_externo') {
        const [d] = await tx
          .select({ responsavelId: demanda.responsavelId })
          .from(demanda)
          .where(eq(demanda.id, atual.vinculoId as number))
          .limit(1);
        if (d?.responsavelId !== novo.id) {
          throw erros.conflito('O novo responsável não alcança a demanda desta tarefa.');
        }
      }
      await tx.update(tarefa).set({ responsavelId }).where(eq(tarefa.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'tarefa.reatribuir',
        entidade: 'tarefa',
        registroId: id,
        valorAnterior: { responsavelId: atual.responsavelId },
        valorNovo: { responsavelId },
      });
      await criarAvisos(tx, ator.usuarioId, [
        {
          destinatarioId: responsavelId,
          natureza: 'tarefa_reatribuida',
          registroTipo: 'tarefa',
          registroId: id,
          geradoEm: this.o.agora(),
        },
      ]);
    });
    return this.o.consultas.ficha(ator, id);
  }

  /** Cancelar exige justificativa. A tarefa cancelada não se altera mais (gatilho no banco). */
  async cancelar(ator: Ator, id: number, justificativa: string): Promise<TarefaFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        const atual = await this.carregar(tx, ator, id);
        exigirPodeAlterar(ator, atual.responsavelId);
        this.exigirNaoCancelada(atual.canceladaEm);
        await tx
          .update(tarefa)
          .set({
            canceladaEm: this.o.agora(),
            canceladaPor: ator.usuarioId,
            justificativaCancelamento: justificativa,
          })
          .where(eq(tarefa.id, id));
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'tarefa.cancelar',
          entidade: 'tarefa',
          registroId: id,
          valorAnterior: { etapa: atual.etapaAtualId },
          justificativa,
        });
      });
    } catch (erro) {
      if (mensagemDoPostgres(erro).includes('Tarefa cancelada')) {
        throw erros.conflito('Tarefa cancelada não se altera.');
      }
      throw erro;
    }
    return this.o.consultas.ficha(ator, id);
  }
}
