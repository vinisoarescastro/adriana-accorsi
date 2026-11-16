import { pode } from '@gabinete/autorizacao';
import {
  respostasDeParticipante,
  type CompromissoSalvo,
  type RespostaDaSessao,
  type RespostaDeParticipanteDto,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho, useCompromisso } from '../api/trabalho';
import { Aviso, AvisoDeErro, Botao, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDaResposta, rotuloDaVisibilidade } from '../rotulos';
import { FormularioDeCompromisso } from './FormularioDeCompromisso';

/**
 * O compromisso numa gaveta. A resposta do participante é só informativa: recusar não cancela o
 * compromisso nem remove ninguém. Quem não vê o compromisso por inteiro nem chega aqui (404).
 */
export function CompromissoAberto({
  id,
  sessao,
  aoFechar,
}: {
  id: number;
  sessao: RespostaDaSessao;
  aoFechar: () => void;
}) {
  const cliente = useQueryClient();
  const { data: c, isLoading, error } = useCompromisso(id);
  const titulo = useRef<HTMLHeadingElement>(null);
  const [alterando, setAlterando] = useState(false);
  const [conflitos, setConflitos] = useState<CompromissoSalvo['conflitos']>([]);
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const podeMarcar = pode('agenda.marcar', autoridade);

  useEffect(() => {
    titulo.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  const atualizar = async (salvo: CompromissoSalvo) => {
    cliente.setQueryData(chavesDoTrabalho.compromisso(id), salvo.compromisso);
    setConflitos(salvo.conflitos);
    await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
  };
  const responder = useMutation({
    mutationFn: (resposta: RespostaDeParticipanteDto) =>
      chamar<CompromissoSalvo>('POST', `/api/agenda/compromissos/${id}/resposta`, {
        corpo: { resposta },
      }),
    onSuccess: atualizar,
  });
  const cancelar = useMutation({
    mutationFn: () => chamar<CompromissoSalvo>('POST', `/api/agenda/compromissos/${id}/cancelar`),
    onSuccess: atualizar,
  });

  return (
    <aside
      className="gaveta"
      role="dialog"
      aria-modal="false"
      aria-labelledby="titulo-do-compromisso"
    >
      <div className="gaveta__topo">
        <h2 id="titulo-do-compromisso" ref={titulo} tabIndex={-1}>
          {c ? c.titulo : 'Compromisso'}
        </h2>
        <Botao variante="secundario" onClick={aoFechar} aria-label="Fechar o compromisso">
          Fechar
        </Botao>
      </div>

      {isLoading ? <Carregando /> : null}
      <AvisoDeErro erro={error ?? responder.error ?? cancelar.error} />

      {c ? (
        <>
          {c.cancelado ? (
            <Aviso tipo="atencao" titulo="Compromisso cancelado. Ele não se altera mais." />
          ) : null}
          <p>
            <Selo>{rotuloDaVisibilidade[c.visibilidade]}</Selo>{' '}
            {c.envolveParlamentar ? <Selo>Envolve a Parlamentar</Selo> : null}
          </p>
          <dl className="ficha">
            <dt>Quando</dt>
            <dd>
              {formatarDataHora(c.inicio)} até {formatarDataHora(c.fim)}
              {c.diaInteiro ? ' (dia inteiro)' : ''}
            </dd>
            <dt>Local</dt>
            <dd>{c.local ?? 'Não informado'}</dd>
            <dt>Marcado por</dt>
            <dd>{c.criador}</dd>
          </dl>

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

          <h3>Participantes da equipe</h3>
          {c.participantesInternos.length === 0 ? (
            <p>Ninguém foi indicado.</p>
          ) : (
            <ul className="lista-simples">
              {c.participantesInternos.map((p) => (
                <li key={p.id}>
                  {p.nome}: <strong>{rotuloDaResposta[p.resposta]}</strong>
                </li>
              ))}
            </ul>
          )}
          {c.participantesExternos.length > 0 ? (
            <>
              <h3>Participantes de fora</h3>
              <ul className="lista-simples">
                {c.participantesExternos.map((p) => (
                  <li key={p.id}>{p.nome ?? 'Dados eliminados'}</li>
                ))}
              </ul>
            </>
          ) : null}

          {c.minhaResposta !== null && !c.cancelado ? (
            <div className="painel-do-usuario">
              <h3>Sua resposta</h3>
              <p className="campo__ajuda">
                A resposta é só informativa: não cancela o compromisso nem tira você da lista.
              </p>
              <div className="acoes">
                {respostasDeParticipante
                  .filter((r) => r !== 'sem_resposta')
                  .map((r) => (
                    <Botao
                      key={r}
                      pequeno
                      variante="secundario"
                      aria-pressed={c.minhaResposta === r}
                      disabled={responder.isPending}
                      onClick={() => responder.mutate(r)}
                    >
                      {r === 'confirmado' ? 'Confirmar presença' : 'Recusar'}
                    </Botao>
                  ))}
              </div>
              <p>Resposta atual: {rotuloDaResposta[c.minhaResposta]}.</p>
            </div>
          ) : null}

          {podeMarcar && !c.cancelado ? (
            <div className="acoes" style={{ marginTop: 'var(--espaco-4)' }}>
              <Botao pequeno variante="secundario" onClick={() => setAlterando((v) => !v)}>
                {alterando ? 'Fechar a alteração' : 'Remarcar ou alterar'}
              </Botao>
              <Botao
                pequeno
                variante="perigo"
                disabled={cancelar.isPending}
                onClick={() => cancelar.mutate()}
              >
                Cancelar compromisso
              </Botao>
            </div>
          ) : null}

          {alterando ? (
            <FormularioDeCompromisso
              sessao={sessao}
              compromisso={c}
              aoSalvar={(salvo) => {
                void atualizar(salvo);
                setAlterando(false);
              }}
              aoFechar={() => setAlterando(false)}
            />
          ) : null}
        </>
      ) : null}
    </aside>
  );
}
