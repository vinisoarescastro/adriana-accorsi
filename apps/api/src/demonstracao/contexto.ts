import type { BancoDeDados, NaturezaDeAviso, TipoDeRegistroDeAviso } from '@gabinete/banco';
import type { ArmazenamentoEmDisco } from '../armazenamento/armazenamento.js';
import type { Aleatorio, Relogio } from './aleatorio.js';

export interface Colega {
  readonly id: number;
  readonly nome: string;
  readonly perfil: string;
  readonly habilitacoes: readonly string[];
  readonly ativo: boolean;
}

export interface LinhaDeTrilha {
  readonly ocorridaEm: Date;
  readonly autorId: number | null;
  readonly origem: 'usuario' | 'publico' | 'comando';
  readonly operacao: string;
  readonly entidade: string;
  readonly registroId: string;
  readonly valorNovo?: unknown;
  readonly justificativa?: string;
}

export interface LinhaDeAviso {
  readonly destinatarioId: number;
  readonly natureza: NaturezaDeAviso;
  readonly registroTipo: TipoDeRegistroDeAviso;
  readonly registroId: number;
  readonly origemId: number | null;
  readonly geradoEm: Date;
  readonly chaveUnica?: string;
}

export interface EtapaConhecida {
  readonly id: number;
  readonly papel: string;
}

export interface Contexto {
  readonly bd: BancoDeDados;
  readonly sorteio: Aleatorio;
  readonly relogio: Relogio;
  readonly armazenamento: ArmazenamentoEmDisco;
  readonly segredoDaAplicacao: string;
  readonly colegas: Colega[];
  readonly tipos: { demanda: number; tarefa: number };
  readonly etapas: {
    demanda: Record<string, EtapaConhecida>;
    tarefa: Record<string, EtapaConhecida>;
  };
  readonly avisos: LinhaDeAviso[];
  readonly trilha: LinhaDeTrilha[];
  /** Contagem do que foi criado, para o resumo final. */
  readonly resumo: Record<string, number>;
}

export const contar = (ctx: Contexto, categoria: string, quantidade = 1): void => {
  ctx.resumo[categoria] = (ctx.resumo[categoria] ?? 0) + quantidade;
};

export const registrarNaTrilha = (ctx: Contexto, linha: LinhaDeTrilha): void => {
  ctx.trilha.push(linha);
};

export const avisar = (ctx: Contexto, linha: LinhaDeAviso): void => {
  if (linha.destinatarioId === linha.origemId) return;
  ctx.avisos.push(linha);
};

/** Os colegas ativos que têm a área (Atendimento, Agenda…) e podem agir sobre ela. */
export const comArea = (ctx: Contexto, area: string): Colega[] =>
  ctx.colegas.filter((c) => c.ativo && c.habilitacoes.includes(area));

export const semAcento = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');

export const preencher = (modelo: string, valores: Record<string, string>): string =>
  modelo.replace(/\{(\w+)\}/g, (_, chave: string) => valores[chave] ?? `{${chave}}`);
