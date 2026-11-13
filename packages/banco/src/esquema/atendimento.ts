import { bigint, boolean, date, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { usuario } from './acesso.js';
import { etapa, type TipoDeRegistro } from './fluxos.js';

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });
const chave = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();

export const situacoesDePessoa = ['ativa', 'inativa', 'dados_eliminados'] as const;
export type SituacaoDePessoa = (typeof situacoesDePessoa)[number];

export const prioridadesDeDemanda = ['baixa', 'media', 'alta', 'urgente'] as const;
export type PrioridadeDeDemanda = (typeof prioridadesDeDemanda)[number];

export const pessoa = pgTable('pessoa', {
  id: chave(),
  nomeCompleto: text('nome_completo'),
  telefoneNormalizado: text('telefone_normalizado'),
  email: text('email'),
  emailInvalido: boolean('email_invalido').notNull().default(false),
  contatos: text('contatos'),
  endereco: text('endereco'),
  situacao: text('situacao').$type<SituacaoDePessoa>().notNull().default('ativa'),
  criadoPor: bigint('criado_por', { mode: 'number' }).references(() => usuario.id),
  criadoEm: instante('criado_em').notNull().defaultNow(),
  atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
});

export const protocoloEmitido = pgTable('protocolo_emitido', {
  protocolo: text('protocolo').primaryKey(),
  emitidoEm: instante('emitido_em').notNull().defaultNow(),
});

export const demanda = pgTable(
  'demanda',
  {
    id: chave(),
    protocolo: text('protocolo')
      .notNull()
      .unique()
      .references(() => protocoloEmitido.protocolo),
    segredoLinkHash: text('segredo_link_hash').notNull().unique(),
    segredoLinkCifrado: text('segredo_link_cifrado').notNull(),
    publicacaoLink: text('publicacao_link')
      .$type<'ativa' | 'suspensa' | 'revogada' | 'expirada'>()
      .notNull()
      .default('ativa'),
    solicitanteId: bigint('solicitante_id', { mode: 'number' })
      .notNull()
      .references(() => pessoa.id),
    responsavelId: bigint('responsavel_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    autorId: bigint('autor_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    prioridade: text('prioridade').$type<PrioridadeDeDemanda>().notNull().default('media'),
    etapaAtualId: bigint('etapa_atual_id', { mode: 'number' })
      .notNull()
      .references(() => etapa.id),
    prazo: date('prazo', { mode: 'string' }),
    canceladaEm: instante('cancelada_em'),
    canceladaPor: bigint('cancelada_por', { mode: 'number' }).references(() => usuario.id),
    justificativaCancelamento: text('justificativa_cancelamento'),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
  },
  (t) => [
    index('demanda_etapa_idx').on(t.etapaAtualId),
    index('demanda_responsavel_idx').on(t.responsavelId),
    index('demanda_solicitante_idx').on(t.solicitanteId),
  ],
);

export const comentarioInterno = pgTable('comentario_interno', {
  id: chave(),
  registroTipo: text('registro_tipo').$type<TipoDeRegistro>().notNull(),
  registroId: bigint('registro_id', { mode: 'number' }).notNull(),
  autorId: bigint('autor_id', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
  texto: text('texto').notNull(),
  criadoEm: instante('criado_em').notNull().defaultNow(),
  situacao: text('situacao').$type<'ativo' | 'removido'>().notNull().default('ativo'),
  removidoPor: bigint('removido_por', { mode: 'number' }).references(() => usuario.id),
  removidoEm: instante('removido_em'),
});

export const comentarioMencao = pgTable('comentario_mencao', {
  comentarioId: bigint('comentario_id', { mode: 'number' })
    .notNull()
    .references(() => comentarioInterno.id),
  usuarioId: bigint('usuario_id', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
});

export const tiposDeDocumento = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/zip',
] as const;
export type TipoDeDocumento = (typeof tiposDeDocumento)[number];

export const documento = pgTable('documento', {
  id: chave(),
  registroTipo: text('registro_tipo').$type<TipoDeRegistro>().notNull(),
  registroId: bigint('registro_id', { mode: 'number' }).notNull(),
  natureza: text('natureza').notNull().default('outro'),
  nome: text('nome').notNull(),
  tipoReal: text('tipo_real').$type<TipoDeDocumento>().notNull(),
  tamanho: bigint('tamanho', { mode: 'number' }).notNull(),
  chaveArmazenamento: text('chave_armazenamento').notNull().unique(),
  hashSha256: text('hash_sha256').notNull(),
  varredura: text('varredura').$type<'limpo' | 'nao_verificado'>().notNull(),
  autorEnvio: bigint('autor_envio', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
  enviadoEm: instante('enviado_em').notNull().defaultNow(),
  situacao: text('situacao').$type<'ativo' | 'removido'>().notNull().default('ativo'),
  removidoPor: bigint('removido_por', { mode: 'number' }).references(() => usuario.id),
  removidoEm: instante('removido_em'),
});
