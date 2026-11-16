import { pode } from '@gabinete/autorizacao';
import type { ConflitoDeAgenda, ItemDaAgenda, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho, useAgenda } from '../api/trabalho';
import { Aviso, AvisoDeErro, Botao, Campo, Carregando } from '../componentes/ui';
import {
  deCampoDeDataHora,
  fimDoDia,
  formatarDataExtensa,
  formatarDataHora,
  formatarHora,
  hojeNoGabinete,
  inicioDoDia,
  somarDias,
} from '../formatos';
import { CompromissoAberto } from './CompromissoAberto';
import { FormularioDeCompromisso } from './FormularioDeCompromisso';

const diasDaSemana = 7;

function agruparPorDia(itens: readonly ItemDaAgenda[]): Map<string, ItemDaAgenda[]> {
  const grupos = new Map<string, ItemDaAgenda[]>();
  for (const item of itens) {
    const lista = grupos.get(formatarDataExtensa(item.inicio)) ?? [];
    lista.push(item);
    grupos.set(formatarDataExtensa(item.inicio), lista);
  }
  return grupos;
}

function BloquearHorario({
  aoConcluir,
}: {
  aoConcluir: (conflitos: readonly ConflitoDeAgenda[]) => void;
}) {
  const cliente = useQueryClient();
  const dia = hojeNoGabinete();
  const [inicio, setInicio] = useState(`${dia}T09:00`);
  const [fim, setFim] = useState(`${dia}T12:00`);
  const bloquear = useMutation({
    mutationFn: () =>
      chamar<{ conflitos: ConflitoDeAgenda[] }>('POST', '/api/agenda/bloqueios', {
        corpo: { inicio: deCampoDeDataHora(inicio), fim: deCampoDeDataHora(fim) },
      }),
    onSuccess: async (r) => {
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
      aoConcluir(r.conflitos);
    },
  });
  return (
    <form
      className="cartao"
      aria-label="Bloquear horário"
      onSubmit={(e) => {
        e.preventDefault();
        bloquear.mutate();
      }}
    >
      <h2>Bloquear horário</h2>
      <p className="campo__ajuda">
        O bloqueio aparece na agenda e nos conflitos, sem dizer o motivo.
      </p>
      <AvisoDeErro erro={bloquear.error} />
      <div className="grade-formulario">
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
        <Campo rotulo="Fim">
          {(p) => (
            <input
              {...p}
              type="datetime-local"
              required
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          )}
        </Campo>
      </div>
      <Botao type="submit" disabled={bloquear.isPending}>
        Bloquear
      </Botao>
    </form>
  );
}

/**
 * Agenda por semana. O servidor devolve a cada um só o que ele pode ver: o compromisso inteiro, só o
 * horário ocupado, ou nada (o Restrito de outros some, nem como ocupado). "Minha agenda" mostra o que
 * envolve a Parlamentar (para ela) e onde o usuário foi indicado.
 */
export function PaginaAgenda({ sessao }: { sessao: RespostaDaSessao }) {
  const cliente = useQueryClient();
  const [parametros, definirParametros] = useSearchParams();
  const aberto = Number(parametros.get('compromisso')) || null;
  const [inicioDaSemana, setInicioDaSemana] = useState(hojeNoGabinete());
  const [minha, setMinha] = useState(false);
  const [modo, setModo] = useState<'nenhum' | 'compromisso' | 'bloqueio'>('nenhum');
  const [conflitos, setConflitos] = useState<readonly ConflitoDeAgenda[]>([]);
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const podeMarcar = pode('agenda.marcar', autoridade);

  const fimDaSemana = somarDias(inicioDaSemana, diasDaSemana - 1);
  const agenda = useAgenda({ de: inicioDoDia(inicioDaSemana), ate: fimDoDia(fimDaSemana), minha });

  const abrir = (id: number | null) => {
    const novos = new URLSearchParams(parametros);
    if (id === null) novos.delete('compromisso');
    else novos.set('compromisso', String(id));
    definirParametros(novos);
  };
  const cancelarBloqueio = useMutation({
    mutationFn: (id: number) => chamar<void>('POST', `/api/agenda/bloqueios/${id}/cancelar`),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo }),
  });

  const grupos = agenda.data ? agruparPorDia(agenda.data.itens) : new Map();

  return (
    <section>
      <h1>Agenda</h1>
      <div className="acoes" style={{ marginBottom: 'var(--espaco-4)' }}>
        {podeMarcar ? (
          <>
            <Botao onClick={() => setModo('compromisso')}>Novo compromisso</Botao>
            <Botao variante="secundario" onClick={() => setModo('bloqueio')}>
              Bloquear horário
            </Botao>
          </>
        ) : null}
        <Botao variante="secundario" aria-pressed={minha} onClick={() => setMinha((v) => !v)}>
          Minha agenda
        </Botao>
      </div>

      {modo === 'compromisso' ? (
        <FormularioDeCompromisso
          sessao={sessao}
          diaInicial={inicioDaSemana}
          aoSalvar={(salvo) => {
            setModo('nenhum');
            setConflitos(salvo.conflitos);
            abrir(salvo.compromisso.id);
          }}
          aoFechar={() => setModo('nenhum')}
        />
      ) : null}
      {modo === 'bloqueio' ? (
        <BloquearHorario
          aoConcluir={(c) => {
            setModo('nenhum');
            setConflitos(c);
          }}
        />
      ) : null}
      {conflitos.length > 0 ? (
        <Aviso tipo="atencao" titulo="Há conflito de horário (é só um aviso).">
          <ul>
            {conflitos.map((x) => (
              <li key={`${x.tipo}-${x.inicio}`}>
                {x.tipo === 'bloqueio' ? 'Horário bloqueado' : 'Outro compromisso'}:{' '}
                {formatarDataHora(x.inicio)} a {formatarDataHora(x.fim)}
              </li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      <div className="acoes" role="group" aria-label="Escolher a semana">
        <Botao
          variante="secundario"
          onClick={() => setInicioDaSemana(somarDias(inicioDaSemana, -diasDaSemana))}
        >
          Semana anterior
        </Botao>
        <Botao variante="secundario" onClick={() => setInicioDaSemana(hojeNoGabinete())}>
          Hoje
        </Botao>
        <Botao
          variante="secundario"
          onClick={() => setInicioDaSemana(somarDias(inicioDaSemana, diasDaSemana))}
        >
          Próxima semana
        </Botao>
      </div>
      <h2>
        De {inicioDaSemana.split('-').reverse().join('/')} a{' '}
        {fimDaSemana.split('-').reverse().join('/')}
      </h2>

      <AvisoDeErro erro={agenda.error ?? cancelarBloqueio.error} />
      {agenda.isLoading ? <Carregando /> : null}
      {agenda.data && agenda.data.itens.length === 0 ? <p>Nada marcado neste período.</p> : null}
      {[...grupos.entries()].map(([dia, itens]) => (
        <div key={dia} className="cartao agenda-dia">
          <h3>{dia}</h3>
          {itens.map((item: ItemDaAgenda, indice: number) => (
            <div key={`${item.tipo}-${item.inicio}-${indice}`} className="agenda-item">
              <span className="agenda-item__hora">
                {item.tipo === 'compromisso' && item.diaInteiro
                  ? 'Dia inteiro'
                  : `${formatarHora(item.inicio)} às ${formatarHora(item.fim)}`}
              </span>
              {item.tipo === 'compromisso' ? (
                <button type="button" className="link-botao" onClick={() => abrir(item.id)}>
                  {item.titulo}
                </button>
              ) : item.tipo === 'ocupado' ? (
                <span>Horário ocupado</span>
              ) : (
                <>
                  <span>Indisponível</span>
                  {podeMarcar ? (
                    <Botao
                      pequeno
                      variante="secundario"
                      disabled={cancelarBloqueio.isPending}
                      onClick={() => cancelarBloqueio.mutate(item.id)}
                    >
                      Cancelar bloqueio
                    </Botao>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>
      ))}

      {aberto ? (
        <CompromissoAberto id={aberto} sessao={sessao} aoFechar={() => abrir(null)} />
      ) : null}
    </section>
  );
}
