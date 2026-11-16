import { pode } from '@gabinete/autorizacao';
import {
  statusDeDemanda,
  type RespostaDaSessao,
  type StatusDeDemanda,
} from '@gabinete/compartilhado';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDemandas, useQuadro } from '../api/atendimento';
import { Kanban, List, Plus, Search } from 'lucide-react';
import { Abas } from '../componentes/abas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { DicaDeUso } from '../componentes/dicas';
import { BarraDeFerramentas, EsqueletoDeTabela } from '../componentes/tabela';
import { AvisoDeErro, Botao, Campo, Carregando } from '../componentes/ui';
import { rotuloDoStatus } from '../rotulos';
import { FichaDaDemanda } from './FichaDaDemanda';
import { ListaDeDemandas, QuadroDasDemandas } from './ListaEQuadro';
import { NovaDemanda } from './NovaDemanda';

/**
 * Demandas: lista e quadro por etapa, com busca, filtros e paginação no servidor. A ficha abre numa
 * gaveta, e o endereço guarda a demanda aberta (`?demanda=<id>`), então o link serve para compartilhar.
 */
export function PaginaDemandas({ sessao }: { sessao: RespostaDaSessao }) {
  const [parametros, definirParametros] = useSearchParams();
  const aberta = Number(parametros.get('demanda')) || null;
  const [visao, setVisao] = useState<'lista' | 'quadro'>('lista');
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState('');
  const [termo, setTermo] = useState('');
  const [status, setStatus] = useState<StatusDeDemanda | ''>(
    (parametros.get('status') as StatusDeDemanda) || '',
  );
  const [atrasadas, setAtrasadas] = useState(parametros.get('atrasadas') === 'true');
  const [pagina, setPagina] = useState(1);

  const solicitanteId = Number(parametros.get('solicitante')) || undefined;
  const lista = useDemandas({
    pagina,
    busca: termo,
    status,
    atrasadas,
    ...(solicitanteId ? { solicitanteId } : {}),
  });
  const quadro = useQuadro(visao === 'quadro');
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };

  const abrir = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('demanda');
    else novos.set('demanda', String(id));
    definirParametros(novos);
  };

  return (
    <section>
      <CabecalhoDaPagina
        titulo="Demandas"
        descricao="Registre, acompanhe e conclua os pedidos dos cidadãos."
        acoes={
          pode('demandas.registrar', autoridade) ? (
            <Botao icone={<Plus size={16} aria-hidden="true" />} onClick={() => setCriando(true)}>
              Nova demanda
            </Botao>
          ) : null
        }
      />

      {criando ? (
        <NovaDemanda
          sessao={sessao}
          aoFechar={() => setCriando(false)}
          aoAbrir={(id) => {
            setCriando(false);
            abrir(id);
          }}
        />
      ) : null}

      <BarraDeFerramentas
        rotulo="Filtros das demandas"
        aoBuscar={() => {
          setTermo(busca.trim());
          setPagina(1);
        }}
        acoes={
          <>
            <Abas
              segmentada
              rotulo="Forma de ver as demandas"
              valor={visao}
              aoMudar={setVisao}
              itens={[
                { id: 'lista', rotulo: 'Lista', icone: <List size={16} aria-hidden="true" /> },
                {
                  id: 'quadro',
                  rotulo: 'Quadro',
                  icone: <Kanban size={16} aria-hidden="true" />,
                },
              ]}
            />
            {visao === 'lista' ? (
              <Botao
                type="submit"
                variante="secundario"
                icone={<Search size={16} aria-hidden="true" />}
              >
                Buscar
              </Botao>
            ) : null}
          </>
        }
      >
        {visao === 'lista' ? (
          <>
            <Campo rotulo="Buscar" ajuda="Protocolo, título, nome ou parte do telefone.">
              {(p) => (
                <input
                  {...p}
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Situação">
              {(p) => (
                <select
                  {...p}
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as StatusDeDemanda | '');
                    setPagina(1);
                  }}
                >
                  <option value="">Todas</option>
                  {statusDeDemanda.map((s) => (
                    <option key={s} value={s}>
                      {rotuloDoStatus[s]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <label className="opcao">
              <input
                type="checkbox"
                checked={atrasadas}
                onChange={(e) => {
                  setAtrasadas(e.target.checked);
                  setPagina(1);
                }}
              />
              Só as atrasadas
            </label>
          </>
        ) : (
          <DicaDeUso>
            O quadro mostra as demandas por etapa. Abra uma para mover, comentar ou publicar para o
            cidadão.
          </DicaDeUso>
        )}
      </BarraDeFerramentas>

      <AvisoDeErro erro={lista.error ?? quadro.error} />
      {visao === 'lista' ? (
        lista.isLoading ? (
          <EsqueletoDeTabela colunas={8} />
        ) : lista.data ? (
          <ListaDeDemandas pagina={lista.data} aoAbrir={abrir} aoMudarPagina={setPagina} />
        ) : null
      ) : quadro.isLoading ? (
        <Carregando />
      ) : quadro.data ? (
        <QuadroDasDemandas quadro={quadro.data} aoAbrir={abrir} />
      ) : null}

      {aberta ? <FichaDaDemanda id={aberta} sessao={sessao} aoFechar={() => abrir(null)} /> : null}
    </section>
  );
}
