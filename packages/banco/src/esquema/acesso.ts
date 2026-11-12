import type { Area, Perfil, SituacaoDeUsuario } from '@gabinete/compartilhado';
import {
  bigint,
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });

const chave = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();

export const contaAcesso = pgTable('conta_acesso', {
  id: chave(),
  email: text('email').notNull().unique(),
  verificadorSenha: text('verificador_senha').notNull(),
  tentativasFalhas: integer('tentativas_falhas').notNull().default(0),
  bloqueadaAte: instante('bloqueada_ate'),
  senhaTrocaObrigatoria: boolean('senha_troca_obrigatoria').notNull().default(true),
  criadoEm: instante('criado_em').notNull().defaultNow(),
  atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
});

export const usuario = pgTable('usuario', {
  id: chave(),
  contaId: bigint('conta_id', { mode: 'number' })
    .notNull()
    .unique()
    .references(() => contaAcesso.id),
  nome: text('nome').notNull(),
  contato: text('contato'),
  fotoChave: text('foto_chave'),
  perfil: text('perfil').$type<Perfil>().notNull(),
  situacao: text('situacao').$type<SituacaoDeUsuario>().notNull().default('ativo'),
  criadoEm: instante('criado_em').notNull().defaultNow(),
  atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
});

export const habilitacao = pgTable(
  'habilitacao',
  {
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    area: text('area').$type<Area>().notNull(),
    concedidaPor: bigint('concedida_por', { mode: 'number' }).references(() => usuario.id),
    concedidaEm: instante('concedida_em').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.area] })],
);

export const sessao = pgTable('sessao', {
  ticketHash: text('ticket_hash').primaryKey(),
  usuarioId: bigint('usuario_id', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
  perfil: text('perfil').$type<Perfil>().notNull(),
  habilitacoes: text('habilitacoes').array().$type<Area[]>().notNull().default([]),
  criadaEm: instante('criada_em').notNull().defaultNow(),
  ultimoUsoEm: instante('ultimo_uso_em').notNull().defaultNow(),
  expiraEm: instante('expira_em').notNull(),
});

export const senhaInicial = pgTable('senha_inicial', {
  usuarioId: bigint('usuario_id', { mode: 'number' })
    .primaryKey()
    .references(() => usuario.id),
  expiraEm: instante('expira_em').notNull(),
  usadaEm: instante('usada_em'),
});
