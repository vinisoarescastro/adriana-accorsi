import { destinacao, emenda, emendaValor, execucaoDestinacao, type Leitor } from '@gabinete/banco';
import { deCentavos, paraCentavos, type ValoresDaEmenda } from '@gabinete/compartilhado';
import { and, eq, inArray, isNull, lte, or, sql, gt } from 'drizzle-orm';

const emCentavos = (v: string | null | undefined) => paraCentavos(v ?? '0') ?? 0;

export const valoresZerados: ValoresDaEmenda = {
  disponibilizado: '0.00',
  comprometido: '0.00',
  utilizado: '0.00',
  disponivel: '0.00',
  aExecutar: '0.00',
};

/** Monta os cinco valores a partir dos três gravados ou somados; o resto é conta, nunca coluna. */
export function montarValores(
  disponibilizado: number,
  comprometido: number,
  utilizado: number,
): ValoresDaEmenda {
  return {
    disponibilizado: deCentavos(disponibilizado),
    comprometido: deCentavos(comprometido),
    utilizado: deCentavos(utilizado),
    disponivel: deCentavos(disponibilizado - comprometido),
    aExecutar: deCentavos(comprometido - utilizado),
  };
}

/**
 * Os valores de várias emendas em um instante (`em`; sem ele, agora). O disponibilizado é o último valor
 * definido até `em`; o comprometido, a soma das destinações já criadas e ainda não canceladas em `em`; o
 * utilizado, a soma das execuções já registradas dessas destinações. Serve para a leitura de hoje e para
 * reconstituir uma data passada pela MESMA conta.
 */
export async function valoresDasEmendas(
  leitor: Leitor,
  ids: readonly number[],
  em: Date,
): Promise<Map<number, ValoresDaEmenda>> {
  const mapa = new Map<number, ValoresDaEmenda>();
  if (ids.length === 0) return mapa;
  const lista = [...ids];

  // O histórico de cada emenda é curto: traz o que valia até `em` e fica com o mais recente de cada uma.
  const historico = await leitor
    .select({
      emendaId: emendaValor.emendaId,
      valor: sql<string>`${emendaValor.valor}::text`,
    })
    .from(emendaValor)
    .where(and(inArray(emendaValor.emendaId, lista), lte(emendaValor.definidoEm, em)))
    .orderBy(sql`${emendaValor.definidoEm} desc`, sql`${emendaValor.id} desc`);
  const valores = new Map<number, string>();
  for (const h of historico) if (!valores.has(h.emendaId)) valores.set(h.emendaId, h.valor);

  const vigente = and(
    lte(destinacao.criadaEm, em),
    or(isNull(destinacao.canceladaEm), gt(destinacao.canceladaEm, em)),
  );
  const comprometidos = await leitor
    .select({
      emendaId: destinacao.emendaId,
      total: sql<string>`coalesce(sum(${destinacao.valor}), 0)::text`,
    })
    .from(destinacao)
    .where(and(inArray(destinacao.emendaId, lista), vigente))
    .groupBy(destinacao.emendaId);
  const utilizados = await leitor
    .select({
      emendaId: destinacao.emendaId,
      total: sql<string>`coalesce(sum(${execucaoDestinacao.valor}), 0)::text`,
    })
    .from(execucaoDestinacao)
    .innerJoin(destinacao, eq(destinacao.id, execucaoDestinacao.destinacaoId))
    .where(
      and(inArray(destinacao.emendaId, lista), vigente, lte(execucaoDestinacao.registradoEm, em)),
    )
    .groupBy(destinacao.emendaId);

  for (const id of lista) {
    mapa.set(
      id,
      montarValores(
        emCentavos(valores.get(id)),
        emCentavos(comprometidos.find((v) => v.emendaId === id)?.total),
        emCentavos(utilizados.find((v) => v.emendaId === id)?.total),
      ),
    );
  }
  return mapa;
}

/** Soma os valores de várias emendas (em centavos, sem ponto flutuante). */
export function somarValores(todos: readonly ValoresDaEmenda[]): ValoresDaEmenda {
  const soma = (chave: keyof ValoresDaEmenda) =>
    todos.reduce((s, v) => s + emCentavos(v[chave]), 0);
  return montarValores(soma('disponibilizado'), soma('comprometido'), soma('utilizado'));
}

export { emenda };
