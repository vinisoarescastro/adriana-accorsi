import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
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
import { usuario } from './acesso.js';
import { etapa } from './fluxos.js';

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });
const chave = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();

export const chavesDeParametroDaCeap = [
  'cota_mensal',
  'prazo_apresentacao_dias',
  'guarda_originais_anos',
  'limite_alerta_saldo',
] as const;
export type ChaveDeParametroDaCeap = (typeof chavesDeParametroDaCeap)[number];

/** Parâmetro com vigência: o valor e o início não mudam; só se encerra a vigência e se abre outra. */
export const ceapParametro = pgTable(
  'ceap_parametro',
  {
    id: chave(),
    chave: text('chave').$type<ChaveDeParametroDaCeap>().notNull(),
    valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
    vigenteDe: date('vigente_de', { mode: 'string' }).notNull(),
    vigenteAte: date('vigente_ate', { mode: 'string' }),
    definidoPor: bigint('definido_por', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    definidoEm: instante('definido_em').notNull().defaultNow(),
  },
  (t) => [index('ceap_parametro_chave_idx').on(t.chave, t.vigenteDe)],
);

export const ceapCategoria = pgTable(
  'ceap_categoria',
  {
    id: chave(),
    nome: text('nome').notNull(),
    itemNorma: text('item_norma'),
    tetoMensal: numeric('teto_mensal', { precision: 14, scale: 2 }),
    comprovanteObrigatorio: boolean('comprovante_obrigatorio').notNull().default(true),
    situacao: text('situacao').$type<'ativa' | 'inativa'>().notNull().default('ativa'),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('ceap_categoria_nome_unico').on(sql`lower(${t.nome})`)],
);

export const ceapEncerramento = pgTable(
  'ceap_encerramento',
  {
    ano: integer('ano').notNull(),
    mes: integer('mes').notNull(),
    encerradaPor: bigint('encerrada_por', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    encerradaEm: instante('encerrada_em').notNull().defaultNow(),
    reabertaPor: bigint('reaberta_por', { mode: 'number' }).references(() => usuario.id),
    reabertaEm: instante('reaberta_em'),
  },
  (t) => [primaryKey({ columns: [t.ano, t.mes] })],
);

export const despesa = pgTable(
  'despesa',
  {
    id: chave(),
    categoriaId: bigint('categoria_id', { mode: 'number' })
      .notNull()
      .references(() => ceapCategoria.id),
    responsavelId: bigint('responsavel_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    lancadoPor: bigint('lancado_por', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    descricao: text('descricao').notNull(),
    valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
    dataDocumento: date('data_documento', { mode: 'string' }).notNull(),
    competenciaAno: integer('competencia_ano').generatedAlwaysAs(
      sql`extract(year FROM data_documento)::integer`,
    ),
    competenciaMes: integer('competencia_mes').generatedAlwaysAs(
      sql`extract(month FROM data_documento)::integer`,
    ),
    fornecedorNome: text('fornecedor_nome').notNull(),
    fornecedorDocumento: text('fornecedor_documento').notNull(),
    numeroDocumento: text('numero_documento').notNull(),
    etapaAtualId: bigint('etapa_atual_id', { mode: 'number' })
      .notNull()
      .references(() => etapa.id),
    decididoPor: bigint('decidido_por', { mode: 'number' }).references(() => usuario.id),
    decididaEm: instante('decidida_em'),
    decisaoPeloProprioLancador: boolean('decisao_pelo_proprio_lancador').notNull().default(false),
    motivoReprovacao: text('motivo_reprovacao'),
    canceladaEm: instante('cancelada_em'),
    canceladaPor: bigint('cancelada_por', { mode: 'number' }).references(() => usuario.id),
    justificativaCancelamento: text('justificativa_cancelamento'),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
  },
  (t) => [
    index('despesa_competencia_idx').on(t.competenciaAno, t.competenciaMes),
    index('despesa_categoria_idx').on(t.categoriaId, t.competenciaAno, t.competenciaMes),
    index('despesa_etapa_idx').on(t.etapaAtualId),
    index('despesa_responsavel_idx').on(t.responsavelId),
  ],
);
