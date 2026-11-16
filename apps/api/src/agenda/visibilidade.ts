import type { Perfil, VisibilidadeDeCompromissoDto } from '@gabinete/compartilhado';

/** O quanto de um compromisso uma pessoa enxerga. */
export type NivelDeVisao = 'completo' | 'ocupado' | 'oculto';

/** Quem vê o compromisso Restrito de outros, sem ser participante (RN-AGE-03). */
const perfisQueVeemTudo: readonly Perfil[] = ['chefe', 'administrador', 'parlamentar'];

export const veTudo = (perfil: Perfil): boolean => perfisQueVeemTudo.includes(perfil);

/**
 * A regra ÚNICA de visibilidade da agenda (RN-AGE-02 e RN-AGE-03):
 * - Aberto: todos veem o compromisso inteiro.
 * - Participantes: o conteúdo é de quem participa, de quem criou e de quem vê tudo; os demais
 *   só sabem que o horário está ocupado.
 * - Restrito: igual, mas os demais NÃO o veem, nem como horário ocupado.
 */
export function nivelDeVisao(
  compromisso: { readonly visibilidade: VisibilidadeDeCompromissoDto; readonly criadorId: number },
  ator: { readonly usuarioId: number; readonly perfil: Perfil },
  ehParticipante: boolean,
): NivelDeVisao {
  if (compromisso.visibilidade === 'aberto') return 'completo';
  const veConteudo =
    ehParticipante || compromisso.criadorId === ator.usuarioId || veTudo(ator.perfil);
  if (veConteudo) return 'completo';
  return compromisso.visibilidade === 'participantes' ? 'ocupado' : 'oculto';
}
