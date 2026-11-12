import { jsonb, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

/** Identidade da Parlamentar e do gabinete: uma única linha (id = 1). */
export const gabinete = pgTable('gabinete', {
  id: smallint('id').primaryKey().default(1),
  nome: text('nome').notNull(),
  parlamentarNome: text('parlamentar_nome').notNull(),
  cargo: text('cargo').notNull(),
  partido: text('partido'),
  mandato: text('mandato'),
  contatoTelefone: text('contato_telefone'),
  contatoEmail: text('contato_email'),
  contatoEndereco: text('contato_endereco'),
  fotoChave: text('foto_chave'),
  fuso: text('fuso').notNull().default('America/Sao_Paulo'),
  atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
});

export const parametro = pgTable('parametro', {
  chave: text('chave').primaryKey(),
  valor: jsonb('valor').notNull(),
  atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
});
