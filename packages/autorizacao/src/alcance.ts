import type { Perfil } from '@gabinete/compartilhado';

/**
 * Composição de alcance: o ponto ÚNICO que diz o que um perfil enxerga dentro de um módulo.
 * Só o Assessor Externo é limitado ao que é seu; os demais alcançam o módulo inteiro
 * (a habilitação já foi conferida pelo decisor). Listagem, painel, busca e exportação usam
 * esta mesma função. Tarefa, documento e comentário herdam o alcance do registro vinculado.
 */
export type Alcance = 'proprio' | 'total';

export function composicaoDeAlcance(perfil: Perfil): Alcance {
  return perfil === 'assessor_externo' ? 'proprio' : 'total';
}
