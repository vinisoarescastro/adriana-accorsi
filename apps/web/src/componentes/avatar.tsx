import { useState } from 'react';
import { iniciais } from '../formatos';

const tons = ['', 'foto--t1', 'foto--t2', 'foto--t3', 'foto--t4'];
const tomDoNome = (nome: string) =>
  tons[Array.from(nome).reduce((n, c) => n + c.charCodeAt(0), 0) % tons.length] ?? '';

/**
 * Avatar da pessoa da equipe: a foto, quando há, ou as iniciais. Sempre decorativo: o nome vem
 * escrito ao lado, então o leitor de tela não repete.
 */
export function Avatar({
  nome,
  id,
  temFoto,
  pequeno,
  mini,
  colorido,
}: {
  nome: string;
  id?: number;
  temFoto?: boolean;
  pequeno?: boolean;
  /** 1,5 rem, como nos cartões do quadro. */
  mini?: boolean;
  /** Uma cor estável a partir do nome, para distinguir pessoas lado a lado. */
  colorido?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const classe = `foto${pequeno ? ' foto--pequena' : ''}${mini ? ' foto--mini' : ''}${colorido ? ` ${tomDoNome(nome)}` : ''}`;
  if (temFoto && id !== undefined && !falhou) {
    return (
      <img
        className={classe}
        src={`/api/equipe/${id}/foto`}
        alt=""
        loading="lazy"
        onError={() => setFalhou(true)}
      />
    );
  }
  return (
    <span className={classe} aria-hidden="true">
      {iniciais(nome)}
    </span>
  );
}
