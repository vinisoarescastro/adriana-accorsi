import type { Perfil } from './perfis.js';

/**
 * Contratos do painel (a página inicial). Tudo é calculado na leitura, a partir dos registros que o
 * usuário alcança: nenhum número é gravado, e o painel nunca mostra o que a lista não mostraria.
 */

/** Um dia da tendência do atendimento, no fuso do gabinete. */
export interface PontoDaTendencia {
  readonly dia: string;
  readonly recebidas: number;
  readonly concluidas: number;
}

export interface TendenciaDoAtendimento {
  readonly dias: number;
  readonly pontos: readonly PontoDaTendencia[];
  readonly totalRecebidas: number;
  readonly totalConcluidas: number;
}

export interface PendenciaDeTarefa {
  readonly id: number;
  readonly titulo: string;
  readonly prazo: string | null;
  readonly atrasada: boolean;
  readonly etapa: string;
}

export interface PendenciaDeDemanda {
  readonly id: number;
  readonly protocolo: string;
  readonly titulo: string;
  readonly prazo: string | null;
  readonly atrasada: boolean;
  readonly etapa: string;
}

/** O que está na mão do usuário: as atrasadas primeiro, depois as de prazo mais próximo. */
export interface PendenciasDoUsuario {
  readonly tarefas: readonly PendenciaDeTarefa[];
  readonly totalDeTarefas: number;
  /** `null` quando o usuário não tem a habilitação de atendimento. */
  readonly demandas: readonly PendenciaDeDemanda[] | null;
  readonly totalDeDemandas: number;
}

export type TipoDeAtividade = 'demanda' | 'tarefa' | 'projeto_lei';

export interface AtividadeRecente {
  readonly id: number;
  readonly tipo: TipoDeAtividade;
  readonly registroId: number;
  readonly titulo: string;
  /** A etapa para a qual o registro foi. */
  readonly etapa: string;
  readonly autor: string;
  readonly em: string;
}

export interface CargaDaPessoa {
  readonly id: number;
  readonly nome: string;
  readonly perfil: Perfil;
  readonly demandasAbertas: number;
  readonly tarefasAbertas: number;
  /** Demandas e tarefas em andamento com o prazo vencido. */
  readonly atrasadas: number;
  /** Demandas e tarefas que a pessoa levou à conclusão no período. */
  readonly concluidasNoPeriodo: number;
}

export interface PainelDaEquipe {
  readonly periodoDias: number;
  readonly pessoas: readonly CargaDaPessoa[];
  readonly porPerfil: readonly { readonly perfil: Perfil; readonly total: number }[];
}
