import { demanda, demandaResponsavel, tarefa, tarefaResponsavel } from '@gabinete/banco';
import { avisar, comArea, contar, type Contexto } from './contexto.js';

/**
 * Vários responsáveis: parte das demandas e das tarefas ganha um ou dois corresponsáveis (além do
 * principal), com o aviso de quem foi incluído. Lê o que já está no banco, então também serve para
 * acrescentar corresponsáveis a uma demonstração já criada.
 */
export async function popularCorresponsaveis(ctx: Contexto): Promise<void> {
  const { sorteio, relogio } = ctx;
  const atendimento = comArea(ctx, 'AT');
  const todos = ctx.colegas.filter((c) => c.ativo);

  const demandas = await ctx.bd
    .select({
      id: demanda.id,
      responsavelId: demanda.responsavelId,
      autorId: demanda.autorId,
      criadoEm: demanda.criadoEm,
      cancelada: demanda.canceladaEm,
    })
    .from(demanda);
  const linhasDeDemanda = [];
  for (const d of demandas) {
    if (!sorteio.chance(0.3)) continue;
    const extras = sorteio.amostra(
      atendimento.filter((c) => c.id !== d.responsavelId),
      sorteio.inteiro(1, 2),
    );
    for (const c of extras) {
      linhasDeDemanda.push({
        demandaId: d.id,
        usuarioId: c.id,
        adicionadoEm: relogio.limitar(relogio.depois(d.criadoEm, 0)),
      });
      avisar(ctx, {
        destinatarioId: c.id,
        natureza: 'demanda_designada',
        registroTipo: 'demanda',
        registroId: d.id,
        origemId: d.autorId,
        geradoEm: relogio.limitar(relogio.depois(d.criadoEm, 0)),
      });
    }
  }
  if (linhasDeDemanda.length > 0) await ctx.bd.insert(demandaResponsavel).values(linhasDeDemanda);

  const tarefas = await ctx.bd
    .select({
      id: tarefa.id,
      responsavelId: tarefa.responsavelId,
      criadorId: tarefa.criadorId,
      criadoEm: tarefa.criadoEm,
    })
    .from(tarefa);
  const linhasDeTarefa = [];
  for (const t of tarefas) {
    if (!sorteio.chance(0.32)) continue;
    const extras = sorteio.amostra(
      todos.filter((c) => c.id !== t.responsavelId && c.perfil !== 'assessor_externo'),
      sorteio.inteiro(1, 2),
    );
    for (const c of extras) {
      const quando = relogio.limitar(relogio.depois(t.criadoEm, 0));
      linhasDeTarefa.push({ tarefaId: t.id, usuarioId: c.id, adicionadoEm: quando });
      avisar(ctx, {
        destinatarioId: c.id,
        natureza: 'tarefa_designada',
        registroTipo: 'tarefa',
        registroId: t.id,
        origemId: t.criadorId,
        geradoEm: quando,
      });
    }
  }
  if (linhasDeTarefa.length > 0) await ctx.bd.insert(tarefaResponsavel).values(linhasDeTarefa);

  contar(ctx, 'Corresponsáveis em demandas', linhasDeDemanda.length);
  contar(ctx, 'Corresponsáveis em tarefas', linhasDeTarefa.length);
}
