import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  demanda,
  emitirProtocolo,
  enfileirarNotificacao,
  registrarConsentimento,
  etapa,
  etapaDeEntrada,
  pessoa,
  registrarMovimentacao,
  registrarTrilha,
  tipoProcesso,
  type BancoDeDados,
} from '@gabinete/banco';
import type {
  CorpoAtualizarDemanda,
  CorpoNovaDemanda,
  DemandaFicha,
  DemandaRegistrada,
} from '@gabinete/compartilhado';
import { and, eq } from 'drizzle-orm';
import { carregarDemandaAlcancavel, exigirResponsavelValido } from '../atendimento/comum.js';
import { mensagemDoPostgres, violouUnicidade } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import type { ConsultasDeDemandas } from './consultas.js';
import {
  cifrarSegredoDeLink,
  gerarSegredoDeLink,
  hashDoSegredoDeLink,
  montarLinkDeAcompanhamento,
} from './link.js';

export interface OpcoesDoServicoDeDemandas {
  readonly bd: BancoDeDados;
  readonly consultas: ConsultasDeDemandas;
  readonly agora: () => Date;
  readonly segredoDaAplicacao: string;
  readonly hostnamePublico: string;
  /** Gerador do protocolo. Só os testes trocam, para forçar colisões. */
  readonly gerarProtocolo?: () => string;
}

/** Quem pode editar e mover: Supervisor ou superior, ou o responsável (RN-DEM-08). */
function exigirPodeAlterar(ator: Ator, responsavelId: number): void {
  if (nivelDoPerfil[ator.perfil] >= 3 || responsavelId === ator.usuarioId) return;
  throw erros.semPermissao('Só o responsável, o Supervisor ou superior alteram esta demanda.');
}

export class ServicoDeDemandas {
  constructor(private readonly o: OpcoesDoServicoDeDemandas) {}

  private get bd() {
    return this.o.bd;
  }

  /**
   * Registra a demanda numa ÚNICA transação: pessoa (se nova), protocolo, link, demanda,
   * movimentação de entrada e trilha. Falhando qualquer parte, nada é criado (RN-DEM-01).
   */
  async registrar(ator: Ator, dados: CorpoNovaDemanda): Promise<DemandaRegistrada> {
    const responsavelId = dados.responsavelId ?? ator.usuarioId;
    if (responsavelId !== ator.usuarioId && nivelDoPerfil[ator.perfil] < 2) {
      throw erros.semPermissao('Você só pode registrar demandas em seu próprio nome.');
    }
    await exigirResponsavelValido(this.bd, responsavelId);

    const segredo = gerarSegredoDeLink();
    let pessoaCriada = false;

    const demandaId = await this.bd.transaction(async (tx) => {
      let solicitanteId: number;
      if ('pessoaId' in dados.solicitante) {
        const [existente] = await tx
          .select({ id: pessoa.id, situacao: pessoa.situacao })
          .from(pessoa)
          .where(eq(pessoa.id, dados.solicitante.pessoaId))
          .limit(1);
        if (!existente) throw erros.naoEncontrado();
        if (existente.situacao !== 'ativa') {
          throw erros.conflito('Esta pessoa está inativa ou teve os dados eliminados.');
        }
        solicitanteId = existente.id;
      } else {
        const nova = dados.solicitante;
        const [duplicada] = await tx
          .select({ id: pessoa.id })
          .from(pessoa)
          .where(and(eq(pessoa.telefoneNormalizado, nova.telefone), eq(pessoa.situacao, 'ativa')))
          .limit(1);
        if (duplicada) {
          throw erros.conflito(
            'Já existe uma pessoa ativa com esse telefone. Use o cadastro existente.',
            [`pessoaId:${duplicada.id}`],
          );
        }
        const [criada] = await tx
          .insert(pessoa)
          .values({
            nomeCompleto: nova.nome,
            telefoneNormalizado: nova.telefone,
            email: nova.email ?? null,
            criadoPor: ator.usuarioId,
          })
          .returning({ id: pessoa.id });
        solicitanteId = (criada as { id: number }).id;
        pessoaCriada = true;
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'pessoa.criar',
          entidade: 'pessoa',
          registroId: solicitanteId,
        });
        if (nova.consentimento) {
          if (!nova.email) {
            throw erros.conflito('O consentimento por e-mail exige o e-mail da pessoa.');
          }
          await registrarConsentimento(tx, {
            pessoaId: solicitanteId,
            consentido: nova.consentimento.consentido,
            origem: nova.consentimento.origem,
            registradoPor: ator.usuarioId,
            registradoEm: this.o.agora(),
            ...(nova.consentimento.consentido
              ? { versaoTexto: nova.consentimento.versaoTexto }
              : {}),
          });
        }
      }

      const protocolo = await emitirProtocolo(tx, this.o.gerarProtocolo);
      const entrada = await etapaDeEntrada(tx, 'demanda');

      const [criada] = await tx
        .insert(demanda)
        .values({
          protocolo,
          criadoEm: this.o.agora(),
          segredoLinkHash: hashDoSegredoDeLink(segredo),
          segredoLinkCifrado: cifrarSegredoDeLink(segredo, this.o.segredoDaAplicacao),
          solicitanteId,
          responsavelId,
          autorId: ator.usuarioId,
          titulo: dados.titulo,
          descricao: dados.descricao ?? null,
          prioridade: dados.prioridade,
          prazo: dados.prazo ?? null,
          etapaAtualId: entrada.id,
        })
        .returning({ id: demanda.id });
      const id = (criada as { id: number }).id;

      await registrarMovimentacao(tx, {
        registroTipo: 'demanda',
        criadaEm: this.o.agora(),
        registroId: id,
        etapaOrigemId: null,
        etapaDestinoId: entrada.id,
        autorId: ator.usuarioId,
      });
      // O segredo do link NUNCA entra na trilha.
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'demanda.registrar',
        entidade: 'demanda',
        registroId: id,
        valorNovo: {
          protocolo,
          solicitanteId,
          responsavelId,
          prioridade: dados.prioridade,
          etapa: entrada.id,
        },
      });
      return id;
    });

    return {
      demanda: await this.o.consultas.ficha(ator, demandaId),
      linkDeAcompanhamento: montarLinkDeAcompanhamento(this.o.hostnamePublico, segredo),
      pessoaCriada,
    };
  }

  async editar(ator: Ator, id: number, dados: CorpoAtualizarDemanda): Promise<DemandaFicha> {
    const mudancas: Partial<typeof demanda.$inferInsert> = {};
    if (dados.titulo !== undefined) mudancas.titulo = dados.titulo;
    if (dados.descricao !== undefined) mudancas.descricao = dados.descricao;
    if (dados.prioridade !== undefined) mudancas.prioridade = dados.prioridade;
    if (dados.prazo !== undefined) mudancas.prazo = dados.prazo;

    await this.bd.transaction(async (tx) => {
      const atual = await carregarDemandaAlcancavel(tx, ator, id, { paraAtualizar: true });
      exigirPodeAlterar(ator, atual.responsavelId);
      this.exigirNaoCancelada(atual.canceladaEm);
      await tx.update(demanda).set(mudancas).where(eq(demanda.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'demanda.editar',
        entidade: 'demanda',
        registroId: id,
        valorAnterior: { titulo: atual.titulo, prioridade: atual.prioridade, prazo: atual.prazo },
        valorNovo: mudancas,
      });
    });
    return this.o.consultas.ficha(ator, id);
  }

  /** Move pelo mecanismo ÚNICO de movimentação. O status deriva do papel da etapa de destino. */
  async mover(ator: Ator, id: number, etapaId: number, observacao?: string): Promise<DemandaFicha> {
    await this.bd.transaction(async (tx) => {
      const atual = await carregarDemandaAlcancavel(tx, ator, id, { paraAtualizar: true });
      exigirPodeAlterar(ator, atual.responsavelId);
      this.exigirNaoCancelada(atual.canceladaEm);
      if (atual.etapaAtualId === etapaId) throw erros.conflito('A demanda já está nesta etapa.');

      const [destino] = await tx
        .select({
          id: etapa.id,
          situacao: etapa.situacao,
          papel: etapa.papel,
          visivelPublico: etapa.visivelPublico,
        })
        .from(etapa)
        .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
        .where(and(eq(etapa.id, etapaId), eq(tipoProcesso.tipo, 'demanda')))
        .limit(1);
      if (!destino) throw erros.requisicaoInvalida();
      if (destino.situacao !== 'ativa') throw erros.conflito('A etapa de destino está inativa.');

      await tx.update(demanda).set({ etapaAtualId: etapaId }).where(eq(demanda.id, id));
      await registrarMovimentacao(tx, {
        registroTipo: 'demanda',
        criadaEm: this.o.agora(),
        registroId: id,
        etapaOrigemId: atual.etapaAtualId,
        etapaDestinoId: etapaId,
        autorId: ator.usuarioId,
        observacao: observacao ?? null,
      });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'demanda.mover',
        entidade: 'demanda',
        registroId: id,
        valorAnterior: { etapa: atual.etapaAtualId },
        valorNovo: { etapa: etapaId },
      });
      // Aviso ao cidadão (outbox, na mesma transação): conclusão, ou etapa que ele enxerga. Etapa
      // interna nunca gera e-mail, e quem não consentiu não recebe (a função confere).
      if (destino.papel === 'conclusao') {
        await enfileirarNotificacao(tx, {
          demandaId: id,
          evento: 'conclusao',
          criadoEm: this.o.agora(),
        });
      } else if (destino.visivelPublico) {
        await enfileirarNotificacao(tx, {
          demandaId: id,
          evento: 'etapa_visivel',
          criadoEm: this.o.agora(),
        });
      }
    });
    return this.o.consultas.ficha(ator, id);
  }

  async reatribuir(ator: Ator, id: number, responsavelId: number): Promise<DemandaFicha> {
    await exigirResponsavelValido(this.bd, responsavelId);
    await this.bd.transaction(async (tx) => {
      const atual = await carregarDemandaAlcancavel(tx, ator, id, { paraAtualizar: true });
      this.exigirNaoCancelada(atual.canceladaEm);
      if (atual.responsavelId === responsavelId) throw erros.conflito('Este já é o responsável.');
      await tx.update(demanda).set({ responsavelId }).where(eq(demanda.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'demanda.reatribuir',
        entidade: 'demanda',
        registroId: id,
        valorAnterior: { responsavelId: atual.responsavelId },
        valorNovo: { responsavelId },
      });
    });
    return this.o.consultas.ficha(ator, id);
  }

  /** Cancelar exige justificativa. A demanda cancelada não se altera mais (gatilho no banco). */
  async cancelar(ator: Ator, id: number, justificativa: string): Promise<DemandaFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        const atual = await carregarDemandaAlcancavel(tx, ator, id, { paraAtualizar: true });
        this.exigirNaoCancelada(atual.canceladaEm);
        await tx
          .update(demanda)
          .set({
            canceladaEm: this.o.agora(),
            canceladaPor: ator.usuarioId,
            justificativaCancelamento: justificativa,
          })
          .where(eq(demanda.id, id));
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'demanda.cancelar',
          entidade: 'demanda',
          registroId: id,
          valorAnterior: { etapa: atual.etapaAtualId },
          justificativa,
        });
        await enfileirarNotificacao(tx, {
          demandaId: id,
          evento: 'cancelamento',
          criadoEm: this.o.agora(),
        });
      });
    } catch (erro) {
      this.traduzir(erro);
    }
    return this.o.consultas.ficha(ator, id);
  }

  private exigirNaoCancelada(canceladaEm: Date | null): void {
    if (canceladaEm) throw erros.conflito('Demanda cancelada não se altera.');
  }

  private traduzir(erro: unknown): never {
    if (mensagemDoPostgres(erro).includes('Demanda cancelada')) {
      throw erros.conflito('Demanda cancelada não se altera.');
    }
    if (violouUnicidade(erro)) throw erros.conflito('Conflito ao salvar a demanda.');
    throw erro;
  }
}
