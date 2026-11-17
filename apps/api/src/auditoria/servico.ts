import { trilha, usuario, type BancoDeDados } from '@gabinete/banco';
import type { EntradaDaTrilhaVisivel, PaginaDaTrilha } from '@gabinete/compartilhado';
import { and, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm';

export interface FiltroDaTrilha {
  readonly pagina: number;
  readonly porPagina: number;
  readonly operacao?: string;
  readonly entidade?: string;
  readonly autorId?: number;
  readonly de?: Date;
  readonly ate?: Date;
}

/** Entidades cujo histórico individual pode ser consultado. Cresce com os módulos (falha fechada). */
export const entidadesComHistorico = ['usuario', 'gabinete', 'pessoa', 'demanda'] as const;

export class ServicoDeAuditoria {
  constructor(private readonly bd: BancoDeDados) {}

  private consulta(condicoes: SQL | undefined) {
    return this.bd
      .select({
        id: trilha.id,
        ocorridaEm: trilha.ocorridaEm,
        autorId: trilha.autorId,
        autorNome: usuario.nome,
        origem: trilha.origem,
        operacao: trilha.operacao,
        entidade: trilha.entidade,
        registroId: trilha.registroId,
        valorAnterior: trilha.valorAnterior,
        valorNovo: trilha.valorNovo,
        justificativa: trilha.justificativa,
      })
      .from(trilha)
      .leftJoin(usuario, eq(usuario.id, trilha.autorId))
      .where(condicoes)
      .orderBy(desc(trilha.id));
  }

  private paraVisivel(
    l: Awaited<ReturnType<ServicoDeAuditoria['consulta']>>[number],
  ): EntradaDaTrilhaVisivel {
    return { ...l, ocorridaEm: l.ocorridaEm.toISOString() };
  }

  async listar(filtro: FiltroDaTrilha): Promise<PaginaDaTrilha> {
    const condicoes: SQL[] = [];
    if (filtro.operacao) condicoes.push(eq(trilha.operacao, filtro.operacao));
    if (filtro.entidade) condicoes.push(eq(trilha.entidade, filtro.entidade));
    if (filtro.autorId !== undefined) condicoes.push(eq(trilha.autorId, filtro.autorId));
    if (filtro.de) condicoes.push(gte(trilha.ocorridaEm, filtro.de));
    if (filtro.ate) condicoes.push(lte(trilha.ocorridaEm, filtro.ate));
    const onde = condicoes.length > 0 ? and(...condicoes) : undefined;

    const [total] = await this.bd.select({ total: count() }).from(trilha).where(onde);
    const itens = await this.consulta(onde)
      .limit(filtro.porPagina)
      .offset((filtro.pagina - 1) * filtro.porPagina);

    return {
      itens: itens.map((i) => this.paraVisivel(i)),
      total: total?.total ?? 0,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  /** As operações e entidades que já aparecem na trilha, para os filtros da tela. */
  async opcoes(): Promise<{ operacoes: string[]; entidades: string[] }> {
    const [operacoes, entidades] = await Promise.all([
      this.bd.selectDistinct({ valor: trilha.operacao }).from(trilha).orderBy(trilha.operacao),
      this.bd.selectDistinct({ valor: trilha.entidade }).from(trilha).orderBy(trilha.entidade),
    ]);
    return { operacoes: operacoes.map((o) => o.valor), entidades: entidades.map((e) => e.valor) };
  }

  /** Histórico de UM registro. O serviço do módulo dono do registro deve conferir o alcance. */
  async historicoDoRegistro(
    entidade: string,
    registroId: string,
  ): Promise<EntradaDaTrilhaVisivel[]> {
    const itens = await this.consulta(
      and(eq(trilha.entidade, entidade), eq(trilha.registroId, registroId)),
    ).limit(200);
    return itens.map((i) => this.paraVisivel(i));
  }
}
