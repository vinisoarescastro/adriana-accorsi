import type { ReactNode } from 'react';
import { Abas } from '../componentes/abas';
import { Cartao } from '../componentes/cartao';
import { usarPreferencia } from '../componentes/usar-preferencia';
import { BarrasHorizontais, type LinhaDeBarra } from '../graficos/BarrasHorizontais';
import { ColunasVerticais } from '../graficos/ColunasVerticais';
import { Rosca } from '../graficos/Rosca';

export type VisaoDeDistribuicao = 'barras' | 'rosca' | 'colunas';

const rotulos: Record<VisaoDeDistribuicao, string> = {
  barras: 'Barras',
  rosca: 'Rosca',
  colunas: 'Colunas',
};

/**
 * Cartão com a mesma distribuição (por etapa, por categoria) em até três visões: quem olha escolhe barras, rosca
 * ou colunas, e o navegador lembra a escolha. Os números são os mesmos nas três.
 */
export function CartaoDeDistribuicao({
  chave,
  titulo,
  descricao,
  icone,
  rodape,
  unidade,
  linhas,
  visoes = ['barras', 'rosca', 'colunas'],
  padrao = 'barras',
  centro,
  formatar,
  formatarCentro,
  vazio,
}: {
  /** Identifica o cartão para lembrar a visão escolhida. */
  chave: string;
  titulo: string;
  descricao: string;
  icone: ReactNode;
  rodape?: ReactNode;
  unidade: string;
  linhas: readonly LinhaDeBarra[];
  visoes?: readonly VisaoDeDistribuicao[];
  padrao?: VisaoDeDistribuicao;
  /** O texto no centro da rosca; sem ele, o total e a unidade. */
  centro?: { readonly valor: string; readonly rotulo: string };
  formatar?: (valor: number) => string;
  /** O total no centro da rosca, em formato curto ("R$ 211 mil"); sem ele, vale `formatar`. */
  formatarCentro?: (valor: number) => string;
  vazio?: string;
}) {
  const [visao, mudar] = usarPreferencia<VisaoDeDistribuicao>(
    `distribuicao:${chave}`,
    padrao,
    visoes,
  );
  const total = linhas.reduce((t, l) => t + l.valor, 0);
  const formato = formatar ?? ((n: number) => String(n));
  const comTexto = linhas.map((l) => ({ ...l, ...(formatar ? { texto: formato(l.valor) } : {}) }));
  return (
    <Cartao
      titulo={titulo}
      descricao={descricao}
      icone={icone}
      {...(rodape ? { rodape } : {})}
      acoes={
        visoes.length > 1 ? (
          <Abas
            segmentada
            discreta
            rotulo={`Como mostrar: ${titulo}`}
            valor={visao}
            aoMudar={mudar}
            itens={visoes.map((v) => ({ id: v, rotulo: rotulos[v] }))}
          />
        ) : undefined
      }
    >
      {linhas.length === 0 || total === 0 ? (
        <p className="campo__ajuda">{vazio ?? 'Nada para mostrar ainda.'}</p>
      ) : visao === 'rosca' ? (
        <Rosca
          rotulo={titulo}
          fatias={linhas}
          centro={centro ?? { valor: (formatarCentro ?? formato)(total), rotulo: unidade }}
          formatar={formato}
        />
      ) : visao === 'colunas' ? (
        <ColunasVerticais rotulo={titulo} colunas={linhas} unidade={unidade} formatar={formato} />
      ) : (
        <BarrasHorizontais
          rotulo={titulo}
          unidade={unidade}
          linhas={comTexto}
          {...(formatar ? { largo: true } : {})}
        />
      )}
    </Cartao>
  );
}
