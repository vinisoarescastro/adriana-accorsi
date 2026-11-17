import {
  categoria,
  etapa,
  projetoAssunto,
  projetoCoautor,
  projetoLei,
  statusPeloPapel,
  tipoProcesso,
  tramitacaoComissao,
  usuario,
  votacaoProjeto,
  type BancoDeDados,
} from '@gabinete/banco';
import type {
  CategoriaDto,
  ConsolidadoDeProjetos,
  PaginaDeProjetos,
  ProjetoFicha,
  ProjetoResumo,
  StatusDeProjeto,
} from '@gabinete/compartilhado';
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
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { hojeNoGabinete, padraoDeBusca, paginar } from '../atendimento/comum.js';
import { movimentacoesDoRegistro } from '../atendimento/movimentacoes.js';
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

const responsavel = alias(usuario, 'responsavel');
const criador = alias(usuario, 'criador');
const registrador = alias(usuario, 'registrador');
const tipo = alias(categoria, 'tipo');

export interface FiltroDeProjetos {
  readonly pagina: number;
  readonly porPagina: number;
  readonly busca?: string | undefined;
  readonly status?: StatusDeProjeto | undefined;
  readonly etapaId?: number | undefined;
  readonly responsavelId?: number | undefined;
  readonly tipoProposicaoId?: number | undefined;
  readonly assuntoId?: number | undefined;
  readonly atrasados?: boolean | undefined;
  readonly meus?: boolean | undefined;
}

type LinhaDeProjeto = Awaited<ReturnType<ConsultasDeProjetos['selecao']>>[number];

/**
 * Leituras do legislativo. O status e o atraso nascem aqui, da etapa e do prazo, e nunca são gravados
 * (RN-DEM-06). Quem alcança o módulo (nível 2 com a habilitação LG) vê todos os projetos: o recorte "só o
 * que é seu" é do Assessor Externo, que não alcança o módulo.
 */
export class ConsultasDeProjetos {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  private selecao() {
    return this.bd
      .select({
        id: projetoLei.id,
        titulo: projetoLei.titulo,
        ementa: projetoLei.ementa,
        autoria: projetoLei.autoria,
        numero: projetoLei.numero,
        prazo: projetoLei.prazo,
        canceladoEm: projetoLei.canceladoEm,
        justificativa: projetoLei.justificativaCancelamento,
        criadoEm: projetoLei.criadoEm,
        tipoId: tipo.id,
        tipoNome: tipo.nome,
        etapaId: etapa.id,
        etapaNome: etapa.nomeInterno,
        etapaPapel: etapa.papel,
        responsavelId: responsavel.id,
        responsavelNome: responsavel.nome,
        criadorNome: criador.nome,
      })
      .from(projetoLei)
      .innerJoin(etapa, eq(etapa.id, projetoLei.etapaAtualId))
      .innerJoin(tipo, eq(tipo.id, projetoLei.tipoProposicaoId))
      .innerJoin(responsavel, eq(responsavel.id, projetoLei.responsavelId))
      .innerJoin(criador, eq(criador.id, projetoLei.criadorId));
  }

  /** Em andamento: não cancelado e fora das etapas de conclusão e arquivamento. */
  static emAndamento(): SQL | undefined {
    return and(isNull(projetoLei.canceladoEm), inArray(etapa.papel, ['entrada', 'intermediaria']));
  }

  private condicoes(ator: Ator, filtro: FiltroDeProjetos): SQL[] {
    const c: SQL[] = [];
    const emAndamento = ConsultasDeProjetos.emAndamento();
    if (filtro.meus) c.push(eq(projetoLei.responsavelId, ator.usuarioId));
    if (filtro.etapaId !== undefined) c.push(eq(projetoLei.etapaAtualId, filtro.etapaId));
    if (filtro.responsavelId !== undefined) {
      c.push(eq(projetoLei.responsavelId, filtro.responsavelId));
    }
    if (filtro.tipoProposicaoId !== undefined) {
      c.push(eq(projetoLei.tipoProposicaoId, filtro.tipoProposicaoId));
    }
    if (filtro.assuntoId !== undefined) {
      const comAssunto = this.bd
        .select({ id: projetoAssunto.projetoId })
        .from(projetoAssunto)
        .where(eq(projetoAssunto.categoriaId, filtro.assuntoId));
      c.push(inArray(projetoLei.id, comAssunto));
    }
    switch (filtro.status) {
      case 'em_andamento':
        if (emAndamento) c.push(emAndamento);
        break;
      case 'concluido':
        c.push(isNull(projetoLei.canceladoEm), eq(etapa.papel, 'conclusao'));
        break;
      case 'arquivado':
        c.push(isNull(projetoLei.canceladoEm), eq(etapa.papel, 'arquivamento'));
        break;
      case 'cancelado':
        c.push(isNotNull(projetoLei.canceladoEm));
        break;
      default:
        break;
    }
    if (filtro.atrasados && emAndamento) {
      c.push(emAndamento, lt(projetoLei.prazo, hojeNoGabinete(this.agora())));
    }
    if (filtro.busca) {
      const termo = padraoDeBusca(filtro.busca);
      const criterio = or(
        ilike(projetoLei.titulo, termo),
        ilike(projetoLei.numero, termo),
        ilike(projetoLei.autoria, termo),
      );
      if (criterio) c.push(criterio);
    }
    return c;
  }

  private async assuntosDe(ids: readonly number[]) {
    const mapa = new Map<number, { id: number; nome: string }[]>();
    if (ids.length === 0) return mapa;
    const linhas = await this.bd
      .select({ projetoId: projetoAssunto.projetoId, id: categoria.id, nome: categoria.nome })
      .from(projetoAssunto)
      .innerJoin(categoria, eq(categoria.id, projetoAssunto.categoriaId))
      .where(inArray(projetoAssunto.projetoId, [...ids]))
      .orderBy(asc(categoria.nome));
    for (const l of linhas) {
      const lista = mapa.get(l.projetoId) ?? [];
      lista.push({ id: l.id, nome: l.nome });
      mapa.set(l.projetoId, lista);
    }
    return mapa;
  }

  private mapear(l: LinhaDeProjeto, assuntos: { id: number; nome: string }[]): ProjetoResumo {
    const status: StatusDeProjeto = l.canceladoEm ? 'cancelado' : statusPeloPapel(l.etapaPapel);
    return {
      id: l.id,
      titulo: l.titulo,
      numero: l.numero,
      tipoProposicao: { id: l.tipoId, nome: l.tipoNome },
      autoria: l.autoria,
      prazo: l.prazo,
      etapa: { id: l.etapaId, nome: l.etapaNome, papel: l.etapaPapel },
      status,
      // Derivado na leitura, nunca gravado: prazo vencido e ainda em andamento.
      atrasado:
        status === 'em_andamento' && l.prazo !== null && l.prazo < hojeNoGabinete(this.agora()),
      responsavel: { id: l.responsavelId, nome: l.responsavelNome },
      assuntos,
      criadoEm: l.criadoEm.toISOString(),
    };
  }

  async listar(ator: Ator, filtro: FiltroDeProjetos): Promise<PaginaDeProjetos> {
    const onde = and(...this.condicoes(ator, filtro));
    const [total] = await this.bd
      .select({ total: count() })
      .from(projetoLei)
      .innerJoin(etapa, eq(etapa.id, projetoLei.etapaAtualId))
      .where(onde);

    const { limite, deslocamento } = paginar(filtro.pagina, filtro.porPagina);
    const linhas = await this.selecao()
      .where(onde)
      .orderBy(desc(projetoLei.criadoEm), desc(projetoLei.id))
      .limit(limite)
      .offset(deslocamento);
    const assuntos = await this.assuntosDe(linhas.map((l) => l.id));

    return {
      itens: linhas.map((l) => this.mapear(l, assuntos.get(l.id) ?? [])),
      total: total?.total ?? 0,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  async ficha(id: number): Promise<ProjetoFicha> {
    const [linha] = await this.selecao().where(eq(projetoLei.id, id)).limit(1);
    if (!linha) throw erros.naoEncontrado();
    const assuntos = (await this.assuntosDe([id])).get(id) ?? [];

    const coautores = await this.bd
      .select({ id: projetoCoautor.id, nome: projetoCoautor.nome })
      .from(projetoCoautor)
      .where(eq(projetoCoautor.projetoId, id))
      .orderBy(asc(projetoCoautor.nome));
    const tramitacoes = await this.bd
      .select({
        id: tramitacaoComissao.id,
        comissao: tramitacaoComissao.comissao,
        data: tramitacaoComissao.data,
        parecer: tramitacaoComissao.parecer,
        registradoPor: registrador.nome,
        registradoEm: tramitacaoComissao.registradoEm,
      })
      .from(tramitacaoComissao)
      .innerJoin(registrador, eq(registrador.id, tramitacaoComissao.registradoPor))
      .where(eq(tramitacaoComissao.projetoId, id))
      .orderBy(asc(tramitacaoComissao.data), asc(tramitacaoComissao.id));
    const votacoes = await this.bd
      .select({
        id: votacaoProjeto.id,
        data: votacaoProjeto.data,
        resultado: votacaoProjeto.resultado,
        local: votacaoProjeto.local,
        registradoPor: registrador.nome,
        registradoEm: votacaoProjeto.registradoEm,
      })
      .from(votacaoProjeto)
      .innerJoin(registrador, eq(registrador.id, votacaoProjeto.registradoPor))
      .where(eq(votacaoProjeto.projetoId, id))
      .orderBy(asc(votacaoProjeto.data), asc(votacaoProjeto.id));

    return {
      ...this.mapear(linha, assuntos),
      ementa: linha.ementa,
      criador: linha.criadorNome,
      coautores,
      tramitacoes: tramitacoes.map((t) => ({
        ...t,
        registradoEm: t.registradoEm.toISOString(),
      })),
      votacoes: votacoes.map((v) => ({ ...v, registradoEm: v.registradoEm.toISOString() })),
      canceladoEm: linha.canceladoEm?.toISOString() ?? null,
      justificativaCancelamento: linha.justificativa,
      movimentacoes: await movimentacoesDoRegistro(this.bd, 'projeto_lei', id),
    };
  }

  /** As etapas ativas do fluxo de projeto de lei, para o quadro e para mover. */
  async etapas() {
    return this.bd
      .select({ id: etapa.id, nome: etapa.nomeInterno, papel: etapa.papel, ordem: etapa.ordem })
      .from(etapa)
      .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
      .where(and(eq(tipoProcesso.tipo, 'projeto_lei'), eq(etapa.situacao, 'ativa')))
      .orderBy(etapa.ordem, etapa.id);
  }

  /** Quadro, consolidado e atrasados: tudo calculado agora, a partir das etapas e dos prazos. */
  async consolidado(ator: Ator): Promise<ConsolidadoDeProjetos> {
    const hoje = hojeNoGabinete(this.agora());
    // Cada conta é uma consulta simples, que diz o que conta.
    const contar = async (...c: (SQL | undefined)[]) => {
      const [r] = await this.bd
        .select({ total: count() })
        .from(projetoLei)
        .innerJoin(etapa, eq(etapa.id, projetoLei.etapaAtualId))
        .where(and(...c));
      return r?.total ?? 0;
    };
    const emAndamento = ConsultasDeProjetos.emAndamento();
    const porEtapa = await Promise.all(
      (await this.etapas()).map(async (e) => ({
        etapaId: e.id,
        nome: e.nome,
        papel: e.papel,
        ordem: e.ordem,
        total: await contar(eq(projetoLei.etapaAtualId, e.id), isNull(projetoLei.canceladoEm)),
      })),
    );
    return {
      emAndamento: await contar(emAndamento),
      atrasados: await contar(emAndamento, lt(projetoLei.prazo, hoje)),
      concluidos: await contar(isNull(projetoLei.canceladoEm), eq(etapa.papel, 'conclusao')),
      arquivados: await contar(isNull(projetoLei.canceladoEm), eq(etapa.papel, 'arquivamento')),
      cancelados: await contar(isNotNull(projetoLei.canceladoEm)),
      minhasEmAndamento: await contar(emAndamento, eq(projetoLei.responsavelId, ator.usuarioId)),
      porEtapa,
    };
  }

  async categorias(natureza?: CategoriaDto['natureza']): Promise<CategoriaDto[]> {
    const linhas = await this.bd
      .select({
        id: categoria.id,
        natureza: categoria.natureza,
        nome: categoria.nome,
        situacao: categoria.situacao,
      })
      .from(categoria)
      .where(
        natureza
          ? eq(categoria.natureza, natureza)
          : inArray(categoria.natureza, ['tipo_proposicao', 'assunto_projeto']),
      )
      .orderBy(asc(categoria.natureza), asc(categoria.nome));
    return linhas as CategoriaDto[];
  }
}
