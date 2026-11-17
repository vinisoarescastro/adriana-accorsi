import { formatarReais, type EmendaResumo, type PaginaDeEmendas } from '@gabinete/compartilhado';
import { HandCoins } from 'lucide-react';
import { EstadoVazio } from '../componentes/dicas';
import { CelulaDoItem, CelulaDoPrazo, CelulaDoResponsavel } from '../componentes/lista';
import { Quadro } from '../componentes/quadro';
import { Paginacao } from '../componentes/tabela';
import { Selo } from '../componentes/ui';
import type { DestinoDaEtapa } from '../demandas/useMoverDemanda';
import { rotuloDoStatusDaEmenda } from '../rotulos';

const apoioDaEmenda = (e: EmendaResumo) =>
  `${e.exercicio} · ${e.tipo.nome} · ${formatarReais(e.valores.disponibilizado)}`;

function CelulaDaEtapaDaEmenda({ emenda }: { emenda: EmendaResumo }) {
  return emenda.status === 'cancelada' ? (
    <Selo tom="perigo" ponto>
      {rotuloDoStatusDaEmenda.cancelada}
    </Selo>
  ) : (
    <span className="celula-etapa">
      <span className={`quadro__ponto quadro__ponto--${emenda.etapa.papel}`} aria-hidden="true" />
      {emenda.etapa.nome}
    </span>
  );
}

/** O prazo mais próximo entre os três (o que a lista mostra e o atraso olha). */
const prazoDaEmenda = (e: EmendaResumo) =>
  [e.prazoDestinacao, e.prazoEmpenho, e.prazoExecucao]
    .filter((p): p is string => p !== null)
    .sort()[0] ?? null;

export function ListaDeEmendas({
  pagina,
  aoAbrir,
  aoMudarPagina,
}: {
  pagina: PaginaDeEmendas;
  aoAbrir: (id: number) => void;
  aoMudarPagina: (p: number) => void;
}) {
  const totalDePaginas = Math.max(1, Math.ceil(pagina.total / pagina.porPagina));
  return (
    <div className="cartao cartao--tabela">
      <div className="tabela-rolavel">
        <table className="tabela">
          <caption>
            {pagina.total} emenda(s), página {pagina.pagina} de {totalDePaginas}
          </caption>
          <thead>
            <tr>
              <th scope="col">Emenda</th>
              <th scope="col">Etapa</th>
              <th scope="col" className="e-numero">
                Disponibilizado
              </th>
              <th scope="col" className="e-numero">
                Disponível
              </th>
              <th scope="col">Responsável</th>
              <th scope="col">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {pagina.itens.map((e) => (
              <tr key={e.id}>
                <td>
                  <CelulaDoItem
                    titulo={e.identificacao}
                    apoio={[`${e.exercicio} · ${e.tipo.nome}`]}
                    aoAbrir={() => aoAbrir(e.id)}
                  />
                </td>
                <td>
                  <CelulaDaEtapaDaEmenda emenda={e} />
                </td>
                <td className="e-numero">{formatarReais(e.valores.disponibilizado)}</td>
                <td className="e-numero">{formatarReais(e.valores.disponivel)}</td>
                <td>
                  <CelulaDoResponsavel nomes={[e.responsavel.nome]} />
                </td>
                <td>
                  <CelulaDoPrazo prazo={prazoDaEmenda(e)} atrasada={e.atrasada} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagina.itens.length === 0 ? (
        <EstadoVazio
          icone={<HandCoins size={24} />}
          titulo="Nenhuma emenda encontrada."
          texto="Ajuste os filtros ou cadastre uma emenda."
        />
      ) : null}
      <Paginacao pagina={pagina.pagina} totalDePaginas={totalDePaginas} aoMudar={aoMudarPagina} />
    </div>
  );
}

const papeis = ['entrada', 'intermediaria', 'conclusao', 'arquivamento'] as const;
const papelValido = (papel: string) =>
  (papeis as readonly string[]).includes(papel)
    ? (papel as (typeof papeis)[number])
    : 'intermediaria';

/** Quadro das emendas por etapa do fluxo. As canceladas ficam de fora. Arrastar (ou "Mover para…") muda a etapa. */
export function QuadroDeEmendas({
  etapas,
  emendas,
  total,
  aoAbrir,
  podeMover,
  aoMover,
}: {
  etapas: readonly { id: number; nome: string; papel: string; ordem: number }[];
  emendas: readonly EmendaResumo[];
  total: number;
  aoAbrir: (id: number) => void;
  podeMover: (e: EmendaResumo) => boolean;
  aoMover: (e: EmendaResumo, destino: DestinoDaEtapa) => void;
}) {
  const visiveis = emendas.filter((e) => e.status !== 'cancelada');
  const ordenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  return (
    <>
      <Quadro
        rotulo="Quadro de emendas por etapa"
        colunas={ordenadas.map((et) => {
          const daEtapa = visiveis.filter((e) => e.etapa.id === et.id);
          return {
            id: et.id,
            nome: et.nome,
            papel: papelValido(et.papel),
            total: daEtapa.length,
            itens: daEtapa,
          };
        })}
        vazio="Nenhuma emenda nesta etapa."
        dados={(e) => ({
          titulo: e.identificacao,
          apoio: apoioDaEmenda(e),
          prazo: prazoDaEmenda(e),
          atrasada: e.atrasada,
          responsaveis: [e.responsavel.nome],
        })}
        aoAbrir={aoAbrir}
        podeMover={podeMover}
        aoMover={(e, etapaId) => {
          const et = ordenadas.find((x) => x.id === etapaId);
          if (et) aoMover(e, { id: et.id, nome: et.nome, papel: papelValido(et.papel) });
        }}
      />
      {total > emendas.length ? (
        <p className="campo__ajuda">
          Mostrando {emendas.length} de {total} emendas. Use a lista para ver todas.
        </p>
      ) : null}
    </>
  );
}
