import {
  beneficiario,
  categoria,
  destinacao,
  emenda,
  emendaValor,
  etapa,
  execucaoDestinacao,
  statusPeloPapel,
  tipoProcesso,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import type {
  CategoriaDto,
  ConsolidadoDeEmendas,
  DestinacaoDto,
  EmendaFicha,
  EmendaResumo,
  PaginaDeEmendas,
  ReconstituicaoDeEmendas,
  StatusDeEmenda,
} from '@gabinete/compartilhado';
import { deCentavos, paraCentavos } from '@gabinete/compartilhado';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { hojeNoGabinete, padraoDeBusca, paginar } from '../atendimento/comum.js';
import { movimentacoesDoRegistro } from '../atendimento/movimentacoes.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';
import { somarValores, valoresDasEmendas } from './valores.js';

const responsavel = alias(usuario, 'responsavel');
const criador = alias(usuario, 'criador');
const tipo = alias(categoria, 'tipo');
const autor = alias(usuario, 'autor');
const etapaDaDestinacao = alias(etapa, 'etapa_da_destinacao');

export interface FiltroDeEmendas {
  readonly pagina: number;
  readonly porPagina: number;
  readonly busca?: string | undefined;
  readonly status?: StatusDeEmenda | undefined;
  readonly etapaId?: number | undefined;
  readonly exercicio?: number | undefined;
  readonly tipoId?: number | undefined;
  readonly responsavelId?: number | undefined;
  readonly atrasadas?: boolean | undefined;
  readonly minhas?: boolean | undefined;
}

type Linha = Awaited<ReturnType<ConsultasDeEmendas['selecao']>>[number];

/**
 * Leituras das emendas. Os valores (comprometido, utilizado, disponível, a executar) e o atraso nascem
 * aqui, da conta sobre os lançamentos: não existe coluna de saldo (RN-EME). Quem alcança o módulo vê todas.
 */
export class ConsultasDeEmendas {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  private selecao() {
    return this.bd
      .select({
        id: emenda.id,
        identificacao: emenda.identificacao,
        exercicio: emenda.exercicio,
        finalidade: emenda.finalidade,
        prazoDestinacao: emenda.prazoDestinacao,
        prazoEmpenho: emenda.prazoEmpenho,
        prazoExecucao: emenda.prazoExecucao,
        canceladaEm: emenda.canceladaEm,
        justificativa: emenda.justificativaCancelamento,
        criadoEm: emenda.criadoEm,
        tipoId: tipo.id,
        tipoNome: tipo.nome,
        etapaId: etapa.id,
        etapaNome: etapa.nomeInterno,
        etapaPapel: etapa.papel,
        responsavelId: responsavel.id,
        responsavelNome: responsavel.nome,
        criadorNome: criador.nome,
      })
      .from(emenda)
      .innerJoin(etapa, eq(etapa.id, emenda.etapaAtualId))
      .innerJoin(tipo, eq(tipo.id, emenda.tipoId))
      .innerJoin(responsavel, eq(responsavel.id, emenda.responsavelId))
      .innerJoin(criador, eq(criador.id, emenda.criadorId));
  }

  static emAndamento(): SQL | undefined {
    return and(isNull(emenda.canceladaEm), inArray(etapa.papel, ['entrada', 'intermediaria']));
  }

  /** Algum dos três prazos vencido (e a emenda ainda em andamento). */
  private vencida(hoje: string): SQL {
    return or(
      lt(emenda.prazoDestinacao, hoje),
      lt(emenda.prazoEmpenho, hoje),
      lt(emenda.prazoExecucao, hoje),
    ) as SQL;
  }

  private condicoes(ator: Ator, filtro: FiltroDeEmendas): SQL[] {
    const c: SQL[] = [];
    const emAndamento = ConsultasDeEmendas.emAndamento();
    if (filtro.minhas) c.push(eq(emenda.responsavelId, ator.usuarioId));
    if (filtro.etapaId !== undefined) c.push(eq(emenda.etapaAtualId, filtro.etapaId));
    if (filtro.exercicio !== undefined) c.push(eq(emenda.exercicio, filtro.exercicio));
    if (filtro.tipoId !== undefined) c.push(eq(emenda.tipoId, filtro.tipoId));
    if (filtro.responsavelId !== undefined) c.push(eq(emenda.responsavelId, filtro.responsavelId));
    switch (filtro.status) {
      case 'em_andamento':
        if (emAndamento) c.push(emAndamento);
        break;
      case 'concluida':
        c.push(isNull(emenda.canceladaEm), eq(etapa.papel, 'conclusao'));
        break;
      case 'arquivada':
        c.push(isNull(emenda.canceladaEm), eq(etapa.papel, 'arquivamento'));
        break;
      case 'cancelada':
        c.push(isNotNull(emenda.canceladaEm));
        break;
      default:
        break;
    }
    if (filtro.atrasadas && emAndamento) {
      c.push(emAndamento, this.vencida(hojeNoGabinete(this.agora())));
    }
    if (filtro.busca) {
      const termo = padraoDeBusca(filtro.busca);
      const criterio = or(ilike(emenda.identificacao, termo), ilike(emenda.finalidade, termo));
      if (criterio) c.push(criterio);
    }
    return c;
  }

  private mapear(l: Linha, valores: EmendaResumo['valores']): EmendaResumo {
    const status: StatusDeEmenda = l.canceladaEm
      ? 'cancelada'
      : ({ em_andamento: 'em_andamento', concluido: 'concluida', arquivado: 'arquivada' } as const)[
          statusPeloPapel(l.etapaPapel)
        ];
    const hoje = hojeNoGabinete(this.agora());
    const prazos = [l.prazoDestinacao, l.prazoEmpenho, l.prazoExecucao];
    return {
      id: l.id,
      identificacao: l.identificacao,
      exercicio: l.exercicio,
      tipo: { id: l.tipoId, nome: l.tipoNome },
      finalidade: l.finalidade,
      etapa: { id: l.etapaId, nome: l.etapaNome, papel: l.etapaPapel },
      status,
      responsavel: { id: l.responsavelId, nome: l.responsavelNome },
      prazoDestinacao: l.prazoDestinacao,
      prazoEmpenho: l.prazoEmpenho,
      prazoExecucao: l.prazoExecucao,
      atrasada: status === 'em_andamento' && prazos.some((p) => p !== null && p < hoje),
      valores,
      criadoEm: l.criadoEm.toISOString(),
    };
  }

  async listar(ator: Ator, filtro: FiltroDeEmendas): Promise<PaginaDeEmendas> {
    const onde = and(...this.condicoes(ator, filtro));
    const [total] = await this.bd
      .select({ total: count() })
      .from(emenda)
      .innerJoin(etapa, eq(etapa.id, emenda.etapaAtualId))
      .where(onde);
    const { limite, deslocamento } = paginar(filtro.pagina, filtro.porPagina);
    const linhas = await this.selecao()
      .where(onde)
      .orderBy(desc(emenda.exercicio), desc(emenda.id))
      .limit(limite)
      .offset(deslocamento);
    const valores = await valoresDasEmendas(
      this.bd,
      linhas.map((l) => l.id),
      this.agora(),
    );
    return {
      itens: linhas.map((l) => this.mapear(l, valores.get(l.id) as EmendaResumo['valores'])),
      total: total?.total ?? 0,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  async ficha(id: number): Promise<EmendaFicha> {
    const [linha] = await this.selecao().where(eq(emenda.id, id)).limit(1);
    if (!linha) throw erros.naoEncontrado();
    const valores = (await valoresDasEmendas(this.bd, [id], this.agora())).get(
      id,
    ) as EmendaResumo['valores'];

    const destinacoes = await this.bd
      .select({
        id: destinacao.id,
        beneficiarioId: beneficiario.id,
        beneficiarioNome: beneficiario.nomeFantasia,
        beneficiarioCnpj: beneficiario.cnpj,
        valor: sql<string>`${destinacao.valor}::text`,
        finalidade: destinacao.finalidade,
        etapaId: etapaDaDestinacao.id,
        etapaNome: etapaDaDestinacao.nomeInterno,
        etapaPapel: etapaDaDestinacao.papel,
        canceladaEm: destinacao.canceladaEm,
        justificativa: destinacao.justificativaCancelamento,
        criadaPor: autor.nome,
        criadaEm: destinacao.criadaEm,
      })
      .from(destinacao)
      .innerJoin(beneficiario, eq(beneficiario.id, destinacao.beneficiarioId))
      .innerJoin(etapaDaDestinacao, eq(etapaDaDestinacao.id, destinacao.etapaAtualId))
      .innerJoin(autor, eq(autor.id, destinacao.criadaPor))
      .where(eq(destinacao.emendaId, id))
      .orderBy(asc(destinacao.id));
    const execucoes = destinacoes.length
      ? await this.bd
          .select({
            id: execucaoDestinacao.id,
            destinacaoId: execucaoDestinacao.destinacaoId,
            valor: sql<string>`${execucaoDestinacao.valor}::text`,
            data: execucaoDestinacao.data,
            observacao: execucaoDestinacao.observacao,
            registradoPor: autor.nome,
            registradoEm: execucaoDestinacao.registradoEm,
          })
          .from(execucaoDestinacao)
          .innerJoin(autor, eq(autor.id, execucaoDestinacao.registradoPor))
          .where(
            inArray(
              execucaoDestinacao.destinacaoId,
              destinacoes.map((d) => d.id),
            ),
          )
          .orderBy(asc(execucaoDestinacao.data), asc(execucaoDestinacao.id))
      : [];

    const dtos: DestinacaoDto[] = destinacoes.map((d) => {
      const dele = execucoes.filter((e) => e.destinacaoId === d.id);
      const executado = dele.reduce((s, e) => s + (paraCentavos(e.valor) ?? 0), 0);
      return {
        id: d.id,
        beneficiario: { id: d.beneficiarioId, nome: d.beneficiarioNome, cnpj: d.beneficiarioCnpj },
        valor: d.valor,
        finalidade: d.finalidade,
        etapa: { id: d.etapaId, nome: d.etapaNome, papel: d.etapaPapel },
        executado: deCentavos(executado),
        aExecutar: deCentavos((paraCentavos(d.valor) ?? 0) - executado),
        cancelada: d.canceladaEm !== null,
        justificativaCancelamento: d.justificativa,
        criadaPor: d.criadaPor,
        criadaEm: d.criadaEm.toISOString(),
        execucoes: dele.map((e) => ({
          id: e.id,
          valor: e.valor,
          data: e.data,
          observacao: e.observacao,
          registradoPor: e.registradoPor,
          registradoEm: e.registradoEm.toISOString(),
        })),
      };
    });

    const historico = await this.bd
      .select({
        valor: sql<string>`${emendaValor.valor}::text`,
        em: emendaValor.definidoEm,
        por: autor.nome,
      })
      .from(emendaValor)
      .innerJoin(autor, eq(autor.id, emendaValor.definidoPor))
      .where(eq(emendaValor.emendaId, id))
      .orderBy(desc(emendaValor.definidoEm), desc(emendaValor.id));

    return {
      ...this.mapear(linha, valores),
      criador: linha.criadorNome,
      destinacoes: dtos,
      historicoDoValor: historico.map((h) => ({
        valor: h.valor,
        em: h.em.toISOString(),
        por: h.por,
      })),
      canceladaEm: linha.canceladaEm?.toISOString() ?? null,
      justificativaCancelamento: linha.justificativa,
      movimentacoes: await movimentacoesDoRegistro(this.bd, 'emenda', id),
    };
  }

  async etapas() {
    return this.bd
      .select({ id: etapa.id, nome: etapa.nomeInterno, papel: etapa.papel, ordem: etapa.ordem })
      .from(etapa)
      .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
      .where(and(eq(tipoProcesso.tipo, 'emenda'), eq(etapa.situacao, 'ativa')))
      .orderBy(etapa.ordem, etapa.id);
  }

  async tipos(): Promise<CategoriaDto[]> {
    const linhas = await this.bd
      .select({ id: categoria.id, nome: categoria.nome, situacao: categoria.situacao })
      .from(categoria)
      .where(eq(categoria.natureza, 'tipo_emenda'))
      .orderBy(asc(categoria.nome));
    return linhas.map((l) => ({ ...l, natureza: 'tipo_emenda' as const }));
  }

  /** O consolidado: contagens por situação, valores somados das emendas não canceladas e por etapa. */
  async consolidado(ator: Ator): Promise<ConsolidadoDeEmendas> {
    const hoje = hojeNoGabinete(this.agora());
    const contar = async (...c: (SQL | undefined)[]) => {
      const [r] = await this.bd
        .select({ total: count() })
        .from(emenda)
        .innerJoin(etapa, eq(etapa.id, emenda.etapaAtualId))
        .where(and(...c));
      return r?.total ?? 0;
    };
    const emAndamento = ConsultasDeEmendas.emAndamento();
    const naoCanceladas = await this.bd
      .select({ id: emenda.id })
      .from(emenda)
      .where(isNull(emenda.canceladaEm));
    const valores = await valoresDasEmendas(
      this.bd,
      naoCanceladas.map((e) => e.id),
      this.agora(),
    );
    const porEtapa = await Promise.all(
      (await this.etapas()).map(async (e) => ({
        etapaId: e.id,
        nome: e.nome,
        papel: e.papel,
        ordem: e.ordem,
        total: await contar(eq(emenda.etapaAtualId, e.id), isNull(emenda.canceladaEm)),
      })),
    );
    return {
      emAndamento: await contar(emAndamento),
      atrasadas: await contar(emAndamento, this.vencida(hoje)),
      concluidas: await contar(isNull(emenda.canceladaEm), eq(etapa.papel, 'conclusao')),
      arquivadas: await contar(isNull(emenda.canceladaEm), eq(etapa.papel, 'arquivamento')),
      canceladas: await contar(isNotNull(emenda.canceladaEm)),
      minhasEmAndamento: await contar(emAndamento, eq(emenda.responsavelId, ator.usuarioId)),
      valores: somarValores([...valores.values()]),
      porEtapa,
    };
  }

  /** Os valores de cada emenda no fim do dia `dia` (fuso do gabinete): a mesma conta de hoje, com a data de então. */
  async reconstituir(dia: string): Promise<ReconstituicaoDeEmendas> {
    const em = new Date(`${dia}T23:59:59.999-03:00`);
    const todas = await this.bd
      .select({ id: emenda.id, identificacao: emenda.identificacao, exercicio: emenda.exercicio })
      .from(emenda)
      .where(sql`${emenda.criadoEm} <= ${em.toISOString()}::timestamptz`)
      .orderBy(asc(emenda.exercicio), asc(emenda.id));
    const valores = await valoresDasEmendas(
      this.bd,
      todas.map((e) => e.id),
      em,
    );
    const itens = todas.map((e) => ({
      ...e,
      valores: valores.get(e.id) as EmendaResumo['valores'],
    }));
    return { em: dia, itens, total: somarValores(itens.map((i) => i.valores)) };
  }
}
