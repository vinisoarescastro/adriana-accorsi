import {
  bloqueioIndisponibilidade,
  compromisso,
  evento,
  participacaoEvento,
  participanteExterno,
  participanteInterno,
} from '@gabinete/banco';
import { eq } from 'drizzle-orm';
import { bairros, compromissos, eventos as modelosDeEvento } from './conteudo.js';
import {
  avisar,
  comArea,
  contar,
  preencher,
  registrarNaTrilha,
  type Contexto,
} from './contexto.js';
import type { PessoaCriada } from './pessoas.js';

const UM_DIA = 24 * 3_600_000;

/** Segunda-feira (UTC) da semana de `base`, às 11h UTC (8h em Brasília). */
function segundaDaSemana(base: Date, deslocamentoDeSemanas: number): Date {
  const d = new Date(base);
  d.setUTCHours(11, 0, 0, 0);
  const dia = d.getUTCDay();
  d.setTime(d.getTime() - ((dia + 6) % 7) * UM_DIA + deslocamentoDeSemanas * 7 * UM_DIA);
  return d;
}

/**
 * Agenda da deputada: a reunião de equipe toda segunda, audiências, visitas, reuniões com órgãos,
 * atendimentos. Cobre as últimas semanas e as próximas, com participantes que confirmam ou recusam,
 * convidados de fora, visibilidades diferentes, remarcações e cancelamentos; mais horários bloqueados.
 */
export async function popularAgenda(
  ctx: Contexto,
  pessoas: readonly PessoaCriada[],
): Promise<void> {
  const { sorteio, relogio } = ctx;
  const agenda = comArea(ctx, 'AG');
  const internos = agenda.filter((c) => c.perfil !== 'assessor_externo');
  const supervisores = internos.filter((c) =>
    ['supervisor', 'chefe', 'administrador', 'parlamentar'].includes(c.perfil),
  );
  const convidaveis = pessoas.filter((p) => p.situacao === 'ativa');

  interface Marca {
    titulo: string;
    local: string | null;
    descricao: string | null;
    inicio: Date;
    horas: number;
    diaInteiro: boolean;
  }
  const marcas: Marca[] = [];

  // Reunião de equipe: toda segunda, das 9h às 10h, de 4 semanas atrás a 4 adiante.
  const reuniao = compromissos.find((c) => c.titulo.startsWith('Reunião de equipe'))!;
  for (let semana = -4; semana <= 4; semana += 1) {
    const inicio = segundaDaSemana(relogio.agora, semana);
    inicio.setUTCHours(12);
    marcas.push({ ...reuniao, inicio, horas: 1, diaInteiro: false });
  }
  // Os demais, em dias úteis entre 25 dias atrás e 40 adiante.
  const outros = compromissos.filter((c) => c !== reuniao);
  for (let i = 0; i < 36; i += 1) {
    const modelo = sorteio.escolher(outros);
    let dias = sorteio.inteiro(-25, 40);
    const inicio = new Date(relogio.agora.getTime() + dias * UM_DIA);
    inicio.setUTCHours(11 + sorteio.inteiro(0, 6), sorteio.escolher([0, 0, 30]), 0, 0);
    while ([0, 6].includes(inicio.getUTCDay())) {
      inicio.setTime(inicio.getTime() + UM_DIA);
      dias += 1;
    }
    marcas.push({
      ...modelo,
      inicio,
      horas: sorteio.inteiro(1, 3),
      diaInteiro: modelo.titulo === 'Atendimento ao público' && sorteio.chance(0.5),
    });
  }

  let participacoes = 0;
  let cancelados = 0;
  for (const m of marcas) {
    const bairro = sorteio.escolher(bairros);
    const criador = sorteio.escolher(internos);
    const colega = sorteio.escolher(internos.filter((c) => c.id !== criador.id));
    const fim = new Date(m.inicio.getTime() + m.horas * 3_600_000);
    const criadoEm = new Date(
      Math.min(
        relogio.agora.getTime() - 60_000,
        m.inicio.getTime() - sorteio.inteiro(2, 20) * UM_DIA,
      ),
    );
    const visibilidade = sorteio.ponderado<'aberto' | 'participantes' | 'restrito'>([
      ['participantes', 56],
      ['aberto', 30],
      ['restrito', 14],
    ]);
    const autor = visibilidade === 'restrito' ? sorteio.escolher(supervisores) : criador;
    const descricao = m.descricao ? preencher(m.descricao, { A: colega.nome, bairro }) : null;
    // Dia inteiro: de 0h a 23h59 de Brasília (3h UTC do dia até 2h59 UTC do seguinte).
    const inicioDoCompromisso = m.diaInteiro
      ? new Date(`${relogio.dia(m.inicio)}T03:00:00Z`)
      : m.inicio;
    const fimDoCompromisso = m.diaInteiro
      ? new Date(inicioDoCompromisso.getTime() + UM_DIA - 60_000)
      : fim;
    const cancelado = cancelados < 4 && sorteio.chance(0.09);

    const [linha] = await ctx.bd
      .insert(compromisso)
      .values({
        criadorId: autor.id,
        titulo: preencher(m.titulo, { bairro }),
        descricao,
        local: m.local ? preencher(m.local, { bairro }) : null,
        inicio: inicioDoCompromisso,
        fim: fimDoCompromisso,
        diaInteiro: m.diaInteiro,
        visibilidade,
        envolveParlamentar: sorteio.chance(0.82),
        criadoEm,
        ...(cancelado
          ? {
              canceladoEm: relogio.limitar(relogio.depois(criadoEm, sorteio.inteiro(1, 6))),
              canceladoPor: autor.id,
            }
          : {}),
      })
      .returning({ id: compromisso.id });
    const id = linha!.id;
    if (cancelado) cancelados += 1;

    const convidados = sorteio.amostra(
      internos.filter((c) => c.id !== autor.id),
      sorteio.inteiro(1, 5),
    );
    if (convidados.length > 0) {
      await ctx.bd.insert(participanteInterno).values(
        convidados.map((c) => {
          const resposta = sorteio.ponderado<'sem_resposta' | 'confirmado' | 'recusado'>([
            ['confirmado', 52],
            ['sem_resposta', 34],
            ['recusado', 14],
          ]);
          return {
            compromissoId: id,
            usuarioId: c.id,
            resposta,
            respondidoEm:
              resposta === 'sem_resposta'
                ? null
                : relogio.limitar(relogio.depois(criadoEm, sorteio.inteiro(0, 3))),
          };
        }),
      );
      participacoes += convidados.length;
      for (const c of convidados) {
        avisar(ctx, {
          destinatarioId: c.id,
          natureza: 'compromisso_indicacao',
          registroTipo: 'compromisso',
          registroId: id,
          origemId: autor.id,
          geradoEm: criadoEm,
        });
        if (cancelado) {
          avisar(ctx, {
            destinatarioId: c.id,
            natureza: 'compromisso_cancelado',
            registroTipo: 'compromisso',
            registroId: id,
            origemId: autor.id,
            geradoEm: relogio.depois(criadoEm, 2),
          });
        } else if (sorteio.chance(0.08)) {
          avisar(ctx, {
            destinatarioId: c.id,
            natureza: 'compromisso_remarcado',
            registroTipo: 'compromisso',
            registroId: id,
            origemId: autor.id,
            geradoEm: relogio.depois(criadoEm, 1),
          });
        }
      }
    }
    if (m.titulo.startsWith('Audiência') || m.titulo.startsWith('Visita') || sorteio.chance(0.25)) {
      const externos = sorteio.amostra(convidaveis, sorteio.inteiro(1, 3));
      await ctx.bd
        .insert(participanteExterno)
        .values(externos.map((p) => ({ compromissoId: id, pessoaId: p.id })));
    }
    if (descricao?.includes(`@${colega.nome}`)) {
      avisar(ctx, {
        destinatarioId: colega.id,
        natureza: 'mencao',
        registroTipo: 'compromisso',
        registroId: id,
        origemId: autor.id,
        geradoEm: criadoEm,
      });
    }
    registrarNaTrilha(ctx, {
      ocorridaEm: criadoEm,
      autorId: autor.id,
      origem: 'usuario',
      operacao: 'compromisso.criar',
      entidade: 'compromisso',
      registroId: String(id),
      valorNovo: { visibilidade },
    });
  }
  contar(ctx, 'Compromissos na agenda', marcas.length);
  contar(ctx, 'Participantes convidados nos compromissos', participacoes);

  // Horários bloqueados (indisponibilidade, sem motivo).
  const bloqueios = Array.from({ length: 7 }, (_, i) => {
    const inicio = new Date(relogio.agora.getTime() + sorteio.inteiro(-10, 25) * UM_DIA);
    inicio.setUTCHours(12 + sorteio.inteiro(0, 4), 0, 0, 0);
    const quem = sorteio.escolher(internos);
    return {
      criadorId: quem.id,
      inicio,
      fim: new Date(inicio.getTime() + sorteio.inteiro(1, 4) * 3_600_000),
      criadoEm: relogio.diasAtras(sorteio.inteiro(1, 20)),
      ...(i === 6 ? { canceladoEm: relogio.diasAtras(1), canceladoPor: quem.id } : {}),
    };
  });
  await ctx.bd.insert(bloqueioIndisponibilidade).values(bloqueios);
  contar(ctx, 'Horários bloqueados', bloqueios.length);

  // ---- Eventos com presença de cidadãos
  const registradores = comArea(ctx, 'AT').filter((c) => c.perfil !== 'assessor_externo');
  let presencas = 0;
  for (const [i, modelo] of modelosDeEvento.entries()) {
    const diasAteOEvento = [-78, -61, -47, -33, -26, -19, -12, -5, 6, 19][i]!;
    const inicio = new Date(relogio.agora.getTime() + diasAteOEvento * UM_DIA);
    inicio.setUTCHours(13 + (i % 4), 0, 0, 0);
    const bairro = sorteio.escolher(bairros);
    const criador = sorteio.escolher(internos);
    const passado = inicio < relogio.agora;
    const [linha] = await ctx.bd
      .insert(evento)
      .values({
        criadorId: criador.id,
        nome: preencher(modelo.nome, { bairro }),
        inicio,
        local: preencher(modelo.local, { bairro }),
        criadoEm: relogio.depois(inicio, -sorteio.inteiro(10, 30)),
      })
      .returning({ id: evento.id });
    const id = linha!.id;
    registrarNaTrilha(ctx, {
      ocorridaEm: relogio.depois(inicio, -12),
      autorId: criador.id,
      origem: 'usuario',
      operacao: 'evento.criar',
      entidade: 'evento',
      registroId: String(id),
    });
    if (!passado) continue;
    const presentes = sorteio.amostra(convidaveis, sorteio.inteiro(9, 30));
    await ctx.bd.insert(participacaoEvento).values(
      presentes.map((p) => ({
        eventoId: id,
        pessoaId: p.id,
        registradoPor: sorteio.escolher(registradores).id,
        registradoEm: new Date(inicio.getTime() + sorteio.inteiro(0, 90) * 60_000),
        observacao: sorteio.chance(0.12) ? 'Pediu retorno sobre a demanda protocolada.' : null,
      })),
    );
    presencas += presentes.length;
    // Eventos passados foram encerrados (o encerramento é definitivo: a lista de presença trava).
    const quem = sorteio.escolher(supervisores);
    const encerradoEm = new Date(inicio.getTime() + 8 * 3_600_000);
    await ctx.bd
      .update(evento)
      .set({ situacao: 'encerrado', encerradoEm, encerradoPor: quem.id })
      .where(eq(evento.id, id));
    registrarNaTrilha(ctx, {
      ocorridaEm: encerradoEm,
      autorId: quem.id,
      origem: 'usuario',
      operacao: 'evento.encerrar',
      entidade: 'evento',
      registroId: String(id),
    });
  }
  contar(ctx, 'Eventos', modelosDeEvento.length);
  contar(ctx, 'Presenças registradas em eventos', presencas);
}
