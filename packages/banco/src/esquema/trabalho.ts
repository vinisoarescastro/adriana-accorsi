import {
  bigint,
  boolean,
  date,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { usuario } from './acesso.js';
import { pessoa, type PrioridadeDeDemanda } from './atendimento.js';
import { etapa } from './fluxos.js';

const instante = (nome: string) => timestamp(nome, { withTimezone: true, mode: 'date' });
const chave = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

export const tiposDeVinculoDeTarefa = ['demanda', 'pessoa', 'compromisso', 'evento'] as const;
export type TipoDeVinculoDeTarefa = (typeof tiposDeVinculoDeTarefa)[number];

export const tarefa = pgTable(
  'tarefa',
  {
    id: chave(),
    criadorId: bigint('criador_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    responsavelId: bigint('responsavel_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    titulo: text('titulo').notNull(),
    descricao: text('descricao'),
    prioridade: text('prioridade').$type<PrioridadeDeDemanda>().notNull().default('media'),
    prazo: date('prazo', { mode: 'string' }),
    etapaAtualId: bigint('etapa_atual_id', { mode: 'number' })
      .notNull()
      .references(() => etapa.id),
    vinculoTipo: text('vinculo_tipo').$type<TipoDeVinculoDeTarefa>(),
    vinculoId: bigint('vinculo_id', { mode: 'number' }),
    canceladaEm: instante('cancelada_em'),
    canceladaPor: bigint('cancelada_por', { mode: 'number' }).references(() => usuario.id),
    justificativaCancelamento: text('justificativa_cancelamento'),
    criadoEm: instante('criado_em').notNull().defaultNow(),
    atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
  },
  (t) => [
    index('tarefa_responsavel_idx').on(t.responsavelId),
    index('tarefa_etapa_idx').on(t.etapaAtualId),
  ],
);

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

export const naturezasDeAviso = [
  'tarefa_designada',
  'tarefa_reatribuida',
  'compromisso_indicacao',
  'compromisso_remarcado',
  'compromisso_cancelado',
  'prazo_proximo',
  'prazo_vencido',
  'despesa_aguardando_analise',
  'saldo_abaixo_limite',
  'mencao',
] as const;
export type NaturezaDeAviso = (typeof naturezasDeAviso)[number];

export const tiposDeRegistroDeAviso = [
  'tarefa',
  'demanda',
  'compromisso',
  'despesa',
  'destinacao',
] as const;
export type TipoDeRegistroDeAviso = (typeof tiposDeRegistroDeAviso)[number];

export const aviso = pgTable(
  'aviso',
  {
    id: chave(),
    destinatarioId: bigint('destinatario_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    natureza: text('natureza').$type<NaturezaDeAviso>().notNull(),
    registroTipo: text('registro_tipo').$type<TipoDeRegistroDeAviso>().notNull(),
    registroId: bigint('registro_id', { mode: 'number' }).notNull(),
    geradoEm: instante('gerado_em').notNull().defaultNow(),
    lidoEm: instante('lido_em'),
    expiraEm: instante('expira_em').notNull(),
    chaveUnica: text('chave_unica').unique(),
  },
  (t) => [index('aviso_caixa_idx').on(t.destinatarioId, t.lidoEm)],
);

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export const visibilidadesDeCompromisso = ['aberto', 'participantes', 'restrito'] as const;
export type VisibilidadeDeCompromisso = (typeof visibilidadesDeCompromisso)[number];

export const respostasDeParticipante = ['sem_resposta', 'confirmado', 'recusado'] as const;
export type RespostaDeParticipante = (typeof respostasDeParticipante)[number];

export const compromisso = pgTable('compromisso', {
  id: chave(),
  criadorId: bigint('criador_id', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
  titulo: text('titulo').notNull(),
  descricao: text('descricao'),
  local: text('local'),
  inicio: instante('inicio').notNull(),
  fim: instante('fim').notNull(),
  diaInteiro: boolean('dia_inteiro').notNull().default(false),
  visibilidade: text('visibilidade')
    .$type<VisibilidadeDeCompromisso>()
    .notNull()
    .default('participantes'),
  envolveParlamentar: boolean('envolve_parlamentar').notNull().default(true),
  canceladoEm: instante('cancelado_em'),
  canceladoPor: bigint('cancelado_por', { mode: 'number' }).references(() => usuario.id),
  criadoEm: instante('criado_em').notNull().defaultNow(),
  atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
});

export const participanteInterno = pgTable(
  'participante_interno',
  {
    compromissoId: bigint('compromisso_id', { mode: 'number' })
      .notNull()
      .references(() => compromisso.id),
    usuarioId: bigint('usuario_id', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    resposta: text('resposta').$type<RespostaDeParticipante>().notNull().default('sem_resposta'),
    respondidoEm: instante('respondido_em'),
  },
  (t) => [primaryKey({ columns: [t.compromissoId, t.usuarioId] })],
);

export const participanteExterno = pgTable(
  'participante_externo',
  {
    compromissoId: bigint('compromisso_id', { mode: 'number' })
      .notNull()
      .references(() => compromisso.id),
    pessoaId: bigint('pessoa_id', { mode: 'number' })
      .notNull()
      .references(() => pessoa.id),
  },
  (t) => [primaryKey({ columns: [t.compromissoId, t.pessoaId] })],
);

export const bloqueioIndisponibilidade = pgTable('bloqueio_indisponibilidade', {
  id: chave(),
  criadorId: bigint('criador_id', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
  inicio: instante('inicio').notNull(),
  fim: instante('fim').notNull(),
  canceladoEm: instante('cancelado_em'),
  canceladoPor: bigint('cancelado_por', { mode: 'number' }).references(() => usuario.id),
  criadoEm: instante('criado_em').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Eventos e presença
// ---------------------------------------------------------------------------

export const evento = pgTable('evento', {
  id: chave(),
  criadorId: bigint('criador_id', { mode: 'number' })
    .notNull()
    .references(() => usuario.id),
  nome: text('nome').notNull(),
  inicio: instante('inicio').notNull(),
  local: text('local'),
  situacao: text('situacao').$type<'aberto' | 'encerrado'>().notNull().default('aberto'),
  encerradoEm: instante('encerrado_em'),
  encerradoPor: bigint('encerrado_por', { mode: 'number' }).references(() => usuario.id),
  criadoEm: instante('criado_em').notNull().defaultNow(),
  atualizadoEm: instante('atualizado_em').notNull().defaultNow(),
});

export const participacaoEvento = pgTable(
  'participacao_evento',
  {
    eventoId: bigint('evento_id', { mode: 'number' })
      .notNull()
      .references(() => evento.id),
    pessoaId: bigint('pessoa_id', { mode: 'number' })
      .notNull()
      .references(() => pessoa.id),
    registradoPor: bigint('registrado_por', { mode: 'number' })
      .notNull()
      .references(() => usuario.id),
    registradoEm: instante('registrado_em').notNull().defaultNow(),
    observacao: text('observacao'),
  },
  (t) => [primaryKey({ columns: [t.eventoId, t.pessoaId] })],
);
