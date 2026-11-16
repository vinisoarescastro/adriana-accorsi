import { composicaoDeAlcance, pode } from '@gabinete/autorizacao';
import {
  aviso,
  compromisso,
  demanda,
  expiracaoDepoisDeLer,
  usuario,
  participanteInterno,
  parametro,
  registrarTrilha,
  tarefa,
  type BancoDeDados,
} from '@gabinete/banco';
import {
  antecedenciaPadraoDoAvisoDePrazo,
  frasesDeAviso,
  type AvisoDto,
  type CaixaDeAvisos,
  type ConfiguracaoDeAvisos,
  type CorpoMarcarAvisos,
} from '@gabinete/compartilhado';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { nivelDeVisao } from '../agenda/visibilidade.js';
import type { Ator } from '../equipe/regras.js';
import { corresponsaveisDe } from '../responsaveis.js';

/** A caixa mostra os avisos mais recentes; o expurgo mantém o resto pequeno. */
const limiteDaCaixa = 200;

const chaveDaAntecedencia = 'antecedencia_aviso_prazo';

/**
 * A caixa pessoal (o sino). O aviso não tem texto nem dado pessoal: só aponta para um registro.
 * Quem não alcança o registro de origem não vê o aviso, mesmo que ele exista (RN-AVI-03).
 */
export class ServicoDeAvisos {
  constructor(
    private readonly bd: BancoDeDados,
    private readonly agora: () => Date,
  ) {}

  /** Título de cada registro que o ator alcança (a chave é "tipo:id"). O que não está aqui, não aparece. */
  private async registrosAlcancaveis(
    ator: Ator,
    avisos: readonly { registroTipo: string; registroId: number }[],
  ): Promise<Map<string, string>> {
    const autoridade = { perfil: ator.perfil, habilitacoes: ator.habilitacoes };
    const alcancados = new Map<string, string>();
    const idsDe = (tipo: string) => [
      ...new Set(avisos.filter((a) => a.registroTipo === tipo).map((a) => a.registroId)),
    ];

    const tarefas = idsDe('tarefa');
    const coTarefas = await corresponsaveisDe(this.bd, 'tarefa', tarefas);
    if (tarefas.length > 0) {
      const linhas = await this.bd
        .select({ id: tarefa.id, titulo: tarefa.titulo, responsavelId: tarefa.responsavelId })
        .from(tarefa)
        .where(inArray(tarefa.id, tarefas));
      for (const t of linhas) {
        if (
          composicaoDeAlcance(ator.perfil) === 'proprio' &&
          t.responsavelId !== ator.usuarioId &&
          !(coTarefas.get(t.id) ?? []).some((c) => c.id === ator.usuarioId)
        ) {
          continue;
        }
        alcancados.set(`tarefa:${t.id}`, t.titulo);
      }
    }

    const demandas = idsDe('demanda');
    const coDemandas = await corresponsaveisDe(this.bd, 'demanda', demandas);
    if (demandas.length > 0 && pode('demandas.consultar', autoridade)) {
      const linhas = await this.bd
        .select({ id: demanda.id, titulo: demanda.titulo, responsavelId: demanda.responsavelId })
        .from(demanda)
        .where(inArray(demanda.id, demandas));
      for (const d of linhas) {
        if (
          composicaoDeAlcance(ator.perfil) === 'proprio' &&
          d.responsavelId !== ator.usuarioId &&
          !(coDemandas.get(d.id) ?? []).some((c) => c.id === ator.usuarioId)
        ) {
          continue;
        }
        alcancados.set(`demanda:${d.id}`, d.titulo);
      }
    }

    const compromissos = idsDe('compromisso');
    if (compromissos.length > 0 && pode('agenda.consultar', autoridade)) {
      const linhas = await this.bd
        .select()
        .from(compromisso)
        .where(inArray(compromisso.id, compromissos));
      const participa = new Set(
        (
          await this.bd
            .select({ id: participanteInterno.compromissoId })
            .from(participanteInterno)
            .where(
              and(
                inArray(participanteInterno.compromissoId, compromissos),
                eq(participanteInterno.usuarioId, ator.usuarioId),
              ),
            )
        ).map((p) => p.id),
      );
      for (const c of linhas) {
        if (nivelDeVisao(c, ator, participa.has(c.id)) === 'completo') {
          alcancados.set(`compromisso:${c.id}`, c.titulo);
        }
      }
    }
    return alcancados;
  }

  async caixa(ator: Ator): Promise<CaixaDeAvisos> {
    const linhas = await this.bd
      .select()
      .from(aviso)
      .where(and(eq(aviso.destinatarioId, ator.usuarioId), gt(aviso.expiraEm, this.agora())))
      .orderBy(desc(aviso.geradoEm), desc(aviso.id))
      .limit(limiteDaCaixa);

    const titulos = await this.registrosAlcancaveis(ator, linhas);
    const origens = [
      ...new Set(linhas.map((l) => l.origemId).filter((o): o is number => o !== null)),
    ];
    const nomes = new Map(
      origens.length === 0
        ? []
        : (
            await this.bd
              .select({ id: usuario.id, nome: usuario.nome })
              .from(usuario)
              .where(inArray(usuario.id, origens))
          ).map((u) => [u.id, u.nome]),
    );
    const itens: AvisoDto[] = [];
    for (const l of linhas) {
      const titulo = titulos.get(`${l.registroTipo}:${l.registroId}`);
      if (titulo === undefined) continue;
      itens.push({
        id: l.id,
        natureza: l.natureza,
        frase: frasesDeAviso[l.natureza],
        registro: { tipo: l.registroTipo, id: l.registroId, titulo },
        de: l.origemId === null ? null : (nomes.get(l.origemId) ?? null),
        geradoEm: l.geradoEm.toISOString(),
        lido: l.lidoEm !== null,
      });
    }
    return { itens, naoLidos: itens.filter((i) => !i.lido).length };
  }

  /** Cada um marca só os próprios. Lido, o aviso passa a expirar em 30 dias (RN-AVI-06). */
  async marcarLidos(ator: Ator, corpo: CorpoMarcarAvisos): Promise<CaixaDeAvisos> {
    const agora = this.agora();
    const proprios = and(eq(aviso.destinatarioId, ator.usuarioId), isNull(aviso.lidoEm));
    const alvo = 'ids' in corpo ? and(proprios, inArray(aviso.id, corpo.ids)) : proprios;
    await this.bd
      .update(aviso)
      .set({
        lidoEm: agora,
        // Nunca alonga a vida do aviso: expira no que vier primeiro.
        expiraEm: sql`least(${aviso.expiraEm}, ${expiracaoDepoisDeLer(agora).toISOString()}::timestamptz)`,
      })
      .where(alvo);
    return this.caixa(ator);
  }

  async configuracao(): Promise<ConfiguracaoDeAvisos> {
    const [linha] = await this.bd
      .select({ valor: parametro.valor })
      .from(parametro)
      .where(eq(parametro.chave, chaveDaAntecedencia))
      .limit(1);
    const valor = linha?.valor;
    const dias =
      typeof valor === 'number' && Number.isInteger(valor) && valor >= 1 && valor <= 30
        ? valor
        : antecedenciaPadraoDoAvisoDePrazo;
    return { antecedenciaDias: dias };
  }

  async configurar(ator: Ator, nova: ConfiguracaoDeAvisos): Promise<ConfiguracaoDeAvisos> {
    const anterior = await this.configuracao();
    await this.bd.transaction(async (tx) => {
      await tx
        .insert(parametro)
        .values({ chave: chaveDaAntecedencia, valor: nova.antecedenciaDias })
        .onConflictDoUpdate({
          target: parametro.chave,
          set: { valor: nova.antecedenciaDias, atualizadoEm: this.agora() },
        });
      await registrarTrilha(tx, {
        origem: 'usuario',
        autorId: ator.usuarioId,
        operacao: 'avisos.configurar',
        entidade: 'parametro',
        registroId: chaveDaAntecedencia,
        valorAnterior: anterior,
        valorNovo: nova,
      });
    });
    return nova;
  }
}
