import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { usuario } from './acesso.js';
import { demanda, pessoa } from './atendimento.js';

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });
const chave = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();

export const exibicoesDeNome = ['completo', 'primeiro_nome', 'nao_exibir'] as const;
export type ExibicaoDeNome = (typeof exibicoesDeNome)[number];

export const exibicoesDeTelefone = ['completo', 'mascarado', 'nao_exibir'] as const;
export type ExibicaoDeTelefone = (typeof exibicoesDeTelefone)[number];

export const politicaPublicacao = pgTable('politica_publicacao', {
  id: chave(),
  exibirTitulo: boolean('exibir_titulo').notNull().default(false),
  exibicaoNome: text('exibicao_nome').$type<ExibicaoDeNome>().notNull().default('primeiro_nome'),
  exibicaoTelefone: text('exibicao_telefone')
    .$type<ExibicaoDeTelefone>()
    .notNull()
    .default('nao_exibir'),
  expiracaoDias: integer('expiracao_dias').notNull().default(90),
  vigenteDesde: instante('vigente_desde').notNull().defaultNow(),
  vigenteAte: instante('vigente_ate'),
  criadoPor: bigint('criado_por', { mode: 'number' }).references(() => usuario.id),
});

export const andamentoPublicado = pgTable(
  'andamento_publicado',
  {
    id: chave(),
    demandaId: bigint('demanda_id', { mode: 'number' })
      .notNull()
      .references(() => demanda.id),
    texto: text('texto').notNull(),
    autorId: bigint('autor_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    publicadoEm: instante('publicado_em').notNull().defaultNow(),
    situacao: text('situacao').$type<'publicado' | 'removido'>().notNull().default('publicado'),
    removidoPor: bigint('removido_por', { mode: 'number' }).references(() => usuario.id),
    removidoEm: instante('removido_em'),
  },
  (t) => [index('andamento_publicado_demanda_idx').on(t.demandaId, t.id)],
);

export const origensDeConsentimento = [
  'atendimento_telefonico',
  'atendimento_presencial',
  'pedido_ao_gabinete',
  'descadastro_cidadao',
  'dados_eliminados',
] as const;
export type OrigemDeConsentimento = (typeof origensDeConsentimento)[number];

export const consentimentoNotificacao = pgTable('consentimento_notificacao', {
  id: chave(),
  pessoaId: bigint('pessoa_id', { mode: 'number' })
    .notNull()
    .references(() => pessoa.id),
  consentido: boolean('consentido').notNull(),
  registradoPor: bigint('registrado_por', { mode: 'number' }).references(() => usuario.id),
  registradoEm: instante('registrado_em').notNull().defaultNow(),
  origem: text('origem').$type<OrigemDeConsentimento>().notNull(),
  versaoTexto: integer('versao_texto'),
});

export const eventosDeNotificacao = [
  'andamento_publicado',
  'etapa_visivel',
  'conclusao',
  'cancelamento',
] as const;
export type EventoDeNotificacao = (typeof eventosDeNotificacao)[number];

export const estadosDeEnvio = ['pendente', 'enviando', 'enviado', 'falhou', 'cancelado'] as const;
export type EstadoDeEnvio = (typeof estadosDeEnvio)[number];

export const envioNotificacao = pgTable('envio_notificacao', {
  id: chave(),
  pessoaId: bigint('pessoa_id', { mode: 'number' })
    .notNull()
    .references(() => pessoa.id),
  demandaId: bigint('demanda_id', { mode: 'number' })
    .notNull()
    .references(() => demanda.id),
  evento: text('evento').$type<EventoDeNotificacao>().notNull(),
  canal: text('canal').$type<'email'>().notNull().default('email'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  descadastroHash: text('descadastro_hash').notNull().unique(),
  estado: text('estado').$type<EstadoDeEnvio>().notNull().default('pendente'),
  tentativas: integer('tentativas').notNull().default(0),
  proximaTentativaEm: instante('proxima_tentativa_em').notNull().defaultNow(),
  provedorIdMensagem: text('provedor_id_mensagem'),
  erro: text('erro'),
  criadoEm: instante('criado_em').notNull().defaultNow(),
  enviadoEm: instante('enviado_em'),
});
