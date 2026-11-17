import {
  criarAvisos,
  despesa,
  documento,
  registrarMovimentacao,
  registrarTrilha,
  type BancoDeDados,
  type Leitor,
  type Transacao,
} from '@gabinete/banco';
import {
  formatarReais,
  paraCentavos,
  type CorpoAtualizarDespesa,
  type CorpoDecidirDespesa,
  type CorpoNovaDespesa,
  type DespesaFicha,
} from '@gabinete/compartilhado';
import { and, eq, sql } from 'drizzle-orm';
import { mensagemDoPostgres } from '../banco-util.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import type { ConsultasDaCeap } from './consultas.js';
import {
  exigirCategoriaAtiva,
  exigirCompetenciaAberta,
  exigirDataValida,
  exigirPodeMexer,
  exigirResponsavelFinanceiro,
  quemPodeDecidir,
} from './validacoes-da-despesa.js';
import type { DespesaCarregada } from './validacoes-da-despesa.js';
import { calcularSaldo, consumoDaCategoriaNoMes, etapasDaDespesa, statusDaEtapa } from './saldo.js';

export interface OpcoesDoServicoDeDespesas {
  readonly bd: BancoDeDados;
  readonly consultas: ConsultasDaCeap;
  readonly agora: () => Date;
}

/** Só estes perfis decidem a despesa que eles mesmos lançaram, com a coincidência marcada (RN-CEAP-10 a 12). */
const podeDecidirAPropria = ['chefe', 'administrador', 'parlamentar'] as const;

/** O que o acompanhamento depois da aprovação permite: de uma etapa, para quais. */
const transicoesDoAcompanhamento: Readonly<Record<string, readonly string[]>> = {
  Aprovada: ['Apresentada à Câmara'],
  'Apresentada à Câmara': ['Ressarcida', 'Glosada pela Câmara'],
  Reprovada: ['Arquivada'],
  'Glosada pela Câmara': ['Arquivada'],
};

/**
 * Despesas da CEAP. Percorrem o fluxo pelo mecanismo único de movimentação. O saldo nunca é gravado: a
 * despesa em análise já o reduz, e a conta é refeita sob um bloqueio da CEAP inteira, para duas escritas
 * simultâneas não furarem o limite. A segregação de função é conferida aqui e repetida pelo banco.
 */
export class ServicoDeDespesas {
  constructor(private readonly o: OpcoesDoServicoDeDespesas) {}

  private get bd() {
    return this.o.bd;
  }

  /** Serializa as escritas que mexem no saldo (a conta de um exercício não pode correr em duas ao mesmo tempo). */
  private async travarACeap(tx: Transacao): Promise<void> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('ceap'))`);
  }

  private async carregar(tx: Transacao, id: number): Promise<DespesaCarregada> {
    const [linha] = await tx
      .select()
      .from(despesa)
      .where(eq(despesa.id, id))
      .limit(1)
      .for('update');
    if (!linha) throw erros.naoEncontrado();
    return linha;
  }

  private async statusAtual(tx: Leitor, d: DespesaCarregada) {
    const etapas = await etapasDaDespesa(tx);
    const entrada = [...etapas].find(([, e]) => e.id === d.etapaAtualId);
    return {
      nome: entrada?.[0] ?? '',
      status: d.canceladaEm
        ? ('cancelada' as const)
        : statusDaEtapa(entrada?.[0] ?? '', entrada?.[1].papel ?? ''),
    };
  }

  async lancar(ator: Ator, dados: CorpoNovaDespesa): Promise<DespesaFicha> {
    exigirDataValida(dados.dataDocumento, this.o.agora());
    const responsavelId = dados.responsavelId ?? ator.usuarioId;
    const id = await this.bd.transaction(async (tx) => {
      await exigirResponsavelFinanceiro(tx, responsavelId);
      await exigirCategoriaAtiva(tx, dados.categoriaId);
      await exigirCompetenciaAberta(tx, dados.dataDocumento);
      const etapas = await etapasDaDespesa(tx);
      const lancada = etapas.get('Lançada')!;
      const [criada] = await tx
        .insert(despesa)
        .values({
          categoriaId: dados.categoriaId,
          responsavelId,
          lancadoPor: ator.usuarioId,
          descricao: dados.descricao,
          valor: dados.valor,
          dataDocumento: dados.dataDocumento,
          fornecedorNome: dados.fornecedorNome,
          fornecedorDocumento: dados.fornecedorDocumento,
          numeroDocumento: dados.numeroDocumento,
          etapaAtualId: lancada.id,
          criadoEm: this.o.agora(),
        })
        .returning({ id: despesa.id });
      const novoId = (criada as { id: number }).id;
      await registrarMovimentacao(tx, {
        registroTipo: 'despesa',
        registroId: novoId,
        etapaOrigemId: null,
        etapaDestinoId: lancada.id,
        autorId: ator.usuarioId,
        criadaEm: this.o.agora(),
      });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'ceap.lancar',
        entidade: 'despesa',
        registroId: novoId,
        valorNovo: {
          valor: dados.valor,
          categoriaId: dados.categoriaId,
          dataDocumento: dados.dataDocumento,
          responsavelId,
        },
      });
      return novoId;
    });
    return this.o.consultas.ficha(id);
  }

  async editar(ator: Ator, id: number, dados: CorpoAtualizarDespesa): Promise<DespesaFicha> {
    const mudancas: Partial<typeof despesa.$inferInsert> = {};
    if (dados.categoriaId !== undefined) mudancas.categoriaId = dados.categoriaId;
    if (dados.descricao !== undefined) mudancas.descricao = dados.descricao;
    if (dados.valor !== undefined) mudancas.valor = dados.valor;
    if (dados.dataDocumento !== undefined) {
      exigirDataValida(dados.dataDocumento, this.o.agora());
      mudancas.dataDocumento = dados.dataDocumento;
    }
    if (dados.fornecedorNome !== undefined) mudancas.fornecedorNome = dados.fornecedorNome;
    if (dados.fornecedorDocumento !== undefined)
      mudancas.fornecedorDocumento = dados.fornecedorDocumento;
    if (dados.numeroDocumento !== undefined) mudancas.numeroDocumento = dados.numeroDocumento;
    if (dados.responsavelId !== undefined) mudancas.responsavelId = dados.responsavelId;

    await this.bd.transaction(async (tx) => {
      const atual = await this.carregar(tx, id);
      exigirPodeMexer(ator, atual);
      if ((await this.statusAtual(tx, atual)).status !== 'lancada') {
        throw erros.conflito('Só a despesa que ainda não foi enviada para análise se edita.');
      }
      if (dados.categoriaId !== undefined) await exigirCategoriaAtiva(tx, dados.categoriaId);
      if (dados.responsavelId !== undefined)
        await exigirResponsavelFinanceiro(tx, dados.responsavelId);
      await exigirCompetenciaAberta(tx, atual.dataDocumento);
      if (dados.dataDocumento !== undefined) await exigirCompetenciaAberta(tx, dados.dataDocumento);
      await tx.update(despesa).set(mudancas).where(eq(despesa.id, id));
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'ceap.editar',
        entidade: 'despesa',
        registroId: id,
        valorAnterior: { valor: atual.valor, dataDocumento: atual.dataDocumento },
        valorNovo: {
          campos: Object.keys(mudancas),
          valor: mudancas.valor,
          dataDocumento: mudancas.dataDocumento,
        },
      });
    });
    return this.o.consultas.ficha(id);
  }

  /**
   * Envia para análise: confere o comprovante, o teto da categoria e o saldo (do mês e dos seguintes) e passa
   * a despesa para "Em análise", quando ela já reduz o saldo. Avisa quem decide; e, se o saldo cruzou o limite de
   * alerta, avisa também (RN-CEAP: a quem pode decidir).
   */
  async enviar(ator: Ator, id: number): Promise<DespesaFicha> {
    await this.bd.transaction(async (tx) => {
      await this.travarACeap(tx);
      const atual = await this.carregar(tx, id);
      exigirPodeMexer(ator, atual);
      if ((await this.statusAtual(tx, atual)).status !== 'lancada') {
        throw erros.conflito('A despesa já foi enviada para análise.');
      }
      await exigirCompetenciaAberta(tx, atual.dataDocumento);
      const categoria = await exigirCategoriaAtiva(tx, atual.categoriaId);

      if (categoria.comprovanteObrigatorio) {
        const [{ total }] = (await tx
          .select({ total: sql<number>`count(*)::int` })
          .from(documento)
          .where(
            and(
              eq(documento.registroTipo, 'despesa'),
              eq(documento.registroId, id),
              eq(documento.situacao, 'ativo'),
            ),
          )) as [{ total: number }];
        if (total === 0) throw erros.conflito('Anexe o comprovante antes de enviar para análise.');
      }

      const valor = paraCentavos(atual.valor) ?? 0;
      const ano = atual.competenciaAno ?? 0;
      const mes = atual.competenciaMes ?? 0;
      if (categoria.tetoMensal !== null) {
        const ja = await consumoDaCategoriaNoMes(tx, atual.categoriaId, ano, mes, id);
        const teto = paraCentavos(categoria.tetoMensal) ?? 0;
        if (ja + valor > teto) {
          throw erros.conflito(
            `A despesa passa do teto mensal da categoria (${formatarReais(categoria.tetoMensal)}); já foram usados ${formatarReais(`${ja / 100}`)}.`,
          );
        }
      }

      const antes = await calcularSaldo(tx, ano, this.o.agora());
      // O saldo acumulado do mês e o de cada mês seguinte precisam comportar a despesa.
      for (const m of antes.meses.filter((x) => x.mes >= mes)) {
        if ((paraCentavos(m.saldo) ?? 0) < valor) {
          const dica =
            antes.mesesSemCota.length > 0
              ? ' O parâmetro "cota mensal" não cobre todo o exercício.'
              : '';
          throw erros.conflito(
            `Saldo insuficiente: o saldo é ${formatarReais(m.saldo)} (${String(m.mes).padStart(2, '0')}/${ano}).${dica}`,
          );
        }
      }

      const etapas = await etapasDaDespesa(tx);
      const emAnalise = etapas.get('Em análise')!;
      await tx.update(despesa).set({ etapaAtualId: emAnalise.id }).where(eq(despesa.id, id));
      await registrarMovimentacao(tx, {
        registroTipo: 'despesa',
        registroId: id,
        etapaOrigemId: atual.etapaAtualId,
        etapaDestinoId: emAnalise.id,
        autorId: ator.usuarioId,
        criadaEm: this.o.agora(),
      });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'ceap.enviar',
        entidade: 'despesa',
        registroId: id,
        valorNovo: { valor: atual.valor },
      });

      const quem = await quemPodeDecidir(tx);
      await criarAvisos(
        tx,
        ator.usuarioId,
        quem.map((destinatarioId) => ({
          destinatarioId,
          natureza: 'despesa_aguardando_analise' as const,
          registroTipo: 'despesa' as const,
          registroId: id,
          geradoEm: this.o.agora(),
        })),
      );
      // O saldo cruzou o limite de alerta por causa desta despesa: avisa uma vez, na passagem.
      const depois = await calcularSaldo(tx, ano, this.o.agora());
      if (antes.limiteDeAlerta !== null && !antes.abaixoDoLimite && depois.abaixoDoLimite) {
        await criarAvisos(
          tx,
          ator.usuarioId,
          quem.map((destinatarioId) => ({
            destinatarioId,
            natureza: 'saldo_abaixo_limite' as const,
            registroTipo: 'despesa' as const,
            registroId: id,
            geradoEm: this.o.agora(),
          })),
        );
      }
    });
    return this.o.consultas.ficha(id);
  }

  /**
   * Aprova ou reprova: terminal. Quem lançou não decide, exceto Chefe, Administrador e Parlamentar, e então a
   * coincidência fica marcada (e a trilha a destaca). Reprovar exige motivo.
   */
  async decidir(ator: Ator, id: number, dados: CorpoDecidirDespesa): Promise<DespesaFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        await this.travarACeap(tx);
        const atual = await this.carregar(tx, id);
        const { status } = await this.statusAtual(tx, atual);
        if (status !== 'em_analise') throw erros.conflito('Só a despesa em análise se decide.');

        const propria = atual.lancadoPor === ator.usuarioId;
        if (propria && !podeDecidirAPropria.some((p) => p === ator.perfil)) {
          throw erros.semPermissao('Quem lançou a despesa não a decide. Peça a outra pessoa.');
        }
        const etapas = await etapasDaDespesa(tx);
        const destino = etapas.get(dados.decisao === 'aprovar' ? 'Aprovada' : 'Reprovada')!;
        await tx
          .update(despesa)
          .set({
            etapaAtualId: destino.id,
            decididoPor: ator.usuarioId,
            decididaEm: this.o.agora(),
            decisaoPeloProprioLancador: propria,
            motivoReprovacao: dados.decisao === 'reprovar' ? (dados.motivo ?? null) : null,
          })
          .where(eq(despesa.id, id));
        await registrarMovimentacao(tx, {
          registroTipo: 'despesa',
          registroId: id,
          etapaOrigemId: atual.etapaAtualId,
          etapaDestinoId: destino.id,
          autorId: ator.usuarioId,
          observacao: dados.decisao === 'reprovar' ? (dados.motivo ?? null) : null,
          criadaEm: this.o.agora(),
        });
        // A decisão pelo próprio lançador tem operação à parte: a trilha a destaca (RN-CEAP-12).
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: `ceap.${dados.decisao === 'aprovar' ? 'aprovar' : 'reprovar'}${propria ? '_propria' : ''}`,
          entidade: 'despesa',
          registroId: id,
          valorNovo: { decisaoPeloProprioLancador: propria },
          ...(dados.decisao === 'reprovar' ? { justificativa: dados.motivo ?? null } : {}),
        });
      });
    } catch (erro) {
      const msg = mensagemDoPostgres(erro);
      if (
        msg.includes('despesa_segregacao') ||
        msg.includes('Só Chefe, Administrador ou Parlamentar')
      ) {
        throw erros.semPermissao('Quem lançou a despesa não a decide.');
      }
      throw erro;
    }
    return this.o.consultas.ficha(id);
  }

  /** Cancelar devolve o valor ao saldo e exige justificativa. Só antes da decisão. */
  async cancelar(ator: Ator, id: number, justificativa: string): Promise<DespesaFicha> {
    try {
      await this.bd.transaction(async (tx) => {
        await this.travarACeap(tx);
        const atual = await this.carregar(tx, id);
        exigirPodeMexer(ator, atual);
        const { status } = await this.statusAtual(tx, atual);
        if (status !== 'lancada' && status !== 'em_analise') {
          throw erros.conflito('Só a despesa ainda não decidida se cancela.');
        }
        await tx
          .update(despesa)
          .set({
            canceladaEm: this.o.agora(),
            canceladaPor: ator.usuarioId,
            justificativaCancelamento: justificativa,
          })
          .where(eq(despesa.id, id));
        await registrarTrilha(tx, {
          origem: 'usuario',
          autorId: ator.usuarioId,
          operacao: 'ceap.cancelar',
          entidade: 'despesa',
          registroId: id,
          valorAnterior: { valor: atual.valor, status },
          justificativa,
        });
      });
    } catch (erro) {
      if (mensagemDoPostgres(erro).includes('Despesa cancelada'))
        throw erros.conflito('Despesa cancelada não se altera.');
      throw erro;
    }
    return this.o.consultas.ficha(id);
  }

  /** O acompanhamento depois da aprovação: apresentar à Câmara, ressarcir, glosar e arquivar. */
  async acompanhar(
    ator: Ator,
    id: number,
    etapaId: number,
    observacao?: string,
  ): Promise<DespesaFicha> {
    await this.bd.transaction(async (tx) => {
      await this.travarACeap(tx);
      const atual = await this.carregar(tx, id);
      if (atual.canceladaEm) throw erros.conflito('Despesa cancelada não se altera.');
      const etapas = await etapasDaDespesa(tx);
      const origem = [...etapas].find(([, e]) => e.id === atual.etapaAtualId)?.[0] ?? '';
      const destino = [...etapas].find(([, e]) => e.id === etapaId)?.[0];
      if (!destino) throw erros.requisicaoInvalida();
      if (!transicoesDoAcompanhamento[origem]?.includes(destino)) {
        throw erros.conflito(`Não se passa de "${origem}" para "${destino}".`);
      }
      await tx.update(despesa).set({ etapaAtualId: etapaId }).where(eq(despesa.id, id));
      await registrarMovimentacao(tx, {
        registroTipo: 'despesa',
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
        operacao: 'ceap.acompanhar',
        entidade: 'despesa',
        registroId: id,
        valorAnterior: { etapa: origem },
        valorNovo: { etapa: destino },
      });
    });
    return this.o.consultas.ficha(id);
  }
}
