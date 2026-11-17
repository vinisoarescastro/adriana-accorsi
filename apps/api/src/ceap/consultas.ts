import {
  ceapCategoria,
  ceapEncerramento,
  despesa,
  documento,
  etapa,
  tipoProcesso,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import {
  formatarDocumentoDoFornecedor,
  statusQueConsomemSaldo,
  type ComprovanteDto,
  type DespesaFicha,
  type DespesaResumo,
  type PaginaDeDespesas,
  type StatusDeDespesa,
} from '@gabinete/compartilhado';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { hojeNoGabinete, padraoDeBusca, paginar } from '../atendimento/comum.js';
import { movimentacoesDoRegistro } from '../atendimento/movimentacoes.js';
import { erros } from '../erros.js';
import { parametroVigente, statusDaEtapa } from './saldo.js';

const responsavel = alias(usuario, 'responsavel');
const lancador = alias(usuario, 'lancador');
const decisor = alias(usuario, 'decisor');
const enviador = alias(usuario, 'enviador');

export interface FiltroDeDespesas {
  readonly pagina: number;
  readonly porPagina: number;
  readonly ano?: number | undefined;
  readonly mes?: number | undefined;
  readonly categoriaId?: number | undefined;
  readonly status?: StatusDeDespesa | undefined;
  readonly busca?: string | undefined;
  readonly minhas?: boolean | undefined;
  /** Só as que aguardam análise. */
  readonly aguardando?: boolean | undefined;
}

type Linha = Awaited<ReturnType<ConsultasDaCeap['selecao']>>[number];

const diasEntre = (de: string, ate: string) =>
  Math.round(
    (new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime()) / 86_400_000,
  );

/** Leituras de despesa. O status vem da etapa; o prazo de apresentação, do parâmetro vigente. */
export class ConsultasDaCeap {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  private selecao() {
    return this.bd
      .select({
        id: despesa.id,
        descricao: despesa.descricao,
        valor: sql<string>`${despesa.valor}::text`,
        dataDocumento: despesa.dataDocumento,
        ano: despesa.competenciaAno,
        mes: despesa.competenciaMes,
        categoriaId: ceapCategoria.id,
        categoriaNome: ceapCategoria.nome,
        fornecedorNome: despesa.fornecedorNome,
        fornecedorDocumento: despesa.fornecedorDocumento,
        numeroDocumento: despesa.numeroDocumento,
        etapaId: etapa.id,
        etapaNome: etapa.nomeInterno,
        etapaPapel: etapa.papel,
        responsavelId: responsavel.id,
        responsavelNome: responsavel.nome,
        lancadorId: lancador.id,
        lancadorNome: lancador.nome,
        decisorNome: decisor.nome,
        decididaEm: despesa.decididaEm,
        proprio: despesa.decisaoPeloProprioLancador,
        motivo: despesa.motivoReprovacao,
        canceladaEm: despesa.canceladaEm,
        justificativa: despesa.justificativaCancelamento,
        criadaEm: despesa.criadoEm,
      })
      .from(despesa)
      .innerJoin(etapa, eq(etapa.id, despesa.etapaAtualId))
      .innerJoin(ceapCategoria, eq(ceapCategoria.id, despesa.categoriaId))
      .innerJoin(responsavel, eq(responsavel.id, despesa.responsavelId))
      .innerJoin(lancador, eq(lancador.id, despesa.lancadoPor))
      .leftJoin(decisor, eq(decisor.id, despesa.decididoPor));
  }

  /** Quais etapas representam cada status (pelos nomes do fluxo). */
  private async idsDoStatus(status: StatusDeDespesa): Promise<number[]> {
    const todas = await this.bd
      .select({ id: etapa.id, nome: etapa.nomeInterno, papel: etapa.papel })
      .from(etapa)
      .where(
        inArray(etapa.nomeInterno, [
          'Lançada',
          'Em análise',
          'Aprovada',
          'Apresentada à Câmara',
          'Ressarcida',
          'Reprovada',
          'Glosada pela Câmara',
          'Arquivada',
        ]),
      );
    return todas.filter((e) => statusDaEtapa(e.nome, e.papel) === status).map((e) => e.id);
  }

  private async condicoes(ator: { usuarioId: number }, f: FiltroDeDespesas): Promise<SQL[]> {
    const c: SQL[] = [];
    if (f.ano !== undefined) c.push(eq(despesa.competenciaAno, f.ano));
    if (f.mes !== undefined) c.push(eq(despesa.competenciaMes, f.mes));
    if (f.categoriaId !== undefined) c.push(eq(despesa.categoriaId, f.categoriaId));
    if (f.minhas)
      c.push(
        or(
          eq(despesa.lancadoPor, ator.usuarioId),
          eq(despesa.responsavelId, ator.usuarioId),
        ) as SQL,
      );
    if (f.aguardando)
      c.push(
        isNull(despesa.canceladaEm),
        inArray(despesa.etapaAtualId, await this.idsDoStatus('em_analise')),
      );
    if (f.status === 'cancelada') c.push(isNotNull(despesa.canceladaEm));
    else if (f.status)
      c.push(
        isNull(despesa.canceladaEm),
        inArray(despesa.etapaAtualId, await this.idsDoStatus(f.status)),
      );
    if (f.busca) {
      const termo = padraoDeBusca(f.busca);
      const criterio = or(
        ilike(despesa.descricao, termo),
        ilike(despesa.fornecedorNome, termo),
        ilike(despesa.numeroDocumento, termo),
      );
      if (criterio) c.push(criterio);
    }
    return c;
  }

  private async contagemDeComprovantes(ids: readonly number[]): Promise<Map<number, number>> {
    const mapa = new Map<number, number>();
    if (ids.length === 0) return mapa;
    const linhas = await this.bd
      .select({ id: documento.registroId, total: count() })
      .from(documento)
      .where(
        and(
          eq(documento.registroTipo, 'despesa'),
          eq(documento.situacao, 'ativo'),
          inArray(documento.registroId, [...ids]),
        ),
      )
      .groupBy(documento.registroId);
    for (const l of linhas) mapa.set(l.id, l.total);
    return mapa;
  }

  private mapear(
    l: Linha,
    comprovantes: number,
    prazoDias: number | null,
    hoje: string,
  ): DespesaResumo {
    const status: StatusDeDespesa = l.canceladaEm
      ? 'cancelada'
      : statusDaEtapa(l.etapaNome, l.etapaPapel);
    return {
      id: l.id,
      descricao: l.descricao,
      valor: l.valor,
      dataDocumento: l.dataDocumento,
      competencia: { ano: l.ano ?? 0, mes: l.mes ?? 0 },
      categoria: { id: l.categoriaId, nome: l.categoriaNome },
      fornecedor: {
        nome: l.fornecedorNome,
        documento: formatarDocumentoDoFornecedor(l.fornecedorDocumento),
      },
      numeroDocumento: l.numeroDocumento,
      etapa: { id: l.etapaId, nome: l.etapaNome, papel: l.etapaPapel },
      status,
      consomeSaldo: statusQueConsomemSaldo.includes(status),
      responsavel: { id: l.responsavelId, nome: l.responsavelNome },
      lancadaPor: { id: l.lancadorId, nome: l.lancadorNome },
      decididaPor: l.decisorNome,
      decididaEm: l.decididaEm?.toISOString() ?? null,
      decisaoPeloProprioLancador: l.proprio,
      motivoReprovacao: l.motivo,
      foraDoPrazo:
        prazoDias !== null &&
        ['lancada', 'em_analise', 'aprovada'].includes(status) &&
        diasEntre(l.dataDocumento, hoje) > prazoDias,
      quantidadeDeComprovantes: comprovantes,
      criadaEm: l.criadaEm.toISOString(),
    };
  }

  private async prazoDeApresentacao(hoje: string): Promise<number | null> {
    const v = await parametroVigente(this.bd, 'prazo_apresentacao_dias', hoje);
    return v === null ? null : Number(v);
  }

  async listar(ator: { usuarioId: number }, filtro: FiltroDeDespesas): Promise<PaginaDeDespesas> {
    const onde = and(...(await this.condicoes(ator, filtro)));
    const [total] = await this.bd.select({ total: count() }).from(despesa).where(onde);
    const { limite, deslocamento } = paginar(filtro.pagina, filtro.porPagina);
    const linhas = await this.selecao()
      .where(onde)
      .orderBy(desc(despesa.dataDocumento), desc(despesa.id))
      .limit(limite)
      .offset(deslocamento);
    const hoje = hojeNoGabinete(this.agora());
    const [prazo, comprovantes] = await Promise.all([
      this.prazoDeApresentacao(hoje),
      this.contagemDeComprovantes(linhas.map((l) => l.id)),
    ]);
    return {
      itens: linhas.map((l) => this.mapear(l, comprovantes.get(l.id) ?? 0, prazo, hoje)),
      total: total?.total ?? 0,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  /** Todas as despesas de um intervalo de competências (para o relatório). */
  async doPeriodo(
    deAno: number,
    deMes: number,
    ateAno: number,
    ateMes: number,
  ): Promise<DespesaResumo[]> {
    const de = deAno * 100 + deMes;
    const ate = ateAno * 100 + ateMes;
    const linhas = await this.selecao()
      .where(
        sql`(${despesa.competenciaAno} * 100 + ${despesa.competenciaMes}) BETWEEN ${de} AND ${ate}`,
      )
      .orderBy(despesa.dataDocumento, despesa.id);
    const hoje = hojeNoGabinete(this.agora());
    const [prazo, comprovantes] = await Promise.all([
      this.prazoDeApresentacao(hoje),
      this.contagemDeComprovantes(linhas.map((l) => l.id)),
    ]);
    return linhas.map((l) => this.mapear(l, comprovantes.get(l.id) ?? 0, prazo, hoje));
  }

  /** As etapas do fluxo da despesa, para o acompanhamento depois da aprovação. */
  async etapas() {
    return this.bd
      .select({ id: etapa.id, nome: etapa.nomeInterno, papel: etapa.papel, ordem: etapa.ordem })
      .from(etapa)
      .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
      .where(and(eq(tipoProcesso.tipo, 'despesa_ceap'), eq(etapa.situacao, 'ativa')))
      .orderBy(etapa.ordem, etapa.id);
  }

  async comprovantes(id: number): Promise<ComprovanteDto[]> {
    const linhas = await this.bd
      .select({
        id: documento.id,
        nome: documento.nome,
        tipo: documento.tipoReal,
        tamanho: documento.tamanho,
        enviadoPor: enviador.nome,
        enviadoEm: documento.enviadoEm,
      })
      .from(documento)
      .innerJoin(enviador, eq(enviador.id, documento.autorEnvio))
      .where(
        and(
          eq(documento.registroTipo, 'despesa'),
          eq(documento.registroId, id),
          eq(documento.situacao, 'ativo'),
        ),
      )
      .orderBy(documento.id);
    return linhas.map((l) => ({
      ...l,
      tamanho: Number(l.tamanho),
      enviadoEm: l.enviadoEm.toISOString(),
    }));
  }

  async ficha(id: number): Promise<DespesaFicha> {
    const [linha] = await this.selecao().where(eq(despesa.id, id)).limit(1);
    if (!linha) throw erros.naoEncontrado();
    const hoje = hojeNoGabinete(this.agora());
    const comprovantes = await this.comprovantes(id);
    const [encerrada] = await this.bd
      .select()
      .from(ceapEncerramento)
      .where(
        and(
          eq(ceapEncerramento.ano, linha.ano ?? 0),
          eq(ceapEncerramento.mes, linha.mes ?? 0),
          isNull(ceapEncerramento.reabertaEm),
        ),
      )
      .limit(1);
    return {
      ...this.mapear(linha, comprovantes.length, await this.prazoDeApresentacao(hoje), hoje),
      comprovantes,
      canceladaEm: linha.canceladaEm?.toISOString() ?? null,
      justificativaCancelamento: linha.justificativa,
      competenciaEncerrada: encerrada !== undefined,
      movimentacoes: await movimentacoesDoRegistro(this.bd, 'despesa', id),
    };
  }
}
