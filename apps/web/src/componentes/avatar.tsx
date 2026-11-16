import { useState } from 'react';
import { iniciais } from '../formatos';

/**
 * Avatar da pessoa da equipe: a foto, quando há, ou as iniciais. Sempre decorativo: o nome vem
 * escrito ao lado, então o leitor de tela não repete.
 */
export function Avatar({
  nome,
  id,
  temFoto,
  pequeno,
}: {
  nome: string;
  id?: number;
  temFoto?: boolean;
  pequeno?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const classe = `foto${pequeno ? ' foto--pequena' : ''}`;
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
