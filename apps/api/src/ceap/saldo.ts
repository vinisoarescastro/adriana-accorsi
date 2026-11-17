import {
  ceapCategoria,
  ceapEncerramento,
  ceapParametro,
  despesa,
  etapa,
  movimentacao,
  tipoProcesso,
  type Leitor,
} from '@gabinete/banco';
import {
  deCentavos,
  paraCentavos,
  statusPelaEtapaDaDespesa,
  statusQueConsomemSaldo,
  type SaldoDaCeap,
  type StatusDeDespesa,
} from '@gabinete/compartilhado';
import { and, asc, desc, eq, inArray, isNull, lte, or, gt } from 'drizzle-orm';
import { hojeNoGabinete } from '../atendimento/comum.js';
import { erros } from '../erros.js';

const emCentavos = (v: string | null) => paraCentavos(v ?? '0') ?? 0;

/** O status que a etapa representa; nome desconhecido (fluxo ajustado) cai no papel da etapa. */
export function statusDaEtapa(nome: string, papel: string): StatusDeDespesa {
  const conhecido = statusPelaEtapaDaDespesa[nome];
  if (conhecido) return conhecido;
  return papel === 'entrada'
    ? 'lancada'
    : papel === 'arquivamento'
      ? 'arquivada'
      : papel === 'conclusao'
        ? 'ressarcida'
        : 'em_analise';
}

/** Mapa nome → id das etapas do fluxo da despesa (ativas e inativas). Falha se o fluxo perdeu uma etapa de que a conta depende. */
export async function etapasDaDespesa(
  leitor: Leitor,
): Promise<Map<string, { id: number; papel: string }>> {
  const linhas = await leitor
    .select({ id: etapa.id, nome: etapa.nomeInterno, papel: etapa.papel })
    .from(etapa)
    .innerJoin(tipoProcesso, eq(tipoProcesso.id, etapa.tipoProcessoId))
    .where(eq(tipoProcesso.tipo, 'despesa_ceap'))
    .orderBy(asc(etapa.ordem));
  const mapa = new Map(linhas.map((l) => [l.nome, { id: l.id, papel: l.papel }]));
  for (const nome of ['Lançada', 'Em análise', 'Aprovada', 'Reprovada']) {
    if (!mapa.has(nome)) {
      throw erros.conflito(
        `O fluxo da despesa não tem mais a etapa "${nome}", de que a CEAP depende.`,
      );
    }
  }
  return mapa;
}

/** O parâmetro que valia no `dia` (e que já estava definido em `em`, se informado). */
export async function parametroVigente(
  leitor: Leitor,
  chave: (typeof ceapParametro.$inferSelect)['chave'],
  dia: string,
  em?: Date,
): Promise<string | null> {
  const linhas = await leitor
    .select({ valor: ceapParametro.valor, definidoEm: ceapParametro.definidoEm })
    .from(ceapParametro)
    .where(
      and(
        eq(ceapParametro.chave, chave),
        lte(ceapParametro.vigenteDe, dia),
        or(
          isNull(ceapParametro.vigenteAte),
          gt(ceapParametro.vigenteAte, dia),
          eq(ceapParametro.vigenteAte, dia),
        ),
      ),
    )
    .orderBy(desc(ceapParametro.vigenteDe));
  const visivel = em ? linhas.filter((l) => l.definidoEm <= em) : linhas;
  return visivel[0]?.valor ?? null;
}

/**
 * O saldo da CEAP no exercício `ano`, como era em `em` (hoje, se omitido). Derivado, nunca gravado: a cota de
 * cada mês é o parâmetro que valia no dia 1; o consumo é a soma das despesas que, naquele instante, estavam em
 * análise ou adiante (menos reprovada e glosada) e não canceladas. O saldo acumula dentro do exercício e não
 * passa ao seguinte. A mesma conta serve para a leitura de hoje e para reconstituir uma data passada.
 */
export async function calcularSaldo(leitor: Leitor, ano: number, em: Date): Promise<SaldoDaCeap> {
  const etapas = await etapasDaDespesa(leitor);
  const nomeDaEtapa = new Map([...etapas].map(([nome, e]) => [e.id, { nome, papel: e.papel }]));
  const diaDe = hojeNoGabinete(em);

  // O que cada despesa do exercício era em `em`: a última movimentação até então.
  const doAno = await leitor
    .select({
      id: despesa.id,
      mes: despesa.competenciaMes,
      categoriaId: despesa.categoriaId,
      valor: despesa.valor,
    })
    .from(despesa)
    .where(
      and(
        eq(despesa.competenciaAno, ano),
        lte(despesa.criadoEm, em),
        or(isNull(despesa.canceladaEm), gt(despesa.canceladaEm, em)),
      ),
    );
  const movimentos = doAno.length
    ? await leitor
        .select({ registroId: movimentacao.registroId, etapaId: movimentacao.etapaDestinoId })
        .from(movimentacao)
        .where(
          and(
            eq(movimentacao.registroTipo, 'despesa'),
            inArray(
              movimentacao.registroId,
              doAno.map((d) => d.id),
            ),
            lte(movimentacao.criadaEm, em),
          ),
        )
        .orderBy(asc(movimentacao.id))
    : [];
  const etapaEm = new Map<number, number>();
  for (const m of movimentos) etapaEm.set(m.registroId, m.etapaId);

  const itens = doAno.map((d) => {
    const e = nomeDaEtapa.get(etapaEm.get(d.id) ?? -1);
    const status = e ? statusDaEtapa(e.nome, e.papel) : 'lancada';
    return { ...d, status, consome: statusQueConsomemSaldo.includes(status) };
  });

  // Cota de cada mês.
  const cotas: (string | null)[] = [];
  for (let mes = 1; mes <= 12; mes += 1) {
    const dia = `${ano}-${String(mes).padStart(2, '0')}-01`;
    cotas.push(await parametroVigente(leitor, 'cota_mensal', dia, em));
  }
  const encerradas = new Set(
    (await leitor.select().from(ceapEncerramento).where(eq(ceapEncerramento.ano, ano)))
      .filter((e) => e.reabertaEm === null)
      .map((e) => e.mes),
  );

  let cotaAcumulada = 0;
  let consumidoAcumulado = 0;
  const meses = cotas.map((cota, i) => {
    const mes = i + 1;
    const consumido = itens
      .filter((d) => d.consome && d.mes === mes)
      .reduce((s, d) => s + emCentavos(d.valor), 0);
    cotaAcumulada += emCentavos(cota);
    consumidoAcumulado += consumido;
    return {
      mes,
      cota,
      consumido: deCentavos(consumido),
      cotaAcumulada: deCentavos(cotaAcumulada),
      consumidoAcumulado: deCentavos(consumidoAcumulado),
      saldo: deCentavos(cotaAcumulada - consumidoAcumulado),
      encerrada: encerradas.has(mes),
    };
  });

  const anoDeEm = Number(diaDe.slice(0, 4));
  const mesDeReferencia = anoDeEm === ano ? Number(diaDe.slice(5, 7)) : anoDeEm > ano ? 12 : 1;
  const saldoAtual = meses[mesDeReferencia - 1]?.saldo ?? '0.00';
  const limite = await parametroVigente(leitor, 'limite_alerta_saldo', diaDe, em);

  const categorias = await leitor.select().from(ceapCategoria).orderBy(asc(ceapCategoria.nome));
  const porCategoria = categorias
    .map((c) => ({
      categoriaId: c.id,
      nome: c.nome,
      consumido: deCentavos(
        itens
          .filter((d) => d.consome && d.categoriaId === c.id)
          .reduce((s, d) => s + emCentavos(d.valor), 0),
      ),
      tetoMensal: c.tetoMensal,
    }))
    .filter((c) => emCentavos(c.consumido) > 0);

  const porStatus = [...new Set(itens.map((d) => d.status))].map((status) => ({
    status,
    total: itens.filter((d) => d.status === status).length,
    valor: deCentavos(
      itens.filter((d) => d.status === status).reduce((s, d) => s + emCentavos(d.valor), 0),
    ),
  }));

  return {
    ano,
    em: diaDe,
    mesDeReferencia,
    meses,
    saldoAtual,
    aguardandoAnalise: itens.filter((d) => d.status === 'em_analise').length,
    limiteDeAlerta: limite,
    abaixoDoLimite:
      limite !== null && emCentavos(limite) > 0 && emCentavos(saldoAtual) < emCentavos(limite),
    mesesSemCota: meses.filter((m) => m.cota === null).map((m) => m.mes),
    porCategoria,
    porStatus,
  };
}

/** O quanto já foi consumido por uma categoria no mês (despesas que consomem saldo, de hoje). */
export async function consumoDaCategoriaNoMes(
  leitor: Leitor,
  categoriaId: number,
  ano: number,
  mes: number,
  ignorar?: number,
): Promise<number> {
  const etapas = await etapasDaDespesa(leitor);
  const consumindo = ['Em análise', 'Aprovada', 'Apresentada à Câmara', 'Ressarcida']
    .map((n) => etapas.get(n)?.id)
    .filter((v): v is number => v !== undefined);
  const linhas = await leitor
    .select({ id: despesa.id, valor: despesa.valor })
    .from(despesa)
    .where(
      and(
        eq(despesa.categoriaId, categoriaId),
        eq(despesa.competenciaAno, ano),
        eq(despesa.competenciaMes, mes),
        isNull(despesa.canceladaEm),
        inArray(despesa.etapaAtualId, consumindo),
      ),
    );
  return linhas.filter((l) => l.id !== ignorar).reduce((s, l) => s + emCentavos(l.valor), 0);
}
