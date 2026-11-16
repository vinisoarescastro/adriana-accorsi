import { Avatar } from './avatar';
import { nomeCurto } from '../formatos';

export interface PessoaResumida {
  readonly id: number;
  readonly nome: string;
}

/** O responsável principal primeiro e, depois, os demais. */
export const todosOsResponsaveis = (
  principal: PessoaResumida,
  outros: readonly PessoaResumida[] | undefined,
): PessoaResumida[] => [principal, ...(outros ?? [])];

/** O usuário responde pelo item (principal ou um dos demais)? */
export const respondePeloItem = (
  item: { responsavel: PessoaResumida; corresponsaveis?: readonly PessoaResumida[] | undefined },
  usuarioId: number,
): boolean =>
  item.responsavel.id === usuarioId || (item.corresponsaveis ?? []).some((c) => c.id === usuarioId);

/** Avatares sobrepostos (até `maximo`), com o restante num "+N"; o nome completo fica na dica. */
export function GrupoDeAvatares({
  nomes,
  maximo = 3,
}: {
  nomes: readonly string[];
  maximo?: number;
}) {
  const aparecem = nomes.slice(0, maximo);
  const resto = nomes.length - aparecem.length;
  return (
    <span className="grupo-de-avatares" title={nomes.join(', ')}>
      {aparecem.map((n) => (
        <span key={n} className="grupo-de-avatares__item">
          <Avatar nome={n} mini colorido />
        </span>
      ))}
      {resto > 0 ? <span className="grupo-de-avatares__mais">+{resto}</span> : null}
    </span>
  );
}

/** "Fulano Tal", ou "Fulano Tal +2" quando há mais de um responsável. */
export function rotuloDosResponsaveis(nomes: readonly string[]): string {
  const [primeiro, ...resto] = nomes;
  if (!primeiro) return '';
  return resto.length === 0 ? nomeCurto(primeiro) : `${nomeCurto(primeiro)} +${resto.length}`;
}
