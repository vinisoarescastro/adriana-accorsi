import { aviso, trilha } from '@gabinete/banco';
import { contar, type Contexto } from './contexto.js';

const UM_DIA = 24 * 3_600_000;

const emLotes = <T>(itens: readonly T[], tamanho: number): T[][] => {
  const lotes: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho));
  return lotes;
};

/**
 * Grava os avisos (a caixa do sino de cada pessoa) e a trilha de auditoria acumulados durante a
 * criação dos dados. Aviso antigo demais já teria expirado e não entra; os mais velhos tendem a
 * estar lidos, os recentes a estar por ler. Um aviso lido expira 30 dias depois da leitura.
 */
export async function gravarAvisosETrilha(ctx: Contexto): Promise<void> {
  await gravarAvisos(ctx);
  await gravarTrilha(ctx);
}

/** Só os avisos (a caixa do sino). */
export async function gravarAvisos(ctx: Contexto): Promise<void> {
  const { sorteio, relogio } = ctx;
  const agora = relogio.agora.getTime();

  const linhasDeAviso: (typeof aviso.$inferInsert)[] = [];
  for (const a of ctx.avisos) {
    const idade = (agora - a.geradoEm.getTime()) / UM_DIA;
    if (idade >= 58 || a.geradoEm.getTime() > agora) continue;
    const lido = sorteio.chance(idade > 3 ? 0.82 : idade > 1 ? 0.45 : 0.15);
    const lidoEm = lido
      ? new Date(
          Math.min(agora - 60_000, a.geradoEm.getTime() + sorteio.inteiro(20, 2800) * 60_000),
        )
      : null;
    const expiraSemLer = a.geradoEm.getTime() + 60 * UM_DIA;
    const expiraEm = new Date(
      lidoEm ? Math.min(expiraSemLer, lidoEm.getTime() + 30 * UM_DIA) : expiraSemLer,
    );
    // Um aviso lido há mais de 30 dias já teria sido expurgado.
    if (expiraEm.getTime() <= agora) continue;
    linhasDeAviso.push({
      destinatarioId: a.destinatarioId,
      natureza: a.natureza,
      registroTipo: a.registroTipo,
      registroId: a.registroId,
      origemId: a.origemId,
      geradoEm: a.geradoEm,
      lidoEm,
      expiraEm: new Date(
        lidoEm ? Math.min(expiraSemLer, lidoEm.getTime() + 30 * UM_DIA) : expiraSemLer,
      ),
      ...(a.chaveUnica ? { chaveUnica: a.chaveUnica } : {}),
    });
  }
  linhasDeAviso.sort((x, y) => (x.geradoEm as Date).getTime() - (y.geradoEm as Date).getTime());
  for (const lote of emLotes(linhasDeAviso, 400)) await ctx.bd.insert(aviso).values(lote);
  contar(ctx, 'Avisos (notificações do sino)', linhasDeAviso.length);
  contar(
    ctx,
    '  dos quais menções (@)',
    linhasDeAviso.filter((a) => a.natureza === 'mencao').length,
  );
}

/** Entradas no sistema e a trilha acumulada (para a página de auditoria ter volume e variedade). */
export async function gravarTrilha(ctx: Contexto): Promise<void> {
  const { sorteio, relogio } = ctx;
  const agora = relogio.agora.getTime();
  // Entradas no sistema.
  for (const c of ctx.colegas.filter((x) => x.ativo)) {
    for (let k = 0; k < sorteio.inteiro(6, 16); k += 1) {
      ctx.trilha.push({
        ocorridaEm: relogio.diasAtras(sorteio.inteiro(0, 30)),
        autorId: c.id,
        origem: 'usuario',
        operacao: 'acesso.entrada',
        entidade: 'usuario',
        registroId: String(c.id),
      });
    }
  }
  // O que ainda não aconteceu não entra na auditoria.
  const passadas = ctx.trilha.filter((t) => t.ocorridaEm.getTime() <= agora);
  ctx.trilha.length = 0;
  ctx.trilha.push(...passadas);
  ctx.trilha.sort((x, y) => x.ocorridaEm.getTime() - y.ocorridaEm.getTime());
  for (const lote of emLotes(ctx.trilha, 400)) {
    await ctx.bd.insert(trilha).values(
      lote.map((t) => ({
        ocorridaEm: t.ocorridaEm,
        autorId: t.autorId,
        origem: t.origem,
        operacao: t.operacao,
        entidade: t.entidade,
        registroId: t.registroId,
        valorNovo: t.valorNovo ?? null,
        justificativa: t.justificativa ?? null,
      })),
    );
  }
  contar(ctx, 'Registros de auditoria (trilha)', ctx.trilha.length);
}
