import type { AvisoDto } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho, useAvisos } from '../api/trabalho';
import { Botao } from '../componentes/ui';
import { formatarDataHora } from '../formatos';

/** Para onde cada aviso leva: o registro de origem, na própria página dele. */
export function destinoDoAviso(aviso: AvisoDto): string | null {
  switch (aviso.registro.tipo) {
    case 'tarefa':
      return `/g/tarefas?tarefa=${aviso.registro.id}`;
    case 'demanda':
      return `/g/demandas?demanda=${aviso.registro.id}`;
    case 'compromisso':
      return `/g/agenda?compromisso=${aviso.registro.id}`;
    default:
      return null;
  }
}

/**
 * O sino: a caixa pessoal de avisos. A contagem e a lista dizem tudo em texto (nada depende só de
 * cor). O aviso não tem conteúdo próprio: a frase vem da natureza e o título, do registro.
 */
export function SinoDeAvisos() {
  const [aberto, setAberto] = useState(false);
  const cliente = useQueryClient();
  const { data } = useAvisos();
  const naoLidos = data?.naoLidos ?? 0;

  const marcar = useMutation({
    mutationFn: (corpo: { ids: number[] } | { todos: true }) =>
      chamar('POST', '/api/avisos/lidos', { corpo }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chavesDoTrabalho.avisos }),
  });

  return (
    <div className="sino">
      <Botao
        variante="secundario"
        aria-expanded={aberto}
        aria-controls="caixa-de-avisos"
        onClick={() => setAberto((v) => !v)}
      >
        Avisos{naoLidos > 0 ? ` (${naoLidos} novo${naoLidos > 1 ? 's' : ''})` : ''}
      </Botao>
      {aberto ? (
        <div id="caixa-de-avisos" className="sino__painel" role="region" aria-label="Seus avisos">
          {data && data.itens.length > 0 ? (
            <>
              <ul className="lista-simples">
                {data.itens.map((a) => {
                  const destino = destinoDoAviso(a);
                  return (
                    <li
                      key={a.id}
                      className={a.lido ? 'sino__item' : 'sino__item sino__item--novo'}
                    >
                      <strong>{a.lido ? '' : 'Novo: '}</strong>
                      {a.frase}
                      {a.registro.titulo ? `: ${a.registro.titulo}` : ''}
                      <br />
                      <small>{formatarDataHora(a.geradoEm)}</small>{' '}
                      {destino ? (
                        <Link
                          to={destino}
                          onClick={() => {
                            marcar.mutate({ ids: [a.id] });
                            setAberto(false);
                          }}
                        >
                          Abrir
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {naoLidos > 0 ? (
                <Botao
                  pequeno
                  variante="secundario"
                  disabled={marcar.isPending}
                  onClick={() => marcar.mutate({ todos: true })}
                >
                  Marcar todos como lidos
                </Botao>
              ) : null}
            </>
          ) : (
            <p>Nenhum aviso por enquanto.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
