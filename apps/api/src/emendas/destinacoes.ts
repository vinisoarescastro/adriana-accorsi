import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  beneficiario,
  destinacao,
  etapa,
  execucaoDestinacao,
  registrarMovimentacao,
  registrarTrilha,
  type BancoDeDados,
  type Transacao,
} from '@gabinete/banco';
import {
  formatarReais,
  paraCentavos,
  type CorpoNovaDestinacao,
  type CorpoNovaExecucao,
  type EmendaFicha,
} from '@gabinete/compartilhado';
import { eq, sql } from 'drizzle-orm';
import { hojeNoGabinete } from '../atendimento/comum.js';
import { mensagemDoPostgres } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import {
  carregarEmenda,
  etapaInicialDaDestinacao,
  exigirEtapaDoFluxo,
  exigirNaoCancelada,
  exigirPodeAcompanhar,
} from './comum.js';
import type { ConsultasDeEmendas } from './consultas.js';
import { valoresDasEmendas } from './valores.js';

const papeisDeSaida = ['conclusao', 'arquivamento'] as const;

/**
 * Destinações a beneficiários e as execuções delas. Os limites (não passar do disponível, não passar da
 * destinação, não cancelar com execução, sem data futura) são conferidos aqui, com a emenda travada, e
 * repetidos pelo banco.
 */
export class ServicoDeDestinacoes {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly consultas: ConsultasDeEmendas,
    private readonly agora: () => Date,
  ) {}

  /** Trava a destinação e a emenda dela; devolve os dois. */
  private async carregar(tx: Transacao, emendaId: number, destinacaoId: number) {
    const emendaAtual = await carregarEmenda(tx, emendaId);
    const [d] = await tx
      .select()
      .from(destinacao)
      .where(eq(destinacao.id, destinacaoId))
      .limit(1)
      .for('update');
    if (!d || d.emendaId !== emendaId) throw erros.naoEncontrado();
    return { emendaAtual, d };
  }

  async destinar(ator: Ator, emendaId: number, dados: CorpoNovaDestinacao): Promise<EmendaFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        const emendaAtual = await carregarEmenda(tx, emendaId);
        exigirPodeAcompanhar(ator, emendaAtual);
        exigirNaoCancelada(emendaAtual);

        const [beneficiado] = await tx
          .select({ situacao: beneficiario.situacao })
          .from(beneficiario)
          .where(eq(beneficiario.id, dados.beneficiarioId))
          .limit(1);
        if (!beneficiado || beneficiado.situacao !== 'ativo') {
          throw erros.conflito('O beneficiário não existe ou está inativo.');
        }
        const valores = (await valoresDasEmendas(tx, [emendaId], this.agora())).get(emendaId);
        if ((paraCentavos(dados.valor) ?? 0) > (paraCentavos(valores?.disponivel ?? '0') ?? 0)) {
          throw erros.conflito(
            `O valor excede o disponível da emenda (${formatarReais(valores?.disponivel ?? '0')}).`,
          );
        }

        const etapaId = await etapaInicialDaDestinacao(tx);
        const [criada] = await tx
          .insert(destinacao)
          .values({
            emendaId,
            beneficiarioId: dados.beneficiarioId,
            valor: dados.valor,
            finalidade: dados.finalidade,
            etapaAtualId: etapaId,
            criadaPor: ator.usuarioId,
            criadaEm: this.agora(),
          })
          .returning({ id: destinacao.id });
        const id = (criada as { id: number }).id;
        await registrarMovimentacao(tx, {
          registroTipo: 'destinacao',
          registroId: id,
          etapaOrigemId: null,
          etapaDestinoId: etapaId,
          autorId: ator.usuarioId,
          criadaEm: this.agora(),
        });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'emenda.destinar',
          entidade: 'emenda',
          registroId: emendaId,
          valorNovo: { destinacaoId: id, beneficiarioId: dados.beneficiarioId, valor: dados.valor },
        });
      });
    } catch (erro) {
      if (mensagemDoPostgres(erro).includes('excede o valor disponível')) {
        throw erros.conflito('O valor excede o disponível da emenda.');
      }
      throw erro;
    }
    return this.consultas.ficha(emendaId);
  }

  async mover(
    ator: Ator,
    emendaId: number,
    destinacaoId: number,
    etapaId: number,
    observacao?: string,
  ): Promise<EmendaFicha> {
    await this.bd.transaction(async (tx) => {
      const { emendaAtual, d } = await this.carregar(tx, emendaId, destinacaoId);
      exigirPodeAcompanhar(ator, emendaAtual);
      exigirNaoCancelada(emendaAtual);
      if (d.canceladaEm) throw erros.conflito('Destinação cancelada não se altera.');
      if (d.etapaAtualId === etapaId) throw erros.conflito('A destinação já está nesta etapa.');
      const [origem] = await tx
        .select({ papel: etapa.papel })
        .from(etapa)
        .where(eq(etapa.id, d.etapaAtualId))
        .limit(1);
      const destino = await exigirEtapaDoFluxo(tx, etapaId);
      const reabre =
        origem !== undefined &&
        papeisDeSaida.some((p) => p === origem.papel) &&
        (destino.papel === 'entrada' || destino.papel === 'intermediaria');
      if (reabre && nivelDoPerfil[ator.perfil] < 3) {
        throw erros.semPermissao('Só o Supervisor ou superior reabre uma destinação encerrada.');
      }
      await tx
        .update(destinacao)
        .set({ etapaAtualId: etapaId })
        .where(eq(destinacao.id, destinacaoId));
      await registrarMovimentacao(tx, {
        registroTipo: 'destinacao',
        registroId: destinacaoId,
        etapaOrigemId: d.etapaAtualId,
        etapaDestinoId: etapaId,
        autorId: ator.usuarioId,
        observacao: observacao ?? null,
        criadaEm: this.agora(),
      });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'emenda.destinacao_mover',
        entidade: 'emenda',
        registroId: emendaId,
        valorNovo: { destinacaoId, etapa: etapaId },
      });
    });
    return this.consultas.ficha(emendaId);
  }

  /** Cancelar devolve o valor ao disponível. Com execução registrada, não se cancela. */
  async cancelar(
    ator: Ator,
    emendaId: number,
    destinacaoId: number,
    justificativa: string,
  ): Promise<EmendaFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        const { emendaAtual, d } = await this.carregar(tx, emendaId, destinacaoId);
        exigirNaoCancelada(emendaAtual);
        if (d.canceladaEm) throw erros.conflito('Destinação cancelada não se altera.');
        const [{ total }] = (await tx
          .select({ total: sql<number>`count(*)::int` })
          .from(execucaoDestinacao)
          .where(eq(execucaoDestinacao.destinacaoId, destinacaoId))) as [{ total: number }];
        if (total > 0) throw erros.conflito('Destinação com execução registrada não se cancela.');
        await tx
          .update(destinacao)
          .set({
            canceladaEm: this.agora(),
            canceladaPor: ator.usuarioId,
            justificativaCancelamento: justificativa,
          })
          .where(eq(destinacao.id, destinacaoId));
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'emenda.destinacao_cancelar',
          entidade: 'emenda',
          registroId: emendaId,
          valorAnterior: { destinacaoId, valor: d.valor },
          justificativa,
        });
      });
    } catch (erro) {
      if (mensagemDoPostgres(erro).includes('execução registrada')) {
        throw erros.conflito('Destinação com execução registrada não se cancela.');
      }
      throw erro;
    }
    return this.consultas.ficha(emendaId);
  }

  async executar(
    ator: Ator,
    emendaId: number,
    destinacaoId: number,
    dados: CorpoNovaExecucao,
  ): Promise<EmendaFicha> {
    if (dados.data > hojeNoGabinete(this.agora())) {
      throw erros.conflito('A data da execução não pode ser futura.');
    }
    try {
      await this.bd.transaction(async (tx) => {
        const { emendaAtual, d } = await this.carregar(tx, emendaId, destinacaoId);
        exigirPodeAcompanhar(ator, emendaAtual);
        exigirNaoCancelada(emendaAtual);
        if (d.canceladaEm) throw erros.conflito('Destinação cancelada não recebe execução.');
        const [{ executado }] = (await tx
          .select({ executado: sql<string>`coalesce(sum(${execucaoDestinacao.valor}), 0)::text` })
          .from(execucaoDestinacao)
          .where(eq(execucaoDestinacao.destinacaoId, destinacaoId))) as [{ executado: string }];
        const falta = (paraCentavos(d.valor) ?? 0) - (paraCentavos(executado) ?? 0);
        if ((paraCentavos(dados.valor) ?? 0) > falta) {
          throw erros.conflito(
            `O valor excede o que falta executar (${formatarReais(`${falta / 100}`)}).`,
          );
        }
        await tx.insert(execucaoDestinacao).values({
          destinacaoId,
          valor: dados.valor,
          data: dados.data,
          observacao: dados.observacao ?? null,
          registradoPor: ator.usuarioId,
          registradoEm: this.agora(),
        });
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'emenda.executar',
          entidade: 'emenda',
          registroId: emendaId,
          valorNovo: { destinacaoId, valor: dados.valor, data: dados.data },
        });
      });
    } catch (erro) {
      const msg = mensagemDoPostgres(erro);
      if (msg.includes('excede o valor da destinação'))
        throw erros.conflito('A execução excede o valor da destinação.');
      if (msg.includes('data da execução'))
        throw erros.conflito('A data da execução não pode ser futura.');
      throw erro;
    }
    return this.consultas.ficha(emendaId);
  }
}
