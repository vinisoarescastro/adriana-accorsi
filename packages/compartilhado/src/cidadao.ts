import { z } from 'zod';

/**
 * Contratos da fase 3: o que o cidadão enxerga, a política que decide isso, os andamentos
 * publicáveis, o consentimento de notificação e a fila de e-mails.
 */

// ---------------------------------------------------------------------------
// Política de publicação
// ---------------------------------------------------------------------------

export const exibicoesDeNome = ['completo', 'primeiro_nome', 'nao_exibir'] as const;
export const exibicoesDeTelefone = ['completo', 'mascarado', 'nao_exibir'] as const;
export const limitesDeExpiracaoEmDias = { minimo: 7, maximo: 1825, padrao: 90 } as const;

export const esquemaPoliticaDePublicacao = z.object({
  exibirTitulo: z.boolean(),
  exibicaoNome: z.enum(exibicoesDeNome),
  exibicaoTelefone: z.enum(exibicoesDeTelefone),
  expiracaoDias: z
    .number()
    .int()
    .min(limitesDeExpiracaoEmDias.minimo)
    .max(limitesDeExpiracaoEmDias.maximo),
});
export type CorpoPoliticaDePublicacao = z.infer<typeof esquemaPoliticaDePublicacao>;

export interface PoliticaDePublicacaoDto extends CorpoPoliticaDePublicacao {
  readonly id: number;
  readonly vigenteDesde: string;
  readonly vigenteAte: string | null;
  readonly criadoPor: string | null;
}

export interface PoliticaEHistorico {
  readonly vigente: PoliticaDePublicacaoDto;
  /** Da mais recente para a mais antiga, sem a vigente. */
  readonly anteriores: readonly PoliticaDePublicacaoDto[];
}

// ---------------------------------------------------------------------------
// A projeção pública: o ÚNICO conjunto que chega ao cidadão
// ---------------------------------------------------------------------------

export type SituacaoPublica = 'em_andamento' | 'concluida' | 'arquivada' | 'cancelada';
export type EstadoDeEtapaPublica = 'concluida' | 'atual' | 'prevista';

export interface EtapaPublica {
  readonly rotulo: string;
  readonly estado: EstadoDeEtapaPublica;
  /** Só concluídas e a atual levam data; previsão não é compromisso. */
  readonly data: string | null;
}

export interface AndamentoPublico {
  readonly texto: string;
  readonly publicadoEm: string;
}

export interface AcompanhamentoPublico {
  readonly protocolo: string;
  readonly situacao: SituacaoPublica;
  readonly criadoEm: string;
  readonly atualizadoEm: string;
  /** Conforme a política vigente: `null` quando não é exibido. */
  readonly titulo: string | null;
  readonly nome: string | null;
  readonly telefone: string | null;
  readonly etapas: readonly EtapaPublica[];
  readonly andamentos: readonly AndamentoPublico[];
  readonly gabinete: {
    readonly nome: string | null;
    readonly parlamentar: string | null;
    readonly telefone: string | null;
    readonly email: string | null;
  };
}

// ---------------------------------------------------------------------------
// Link de acompanhamento e andamentos
// ---------------------------------------------------------------------------

export type EstadoDoLink = 'ativa' | 'suspensa' | 'revogada';

export const esquemaNovoAndamento = z.object({
  texto: z.string().trim().min(1).max(600),
});
export type CorpoNovoAndamento = z.infer<typeof esquemaNovoAndamento>;

export interface AndamentoDto {
  readonly id: number;
  readonly texto: string;
  readonly autor: string;
  readonly publicadoEm: string;
  readonly removido: boolean;
  readonly removidoPor: string | null;
  readonly removidoEm: string | null;
}

export interface NotificacaoDaPessoa {
  readonly pessoaId: number;
  readonly temEmail: boolean;
  readonly emailInvalido: boolean;
  readonly consentimento: boolean;
  readonly registradoEm: string | null;
  readonly origem: OrigemDeConsentimentoDto | null;
}

export interface AcompanhamentoInterno {
  readonly estado: EstadoDoLink;
  /** `null` quando o link foi revogado (o segredo não existe mais). */
  readonly link: string | null;
  /** O que o cidadão veria agora, pela MESMA projeção; `null` se hoje ele não vê nada (suspenso, expirado). */
  readonly previa: AcompanhamentoPublico | null;
  readonly andamentos: readonly AndamentoDto[];
  readonly notificacao: NotificacaoDaPessoa | null;
}

// ---------------------------------------------------------------------------
// Consentimento de notificação (LGPD)
// ---------------------------------------------------------------------------

export const origensDeConsentimentoRegistravel = [
  'atendimento_telefonico',
  'atendimento_presencial',
  'pedido_ao_gabinete',
] as const;
export type OrigemDeConsentimentoDto =
  (typeof origensDeConsentimentoRegistravel)[number] | 'descadastro_cidadao' | 'dados_eliminados';

/** Texto que o atendente lê ao cidadão. A versão vai junto de cada "sim". Minuta: revisão jurídica (PV-F). */
export const textoDeConsentimento = {
  versao: 1,
  texto:
    'Posso avisar o senhor(a) por e-mail quando houver novidade sobre esta solicitação? Usaremos o seu e-mail somente para informar o andamento do pedido que o(a) senhor(a) fez ao gabinete da Deputada Adriana Accorsi. Não enviaremos propaganda. O(A) senhor(a) pode deixar de receber a qualquer momento, pelo link que vai em cada mensagem ou avisando o gabinete.',
} as const;

export const esquemaConsentimento = z.discriminatedUnion('consentido', [
  z.object({
    consentido: z.literal(true),
    origem: z.enum(origensDeConsentimentoRegistravel),
    /** Precisa ser a versão vigente do texto: quem registra confirma que o leu ao cidadão. */
    versaoTexto: z.literal(textoDeConsentimento.versao),
  }),
  z.object({
    consentido: z.literal(false),
    origem: z.enum(origensDeConsentimentoRegistravel),
  }),
]);
export type CorpoConsentimento = z.infer<typeof esquemaConsentimento>;

export interface RegistroDeConsentimento {
  readonly id: number;
  readonly consentido: boolean;
  readonly origem: OrigemDeConsentimentoDto;
  readonly versaoTexto: number | null;
  readonly registradoPor: string | null;
  readonly registradoEm: string;
}

// ---------------------------------------------------------------------------
// Fila de e-mails
// ---------------------------------------------------------------------------

export const eventosDeNotificacao = [
  'andamento_publicado',
  'etapa_visivel',
  'conclusao',
  'cancelamento',
] as const;
export type EventoDeNotificacaoDto = (typeof eventosDeNotificacao)[number];
export const estadosDeEnvio = ['pendente', 'enviando', 'enviado', 'falhou', 'cancelado'] as const;
export type EstadoDeEnvioDto = (typeof estadosDeEnvio)[number];

export interface EnvioDeEmail {
  readonly id: number;
  readonly protocolo: string;
  readonly evento: EventoDeNotificacaoDto;
  readonly estado: EstadoDeEnvioDto;
  readonly tentativas: number;
  readonly proximaTentativa: string | null;
  readonly erro: string | null;
  readonly criadoEm: string;
  readonly enviadoEm: string | null;
}

export interface PaginaDeEnvios {
  readonly itens: readonly EnvioDeEmail[];
  readonly total: number;
  readonly pagina: number;
  readonly porPagina: number;
  /** Contagem por estado, para o resumo da tela. */
  readonly porEstado: Readonly<Record<EstadoDeEnvioDto, number>>;
}
