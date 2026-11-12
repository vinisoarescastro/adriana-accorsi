import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { usuario } from './acesso.js';

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });
const chave = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();

export const tiposDeProcesso = [
  'demanda',
  'tarefa',
  'projeto_lei',
  'emenda',
  'despesa_ceap',
] as const;
export type TipoDeProcesso = (typeof tiposDeProcesso)[number];

export const papeisDeEtapa = ['entrada', 'intermediaria', 'conclusao', 'arquivamento'] as const;
export type PapelDeEtapa = (typeof papeisDeEtapa)[number];

export const tiposDeRegistro = [
  'demanda',
  'tarefa',
  'projeto_lei',
  'emenda',
  'destinacao',
  'despesa',
] as const;
export type TipoDeRegistro = (typeof tiposDeRegistro)[number];

export const tipoProcesso = pgTable('tipo_processo', {
  id: chave(),
  tipo: text('tipo').$type<TipoDeProcesso>().notNull().unique(),
  nome: text('nome').notNull(),
});

export const etapa = pgTable('etapa', {
  id: chave(),
  tipoProcessoId: bigint('tipo_processo_id', { mode: 'number' })
    .notNull()
    .references(() => tipoProcesso.id),
  nomeInterno: text('nome_interno').notNull(),
  ordem: integer('ordem').notNull(),
  papel: text('papel').$type<PapelDeEtapa>().notNull(),
  rotuloPublico: text('rotulo_publico'),
  visivelPublico: boolean('visivel_publico').notNull().default(false),
  prazoPadraoDias: integer('prazo_padrao_dias'),
  situacao: text('situacao').$type<'ativa' | 'inativa'>().notNull().default('ativa'),
  criadoEm: instante('criado_em').notNull().defaultNow(),
  atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
});

export const vinculo = pgTable(
  'vinculo',
  {
    id: chave(),
    origemTipo: text('origem_tipo').notNull(),
    origemId: bigint('origem_id', { mode: 'number' }).notNull(),
    destinoTipo: text('destino_tipo').notNull(),
    destinoId: bigint('destino_id', { mode: 'number' }).notNull(),
    criadoPor: bigint('criado_por', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    criadoEm: instante('criado_em').notNull().defaultNow(),
  },
  (t) => [
    unique('vinculo_origem_unica').on(t.origemTipo, t.origemId),
    index('vinculo_destino_idx').on(t.destinoTipo, t.destinoId),
  ],
);

export const movimentacao = pgTable('movimentacao', {
  id: chave(),
  registroTipo: text('registro_tipo').$type<TipoDeRegistro>().notNull(),
  registroId: bigint('registro_id', { mode: 'number' }).notNull(),
  tipoProcessoId: bigint('tipo_processo_id', { mode: 'number' })
    .notNull()
    .references(() => tipoProcesso.id),
  etapaOrigemId: bigint('etapa_origem_id', { mode: 'number' }).references(() => etapa.id),
  etapaDestinoId: bigint('etapa_destino_id', { mode: 'number' })
    .notNull()
    .references(() => etapa.id),
  autorId: bigint('autor_id', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
  observacao: text('observacao'),
  criadaEm: instante('criada_em').notNull().defaultNow(),
});
