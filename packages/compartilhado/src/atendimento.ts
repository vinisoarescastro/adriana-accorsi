import { z } from 'zod';
import { esquemaConsentimento } from './cidadao.js';

/** Contratos do atendimento: pessoas, demandas, comentários internos, documentos e painel. */

// ---------------------------------------------------------------------------
// Telefone
// ---------------------------------------------------------------------------

/**
 * Telefone brasileiro normalizado: só dígitos, com DDD e sem código do país nem zero de operadora.
 * 10 dígitos (fixo, que começa com 2 a 5) ou 11 (celular, com o 9). Devolve `null` se não for um telefone possível.
 * É o que identifica a pessoa: "(67) 99999-0000" e "+55 67 99999-0000" dão o mesmo resultado.
 */
export function normalizarTelefone(entrada: string): string | null {
  let digitos = entrada.replace(/\D/g, '');
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) {
    digitos = digitos.slice(2);
  }
  if ((digitos.length === 11 || digitos.length === 12) && digitos.startsWith('0')) {
    digitos = digitos.slice(1);
  }
  if (digitos.length !== 10 && digitos.length !== 11) return null;
  const ddd = Number(digitos.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  const terceiro = digitos[2] ?? '';
  if (digitos.length === 11 && terceiro !== '9') return null;
  if (digitos.length === 10 && !/[2-5]/.test(terceiro)) return null;
  return digitos;
}

/** Para exibir: (67) 99999-0000. */
export function formatarTelefone(normalizado: string): string {
  if (normalizado.length === 11) {
    return `(${normalizado.slice(0, 2)}) ${normalizado.slice(2, 7)}-${normalizado.slice(7)}`;
  }
  return `(${normalizado.slice(0, 2)}) ${normalizado.slice(2, 6)}-${normalizado.slice(6)}`;
}

// ---------------------------------------------------------------------------
// Pessoas
// ---------------------------------------------------------------------------

const texto = (max: number) => z.string().trim().max(max);

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

export const esquemaNovaPessoa = z.object({
  nome: texto(160).min(1),
  telefone,
  email: z.email().max(254).optional(),
  contatos: texto(500).optional(),
  endereco: texto(300).optional(),
  /** Consentimento de notificação por e-mail, já na hora do cadastro (exige e-mail). */
  consentimento: esquemaConsentimento.optional(),
});
export type CorpoNovaPessoa = z.infer<typeof esquemaNovaPessoa>;

export const esquemaAtualizarPessoa = z
  .object({
    nome: texto(160).min(1).optional(),
    telefone: telefone.optional(),
    email: z.email().max(254).nullable().optional(),
    contatos: texto(500).nullable().optional(),
    endereco: texto(300).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export type CorpoAtualizarPessoa = z.infer<typeof esquemaAtualizarPessoa>;

export const esquemaSituacaoDePessoa = z.object({ situacao: z.enum(['ativa', 'inativa']) });

/** A eliminação de dados é irreversível: exige a confirmação explícita. */
export const esquemaEliminarDados = z.object({ confirmo: z.literal(true) });

export type SituacaoDePessoaDto = 'ativa' | 'inativa' | 'dados_eliminados';

export interface PessoaDto {
  readonly id: number;
  /** `null` quando os dados foram eliminados. */
  readonly nomeCompleto: string | null;
  readonly telefone: string | null;
  readonly email: string | null;
  /** O provedor recusou este e-mail em definitivo: não se envia até alguém corrigi-lo. */
  readonly emailInvalido: boolean;
  /** Consentimento vigente para notificação por e-mail (histórico em /api/pessoas/:id/consentimento). */
  readonly consentimento: boolean;
  readonly contatos: string | null;
  readonly endereco: string | null;
  readonly situacao: SituacaoDePessoaDto;
  readonly criadoEm: string;
}

export interface PaginaDePessoas {
  readonly itens: readonly PessoaDto[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
}

// ---------------------------------------------------------------------------
// Demandas
// ---------------------------------------------------------------------------

export const prioridades = ['baixa', 'media', 'alta', 'urgente'] as const;
export type Prioridade = (typeof prioridades)[number];

export const statusDeDemanda = ['em_andamento', 'concluido', 'arquivado', 'cancelada'] as const;
export type StatusDeDemanda = (typeof statusDeDemanda)[number];

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');
const id = z.number().int().positive();

export const esquemaNovaDemanda = z.object({
  /** Pessoa já cadastrada, ou os dados para cadastrá-la na mesma operação. */
  solicitante: z.union([
    z.object({ pessoaId: id }),
    z.object({
      nome: texto(160).min(1),
      telefone,
      email: z.email().max(254).optional(),
      consentimento: esquemaConsentimento.optional(),
    }),
  ]),
  titulo: texto(200).min(1),
  descricao: texto(5000).optional(),
  prioridade: z.enum(prioridades).default('media'),
  prazo: data.optional(),
  /** Se omitido, quem registra é o responsável. */
  responsavelId: id.optional(),
});
export type CorpoNovaDemanda = z.infer<typeof esquemaNovaDemanda>;

export const esquemaAtualizarDemanda = z
  .object({
    titulo: texto(200).min(1).optional(),
    descricao: texto(5000).nullable().optional(),
    prioridade: z.enum(prioridades).optional(),
    prazo: data.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Informe ao menos um campo.');
export type CorpoAtualizarDemanda = z.infer<typeof esquemaAtualizarDemanda>;

export const esquemaMoverDemanda = z.object({
  etapaId: id,
  observacao: texto(1000).optional(),
});

export const esquemaReatribuirDemanda = z.object({ responsavelId: id });

export const esquemaCancelarDemanda = z.object({
  justificativa: texto(1000).min(10, 'A justificativa deve ter ao menos 10 caracteres.'),
});

export interface EtapaResumo {
  readonly id: number;
  readonly nome: string;
  readonly papel: 'entrada' | 'intermediaria' | 'conclusao' | 'arquivamento';
}

export interface DemandaResumo {
  readonly id: number;
  /** Em três grupos de quatro: K7M2-9PQ4-XA3N. */
  readonly protocolo: string;
  readonly titulo: string;
  readonly prioridade: Prioridade;
  readonly prazo: string | null;
  readonly etapa: EtapaResumo;
  /** Derivado do papel da etapa (ou "cancelada"). Nunca armazenado. */
  readonly status: StatusDeDemanda;
  /** Derivado na leitura: prazo vencido e ainda em andamento. */
  readonly atrasada: boolean;
  readonly solicitante: { readonly id: number; readonly nome: string | null };
  readonly responsavel: { readonly id: number; readonly nome: string };
  readonly criadoEm: string;
}

export interface PaginaDeDemandas {
  readonly itens: readonly DemandaResumo[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
}

export interface ColunaDoQuadro {
  readonly etapa: EtapaResumo & { readonly ordem: number };
  readonly total: number;
  readonly itens: readonly DemandaResumo[];
}

export interface QuadroDeDemandas {
  readonly colunas: readonly ColunaDoQuadro[];
  readonly limitePorColuna: number;
}

export interface MovimentacaoDto {
  readonly id: number;
  readonly de: string | null;
  readonly para: string;
  readonly papelDoDestino: EtapaResumo['papel'];
  readonly autor: string;
  readonly observacao: string | null;
  readonly criadaEm: string;
}

export interface ComentarioDto {
  readonly id: number;
  readonly autor: { readonly id: number; readonly nome: string };
  /** `null` quando o comentário foi removido (a marca fica; o texto não é mais mostrado). */
  readonly texto: string | null;
  readonly criadoEm: string;
  readonly removido: boolean;
  readonly removidoPor: string | null;
  readonly removidoEm: string | null;
  readonly mencoes: readonly { readonly id: number; readonly nome: string }[];
}

export const naturezasDeDocumento = [
  'comprovante',
  'nota_fiscal',
  'minuta',
  'justificativa',
  'parecer',
  'oficio',
  'plano_de_trabalho',
  'foto',
  'lista_assinada',
  'outro',
] as const;
export type NaturezaDeDocumento = (typeof naturezasDeDocumento)[number];

export const tamanhoMaximoDoDocumento = 25 * 1024 * 1024;

export interface DocumentoDto {
  readonly id: number;
  readonly nome: string;
  readonly natureza: NaturezaDeDocumento;
  readonly tipo: 'application/pdf' | 'image/png' | 'image/jpeg' | 'application/zip';
  readonly tamanho: number;
  readonly enviadoPor: string;
  readonly enviadoEm: string;
  readonly removido: boolean;
  readonly removidoEm: string | null;
}

export const esquemaNovoComentario = z.object({
  texto: texto(5000).min(1),
  /** Colegas mencionados com @ (ids). A API conserva só os que alcançam o registro. */
  mencoes: z.array(id).max(20).default([]),
});
export type CorpoNovoComentario = z.infer<typeof esquemaNovoComentario>;

export interface DemandaFicha extends DemandaResumo {
  readonly descricao: string | null;
  readonly autor: string;
  readonly solicitanteTelefone: string | null;
  readonly canceladaEm: string | null;
  readonly justificativaCancelamento: string | null;
  /** Só para quem tem a ficha completa (Assessor Interno em diante). */
  readonly completa: boolean;
  readonly comentarios: readonly ComentarioDto[];
  readonly documentos: readonly DocumentoDto[];
  readonly movimentacoes: readonly MovimentacaoDto[];
}

/** Resposta do registro: a ficha e o link de acompanhamento, mostrado nesta hora. */
export interface DemandaRegistrada {
  readonly demanda: DemandaFicha;
  /** Endereço de acompanhamento do cidadão. Vale quando a área pública existir (fase 3). */
  readonly linkDeAcompanhamento: string;
  readonly pessoaCriada: boolean;
}

// ---------------------------------------------------------------------------
// Painel de atendimento
// ---------------------------------------------------------------------------

export interface PainelDeAtendimento {
  readonly abertas: number;
  readonly atrasadas: number;
  /** Em andamento e sem movimentação há mais que o limite. */
  readonly paradas: number;
  readonly limiteParadoDias: number;
  readonly novasNaSemana: number;
  readonly concluidasNoMes: number;
  readonly minhasAbertas: number;
  readonly porEtapa: readonly (EtapaResumo & { readonly total: number })[];
}
