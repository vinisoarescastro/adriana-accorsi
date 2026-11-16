import { pode } from '@gabinete/autorizacao';
import type { EventoFicha, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho, useEventos } from '../api/trabalho';
import { AvisoDeErro, Botao, Campo, Carregando, Selo } from '../componentes/ui';
import { deCampoDeDataHora, formatarDataHora, hojeNoGabinete } from '../formatos';
import { FichaDoEvento } from './FichaDoEvento';

function NovoEvento({
  aoFechar,
  aoAbrir,
}: {
  aoFechar: () => void;
  aoAbrir: (id: number) => void;
}) {
  const cliente = useQueryClient();
  const [nome, setNome] = useState('');
  const [inicio, setInicio] = useState(`${hojeNoGabinete()}T19:00`);
  const [local, setLocal] = useState('');
  const criar = useMutation({
    mutationFn: () =>
      chamar<EventoFicha>('POST', '/api/eventos', {
        corpo: {
          nome: nome.trim(),
          inicio: deCampoDeDataHora(inicio),
          ...(local.trim() ? { local: local.trim() } : {}),
        },
      }),
    onSuccess: async (e) => {
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
      aoAbrir(e.id);
    },
  });
  return (
    <form
      className="cartao"
      aria-label="Novo evento"
      onSubmit={(e) => {
        e.preventDefault();
        criar.mutate();
      }}
    >
      <h2>Novo evento</h2>
      <AvisoDeErro erro={criar.error} />
      <div className="grade-formulario">
        <Campo rotulo="Nome">
          {(p) => (
            <input
              {...p}
              required
              maxLength={200}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Início">
          {(p) => (
            <input
              {...p}
              type="datetime-local"
              required
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          )}
        </Campo>
        <Campo rotulo="Local (opcional)">
          {(p) => (
            <input
              {...p}
              maxLength={300}
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          )}
        </Campo>
      </div>
      <div className="acoes">
        <Botao type="submit" disabled={!nome.trim() || criar.isPending}>
          Cadastrar evento
        </Botao>
        <Botao variante="secundario" onClick={aoFechar}>
          Cancelar
        </Botao>
      </div>
    </form>
  );
}

/** Eventos e presença. A ficha abre numa gaveta (`?evento=<id>`), para chegar direto do celular. */
export function PaginaEventos({ sessao }: { sessao: RespostaDaSessao }) {
  const [parametros, definirParametros] = useSearchParams();
  const aberto = Number(parametros.get('evento')) || null;
  const [criando, setCriando] = useState(false);
  const [situacao, setSituacao] = useState('aberto');
  const [pagina, setPagina] = useState(1);
  const lista = useEventos({ pagina, situacao });
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };

  const abrir = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('evento');
    else novos.set('evento', String(id));
    definirParametros(novos);
  };
  const totalDePaginas = lista.data
    ? Math.max(1, Math.ceil(lista.data.total / lista.data.porPagina))
    : 1;

  return (
    <section>
      <h1>Eventos</h1>
      <div className="acoes" style={{ marginBottom: 'var(--espaco-4)' }}>
        {pode('eventos.organizar', autoridade) && !criando ? (
          <Botao onClick={() => setCriando(true)}>Novo evento</Botao>
        ) : null}
      </div>
      {criando ? (
        <NovoEvento
          aoFechar={() => setCriando(false)}
          aoAbrir={(id) => {
            setCriando(false);
            abrir(id);
          }}
        />
      ) : null}

      <div className="cartao">
        <Campo rotulo="Situação">
          {(p) => (
            <select
              {...p}
              value={situacao}
              onChange={(e) => {
                setSituacao(e.target.value);
                setPagina(1);
              }}
            >
              <option value="aberto">Abertos</option>
              <option value="encerrado">Encerrados</option>
              <option value="">Todos</option>
            </select>
          )}
        </Campo>
      </div>

      <AvisoDeErro erro={lista.error} />
      {lista.isLoading ? <Carregando /> : null}
      {lista.data ? (
        <div className="cartao tabela-rolavel">
          <table className="tabela">
            <caption>
              {lista.data.total} evento(s), página {lista.data.pagina} de {totalDePaginas}
            </caption>
            <thead>
              <tr>
                <th scope="col">Evento</th>
                <th scope="col">Quando</th>
                <th scope="col">Local</th>
                <th scope="col">Situação</th>
                <th scope="col">Presentes</th>
              </tr>
            </thead>
            <tbody>
              {lista.data.itens.map((e) => (
                <tr key={e.id}>
                  <td>
                    <button type="button" className="link-botao" onClick={() => abrir(e.id)}>
                      {e.nome}
                    </button>
                  </td>
                  <td>{formatarDataHora(e.inicio)}</td>
                  <td>{e.local ?? '-'}</td>
                  <td>
                    <Selo tipo={e.situacao === 'aberto' ? 'ativo' : 'inativo'}>
                      {e.situacao === 'aberto' ? 'Aberto' : 'Encerrado'}
                    </Selo>
                  </td>
                  <td>{e.presentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.data.itens.length === 0 ? <p>Nenhum evento encontrado.</p> : null}
          <div className="acoes" style={{ marginTop: 'var(--espaco-4)' }}>
            <Botao
              variante="secundario"
              onClick={() => setPagina(pagina - 1)}
              disabled={pagina <= 1}
            >
              Anterior
            </Botao>
            <Botao
              variante="secundario"
              onClick={() => setPagina(pagina + 1)}
              disabled={pagina >= totalDePaginas}
            >
              Próxima
            </Botao>
          </div>
        </div>
      ) : null}

      {aberto ? <FichaDoEvento id={aberto} sessao={sessao} aoFechar={() => abrir(null)} /> : null}
    </section>
  );
}
