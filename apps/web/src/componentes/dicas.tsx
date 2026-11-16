import { Lightbulb } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Botao } from './ui';

/** Texto de apoio que aparece ao passar o mouse ou focar. O nome acessível continua no próprio controle. */
export function Dica({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <span className="dica">
      {children}
      <span className="dica__texto" role="tooltip" aria-hidden="true">
        {texto}
      </span>
    </span>
  );
}

/** Botão só com ícone: o rótulo vira o nome acessível e a dica. */
export function BotaoDeIcone({
  rotulo,
  icone,
  variante = 'secundario',
  ...resto
}: {
  rotulo: string;
  icone: ReactNode;
  variante?: 'secundario' | 'fantasma' | 'perigo';
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'>) {
  return (
    <Dica texto={rotulo}>
      <Botao variante={variante} className="botao--icone" aria-label={rotulo} {...resto}>
        {icone}
      </Botao>
    </Dica>
  );
}

/** Orientação contextual, discreta: serve para explicar uma regra sem ocupar um aviso inteiro. */
export function DicaDeUso({ children }: { children: ReactNode }) {
  return (
    <div className="dica-de-uso">
      <span className="dica-de-uso__icone" aria-hidden="true">
        <Lightbulb size={14} />
      </span>
      <div>{children}</div>
    </div>
  );
}

/** Estado vazio: o que falta e, se couber, o que fazer. */
export function EstadoVazio({
  icone,
  titulo,
  texto,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  texto?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="vazio">
      <span className="vazio__icone" aria-hidden="true">
        {icone}
      </span>
      <p className="vazio__titulo">{titulo}</p>
      {texto ? <p className="vazio__texto">{texto}</p> : null}
      {acao ? <div className="vazio__acao">{acao}</div> : null}
    </div>
  );
}
