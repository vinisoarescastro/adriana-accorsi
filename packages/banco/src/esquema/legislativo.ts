import {
  bigint,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { usuario } from './acesso.js';
import { etapa } from './fluxos.js';

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });
const chave = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();

// ---------------------------------------------------------------------------
// Categorias (vocabulários controlados)
// ---------------------------------------------------------------------------

export const naturezasDeCategoria = [
  'assunto_projeto',
  'tipo_proposicao',
  'natureza_documento',
  'tipo_emenda',
] as const;
export type NaturezaDeCategoria = (typeof naturezasDeCategoria)[number];

export const categoria = pgTable(
  'categoria',
  {
    id: chave(),
    natureza: text('natureza').$type<NaturezaDeCategoria>().notNull(),
    nome: text('nome').notNull(),
    situacao: text('situacao').$type<'ativa' | 'inativa'>().notNull().default('ativa'),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('categoria_nome_unico').on(t.natureza, sql`lower(${t.nome})`)],
);

// ---------------------------------------------------------------------------
// Beneficiários
// ---------------------------------------------------------------------------

export const naturezasDeBeneficiario = ['municipio', 'orgao', 'entidade'] as const;
export type NaturezaDeBeneficiario = (typeof naturezasDeBeneficiario)[number];

export const beneficiario = pgTable(
  'beneficiario',
  {
    id: chave(),
    nomeFantasia: text('nome_fantasia').notNull(),
    razaoSocial: text('razao_social').notNull(),
    cnpj: text('cnpj').notNull(),
    cep: text('cep').notNull(),
    logradouro: text('logradouro').notNull(),
    numero: text('numero').notNull(),
    complemento: text('complemento'),
    bairro: text('bairro').notNull(),
    cidade: text('cidade').notNull(),
    estado: text('estado').notNull(),
    natureza: text('natureza').$type<NaturezaDeBeneficiario>().notNull(),
    situacao: text('situacao').$type<'ativo' | 'inativo'>().notNull().default('ativo'),
    criadoPor: bigint('criado_por', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('beneficiario_cnpj_unico_ativos')
      .on(t.cnpj)
      .where(sql`${t.situacao} = 'ativo'`),
    index('beneficiario_nome_idx').on(sql`lower(${t.nomeFantasia})`),
  ],
);

// ---------------------------------------------------------------------------
// Projetos de lei
// ---------------------------------------------------------------------------

export const projetoLei = pgTable(
  'projeto_lei',
  {
    id: chave(),
    criadorId: bigint('criador_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    responsavelId: bigint('responsavel_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    titulo: text('titulo').notNull(),
    ementa: text('ementa').notNull(),
    autoria: text('autoria').notNull(),
    numero: text('numero'),
    tipoProposicaoId: bigint('tipo_proposicao_id', { mode: 'number' })
      .notNull()
      .references(() => categoria.id),
    etapaAtualId: bigint('etapa_atual_id', { mode: 'number' })
      .notNull()
      .references(() => etapa.id),
    prazo: date('prazo', { mode: 'string' }),
    canceladoEm: instante('cancelado_em'),
    canceladoPor: bigint('cancelado_por', { mode: 'number' }).references(() => usuario.id),
    justificativaCancelamento: text('justificativa_cancelamento'),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('projeto_numero_unico_ativos')
      .on(sql`lower(${t.numero})`)
      .where(sql`${t.numero} IS NOT NULL AND ${t.canceladoEm} IS NULL`),
    index('projeto_responsavel_idx').on(t.responsavelId),
    index('projeto_etapa_idx').on(t.etapaAtualId),
  ],
);

export const projetoAssunto = pgTable(
  'projeto_assunto',
  {
    projetoId: bigint('projeto_id', { mode: 'number' })
      .notNull()
      .references(() => projetoLei.id),
    categoriaId: bigint('categoria_id', { mode: 'number' })
      .notNull()
      .references(() => categoria.id),
  },
  (t) => [primaryKey({ columns: [t.projetoId, t.categoriaId] })],
);

export const projetoCoautor = pgTable('projeto_coautor', {
  id: chave(),
  projetoId: bigint('projeto_id', { mode: 'number' })
    .notNull()
    .references(() => projetoLei.id),
  nome: text('nome').notNull(),
});

export const tramitacaoComissao = pgTable('tramitacao_comissao', {
  id: chave(),
  projetoId: bigint('projeto_id', { mode: 'number' })
    .notNull()
    .references(() => projetoLei.id),
  comissao: text('comissao').notNull(),
  data: date('data', { mode: 'string' }).notNull(),
  parecer: text('parecer'),
  registradoPor: bigint('registrado_por', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
  registradoEm: instante('registrado_em').notNull().defaultNow(),
});

export const resultadosDeVotacao = [
  'aprovado',
  'aprovado_com_emendas',
  'rejeitado',
  'retirado_de_pauta',
  'adiado',
] as const;
export type ResultadoDeVotacao = (typeof resultadosDeVotacao)[number];

export const votacaoProjeto = pgTable('votacao_projeto', {
  id: chave(),
  projetoId: bigint('projeto_id', { mode: 'number' })
    .notNull()
    .references(() => projetoLei.id),
  data: date('data', { mode: 'string' }).notNull(),
  resultado: text('resultado').$type<ResultadoDeVotacao>().notNull(),
  local: text('local'),
  registradoPor: bigint('registrado_por', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
  registradoEm: instante('registrado_em').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Emendas parlamentares (fase 6)
// ---------------------------------------------------------------------------

export const emenda = pgTable(
  'emenda',
  {
    id: chave(),
    criadorId: bigint('criador_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    responsavelId: bigint('responsavel_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    identificacao: text('identificacao').notNull(),
    exercicio: integer('exercicio').notNull(),
    tipoId: bigint('tipo_id', { mode: 'number' })
      .notNull()
      .references(() => categoria.id),
    finalidade: text('finalidade').notNull(),
    prazoDestinacao: date('prazo_destinacao', { mode: 'string' }),
    prazoEmpenho: date('prazo_empenho', { mode: 'string' }),
    prazoExecucao: date('prazo_execucao', { mode: 'string' }),
    etapaAtualId: bigint('etapa_atual_id', { mode: 'number' })
      .notNull()
      .references(() => etapa.id),
    canceladaEm: instante('cancelada_em'),
    canceladaPor: bigint('cancelada_por', { mode: 'number' }).references(() => usuario.id),
    justificativaCancelamento: text('justificativa_cancelamento'),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('emenda_identificacao_unica')
      .on(sql`lower(${t.identificacao})`, t.exercicio)
      .where(sql`${t.canceladaEm} IS NULL`),
    index('emenda_responsavel_idx').on(t.responsavelId),
    index('emenda_etapa_idx').on(t.etapaAtualId),
  ],
);

/** Só acrescenta: o valor atual é o mais recente, e o de uma data passada é o que valia nela. */
export const emendaValor = pgTable(
  'emenda_valor',
  {
    id: chave(),
    emendaId: bigint('emenda_id', { mode: 'number' })
      .notNull()
      .references(() => emenda.id),
    valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
    definidoPor: bigint('definido_por', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    definidoEm: instante('definido_em').notNull().defaultNow(),
  },
  (t) => [index('emenda_valor_idx').on(t.emendaId, t.definidoEm.desc(), t.id.desc())],
);

export const destinacao = pgTable(
  'destinacao',
  {
    id: chave(),
    emendaId: bigint('emenda_id', { mode: 'number' })
      .notNull()
      .references(() => emenda.id),
    beneficiarioId: bigint('beneficiario_id', { mode: 'number' })
      .notNull()
      .references(() => beneficiario.id),
    valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
    finalidade: text('finalidade').notNull(),
    etapaAtualId: bigint('etapa_atual_id', { mode: 'number' })
      .notNull()
      .references(() => etapa.id),
    criadaPor: bigint('criada_por', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    criadaEm: instante('criada_em').notNull().defaultNow(),
    canceladaEm: instante('cancelada_em'),
    canceladaPor: bigint('cancelada_por', { mode: 'number' }).references(() => usuario.id),
    justificativaCancelamento: text('justificativa_cancelamento'),
  },
  (t) => [
    index('destinacao_emenda_idx').on(t.emendaId, t.id),
    index('destinacao_beneficiario_idx').on(t.beneficiarioId),
  ],
);

export const execucaoDestinacao = pgTable(
  'execucao_destinacao',
  {
    id: chave(),
    destinacaoId: bigint('destinacao_id', { mode: 'number' })
      .notNull()
      .references(() => destinacao.id),
    valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
    data: date('data', { mode: 'string' }).notNull(),
    observacao: text('observacao'),
    registradoPor: bigint('registrado_por', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    registradoEm: instante('registrado_em').notNull().defaultNow(),
  },
  (t) => [index('execucao_destinacao_idx').on(t.destinacaoId, t.id)],
);
