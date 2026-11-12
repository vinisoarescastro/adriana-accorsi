import { composicaoDeAlcance, pode } from '@gabinete/autorizacao';
import {
  comentarioInterno,
  comentarioMencao,
  demanda,
  documento,
  etapa,
  formatarProtocolo,
  movimentacao,
  normalizarProtocolo,
  pessoa,
  statusPeloPapel,
  tipoProcesso,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import {
  formatarTelefone,
  type ColunaDoQuadro,
  type ComentarioDto,
  type DemandaFicha,
  type DemandaResumo,
  type DocumentoDto,
  type MovimentacaoDto,
  type PaginaDeDemandas,
  type Prioridade,
  type QuadroDeDemandas,
  type StatusDeDemanda,
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
import type { Ator } from '../equipe/regras.js';
import { erros } from '../erros.js';

const responsavel = alias(usuario, 'responsavel');
const autor = alias(usuario, 'autor');

export interface FiltroDeDemandas {
  readonly pagina: number;
  readonly porPagina: number;
  readonly busca?: string | undefined;
  readonly status?: StatusDeDemanda | undefined;
  readonly etapaId?: number | undefined;
  readonly responsavelId?: number | undefined;
  readonly solicitanteId?: number | undefined;
  readonly prioridade?: Prioridade | undefined;
  readonly atrasadas?: boolean | undefined;
}

/**
 * Leituras de demanda. Listagem, quadro, ficha e painel usam o MESMO ponto de alcance
 * (`condicoesDeAlcance`): o Assessor Externo só enxerga as demandas de que é responsável.
 */
export class ConsultasDeDemandas {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  private selecao() {
    return this.bd
      .select({
        id: demanda.id,
        protocolo: demanda.protocolo,
        titulo: demanda.titulo,
        descricao: demanda.descricao,
        prioridade: demanda.prioridade,
        prazo: demanda.prazo,
        canceladaEm: demanda.canceladaEm,
        justificativa: demanda.justificativaCancelamento,
        criadoEm: demanda.criadoEm,
        etapaId: etapa.id,
        etapaNome: etapa.nomeInterno,
        etapaPapel: etapa.papel,
        solicitanteId: pessoa.id,
        solicitanteNome: pessoa.nomeCompleto,
        solicitanteTelefone: pessoa.telefoneNormalizado,
        responsavelId: responsavel.id,
        responsavelNome: responsavel.nome,
        autorNome: autor.nome,
      })
      .from(demanda)
      .innerJoin(etapa, eq(etapa.id, demanda.etapaAtualId))
      .innerJoin(pessoa, eq(pessoa.id, demanda.solicitanteId))
      .innerJoin(responsavel, eq(responsavel.id, demanda.responsavelId))
      .innerJoin(autor, eq(autor.id, demanda.autorId));
  }

  /** O ponto único de alcance (RN-DEM-07). */
  static condicoesDeAlcance(ator: Ator): SQL[] {
    return composicaoDeAlcance(ator.perfil) === 'proprio'
      ? [eq(demanda.responsavelId, ator.usuarioId)]
      : [];
  }

  private condicoes(ator: Ator, filtro: FiltroDeDemandas): SQL[] {
    const c = ConsultasDeDemandas.condicoesDeAlcance(ator);
    const hoje = hojeNoGabinete(this.agora());
    const emAndamento = and(
      isNull(demanda.canceladaEm),
      inArray(etapa.papel, ['entrada', 'intermediaria']),
    );

    if (filtro.etapaId !== undefined) c.push(eq(demanda.etapaAtualId, filtro.etapaId));
    if (filtro.responsavelId !== undefined) c.push(eq(demanda.responsavelId, filtro.responsavelId));
    if (filtro.solicitanteId !== undefined) c.push(eq(demanda.solicitanteId, filtro.solicitanteId));
    if (filtro.prioridade) c.push(eq(demanda.prioridade, filtro.prioridade));

    switch (filtro.status) {
      case 'em_andamento':
        if (emAndamento) c.push(emAndamento);
        break;
      case 'concluido':
        c.push(isNull(demanda.canceladaEm), eq(etapa.papel, 'conclusao'));
        break;
      case 'arquivado':
        c.push(isNull(demanda.canceladaEm), eq(etapa.papel, 'arquivamento'));
        break;
      case 'cancelada':
        c.push(isNotNull(demanda.canceladaEm));
        break;
      default:
        break;
    }
    if (filtro.atrasadas && emAndamento) c.push(emAndamento, lt(demanda.prazo, hoje));

    if (filtro.busca) {
      const protocolo = normalizarProtocolo(filtro.busca);
      const digitos = filtro.busca.replace(/\D/g, '');
      const criterios: SQL[] = [
        ilike(demanda.titulo, padraoDeBusca(filtro.busca)),
        ilike(pessoa.nomeCompleto, padraoDeBusca(filtro.busca)),
      ];
      if (protocolo) criterios.push(eq(demanda.protocolo, protocolo));
      if (digitos.length >= 4)
        criterios.push(ilike(pessoa.telefoneNormalizado, padraoDeBusca(digitos)));
      const algum = or(...criterios);
      if (algum) c.push(algum);
    }
    return c;
  }

  private mapear(l: Awaited<ReturnType<ConsultasDeDemandas['selecao']>>[number]): DemandaResumo {
    const cancelada = l.canceladaEm !== null;
    const status: StatusDeDemanda = cancelada ? 'cancelada' : statusPeloPapel(l.etapaPapel);
    return {
      id: l.id,
      protocolo: formatarProtocolo(l.protocolo),
      titulo: l.titulo,
      prioridade: l.prioridade,
      prazo: l.prazo,
      etapa: { id: l.etapaId, nome: l.etapaNome, papel: l.etapaPapel },
      status,
      atrasada:
        status === 'em_andamento' && l.prazo !== null && l.prazo < hojeNoGabinete(this.agora()),
      solicitante: { id: l.solicitanteId, nome: l.solicitanteNome },
      responsavel: { id: l.responsavelId, nome: l.responsavelNome },
      criadoEm: l.criadoEm.toISOString(),
    };
  }

  async listar(ator: Ator, filtro: FiltroDeDemandas): Promise<PaginaDeDemandas> {
    const onde = and(...this.condicoes(ator, filtro));
    const [total] = await this.bd
      .select({ total: count() })
      .from(demanda)
      .innerJoin(etapa, eq(etapa.id, demanda.etapaAtualId))
      .innerJoin(pessoa, eq(pessoa.id, demanda.solicitanteId))
      .where(onde);

    const { limite, deslocamento } = paginar(filtro.pagina, filtro.porPagina);
    const linhas = await this.selecao()
      .where(onde)
      .orderBy(desc(demanda.criadoEm), desc(demanda.id))
      .limit(limite)
      .offset(deslocamento);

    return {
      itens: linhas.map((l) => this.mapear(l)),
      total: total?.total ?? 0,
      pagina: filtro.pagina,
      porPagina: filtro.porPagina,
    };
  }

  /** Quadro por etapa: as demandas em andamento (e as concluídas e arquivadas) de cada etapa ativa. */
  async quadro(ator: Ator, limitePorColuna = 30): Promise<QuadroDeDemandas> {
    const etapas = await this.bd
      .select({ id: etapa.id, nome: etapa.nomeInterno, papel: etapa.papel, ordem: etapa.ordem })
      .from(etapa)
      .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
      .where(and(eq(tipoProcesso.tipo, 'demanda'), eq(etapa.situacao, 'ativa')))
      .orderBy(asc(etapa.ordem), asc(etapa.id));

    const colunas: ColunaDoQuadro[] = [];
    for (const e of etapas) {
      const onde = and(
        ...ConsultasDeDemandas.condicoesDeAlcance(ator),
        eq(demanda.etapaAtualId, e.id),
        isNull(demanda.canceladaEm),
      );
      const [total] = await this.bd.select({ total: count() }).from(demanda).where(onde);
      const linhas = await this.selecao()
        .where(onde)
        .orderBy(desc(demanda.criadoEm), desc(demanda.id))
        .limit(limitePorColuna);
      colunas.push({
        etapa: e,
        total: total?.total ?? 0,
        itens: linhas.map((l) => this.mapear(l)),
      });
    }
    return { colunas, limitePorColuna };
  }

  /**
   * A ficha. O Assessor Externo vê as dele, sem comentários, documentos e histórico (a ficha
   * completa é do Assessor Interno em diante, RN-DEM-07).
   */
  async ficha(ator: Ator, id: number): Promise<DemandaFicha> {
    const [linha] = await this.selecao()
      .where(and(eq(demanda.id, id), ...ConsultasDeDemandas.condicoesDeAlcance(ator)))
      .limit(1);
    if (!linha) throw erros.naoEncontrado();

    const completa = pode('demandas.ficha', {
      perfil: ator.perfil,
      habilitacoes: ator.habilitacoes,
    });
    const base = {
      ...this.mapear(linha),
      descricao: linha.descricao,
      autor: linha.autorNome,
      solicitanteTelefone: linha.solicitanteTelefone
        ? formatarTelefone(linha.solicitanteTelefone)
        : null,
      canceladaEm: linha.canceladaEm?.toISOString() ?? null,
      justificativaCancelamento: linha.justificativa,
      completa,
    };
    if (!completa) return { ...base, comentarios: [], documentos: [], movimentacoes: [] };

    const [comentarios, documentos, movimentacoes] = await Promise.all([
      this.comentarios(id),
      this.documentos(id),
      this.movimentacoes(id),
    ]);
    return { ...base, comentarios, documentos, movimentacoes };
  }

  async comentarios(demandaId: number): Promise<ComentarioDto[]> {
    const removedor = alias(usuario, 'removedor');
    const linhas = await this.bd
      .select({
        id: comentarioInterno.id,
        autorId: comentarioInterno.autorId,
        autorNome: usuario.nome,
        texto: comentarioInterno.texto,
        criadoEm: comentarioInterno.criadoEm,
        situacao: comentarioInterno.situacao,
        removidoPor: removedor.nome,
        removidoEm: comentarioInterno.removidoEm,
      })
      .from(comentarioInterno)
      .innerJoin(usuario, eq(usuario.id, comentarioInterno.autorId))
      .leftJoin(removedor, eq(removedor.id, comentarioInterno.removidoPor))
      .where(
        and(
          eq(comentarioInterno.registroTipo, 'demanda'),
          eq(comentarioInterno.registroId, demandaId),
        ),
      )
      .orderBy(asc(comentarioInterno.id));

    const ids = linhas.map((l) => l.id);
    const mencoes = ids.length
      ? await this.bd
          .select({
            comentarioId: comentarioMencao.comentarioId,
            id: usuario.id,
            nome: usuario.nome,
          })
          .from(comentarioMencao)
          .innerJoin(usuario, eq(usuario.id, comentarioMencao.usuarioId))
          .where(inArray(comentarioMencao.comentarioId, ids))
      : [];

    return linhas.map((l) => ({
      id: l.id,
      autor: { id: l.autorId, nome: l.autorNome },
      // O texto de um comentário removido não é mais mostrado: fica só a marca.
      texto: l.situacao === 'removido' ? null : l.texto,
      criadoEm: l.criadoEm.toISOString(),
      removido: l.situacao === 'removido',
      removidoPor: l.removidoPor,
      removidoEm: l.removidoEm?.toISOString() ?? null,
      mencoes: mencoes
        .filter((m) => m.comentarioId === l.id)
        .map(({ id: uid, nome }) => ({ id: uid, nome })),
    }));
  }

  async documentos(demandaId: number): Promise<DocumentoDto[]> {
    const linhas = await this.bd
      .select({ d: documento, enviadoPor: usuario.nome })
      .from(documento)
      .innerJoin(usuario, eq(usuario.id, documento.autorEnvio))
      .where(and(eq(documento.registroTipo, 'demanda'), eq(documento.registroId, demandaId)))
      .orderBy(asc(documento.id));
    return linhas.map(({ d, enviadoPor }) => ({
      id: d.id,
      nome: d.nome,
      natureza: d.natureza as DocumentoDto['natureza'],
      tipo: d.tipoReal,
      tamanho: d.tamanho,
      enviadoPor,
      enviadoEm: d.enviadoEm.toISOString(),
      removido: d.situacao === 'removido',
      removidoEm: d.removidoEm?.toISOString() ?? null,
    }));
  }

  async movimentacoes(demandaId: number): Promise<MovimentacaoDto[]> {
    const origem = alias(etapa, 'origem');
    const linhas = await this.bd
      .select({
        id: movimentacao.id,
        de: origem.nomeInterno,
        para: etapa.nomeInterno,
        papel: etapa.papel,
        autor: usuario.nome,
        observacao: movimentacao.observacao,
        criadaEm: movimentacao.criadaEm,
      })
      .from(movimentacao)
      .innerJoin(etapa, eq(etapa.id, movimentacao.etapaDestinoId))
      .leftJoin(origem, eq(origem.id, movimentacao.etapaOrigemId))
      .innerJoin(usuario, eq(usuario.id, movimentacao.autorId))
      .where(and(eq(movimentacao.registroTipo, 'demanda'), eq(movimentacao.registroId, demandaId)))
      .orderBy(asc(movimentacao.id));
    return linhas.map((l) => ({
      id: l.id,
      de: l.de,
      para: l.para,
      papelDoDestino: l.papel,
      autor: l.autor,
      observacao: l.observacao,
      criadaEm: l.criadaEm.toISOString(),
    }));
  }
}
