import { nivelDoPerfil, pode } from '@gabinete/autorizacao';
import {
  statusDeDemanda,
  type RespostaDaSessao,
  type StatusDeDemanda,
} from '@gabinete/compartilhado';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDemandas, useQuadro } from '../api/atendimento';
import { AlarmClock, Kanban, List, Plus } from 'lucide-react';
import { Abas } from '../componentes/abas';
import { respondePeloItem } from '../componentes/responsaveis';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { BarraDeFiltros, FiltroRapido } from '../componentes/filtros';
import { EsqueletoDeCartoes, EsqueletoDeTabela } from '../componentes/tabela';
import { AvisoDeErro, Botao } from '../componentes/ui';
import { rotuloDoStatus } from '../rotulos';
import { FichaDaDemanda } from './FichaDaDemanda';
import { ListaDeDemandas, QuadroDasDemandas } from './ListaEQuadro';
import { NovaDemanda } from './NovaDemanda';
import { useMoverDemanda } from './useMoverDemanda';

/**
 * Demandas: quadro por etapa (a visão padrão) e lista, com busca, filtros e paginação no servidor. A ficha abre numa
 * gaveta, e o endereço guarda a demanda aberta (`?demanda=<id>`), então o link serve para compartilhar.
 */
export function PaginaDemandas({ sessao }: { sessao: RespostaDaSessao }) {
  const [parametros, definirParametros] = useSearchParams();
  const aberta = Number(parametros.get('demanda')) || null;
  // O quadro é a visão padrão. Quem chega com um filtro de situação (os links do painel) cai na lista,
  // porque o quadro já separa por etapa.
  const visaoDoEndereco = parametros.get('visao');
  const visao: 'lista' | 'quadro' =
    visaoDoEndereco === 'lista' || (visaoDoEndereco === null && parametros.get('status'))
      ? 'lista'
      : 'quadro';
  // O atalho do painel abre o cadastro direto (`?novo=1`).
  const [criando, setCriando] = useState(parametros.get('novo') === '1');
  const [termo, setTermo] = useState('');
  const [status, setStatus] = useState<StatusDeDemanda | ''>(
    (parametros.get('status') as StatusDeDemanda) || '',
  );
  const [atrasadas, setAtrasadas] = useState(parametros.get('atrasadas') === 'true');
  const [pagina, setPagina] = useState(1);

  const solicitanteId = Number(parametros.get('solicitante')) || undefined;
  const lista = useDemandas(
    {
      pagina,
      busca: termo,
      status,
      atrasadas,
      ...(solicitanteId ? { solicitanteId } : {}),
    },
    visao === 'lista',
  );
  const quadro = useQuadro(visao === 'quadro', { busca: termo, atrasadas, solicitanteId });
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const mover = useMoverDemanda();

  const abrir = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('demanda');
    else novos.set('demanda', String(id));
    definirParametros(novos);
  };
  const mudarVisao = (nova: 'lista' | 'quadro') => {
    const novos = new URLSearchParams(parametros);
    novos.set('visao', nova);
    definirParametros(novos, { replace: true });
  };
  const limpar = () => {
    setTermo('');
    setStatus('');
    setAtrasadas(false);
    setPagina(1);
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

      <BarraDeFiltros
        rotulo="Filtros das demandas"
        termo={termo}
        aoBuscar={(t) => {
          setTermo(t);
          setPagina(1);
        }}
        placeholder="Buscar por protocolo, título ou nome"
        ativos={Boolean(termo || status || atrasadas)}
        aoLimpar={limpar}
        filtros={
          <>
            {visao === 'lista' ? (
              <select
                className="filtros__selecao"
                aria-label="Situação"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as StatusDeDemanda | '');
                  setPagina(1);
                }}
              >
                <option value="">Todas as situações</option>
                {statusDeDemanda.map((s) => (
                  <option key={s} value={s}>
                    {rotuloDoStatus[s]}
                  </option>
                ))}
              </select>
            ) : null}
            <FiltroRapido
              rotulo="Atrasadas"
              icone={<AlarmClock size={14} aria-hidden="true" />}
              ativo={atrasadas}
              aoAlternar={(v) => {
                setAtrasadas(v);
                setPagina(1);
              }}
            />
          </>
        }
        visao={
          <Abas
            segmentada
            rotulo="Forma de ver as demandas"
            valor={visao}
            aoMudar={mudarVisao}
            itens={[
              { id: 'quadro', rotulo: 'Quadro', icone: <Kanban size={16} aria-hidden="true" /> },
              { id: 'lista', rotulo: 'Lista', icone: <List size={16} aria-hidden="true" /> },
            ]}
          />
        }
      />

      <AvisoDeErro erro={lista.error ?? quadro.error} />
      {visao === 'lista' ? (
        lista.isLoading ? (
          <EsqueletoDeTabela colunas={5} />
        ) : lista.data ? (
          <ListaDeDemandas pagina={lista.data} aoAbrir={abrir} aoMudarPagina={setPagina} />
        ) : null
      ) : quadro.isLoading ? (
        <EsqueletoDeCartoes quantidade={4} />
      ) : quadro.data ? (
        <QuadroDasDemandas
          quadro={quadro.data}
          aoAbrir={abrir}
          // Supervisor ou superior, ou o responsável, movem (a mesma regra das ações da ficha).
          podeMover={(d) =>
            nivelDoPerfil[sessao.usuario.perfil] >= 3 || respondePeloItem(d, sessao.usuario.id)
          }
          aoMover={(d, destino) => mover.mutate({ id: d.id, destino })}
        />
      ) : null}

      {aberta ? <FichaDaDemanda id={aberta} sessao={sessao} aoFechar={() => abrir(null)} /> : null}
    </section>
  );
}
