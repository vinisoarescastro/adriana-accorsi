import {
  etapa,
  movimentacao,
  usuario,
  type BancoDeDados,
  type TipoDeRegistro,
} from '@gabinete/banco';
import type { MovimentacaoDto } from '@gabinete/compartilhado';
import { and, asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

/** O histórico de etapas de um registro: a leitura das suas movimentações (mecanismo único). */
export async function movimentacoesDoRegistro(
  bd: BancoDeDados,
  tipo: TipoDeRegistro,
  registroId: number,
): Promise<MovimentacaoDto[]> {
  const origem = alias(etapa, 'origem');
  const linhas = await bd
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
    .where(and(eq(movimentacao.registroTipo, tipo), eq(movimentacao.registroId, registroId)))
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
