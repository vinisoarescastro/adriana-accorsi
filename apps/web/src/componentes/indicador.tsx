import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Cartão de indicador: no cabeçalho, o ícone, o rótulo e o subtítulo; no conteúdo, o número grande; no rodapé
 * (quando o cartão leva a outra página), o convite a abrir. Só os valores em dinheiro ganham uma barra.
 */
export function CartaoDeIndicador({
  rotulo,
  valor,
  icone,
  apoio,
  para,
  aoClicar,
  alerta,
  progresso,
  verRotulo = 'Ver detalhes',
}: {
  rotulo: string;
  valor: number | string;
  icone?: ReactNode;
  /** O subtítulo: uma linha curta embaixo do rótulo. */
  apoio?: string;
  para?: string;
  /** O cartão inteiro vira um botão (uma ação na mesma página, como abrir a lista filtrada). */
  aoClicar?: () => void;
  /** Realça o número (em vermelho): algo pede atenção. */
  alerta?: boolean;
  /** Só para valores em dinheiro: uma barra de quanto o valor é de um total. */
  progresso?: { readonly parte: number; readonly total: number; readonly texto: string };
  /** O texto do rodapé, quando o cartão leva a outra página. */
  verRotulo?: string;
}) {
  const percentual =
    progresso && progresso.total > 0
      ? Math.min(100, Math.max(0, Math.round((progresso.parte / progresso.total) * 100)))
      : 0;
  const clicavel = Boolean(para || aoClicar);
  const conteudo = (
    <>
      <span className="indicador__cabecalho">
        {icone ? (
          <span className="indicador__icone" aria-hidden="true">
            {icone}
          </span>
        ) : null}
        <span className="indicador__titulos">
          <span className="indicador__rotulo">{rotulo}</span>
          {apoio ? <span className="indicador__apoio">{apoio}</span> : null}
        </span>
      </span>
      <span className="indicador__corpo">
        <span
          className={`indicador__valor${typeof valor === 'string' ? ' indicador__valor--texto' : ''}${alerta ? ' indicador__valor--alerta' : ''}`}
        >
          {valor}
        </span>
        {progresso ? (
          <span className="indicador__progresso">
            <span
              className={`progresso${alerta ? ' progresso--alerta' : ''}`}
              role="img"
              aria-label={`${percentual}% ${progresso.texto}`}
            >
              <span className="progresso__preenchimento" style={{ width: `${percentual}%` }} />
            </span>
            <span className="progresso__percentual" aria-hidden="true">
              {percentual}% {progresso.texto}
            </span>
          </span>
        ) : null}
      </span>
      {clicavel ? (
        <span className="indicador__rodape">
          <span className="indicador__ver">{verRotulo}</span>
          <ChevronRight size={14} aria-hidden="true" />
        </span>
      ) : null}
    </>
  );
  const classe = `cartao indicador${clicavel ? ' indicador--link' : ''}${alerta ? ' indicador--alerta' : ''}`;
  if (aoClicar) {
    return (
      <button type="button" className={`${classe} indicador--botao`} onClick={aoClicar}>
        {conteudo}
      </button>
    );
  }
  return para ? (
    <Link className={classe} to={para}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

/** Grade dos cartões de indicador. */
export function GradeDeIndicadores({ rotulo, children }: { rotulo?: string; children: ReactNode }) {
  return (
    <div className="indicadores" {...(rotulo ? { role: 'group', 'aria-label': rotulo } : {})}>
      {children}
    </div>
  );
}
