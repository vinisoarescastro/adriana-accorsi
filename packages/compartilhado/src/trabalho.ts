import { z } from 'zod';
import {
  normalizarTelefone,
  prioridades,
  type EtapaResumo,
  type MovimentacaoDto,
} from './atendimento.js';

/** Contratos do trabalho da equipe: tarefas, avisos, agenda, eventos e presença (fase 4). */

const texto = (max: number) => z.string().trim().max(max);
const id = z.number().int().positive();
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');
/** Instante com fuso explícito, para a agenda não depender do fuso de quem consulta. */
const instante = z.iso.datetime({ offset: true });

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

export const tiposDeVinculoDeTarefa = ['demanda', 'pessoa', 'compromisso', 'evento'] as const;
export type TipoDeVinculoDeTarefaDto = (typeof tiposDeVinculoDeTarefa)[number];

export const statusDeTarefa = ['em_andamento', 'concluido', 'arquivado', 'cancelada'] as const;
export type StatusDeTarefa = (typeof statusDeTarefa)[number];

/** Colegas mencionados com @ (ids). A API conserva só os que aparecem no texto e podem ser avisados. */
const mencoes = z.array(id).max(20).default([]);

export const esquemaNovaTarefa = z.object({
  titulo: texto(200).min(1),
  descricao: texto(5000).optional(),
  mencoes,
  prioridade: z.enum(prioridades).default('media'),
  prazo: data.optional(),
  /** Se omitido, quem cria é o responsável. O Assessor Externo só cria para si. */
  responsavelId: id.optional(),
  /** Outros responsáveis, além do principal. */
  corresponsaveis: z.array(id).max(10).default([]),
  vinculo: z.object({ tipo: z.enum(tiposDeVinculoDeTarefa), id }).optional(),
});
export type CorpoNovaTarefa = z.infer<typeof esquemaNovaTarefa>;

export const esquemaAtualizarTarefa = z
  .object({
    titulo: texto(200).min(1).optional(),
    descricao: texto(5000).nullable().optional(),
    mencoes,
    prioridade: z.enum(prioridades).optional(),
    prazo: data.nullable().optional(),
  })
  .refine(
    (v) =>
      Object.values(v)
        .filter((x) => !Array.isArray(x))
        .some((x) => x !== undefined),
    'Informe ao menos um campo.',
  );
export type CorpoAtualizarTarefa = z.infer<typeof esquemaAtualizarTarefa>;

export const esquemaMoverTarefa = z.object({
  etapaId: id,
  observacao: texto(1000).optional(),
  mencoes,
});
/** Troca o responsável principal e/ou a lista dos demais responsáveis (substitui a lista). */
export const esquemaReatribuirTarefa = z
  .object({ responsavelId: id.optional(), corresponsaveis: z.array(id).max(10).optional() })
  .refine(
    (v) => v.responsavelId !== undefined || v.corresponsaveis !== undefined,
    'Informe quem passa a responder.',
  );
export const esquemaCancelarTarefa = z.object({
  justificativa: texto(1000).min(10, 'A justificativa deve ter ao menos 10 caracteres.'),
});

export interface TarefaResumo {
  readonly id: number;
  readonly titulo: string;
  readonly prioridade: (typeof prioridades)[number];
  readonly prazo: string | null;
  readonly etapa: EtapaResumo;
  /** Derivado do papel da etapa (ou "cancelada"). Nunca armazenado. */
  readonly status: StatusDeTarefa;
  /** Derivado na leitura: prazo vencido e ainda em andamento. */
  readonly atrasada: boolean;
  readonly responsavel: { readonly id: number; readonly nome: string };
  /** Os demais responsáveis (além do principal). */
  readonly corresponsaveis: readonly { readonly id: number; readonly nome: string }[];
  readonly criador: string;
  readonly vinculo: { readonly tipo: TipoDeVinculoDeTarefaDto; readonly id: number } | null;
  readonly criadoEm: string;
}

export interface TarefaFicha extends TarefaResumo {
  readonly descricao: string | null;
  readonly canceladaEm: string | null;
  readonly justificativaCancelamento: string | null;
  readonly movimentacoes: readonly MovimentacaoDto[];
}

export interface PaginaDeTarefas {
  readonly itens: readonly TarefaResumo[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
}

export interface PainelDeTarefas {
  readonly abertas: number;
  readonly atrasadas: number;
  readonly minhasAbertas: number;
  readonly minhasAtrasadas: number;
}

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
  'demanda_designada',
] as const;
export type NaturezaDeAvisoDto = (typeof naturezasDeAviso)[number];

/** O que cada aviso diz. O aviso em si não carrega texto: a frase sai da natureza. */
export const frasesDeAviso: Readonly<Record<NaturezaDeAvisoDto, string>> = {
  tarefa_designada: 'Uma tarefa foi designada a você',
  tarefa_reatribuida: 'Uma tarefa foi passada para você',
  compromisso_indicacao: 'Você foi indicado em um compromisso',
  compromisso_remarcado: 'Um compromisso seu foi remarcado',
  compromisso_cancelado: 'Um compromisso seu foi cancelado',
  prazo_proximo: 'Um prazo está chegando',
  prazo_vencido: 'Um prazo venceu',
  despesa_aguardando_analise: 'Uma despesa aguarda a sua análise',
  saldo_abaixo_limite: 'Um saldo ficou abaixo do limite',
  mencao: 'Você foi mencionado',
  demanda_designada: 'Você foi incluído como responsável por uma demanda',
};

export interface AvisoDto {
  readonly id: number;
  readonly natureza: NaturezaDeAvisoDto;
  readonly frase: string;
  readonly registro: {
    readonly tipo: 'tarefa' | 'demanda' | 'compromisso' | 'despesa' | 'destinacao';
    readonly id: number;
    /** Lido na hora, do registro que o destinatário alcança. `null` se não houver título a mostrar. */
    readonly titulo: string | null;
  };
  /** Quem gerou o aviso (por exemplo, quem mencionou); `null` nos automáticos (prazos). */
  readonly de: string | null;
  readonly geradoEm: string;
  readonly lido: boolean;
}

export interface CaixaDeAvisos {
  readonly itens: readonly AvisoDto[];
  readonly naoLidos: number;
}

export const esquemaMarcarAvisos = z.union([
  z.object({ ids: z.array(id).min(1).max(200) }),
  z.object({ todos: z.literal(true) }),
]);
export type CorpoMarcarAvisos = z.infer<typeof esquemaMarcarAvisos>;

export const antecedenciaPadraoDoAvisoDePrazo = 3;
export const esquemaAntecedenciaDoAviso = z.object({
  antecedenciaDias: z.number().int().min(1).max(30),
});
export type ConfiguracaoDeAvisos = z.infer<typeof esquemaAntecedenciaDoAviso>;

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export const visibilidadesDeCompromisso = ['aberto', 'participantes', 'restrito'] as const;
export type VisibilidadeDeCompromissoDto = (typeof visibilidadesDeCompromisso)[number];

export const respostasDeParticipante = ['sem_resposta', 'confirmado', 'recusado'] as const;
export type RespostaDeParticipanteDto = (typeof respostasDeParticipante)[number];

/** A consulta da agenda cobre no máximo este período (em dias). */
export const periodoMaximoDaAgendaEmDias = 62;

const periodo = z
  .object({ inicio: instante, fim: instante })
  .refine((v) => new Date(v.fim) >= new Date(v.inicio), {
    message: 'O fim não pode ser anterior ao início.',
    path: ['fim'],
  });

export const esquemaNovoCompromisso = z
  .object({
    titulo: texto(200).min(1),
    descricao: texto(2000).optional(),
    mencoes,
    local: texto(300).optional(),
    inicio: instante,
    fim: instante,
    diaInteiro: z.boolean().default(false),
    visibilidade: z.enum(visibilidadesDeCompromisso).default('participantes'),
    /** Ligada por padrão: o compromisso aparece na agenda da Parlamentar, sem gerar aviso. */
    envolveParlamentar: z.boolean().default(true),
    participantesInternos: z.array(id).max(50).default([]),
    participantesExternos: z.array(id).max(50).default([]),
  })
  .refine((v) => new Date(v.fim) >= new Date(v.inicio), {
    message: 'O fim não pode ser anterior ao início.',
    path: ['fim'],
  });
export type CorpoNovoCompromisso = z.infer<typeof esquemaNovoCompromisso>;

export const esquemaAtualizarCompromisso = z
  .object({
    titulo: texto(200).min(1).optional(),
    descricao: texto(2000).nullable().optional(),
    mencoes,
    local: texto(300).nullable().optional(),
    inicio: instante.optional(),
    fim: instante.optional(),
    diaInteiro: z.boolean().optional(),
    visibilidade: z.enum(visibilidadesDeCompromisso).optional(),
    envolveParlamentar: z.boolean().optional(),
    /** Se informada, substitui a lista. Só os novos indicados recebem aviso. */
    participantesInternos: z.array(id).max(50).optional(),
    participantesExternos: z.array(id).max(50).optional(),
  })
  .refine(
    (v) => Object.entries(v).some(([chave, x]) => chave !== 'mencoes' && x !== undefined),
    'Informe ao menos um campo.',
  );
export type CorpoAtualizarCompromisso = z.infer<typeof esquemaAtualizarCompromisso>;

export const esquemaResponderCompromisso = z.object({ resposta: z.enum(respostasDeParticipante) });

export const esquemaNovoBloqueio = periodo;
export type CorpoNovoBloqueio = z.infer<typeof esquemaNovoBloqueio>;

export const esquemaConsultaDaAgenda = z.object({
  de: instante,
  ate: instante,
  /** "Minha agenda": os compromissos que envolvem a Parlamentar ou em que o usuário é participante. */
  minha: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export interface ParticipanteInternoDto {
  readonly id: number;
  readonly nome: string;
  readonly resposta: RespostaDeParticipanteDto;
}

export interface CompromissoDto {
  readonly id: number;
  readonly titulo: string;
  /** O que será tratado, em texto livre. */
  readonly descricao: string | null;
  readonly local: string | null;
  readonly inicio: string;
  readonly fim: string;
  readonly diaInteiro: boolean;
  readonly visibilidade: VisibilidadeDeCompromissoDto;
  readonly envolveParlamentar: boolean;
  readonly criador: string;
  readonly cancelado: boolean;
  readonly participantesInternos: readonly ParticipanteInternoDto[];
  readonly participantesExternos: readonly { readonly id: number; readonly nome: string | null }[];
  /** A resposta do usuário que consulta, se ele foi indicado. */
  readonly minhaResposta: RespostaDeParticipanteDto | null;
}

/** O que se vê na agenda: o compromisso inteiro, só o horário ocupado, ou o bloqueio. */
export type ItemDaAgenda =
  | ({ readonly tipo: 'compromisso' } & CompromissoDto)
  | {
      readonly tipo: 'ocupado';
      readonly inicio: string;
      readonly fim: string;
      readonly diaInteiro: boolean;
    }
  | {
      readonly tipo: 'bloqueio';
      readonly id: number;
      readonly inicio: string;
      readonly fim: string;
    };

export interface ConflitoDeAgenda {
  readonly tipo: 'compromisso' | 'bloqueio';
  readonly inicio: string;
  readonly fim: string;
}

export interface AgendaConsultada {
  readonly itens: readonly ItemDaAgenda[];
}

/** Resposta de criar e alterar: o compromisso e os conflitos de horário (só aviso, não impede). */
export interface CompromissoSalvo {
  readonly compromisso: CompromissoDto;
  readonly conflitos: readonly ConflitoDeAgenda[];
}

// ---------------------------------------------------------------------------
// Eventos e presença
// ---------------------------------------------------------------------------

export const esquemaNovoEvento = z.object({
  nome: texto(200).min(1),
  inicio: instante,
  local: texto(300).optional(),
});
export type CorpoNovoEvento = z.infer<typeof esquemaNovoEvento>;

export const esquemaAtualizarEvento = z
  .object({
    nome: texto(200).min(1).optional(),
    inicio: instante.optional(),
    local: texto(300).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export type CorpoAtualizarEvento = z.infer<typeof esquemaAtualizarEvento>;

const telefone = z
  .string()
  .trim()
  .transform((v, contexto) => {
    const normalizado = normalizarTelefone(v);
    if (normalizado === null) {
      contexto.addIssue({
        code: 'custom',
        message: 'Telefone inválido. Informe o DDD e o número.',
      });
      return z.NEVER;
    }
    return normalizado;
  });

/** Presença por telefone. Se a pessoa não está cadastrada, informa-se o nome e ela é criada no ato. */
export const esquemaRegistrarPresenca = z.object({
  telefone,
  nome: texto(160).min(1).optional(),
  observacao: texto(300).optional(),
});
export type CorpoRegistrarPresenca = z.infer<typeof esquemaRegistrarPresenca>;

export const esquemaCorrigirPresenca = z
  .object({
    observacao: texto(300).nullable().optional(),
    /** Corrige a pessoa registrada por engano: outro telefone (e o nome, se for uma pessoa nova). */
    telefone: telefone.optional(),
    nome: texto(160).min(1).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export type CorpoCorrigirPresenca = z.infer<typeof esquemaCorrigirPresenca>;

export const esquemaRemoverPresenca = z.object({
  justificativa: texto(1000).min(10, 'A justificativa deve ter ao menos 10 caracteres.'),
});

/** Presença corrigível pelo próprio registrador (em minutos). */
export const janelaDeCorrecaoDaPresencaEmMinutos = 30;

export interface PresencaDto {
  readonly pessoaId: number;
  readonly nome: string | null;
  readonly telefone: string | null;
  readonly observacao: string | null;
  readonly registradoPor: string;
  readonly registradoEm: string;
  /** O usuário que consulta pode corrigir esta presença agora. */
  readonly corrigivel: boolean;
}

export interface EventoDto {
  readonly id: number;
  readonly nome: string;
  readonly inicio: string;
  readonly local: string | null;
  readonly situacao: 'aberto' | 'encerrado';
  readonly encerradoEm: string | null;
  readonly criador: string;
  readonly presentes: number;
}

export interface EventoFicha extends EventoDto {
  /** Só para quem vê a lista nominal (Assessor Interno em diante); os demais veem as que registraram. */
  readonly presencas: readonly PresencaDto[];
  readonly listaNominalCompleta: boolean;
}

export interface PaginaDeEventos {
  readonly itens: readonly EventoDto[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
}

export interface PresencaRegistrada {
  readonly evento: EventoFicha;
  readonly pessoaCriada: boolean;
}

export const esquemaFiltroDeEventos = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(25),
  situacao: z.enum(['aberto', 'encerrado']).optional(),
});
