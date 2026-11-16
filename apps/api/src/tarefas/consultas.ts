import { composicaoDeAlcance } from '@gabinete/autorizacao';
import {
  etapa,
  statusPeloPapel,
  tarefa,
  tipoProcesso,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import type {
  PaginaDeTarefas,
  Prioridade,
  StatusDeTarefa,
  TarefaFicha,
  TarefaResumo,
  TipoDeVinculoDeTarefaDto,
} from '@gabinete/compartilhado';
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, lt, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { hojeNoGabinete, padraoDeBusca, paginar } from '../atendimento/comum.js';
import { movimentacoesDoRegistro } from '../atendimento/movimentacoes.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import { comCorresponsaveis, corresponsaveisDe, tarefaDoUsuario } from '../responsaveis.js';

const responsavel = alias(usuario, 'responsavel');
const criador = alias(usuario, 'criador');

export interface FiltroDeTarefas {
  readonly pagina: number;
  readonly porPagina: number;
  readonly busca?: string | undefined;
  readonly status?: StatusDeTarefa | undefined;
  readonly etapaId?: number | undefined;
  readonly responsavelId?: number | undefined;
  readonly prioridade?: Prioridade | undefined;
  readonly atrasadas?: boolean | undefined;
  readonly minhas?: boolean | undefined;
  readonly vinculoTipo?: TipoDeVinculoDeTarefaDto | undefined;
  readonly vinculoId?: number | undefined;
}

/**
 * Leituras de tarefa. Listagem, ficha e painel usam o MESMO ponto de alcance: o Assessor Externo
 * só enxerga as tarefas de que é responsável (RN-TAR-03).
 */
export class ConsultasDeTarefas {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  private selecao() {
    return this.bd
      .select({
        id: tarefa.id,
        titulo: tarefa.titulo,
        descricao: tarefa.descricao,
        prioridade: tarefa.prioridade,
        prazo: tarefa.prazo,
        vinculoTipo: tarefa.vinculoTipo,
        vinculoId: tarefa.vinculoId,
        canceladaEm: tarefa.canceladaEm,
        justificativa: tarefa.justificativaCancelamento,
        criadoEm: tarefa.criadoEm,
        etapaId: etapa.id,
        etapaNome: etapa.nomeInterno,
        etapaPapel: etapa.papel,
        responsavelId: responsavel.id,
        responsavelNome: responsavel.nome,
        criadorNome: criador.nome,
      })
      .from(tarefa)
      .innerJoin(etapa, eq(etapa.id, tarefa.etapaAtualId))
      .innerJoin(responsavel, eq(responsavel.id, tarefa.responsavelId))
      .innerJoin(criador, eq(criador.id, tarefa.criadorId));
  }

  /** O ponto único de alcance. */
  static condicoesDeAlcance(ator: Ator): SQL[] {
    return composicaoDeAlcance(ator.perfil) === 'proprio' ? [tarefaDoUsuario(ator.usuarioId)] : [];
  }

  /** Tarefa em andamento: não cancelada e fora das etapas de conclusão e arquivamento. */
  static emAndamento(): SQL | undefined {
    return and(isNull(tarefa.canceladaEm), inArray(etapa.papel, ['entrada', 'intermediaria']));
  }

  private condicoes(ator: Ator, filtro: FiltroDeTarefas): SQL[] {
    const c = ConsultasDeTarefas.condicoesDeAlcance(ator);
    const emAndamento = ConsultasDeTarefas.emAndamento();

    if (filtro.minhas) c.push(tarefaDoUsuario(ator.usuarioId));
    if (filtro.etapaId !== undefined) c.push(eq(tarefa.etapaAtualId, filtro.etapaId));
    if (filtro.responsavelId !== undefined) c.push(eq(tarefa.responsavelId, filtro.responsavelId));
    if (filtro.prioridade) c.push(eq(tarefa.prioridade, filtro.prioridade));
    if (filtro.vinculoTipo) c.push(eq(tarefa.vinculoTipo, filtro.vinculoTipo));
    if (filtro.vinculoId !== undefined) c.push(eq(tarefa.vinculoId, filtro.vinculoId));

    switch (filtro.status) {
      case 'em_andamento':
        if (emAndamento) c.push(emAndamento);
        break;
      case 'concluido':
        c.push(isNull(tarefa.canceladaEm), eq(etapa.papel, 'conclusao'));
        break;
      case 'arquivado':
        c.push(isNull(tarefa.canceladaEm), eq(etapa.papel, 'arquivamento'));
        break;
      case 'cancelada':
        c.push(isNotNull(tarefa.canceladaEm));
        break;
      default:
        break;
    }
    if (filtro.atrasadas && emAndamento) {
      c.push(emAndamento, lt(tarefa.prazo, hojeNoGabinete(this.agora())));
    }
    if (filtro.busca) c.push(ilike(tarefa.titulo, padraoDeBusca(filtro.busca)));
    return c;
  }

  private mapear(l: Awaited<ReturnType<ConsultasDeTarefas['selecao']>>[number]): TarefaResumo {
    const status: StatusDeTarefa = l.canceladaEm ? 'cancelada' : statusPeloPapel(l.etapaPapel);
    return {
      id: l.id,
      titulo: l.titulo,
      prioridade: l.prioridade,
      prazo: l.prazo,
      etapa: { id: l.etapaId, nome: l.etapaNome, papel: l.etapaPapel },
      status,
      atrasada:
        status === 'em_andamento' && l.prazo !== null && l.prazo < hojeNoGabinete(this.agora()),
      responsavel: { id: l.responsavelId, nome: l.responsavelNome },
      corresponsaveis: [],
      criador: l.criadorNome,
      vinculo:
        l.vinculoTipo !== null && l.vinculoId !== null
          ? { tipo: l.vinculoTipo, id: l.vinculoId }
          : null,
      criadoEm: l.criadoEm.toISOString(),
    };
  }

  async listar(ator: Ator, filtro: FiltroDeTarefas): Promise<PaginaDeTarefas> {
    const onde = and(...this.condicoes(ator, filtro));
    const [total] = await this.bd
      .select({ total: count() })
      .from(tarefa)
      .innerJoin(etapa, eq(etapa.id, tarefa.etapaAtualId))
      .where(onde);

    const { limite, deslocamento } = paginar(filtro.pagina, filtro.porPagina);
    const linhas = await this.selecao()
      .where(onde)
      .orderBy(desc(tarefa.criadoEm), desc(tarefa.id))
      .limit(limite)
      .offset(deslocamento);

    return {
      itens: await comCorresponsaveis(
        this.bd,
        'tarefa',
        linhas.map((l) => this.mapear(l)),
      ),
      total: total?.total ?? 0,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  async ficha(ator: Ator, id: number): Promise<TarefaFicha> {
    const [linha] = await this.selecao()
      .where(and(eq(tarefa.id, id), ...ConsultasDeTarefas.condicoesDeAlcance(ator)))
      .limit(1);
    if (!linha) throw erros.naoEncontrado();
    return {
      ...this.mapear(linha),
      corresponsaveis: (await corresponsaveisDe(this.bd, 'tarefa', [id])).get(id) ?? [],
      descricao: linha.descricao,
      canceladaEm: linha.canceladaEm?.toISOString() ?? null,
      justificativaCancelamento: linha.justificativa,
      movimentacoes: await movimentacoesDoRegistro(this.bd, 'tarefa', id),
    };
  }

  /** As etapas ativas do fluxo da tarefa, para mover. */
  async etapas() {
    return this.bd
      .select({ id: etapa.id, nome: etapa.nomeInterno, papel: etapa.papel, ordem: etapa.ordem })
      .from(etapa)
      .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
      .where(and(eq(tipoProcesso.tipo, 'tarefa'), eq(etapa.situacao, 'ativa')))
      .orderBy(etapa.ordem, etapa.id);
  }
}
