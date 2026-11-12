import { bigint, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { usuario } from './acesso.js';

export const origensDaTrilha = ['usuario', 'publico', 'comando'] as const;

export type OrigemDaTrilha = (typeof origensDaTrilha)[number];

/** Trilha de auditoria. Imutável por gatilho e por permissão (ver migrações 0002 e 0004). */
export const trilha = pgTable('trilha', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  ocorridaEm: timestamp('ocorrida_em', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  autorId: bigint('autor_id', { mode: 'number' }).references(() => usuario.id),
  origem: text('origem').$type<OrigemDaTrilha>().notNull(),
  operacao: text('operacao').notNull(),
  entidade: text('entidade').notNull(),
  registroId: text('registro_id'),
  valorAnterior: jsonb('valor_anterior'),
  valorNovo: jsonb('valor_novo'),
  justificativa: text('justificativa'),
});
