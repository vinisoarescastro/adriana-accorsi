import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  emenda,
  emendaValor,
  etapa,
  etapaDeEntrada,
  registrarMovimentacao,
  registrarTrilha,
  type BancoDeDados,
} from '@gabinete/banco';
import {
  formatarReais,
  paraCentavos,
  type CorpoAtualizarEmenda,
  type CorpoNovaEmenda,
  type EmendaFicha,
} from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import { hojeNoGabinete } from '../atendimento/comum.js';
import { mensagemDoPostgres, violouUnicidade } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import { exigirCategorias, exigirResponsavelDoLegislativo } from '../projetos/comum.js';
import {
  carregarEmenda,
  exigirEtapaDoFluxo,
  exigirNaoCancelada,
  exigirPodeAcompanhar,
} from './comum.js';
import type { ConsultasDeEmendas } from './consultas.js';
import { valoresDasEmendas } from './valores.js';

export interface OpcoesDoServicoDeEmendas {
  readonly bd: BancoDeDados;
  readonly consultas: ConsultasDeEmendas;
  readonly agora: () => Date;
}

const mensagemDeIdentificacaoRepetida =
  'Já existe uma emenda ativa com esta identificação neste exercício.';
const papeisDeSaida = ['conclusao', 'arquivamento'] as const;

/**
 * Emendas parlamentares. Percorrem o fluxo pelo mecanismo único de movimentação. Só o valor
 * disponibilizado se cadastra (com histórico); o resto é derivado. Os limites de valor são conferidos aqui,
 * com a emenda travada, e repetidos pelo banco.
 */
export class ServicoDeEmendas {
  constructor(private readonly o: OpcoesDoServicoDeEmendas) {}

  private get bd() {
    return this.o.bd;
  }

  async criar(ator: Ator, dados: CorpoNovaEmenda): Promise<EmendaFicha> {
    const hoje = hojeNoGabinete(this.o.agora());
    for (const prazo of [dados.prazoDestinacao, dados.prazoEmpenho, dados.prazoExecucao]) {
      if (prazo && prazo < hoje) throw erros.conflito('Os prazos não podem ser anteriores a hoje.');
    }
    const responsavelId = dados.responsavelId ?? ator.usuarioId;

    let id: number;
    try {
      id = await this.bd.transaction(async (tx) => {
        await exigirResponsavelDoLegislativo(tx, responsavelId);
        await exigirCategorias(
          tx,
          'tipo_emenda',
          [dados.tipoId],
          'Tipo de emenda inválido ou inativo.',
        );
        const entrada = await etapaDeEntrada(tx, 'emenda');
        const [criada] = await tx
          .insert(emenda)
          .values({
            criadorId: ator.usuarioId,
            responsavelId,
            identificacao: dados.identificacao,
            exercicio: dados.exercicio,
            tipoId: dados.tipoId,
            finalidade: dados.finalidade,
            prazoDestinacao: dados.prazoDestinacao ?? null,
            prazoEmpenho: dados.prazoEmpenho ?? null,
            prazoExecucao: dados.prazoExecucao ?? null,
            etapaAtualId: entrada.id,
            criadoEm: this.o.agora(),
          })
          .returning({ id: emenda.id });
        const novoId = (criada as { id: number }).id;
        await tx.insert(emendaValor).values({
          emendaId: novoId,
          valor: dados.valor,
          definidoPor: ator.usuarioId,
          definidoEm: this.o.agora(),
        });
        await registrarMovimentacao(tx, {
          registroTipo: 'emenda',
          registroId: novoId,
          etapaOrigemId: null,
          etapaDestinoId: entrada.id,
          autorId: ator.usuarioId,
          criadaEm: this.o.agora(),
        });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'emenda.criar',
          entidade: 'emenda',
          registroId: novoId,
          valorNovo: {
            identificacao: dados.identificacao,
            exercicio: dados.exercicio,
            valor: dados.valor,
            responsavelId,
          },
        });
        return novoId;
      });
    } catch (erro) {
      if (violouUnicidade(erro)) throw erros.conflito(mensagemDeIdentificacaoRepetida);
      throw erro;
    }
    return this.o.consultas.ficha(id);
  }

  async editar(ator: Ator, id: number, dados: CorpoAtualizarEmenda): Promise<EmendaFicha> {
    const mudancas: Partial<typeof emenda.$inferInsert> = {};
    if (dados.identificacao !== undefined) mudancas.identificacao = dados.identificacao;
    if (dados.exercicio !== undefined) mudancas.exercicio = dados.exercicio;
    if (dados.tipoId !== undefined) mudancas.tipoId = dados.tipoId;
    if (dados.finalidade !== undefined) mudancas.finalidade = dados.finalidade;
    if (dados.prazoDestinacao !== undefined) mudancas.prazoDestinacao = dados.prazoDestinacao;
    if (dados.prazoEmpenho !== undefined) mudancas.prazoEmpenho = dados.prazoEmpenho;
    if (dados.prazoExecucao !== undefined) mudancas.prazoExecucao = dados.prazoExecucao;

    try {
      await this.bd.transaction(async (tx) => {
        const atual = await carregarEmenda(tx, id);
        exigirPodeAcompanhar(ator, atual);
        exigirNaoCancelada(atual);
        if (dados.tipoId !== undefined) {
          await exigirCategorias(
            tx,
            'tipo_emenda',
            [dados.tipoId],
            'Tipo de emenda inválido ou inativo.',
          );
        }
        let valorNovo: string | undefined;
        if (dados.valor !== undefined) {
          const valores = (await valoresDasEmendas(tx, [id], this.o.agora())).get(id);
          if (
            (paraCentavos(dados.valor) ?? 0) < (paraCentavos(valores?.comprometido ?? '0') ?? 0)
          ) {
            throw erros.conflito(
              `O valor não pode ficar abaixo do já destinado (${formatarReais(valores?.comprometido ?? '0')}).`,
            );
          }
          if (dados.valor !== valores?.disponibilizado) {
            await tx.insert(emendaValor).values({
              emendaId: id,
              valor: dados.valor,
              definidoPor: ator.usuarioId,
              definidoEm: this.o.agora(),
            });
            valorNovo = dados.valor;
          }
        }
        if (Object.keys(mudancas).length > 0) {
          await tx.update(emenda).set(mudancas).where(eq(emenda.id, id));
        }
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'emenda.editar',
          entidade: 'emenda',
          registroId: id,
          valorNovo: { campos: Object.keys(mudancas), ...(valorNovo ? { valor: valorNovo } : {}) },
        });
      });
    } catch (erro) {
      if (violouUnicidade(erro)) throw erros.conflito(mensagemDeIdentificacaoRepetida);
      if (mensagemDoPostgres(erro).includes('excede o valor disponível')) {
        throw erros.conflito('O valor não pode ficar abaixo do já destinado.');
      }
      throw erro;
    }
    return this.o.consultas.ficha(id);
  }

  /** Pelo mecanismo único de movimentação; reabrir uma emenda encerrada é do Supervisor em diante. */
  async mover(ator: Ator, id: number, etapaId: number, observacao?: string): Promise<EmendaFicha> {
    await this.bd.transaction(async (tx) => {
      const atual = await carregarEmenda(tx, id);
      exigirPodeAcompanhar(ator, atual);
      exigirNaoCancelada(atual);
      if (atual.etapaAtualId === etapaId) throw erros.conflito('A emenda já está nesta etapa.');
      const [origem] = await tx
        .select({ papel: etapa.papel })
        .from(etapa)
        .where(eq(etapa.id, atual.etapaAtualId))
        .limit(1);
      const destino = await exigirEtapaDoFluxo(tx, etapaId);
      const reabre =
        origem !== undefined &&
        papeisDeSaida.some((p) => p === origem.papel) &&
        (destino.papel === 'entrada' || destino.papel === 'intermediaria');
      if (reabre && nivelDoPerfil[ator.perfil] < 3) {
        throw erros.semPermissao('Só o Supervisor ou superior reabre uma emenda encerrada.');
      }
      await tx.update(emenda).set({ etapaAtualId: etapaId }).where(eq(emenda.id, id));
      await registrarMovimentacao(tx, {
        registroTipo: 'emenda',
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
        operacao: reabre ? 'emenda.reabrir' : 'emenda.mover',
        entidade: 'emenda',
        registroId: id,
        valorAnterior: { etapa: atual.etapaAtualId },
        valorNovo: { etapa: etapaId },
      });
    });
    return this.o.consultas.ficha(id);
  }

  async reatribuir(ator: Ator, id: number, responsavelId: number): Promise<EmendaFicha> {
    await this.bd.transaction(async (tx) => {
      const atual = await carregarEmenda(tx, id);
      exigirNaoCancelada(atual);
      if (atual.responsavelId === responsavelId) throw erros.conflito('Este já é o responsável.');
      await exigirResponsavelDoLegislativo(tx, responsavelId);
      await tx.update(emenda).set({ responsavelId }).where(eq(emenda.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'emenda.reatribuir',
        entidade: 'emenda',
        registroId: id,
        valorAnterior: { responsavelId: atual.responsavelId },
        valorNovo: { responsavelId },
      });
    });
    return this.o.consultas.ficha(id);
  }

  /** Cancelar exige justificativa e que não reste destinação ativa (cancele antes: com execução, ela não cancela). */
  async cancelar(ator: Ator, id: number, justificativa: string): Promise<EmendaFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        const atual = await carregarEmenda(tx, id);
        exigirNaoCancelada(atual);
        const valores = (await valoresDasEmendas(tx, [id], this.o.agora())).get(id);
        if ((paraCentavos(valores?.comprometido ?? '0') ?? 0) > 0) {
          throw erros.conflito('A emenda tem valor destinado. Cancele antes as destinações.');
        }
        await tx
          .update(emenda)
          .set({
            canceladaEm: this.o.agora(),
            canceladaPor: ator.usuarioId,
            justificativaCancelamento: justificativa,
          })
          .where(eq(emenda.id, id));
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'emenda.cancelar',
          entidade: 'emenda',
          registroId: id,
          valorAnterior: { etapa: atual.etapaAtualId },
          justificativa,
        });
      });
    } catch (erro) {
      if (mensagemDoPostgres(erro).includes('Emenda cancelada')) {
        throw erros.conflito('Emenda cancelada não se altera.');
      }
      throw erro;
    }
    return this.o.consultas.ficha(id);
  }
}
