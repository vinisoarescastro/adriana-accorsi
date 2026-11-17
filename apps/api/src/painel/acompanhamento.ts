import { pode } from '@gabinete/autorizacao';
import {
  demanda,
  etapa,
  movimentacao,
  projetoLei,
  tarefa,
  usuario,
  type BancoDeDados,
} from '@gabinete/banco';
import {
  formatarProtocolo,
  type AtividadeRecente,
  type CargaDaPessoa,
  type PainelDaEquipe,
  type PendenciasDoUsuario,
  type PontoDaTendencia,
  type TendenciaDoAtendimento,
} from '@gabinete/compartilhado';
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { hojeNoGabinete } from '../atendimento/comum.js';
import { ConsultasDeDemandas } from '../demandas/consultas.js';
import type { Ator } from '../equipe/regras.js';
import { demandaDoUsuario, tarefaDoUsuario } from '../responsaveis.js';
import { ConsultasDeTarefas } from '../tarefas/consultas.js';

const umDiaEmMs = 86_400_000;
const diaNoGabinete = (coluna: SQL | typeof movimentacao.criadaEm | typeof demanda.criadoEm) =>
  sql<string>`to_char((${coluna} at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD')`;

/** Os `dias` dias que terminam hoje, do mais antigo ao mais novo (AAAA-MM-DD, no fuso do gabinete). */
function ultimosDias(hoje: string, dias: number): string[] {
  const base = new Date(`${hoje}T12:00:00Z`).getTime();
  return Array.from({ length: dias }, (_, i) =>
    new Date(base - (dias - 1 - i) * umDiaEmMs).toISOString().slice(0, 10),
  );
}

/**
 * O que o painel mostra além dos totais: a tendência do atendimento, as pendências de quem entrou,
 * a atividade recente e a carga da equipe. Cada leitura usa o MESMO alcance das listagens.
 */
export class ServicoDoPainelDeAcompanhamento {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  /** Demandas recebidas e concluídas por dia, nos últimos `dias` dias. */
  async tendencia(ator: Ator, dias = 30): Promise<TendenciaDoAtendimento> {
    const agora = this.agora();
    const hoje = hojeNoGabinete(agora);
    const lista = ultimosDias(hoje, dias);
    // Folga de um dia para o fuso: o filtro fino é feito pelo dia calculado abaixo.
    const desde = new Date(agora.getTime() - (dias + 1) * umDiaEmMs);
    const alcance = ConsultasDeDemandas.condicoesDeAlcance(ator);

    const recebidas = await this.bd
      .select({ dia: diaNoGabinete(demanda.criadoEm), total: count() })
      .from(demanda)
      .where(and(...alcance, isNull(demanda.canceladaEm), gte(demanda.criadoEm, desde)))
      .groupBy(diaNoGabinete(demanda.criadoEm));
    const concluidas = await this.bd
      .select({ dia: diaNoGabinete(movimentacao.criadaEm), total: count() })
      .from(movimentacao)
      .innerJoin(etapa, eq(etapa.id, movimentacao.etapaDestinoId))
      .innerJoin(demanda, eq(demanda.id, movimentacao.registroId))
      .where(
        and(
          ...alcance,
          eq(movimentacao.registroTipo, 'demanda'),
          eq(etapa.papel, 'conclusao'),
          isNull(demanda.canceladaEm),
          gte(movimentacao.criadaEm, desde),
        ),
      )
      .groupBy(diaNoGabinete(movimentacao.criadaEm));

    const pontos: PontoDaTendencia[] = lista.map((dia) => ({
      dia,
      recebidas: recebidas.find((r) => r.dia === dia)?.total ?? 0,
      concluidas: concluidas.find((r) => r.dia === dia)?.total ?? 0,
    }));
    return {
      dias,
      pontos,
      totalRecebidas: pontos.reduce((s, p) => s + p.recebidas, 0),
      totalConcluidas: pontos.reduce((s, p) => s + p.concluidas, 0),
    };
  }

  /** As tarefas (e, com atendimento, as demandas) em andamento que são do usuário. */
  async pendencias(ator: Ator, limite = 6): Promise<PendenciasDoUsuario> {
    const hoje = hojeNoGabinete(this.agora());
    const autoridade = { perfil: ator.perfil, habilitacoes: ator.habilitacoes };

    const deTarefa = [
      ...ConsultasDeTarefas.condicoesDeAlcance(ator),
      ConsultasDeTarefas.emAndamento(),
      tarefaDoUsuario(ator.usuarioId),
    ];
    const tarefas = await this.bd
      .select({
        id: tarefa.id,
        titulo: tarefa.titulo,
        prazo: tarefa.prazo,
        etapa: etapa.nomeInterno,
      })
      .from(tarefa)
      .innerJoin(etapa, eq(etapa.id, tarefa.etapaAtualId))
      .where(and(...deTarefa))
      .orderBy(sql`${tarefa.prazo} is null`, asc(tarefa.prazo), asc(tarefa.id))
      .limit(limite);
    const [totalDeTarefas] = await this.bd
      .select({ total: count() })
      .from(tarefa)
      .innerJoin(etapa, eq(etapa.id, tarefa.etapaAtualId))
      .where(and(...deTarefa));

    let demandas: PendenciasDoUsuario['demandas'] = null;
    let totalDeDemandas = 0;
    if (pode('painel.atendimento', autoridade)) {
      const deDemanda = [
        ...ConsultasDeDemandas.condicoesDeAlcance(ator),
        isNull(demanda.canceladaEm),
        inArray(etapa.papel, ['entrada', 'intermediaria']),
        demandaDoUsuario(ator.usuarioId),
      ];
      const linhas = await this.bd
        .select({
          id: demanda.id,
          protocolo: demanda.protocolo,
          titulo: demanda.titulo,
          prazo: demanda.prazo,
          etapa: etapa.nomeInterno,
        })
        .from(demanda)
        .innerJoin(etapa, eq(etapa.id, demanda.etapaAtualId))
        .where(and(...deDemanda))
        .orderBy(sql`${demanda.prazo} is null`, asc(demanda.prazo), asc(demanda.id))
        .limit(limite);
      const [total] = await this.bd
        .select({ total: count() })
        .from(demanda)
        .innerJoin(etapa, eq(etapa.id, demanda.etapaAtualId))
        .where(and(...deDemanda));
      totalDeDemandas = total?.total ?? 0;
      demandas = linhas.map((d) => ({
        ...d,
        protocolo: formatarProtocolo(d.protocolo),
        atrasada: d.prazo !== null && d.prazo < hoje,
      }));
    }

    return {
      tarefas: tarefas.map((t) => ({
        ...t,
        atrasada: t.prazo !== null && t.prazo < hoje,
      })),
      totalDeTarefas: totalDeTarefas?.total ?? 0,
      demandas,
      totalDeDemandas,
    };
  }

  /** As últimas passagens de etapa nos registros que o usuário alcança, as mais recentes primeiro. */
  async atividade(ator: Ator, limite = 8): Promise<AtividadeRecente[]> {
    const autoridade = { perfil: ator.perfil, habilitacoes: ator.habilitacoes };
    const base = {
      id: movimentacao.id,
      registroId: movimentacao.registroId,
      etapa: etapa.nomeInterno,
      autor: usuario.nome,
      em: movimentacao.criadaEm,
    };
    const colhidas: AtividadeRecente[] = [];

    const tarefas = await this.bd
      .select({ ...base, titulo: tarefa.titulo })
      .from(movimentacao)
      .innerJoin(tarefa, eq(tarefa.id, movimentacao.registroId))
      .innerJoin(etapa, eq(etapa.id, movimentacao.etapaDestinoId))
      .innerJoin(usuario, eq(usuario.id, movimentacao.autorId))
      .where(
        and(
          ...ConsultasDeTarefas.condicoesDeAlcance(ator),
          eq(movimentacao.registroTipo, 'tarefa'),
        ),
      )
      .orderBy(desc(movimentacao.criadaEm), desc(movimentacao.id))
      .limit(limite);
    colhidas.push(
      ...tarefas.map((l) => ({ ...l, tipo: 'tarefa' as const, em: l.em.toISOString() })),
    );

    if (pode('painel.atendimento', autoridade)) {
      const demandas = await this.bd
        .select({ ...base, titulo: demanda.titulo })
        .from(movimentacao)
        .innerJoin(demanda, eq(demanda.id, movimentacao.registroId))
        .innerJoin(etapa, eq(etapa.id, movimentacao.etapaDestinoId))
        .innerJoin(usuario, eq(usuario.id, movimentacao.autorId))
        .where(
          and(
            ...ConsultasDeDemandas.condicoesDeAlcance(ator),
            eq(movimentacao.registroTipo, 'demanda'),
          ),
        )
        .orderBy(desc(movimentacao.criadaEm), desc(movimentacao.id))
        .limit(limite);
      colhidas.push(
        ...demandas.map((l) => ({ ...l, tipo: 'demanda' as const, em: l.em.toISOString() })),
      );
    }

    if (pode('projetos.consultar', autoridade)) {
      const projetos = await this.bd
        .select({ ...base, titulo: projetoLei.titulo })
        .from(movimentacao)
        .innerJoin(projetoLei, eq(projetoLei.id, movimentacao.registroId))
        .innerJoin(etapa, eq(etapa.id, movimentacao.etapaDestinoId))
        .innerJoin(usuario, eq(usuario.id, movimentacao.autorId))
        .where(eq(movimentacao.registroTipo, 'projeto_lei'))
        .orderBy(desc(movimentacao.criadaEm), desc(movimentacao.id))
        .limit(limite);
      colhidas.push(
        ...projetos.map((l) => ({ ...l, tipo: 'projeto_lei' as const, em: l.em.toISOString() })),
      );
    }

    return colhidas
      .sort((a, b) => (a.em < b.em ? 1 : a.em > b.em ? -1 : b.id - a.id))
      .slice(0, limite);
  }

  /** A carga de trabalho de cada pessoa ativa e a composição da equipe (Chefe e superiores). */
  async equipe(dias = 30): Promise<PainelDaEquipe> {
    const agora = this.agora();
    const hoje = hojeNoGabinete(agora);
    const desde = new Date(agora.getTime() - dias * umDiaEmMs);
    const ativos = await this.bd
      .select({ id: usuario.id, nome: usuario.nome, perfil: usuario.perfil })
      .from(usuario)
      .where(eq(usuario.situacao, 'ativo'))
      .orderBy(asc(usuario.nome));

    const emAndamento = (papel: typeof etapa.papel) => inArray(papel, ['entrada', 'intermediaria']);
    const demandasAbertas = await this.bd
      .select({
        id: demanda.responsavelId,
        total: count(),
        atrasadas: sql<number>`count(*) filter (where ${lt(demanda.prazo, hoje)})`,
      })
      .from(demanda)
      .innerJoin(etapa, eq(etapa.id, demanda.etapaAtualId))
      .where(and(isNull(demanda.canceladaEm), emAndamento(etapa.papel)))
      .groupBy(demanda.responsavelId);
    const tarefasAbertas = await this.bd
      .select({
        id: tarefa.responsavelId,
        total: count(),
        atrasadas: sql<number>`count(*) filter (where ${lt(tarefa.prazo, hoje)})`,
      })
      .from(tarefa)
      .innerJoin(etapa, eq(etapa.id, tarefa.etapaAtualId))
      .where(and(isNull(tarefa.canceladaEm), emAndamento(etapa.papel)))
      .groupBy(tarefa.responsavelId);
    const concluidas = await this.bd
      .select({ id: movimentacao.autorId, total: count() })
      .from(movimentacao)
      .innerJoin(etapa, eq(etapa.id, movimentacao.etapaDestinoId))
      .where(
        and(
          inArray(movimentacao.registroTipo, ['demanda', 'tarefa']),
          eq(etapa.papel, 'conclusao'),
          gte(movimentacao.criadaEm, desde),
        ),
      )
      .groupBy(movimentacao.autorId);

    const pessoas: CargaDaPessoa[] = ativos.map((u) => {
      const d = demandasAbertas.find((x) => x.id === u.id);
      const t = tarefasAbertas.find((x) => x.id === u.id);
      return {
        id: u.id,
        nome: u.nome,
        perfil: u.perfil,
        demandasAbertas: d?.total ?? 0,
        tarefasAbertas: t?.total ?? 0,
        atrasadas: Number(d?.atrasadas ?? 0) + Number(t?.atrasadas ?? 0),
        concluidasNoPeriodo: concluidas.find((x) => x.id === u.id)?.total ?? 0,
      };
    });
    const porPerfil = [...new Set(ativos.map((u) => u.perfil))].map((perfil) => ({
      perfil,
      total: ativos.filter((u) => u.perfil === perfil).length,
    }));
    return { periodoDias: dias, pessoas, porPerfil };
  }
}
