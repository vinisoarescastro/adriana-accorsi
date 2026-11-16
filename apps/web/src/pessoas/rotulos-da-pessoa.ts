import type { PessoaDto } from '@gabinete/compartilhado';

export const rotuloDaSituacao = {
  ativa: 'Ativa',
  inativa: 'Inativa',
  dados_eliminados: 'Dados eliminados',
} as const;

/** Em texto, nunca só por cor: consentimento, e-mail ausente ou recusado pelo provedor. */
export function rotuloDosAvisos(p: PessoaDto): string {
  if (p.situacao === 'dados_eliminados') return '-';
  if (!p.email) return 'Sem e-mail';
  if (p.emailInvalido) return 'E-mail recusado';
  return p.consentimento ? 'Ativados' : 'Desativados';
}
