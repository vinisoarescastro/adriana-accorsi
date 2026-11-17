import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  etapa,
  etapaDeEntrada,
  projetoAssunto,
  projetoCoautor,
  projetoLei,
  registrarMovimentacao,
  registrarTrilha,
  tipoProcesso,
  type BancoDeDados,
} from '@gabinete/banco';
import type {
  CorpoAtualizarProjeto,
  CorpoNovoProjeto,
  ProjetoFicha,
} from '@gabinete/compartilhado';
import { and, eq } from 'drizzle-orm';
import { hojeNoGabinete } from '../atendimento/comum.js';
import { mensagemDoPostgres, violouUnicidade } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import {
  carregarProjeto,
  exigirCategorias,
  exigirNaoCancelado,
  exigirPodeAlterar,
  exigirResponsavelDoLegislativo,
  nomesUnicos,
} from './comum.js';
import type { ConsultasDeProjetos } from './consultas.js';

export interface OpcoesDoServicoDeProjetos {
  readonly bd: BancoDeDados;
  readonly consultas: ConsultasDeProjetos;
  readonly agora: () => Date;
}

const mensagemDeNumeroRepetido = 'Já existe um projeto ativo com este número.';
const papeisDeSaida = ['conclusao', 'arquivamento'] as const;

/**
 * Projetos de lei. Percorrem as etapas do fluxo federal pelo mecanismo único de movimentação, sem
 * máquina de estados própria. O status e o atraso nunca são gravados.
 */
export class ServicoDeProjetos {
  constructor(private readonly o: OpcoesDoServicoDeProjetos) {}

  private get bd() {
    return this.o.bd;
  }

  /** O prazo não pode ser anterior a hoje na criação (RN-PRO-01). Alterar depois pode. */
  async criar(ator: Ator, dados: CorpoNovoProjeto): Promise<ProjetoFicha> {
    if (dados.prazo && dados.prazo < hojeNoGabinete(this.o.agora())) {
      throw erros.conflito('O prazo não pode ser anterior a hoje.');
    }
    const responsavelId = dados.responsavelId ?? ator.usuarioId;

    let id: number;
    try {
      id = await this.bd.transaction(async (tx) => {
        await exigirResponsavelDoLegislativo(tx, responsavelId);
        await exigirCategorias(
          tx,
          'tipo_proposicao',
          [dados.tipoProposicaoId],
          'Tipo de proposição inválido ou inativo.',
        );
        const assuntos = await exigirCategorias(
          tx,
          'assunto_projeto',
          dados.assuntos,
          'Há assunto inválido ou inativo.',
        );

        const entrada = await etapaDeEntrada(tx, 'projeto_lei');
        const [criado] = await tx
          .insert(projetoLei)
          .values({
            criadorId: ator.usuarioId,
            responsavelId,
            titulo: dados.titulo,
            ementa: dados.ementa,
            autoria: dados.autoria,
            numero: dados.numero ?? null,
            tipoProposicaoId: dados.tipoProposicaoId,
            etapaAtualId: entrada.id,
            prazo: dados.prazo ?? null,
            criadoEm: this.o.agora(),
          })
          .returning({ id: projetoLei.id });
        const novoId = (criado as { id: number }).id;

        if (assuntos.length > 0) {
          await tx
            .insert(projetoAssunto)
            .values(assuntos.map((categoriaId) => ({ projetoId: novoId, categoriaId })));
        }
        const coautores = nomesUnicos(dados.coautores);
        if (coautores.length > 0) {
          await tx
            .insert(projetoCoautor)
            .values(coautores.map((nome) => ({ projetoId: novoId, nome })));
        }
        await registrarMovimentacao(tx, {
          registroTipo: 'projeto_lei',
          registroId: novoId,
          etapaOrigemId: null,
          etapaDestinoId: entrada.id,
          autorId: ator.usuarioId,
          criadaEm: this.o.agora(),
        });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'projeto.criar',
          entidade: 'projeto_lei',
          registroId: novoId,
          valorNovo: {
            responsavelId,
            numero: dados.numero ?? null,
            tipoProposicaoId: dados.tipoProposicaoId,
            prazo: dados.prazo ?? null,
          },
        });
        return novoId;
      });
    } catch (erro) {
      if (violouUnicidade(erro)) throw erros.conflito(mensagemDeNumeroRepetido);
      throw erro;
    }
    return this.o.consultas.ficha(id);
  }

  async editar(ator: Ator, id: number, dados: CorpoAtualizarProjeto): Promise<ProjetoFicha> {
    const mudancas: Partial<typeof projetoLei.$inferInsert> = {};
    if (dados.titulo !== undefined) mudancas.titulo = dados.titulo;
    if (dados.ementa !== undefined) mudancas.ementa = dados.ementa;
    if (dados.autoria !== undefined) mudancas.autoria = dados.autoria;
    if (dados.numero !== undefined) mudancas.numero = dados.numero;
    if (dados.tipoProposicaoId !== undefined) mudancas.tipoProposicaoId = dados.tipoProposicaoId;
    if (dados.prazo !== undefined) mudancas.prazo = dados.prazo;

    try {
      await this.bd.transaction(async (tx) => {
        const atual = await carregarProjeto(tx, id);
        exigirPodeAlterar(ator, atual);
        exigirNaoCancelado(atual);
        if (dados.tipoProposicaoId !== undefined) {
          await exigirCategorias(
            tx,
            'tipo_proposicao',
            [dados.tipoProposicaoId],
            'Tipo de proposição inválido ou inativo.',
          );
        }
        await tx.update(projetoLei).set(mudancas).where(eq(projetoLei.id, id));
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'projeto.editar',
          entidade: 'projeto_lei',
          registroId: id,
          valorAnterior: { numero: atual.numero, prazo: atual.prazo },
          valorNovo: {
            campos: Object.keys(mudancas),
            numero: mudancas.numero ?? atual.numero,
            prazo: mudancas.prazo === undefined ? atual.prazo : mudancas.prazo,
          },
        });
      });
    } catch (erro) {
      if (violouUnicidade(erro)) throw erros.conflito(mensagemDeNumeroRepetido);
      throw erro;
    }
    return this.o.consultas.ficha(id);
  }

  /**
   * Move pelo mecanismo ÚNICO de movimentação. A etapa de destino precisa ser do fluxo de projeto de lei
   * e estar ativa (o banco repete a regra). Reabrir (sair de concluído ou arquivado para uma etapa em
   * andamento) é do Supervisor ou superior, como nas tarefas.
   */
  async mover(ator: Ator, id: number, etapaId: number, observacao?: string): Promise<ProjetoFicha> {
    await this.bd.transaction(async (tx) => {
      const atual = await carregarProjeto(tx, id);
      exigirPodeAlterar(ator, atual);
      exigirNaoCancelado(atual);
      if (atual.etapaAtualId === etapaId) throw erros.conflito('O projeto já está nesta etapa.');

      const [origem] = await tx
        .select({ papel: etapa.papel })
        .from(etapa)
        .where(eq(etapa.id, atual.etapaAtualId))
        .limit(1);
      const [destino] = await tx
        .select({ id: etapa.id, situacao: etapa.situacao, papel: etapa.papel })
        .from(etapa)
        .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
        .where(and(eq(etapa.id, etapaId), eq(tipoProcesso.tipo, 'projeto_lei')))
        .limit(1);
      if (!destino) throw erros.requisicaoInvalida();
      if (destino.situacao !== 'ativa') throw erros.conflito('A etapa de destino está inativa.');

      const reabre =
        origem !== undefined &&
        papeisDeSaida.some((p) => p === origem.papel) &&
        (destino.papel === 'entrada' || destino.papel === 'intermediaria');
      if (reabre && nivelDoPerfil[ator.perfil] < 3) {
        throw erros.semPermissao('Só o Supervisor ou superior reabre um projeto encerrado.');
      }

      await tx.update(projetoLei).set({ etapaAtualId: etapaId }).where(eq(projetoLei.id, id));
      await registrarMovimentacao(tx, {
        registroTipo: 'projeto_lei',
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
        operacao: reabre ? 'projeto.reabrir' : 'projeto.mover',
        entidade: 'projeto_lei',
        registroId: id,
        valorAnterior: { etapa: atual.etapaAtualId },
        valorNovo: { etapa: etapaId },
      });
    });
    return this.o.consultas.ficha(id);
  }

  async reatribuir(ator: Ator, id: number, responsavelId: number): Promise<ProjetoFicha> {
    await this.bd.transaction(async (tx) => {
      const atual = await carregarProjeto(tx, id);
      exigirNaoCancelado(atual);
      if (atual.responsavelId === responsavelId) throw erros.conflito('Este já é o responsável.');
      await exigirResponsavelDoLegislativo(tx, responsavelId);
      await tx.update(projetoLei).set({ responsavelId }).where(eq(projetoLei.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'projeto.reatribuir',
        entidade: 'projeto_lei',
        registroId: id,
        valorAnterior: { responsavelId: atual.responsavelId },
        valorNovo: { responsavelId },
      });
    });
    return this.o.consultas.ficha(id);
  }

  /** Cancelar exige justificativa. O projeto cancelado não se altera mais (gatilho no banco). */
  async cancelar(ator: Ator, id: number, justificativa: string): Promise<ProjetoFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        const atual = await carregarProjeto(tx, id);
        exigirNaoCancelado(atual);
        await tx
          .update(projetoLei)
          .set({
            canceladoEm: this.o.agora(),
            canceladoPor: ator.usuarioId,
            justificativaCancelamento: justificativa,
          })
          .where(eq(projetoLei.id, id));
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'projeto.cancelar',
          entidade: 'projeto_lei',
          registroId: id,
          valorAnterior: { etapa: atual.etapaAtualId },
          justificativa,
        });
      });
    } catch (erro) {
      if (mensagemDoPostgres(erro).includes('Projeto cancelado')) {
        throw erros.conflito('Projeto cancelado não se altera.');
      }
      throw erro;
    }
    return this.o.consultas.ficha(id);
  }
}
