import {
  projetoAssunto,
  projetoCoautor,
  registrarTrilha,
  tramitacaoComissao,
  votacaoProjeto,
  type BancoDeDados,
  type Transacao,
} from '@gabinete/banco';
import type {
  CorpoNovaTramitacao,
  CorpoNovaVotacao,
  ProjetoFicha,
  ResultadoDeVotacaoDto,
} from '@gabinete/compartilhado';
import { and, eq } from 'drizzle-orm';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import {
  carregarProjeto,
  exigirCategorias,
  exigirNaoCancelado,
  exigirPodeAlterar,
  nomesUnicos,
} from './comum.js';
import type { ConsultasDeProjetos } from './consultas.js';

export interface CorpoAtualizarTramitacaoDoProjeto {
  readonly comissao?: string | undefined;
  readonly data?: string | undefined;
  readonly parecer?: string | null | undefined;
}
export interface CorpoAtualizarVotacaoDoProjeto {
  readonly data?: string | undefined;
  readonly resultado?: ResultadoDeVotacaoDto | undefined;
  readonly local?: string | null | undefined;
}

/**
 * O que cerca o projeto: assuntos, coautores, comissões e votações (RN-PRO-05). Quem acompanha é o
 * responsável, o Supervisor ou superior; projeto cancelado não recebe nada novo. A votação guarda só
 * a data e o resultado, nunca o placar individual.
 */
export class ServicoDeAcompanhamentoDoProjeto {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly consultas: ConsultasDeProjetos,
    private readonly agora: () => Date,
  ) {}

  /** Abre a transação, trava o projeto e confere quem pode acompanhar. */
  private async noProjeto(
    ator: Ator,
    id: number,
    acao: (tx: Transacao) => Promise<void>,
  ): Promise<ProjetoFicha> {
    await this.bd.transaction(async (tx) => {
      const projeto = await carregarProjeto(tx, id);
      exigirPodeAlterar(ator, projeto);
      exigirNaoCancelado(projeto);
      await acao(tx);
    });
    return this.consultas.ficha(id);
  }

  private trilha(tx: Transacao, ator: Ator, operacao: string, id: number, valor?: unknown) {
    return registrarTrilha(tx, {
      origem: 'usuario',
      autorId: ator.usuarioId,
      operacao,
      entidade: 'projeto_lei',
      registroId: id,
      ...(valor !== undefined ? { valorNovo: valor } : {}),
    });
  }

  /** Troca os assuntos pela lista informada. */
  assuntos(ator: Ator, id: number, ids: readonly number[]): Promise<ProjetoFicha> {
    return this.noProjeto(ator, id, async (tx) => {
      const novos = await exigirCategorias(
        tx,
        'assunto_projeto',
        ids,
        'Há assunto inválido ou inativo.',
      );
      await tx.delete(projetoAssunto).where(eq(projetoAssunto.projetoId, id));
      if (novos.length > 0) {
        await tx
          .insert(projetoAssunto)
          .values(novos.map((categoriaId) => ({ projetoId: id, categoriaId })));
      }
      await this.trilha(tx, ator, 'projeto.assuntos', id, { assuntos: novos });
    });
  }

  /** Troca os coautores pela lista de nomes informada. */
  coautores(ator: Ator, id: number, nomes: readonly string[]): Promise<ProjetoFicha> {
    return this.noProjeto(ator, id, async (tx) => {
      const novos = nomesUnicos(nomes);
      await tx.delete(projetoCoautor).where(eq(projetoCoautor.projetoId, id));
      if (novos.length > 0) {
        await tx.insert(projetoCoautor).values(novos.map((nome) => ({ projetoId: id, nome })));
      }
      await this.trilha(tx, ator, 'projeto.coautores', id, { quantidade: novos.length });
    });
  }

  registrarTramitacao(ator: Ator, id: number, dados: CorpoNovaTramitacao): Promise<ProjetoFicha> {
    return this.noProjeto(ator, id, async (tx) => {
      const [criada] = await tx
        .insert(tramitacaoComissao)
        .values({
          projetoId: id,
          comissao: dados.comissao,
          data: dados.data,
          parecer: dados.parecer || null,
          registradoPor: ator.usuarioId,
          registradoEm: this.agora(),
        })
        .returning({ id: tramitacaoComissao.id });
      await this.trilha(tx, ator, 'projeto.tramitacao_registrar', id, {
        tramitacaoId: (criada as { id: number }).id,
        comissao: dados.comissao,
        data: dados.data,
      });
    });
  }

  atualizarTramitacao(
    ator: Ator,
    id: number,
    tramitacaoId: number,
    dados: CorpoAtualizarTramitacaoDoProjeto,
  ): Promise<ProjetoFicha> {
    const mudancas: Partial<typeof tramitacaoComissao.$inferInsert> = {};
    if (dados.comissao !== undefined) mudancas.comissao = dados.comissao;
    if (dados.data !== undefined) mudancas.data = dados.data;
    if (dados.parecer !== undefined) mudancas.parecer = dados.parecer || null;
    return this.noProjeto(ator, id, async (tx) => {
      const alterada = await tx
        .update(tramitacaoComissao)
        .set(mudancas)
        .where(and(eq(tramitacaoComissao.id, tramitacaoId), eq(tramitacaoComissao.projetoId, id)))
        .returning({ id: tramitacaoComissao.id });
      if (alterada.length === 0) throw erros.naoEncontrado();
      await this.trilha(tx, ator, 'projeto.tramitacao_editar', id, {
        tramitacaoId,
        campos: Object.keys(mudancas),
      });
    });
  }

  removerTramitacao(ator: Ator, id: number, tramitacaoId: number): Promise<ProjetoFicha> {
    return this.noProjeto(ator, id, async (tx) => {
      const removida = await tx
        .delete(tramitacaoComissao)
        .where(and(eq(tramitacaoComissao.id, tramitacaoId), eq(tramitacaoComissao.projetoId, id)))
        .returning({ id: tramitacaoComissao.id });
      if (removida.length === 0) throw erros.naoEncontrado();
      await this.trilha(tx, ator, 'projeto.tramitacao_remover', id, { tramitacaoId });
    });
  }

  registrarVotacao(ator: Ator, id: number, dados: CorpoNovaVotacao): Promise<ProjetoFicha> {
    return this.noProjeto(ator, id, async (tx) => {
      const [criada] = await tx
        .insert(votacaoProjeto)
        .values({
          projetoId: id,
          data: dados.data,
          resultado: dados.resultado,
          local: dados.local || null,
          registradoPor: ator.usuarioId,
          registradoEm: this.agora(),
        })
        .returning({ id: votacaoProjeto.id });
      await this.trilha(tx, ator, 'projeto.votacao_registrar', id, {
        votacaoId: (criada as { id: number }).id,
        data: dados.data,
        resultado: dados.resultado,
      });
    });
  }

  atualizarVotacao(
    ator: Ator,
    id: number,
    votacaoId: number,
    dados: CorpoAtualizarVotacaoDoProjeto,
  ): Promise<ProjetoFicha> {
    const mudancas: Partial<typeof votacaoProjeto.$inferInsert> = {};
    if (dados.data !== undefined) mudancas.data = dados.data;
    if (dados.resultado !== undefined) mudancas.resultado = dados.resultado;
    if (dados.local !== undefined) mudancas.local = dados.local || null;
    return this.noProjeto(ator, id, async (tx) => {
      const alterada = await tx
        .update(votacaoProjeto)
        .set(mudancas)
        .where(and(eq(votacaoProjeto.id, votacaoId), eq(votacaoProjeto.projetoId, id)))
        .returning({ id: votacaoProjeto.id });
      if (alterada.length === 0) throw erros.naoEncontrado();
      await this.trilha(tx, ator, 'projeto.votacao_editar', id, {
        votacaoId,
        campos: Object.keys(mudancas),
      });
    });
  }

  removerVotacao(ator: Ator, id: number, votacaoId: number): Promise<ProjetoFicha> {
    return this.noProjeto(ator, id, async (tx) => {
      const removida = await tx
        .delete(votacaoProjeto)
        .where(and(eq(votacaoProjeto.id, votacaoId), eq(votacaoProjeto.projetoId, id)))
        .returning({ id: votacaoProjeto.id });
      if (removida.length === 0) throw erros.naoEncontrado();
      await this.trilha(tx, ator, 'projeto.votacao_remover', id, { votacaoId });
    });
  }
}
