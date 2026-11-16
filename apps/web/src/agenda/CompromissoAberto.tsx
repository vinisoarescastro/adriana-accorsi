import { pode } from '@gabinete/autorizacao';
import {
  respostasDeParticipante,
  type CompromissoSalvo,
  type RespostaDaSessao,
  type RespostaDeParticipanteDto,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { useEquipe } from '../api/consultas';
import { chavesDoTrabalho, useCompromisso } from '../api/trabalho';
import { Avatar } from '../componentes/avatar';
import { Modal } from '../componentes/modal';
import { useToast } from '../componentes/toast';
import { Aviso, AvisoDeErro, Botao, Carregando, Selo } from '../componentes/ui';
import { CalendarDays, Eye, Lock, MapPin, Pencil } from 'lucide-react';
import { formatarDataExtensa, formatarDataHora, formatarHora, iniciais } from '../formatos';
import { rotuloCurtoDaVisibilidade, rotuloDaResposta } from '../rotulos';
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
  const { data: equipe } = useEquipe();
  const fotoDe = new Map((equipe ?? []).map((u) => [u.id, u.temFoto]));
  const [alterando, setAlterando] = useState(false);
  const [conflitos, setConflitos] = useState<CompromissoSalvo['conflitos']>([]);
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const podeMarcar = pode('agenda.marcar', autoridade);

  const atualizar = async (salvo: CompromissoSalvo) => {
    cliente.setQueryData(chavesDoTrabalho.compromisso(id), salvo.compromisso);
    setConflitos(salvo.conflitos);
    await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
  };
  const avisar = useToast();
  const responder = useMutation({
    mutationFn: (resposta: RespostaDeParticipanteDto) =>
      chamar<CompromissoSalvo>('POST', `/api/agenda/compromissos/${id}/resposta`, {
        corpo: { resposta },
      }),
    onSuccess: async (salvo) => {
      await atualizar(salvo);
      avisar({ tom: 'sucesso', titulo: 'Resposta registrada' });
    },
  });
  const cancelar = useMutation({
    mutationFn: () => chamar<CompromissoSalvo>('POST', `/api/agenda/compromissos/${id}/cancelar`),
    onSuccess: async (salvo) => {
      await atualizar(salvo);
      avisar({ tom: 'sucesso', titulo: 'Compromisso cancelado' });
    },
  });

  const sigiloso = c ? c.visibilidade !== 'aberto' : false;
  const mesmoDia = c ? formatarDataExtensa(c.inicio) === formatarDataExtensa(c.fim) : true;
  const podeAlterar = podeMarcar && c && !c.cancelado;

  return (
    <Modal
      titulo={c ? c.titulo : 'Compromisso'}
      tamanho="md"
      aoFechar={aoFechar}
      rodape={
        podeAlterar && !alterando ? (
          <>
            <Botao
              variante="perigo"
              className="rodape-esquerda"
              disabled={cancelar.isPending}
              onClick={() => cancelar.mutate()}
            >
              Cancelar compromisso
            </Botao>
            <Botao
              variante="secundario"
              icone={<Pencil size={16} aria-hidden="true" />}
              onClick={() => setAlterando(true)}
            >
              Remarcar ou alterar
            </Botao>
          </>
        ) : null
      }
    >
      {isLoading ? <Carregando /> : null}
      <AvisoDeErro erro={error ?? responder.error ?? cancelar.error} />

      {c && alterando ? (
        <FormularioDeCompromisso
          incorporado
          sessao={sessao}
          compromisso={c}
          aoSalvar={(salvo) => {
            void atualizar(salvo);
            setAlterando(false);
          }}
          aoFechar={() => setAlterando(false)}
        />
      ) : null}

      {c && !alterando ? (
        <div className="compromisso">
          <div className="acoes">
            {c.cancelado ? <Selo tom="perigo">Cancelado</Selo> : null}
            <Selo tom={sigiloso ? 'atencao' : 'neutro'}>
              {sigiloso ? 'Sigiloso' : 'Não sigiloso'}
            </Selo>
            {c.envolveParlamentar ? <Selo tom="primario">Envolve a Parlamentar</Selo> : null}
          </div>

          <ul className="compromisso__dados">
            <li>
              <CalendarDays size={18} aria-hidden="true" />
              <div>
                <strong className="compromisso__data">
                  {formatarDataExtensa(c.inicio)}
                  {mesmoDia ? '' : ` até ${formatarDataExtensa(c.fim)}`}
                </strong>
                <span>
                  {c.diaInteiro
                    ? 'Dia inteiro'
                    : mesmoDia
                      ? `${formatarHora(c.inicio)} às ${formatarHora(c.fim)}`
                      : `${formatarDataHora(c.inicio)} a ${formatarDataHora(c.fim)}`}
                </span>
              </div>
            </li>
            <li>
              <MapPin size={18} aria-hidden="true" />
              <div>
                <strong>{c.local ?? 'Local não informado'}</strong>
              </div>
            </li>
            <li>
              {sigiloso ? (
                <Lock size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
              <div>
                <strong>{rotuloCurtoDaVisibilidade[c.visibilidade]}</strong>
                <span>Marcado por {c.criador}</span>
              </div>
            </li>
          </ul>

          {c.descricao ? (
            <section aria-labelledby="titulo-descricao">
              <h3 id="titulo-descricao" className="compromisso__secao">
                Descrição
              </h3>
              <p className="compromisso__descricao">{c.descricao}</p>
            </section>
          ) : null}

          {c.cancelado ? (
            <Aviso tipo="atencao" titulo="Compromisso cancelado. Ele não se altera mais." />
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

          <section aria-labelledby="titulo-participantes">
            <h3 id="titulo-participantes" className="compromisso__secao">
              Quem está marcado
            </h3>
            {c.participantesInternos.length === 0 && c.participantesExternos.length === 0 ? (
              <p className="campo__ajuda">Ninguém foi indicado.</p>
            ) : (
              <ul className="participantes">
                {c.participantesInternos.map((p) => (
                  <li key={`i-${p.id}`}>
                    <Avatar nome={p.nome} id={p.id} temFoto={fotoDe.get(p.id)} pequeno />
                    <span className="participantes__nome">{p.nome}</span>
                    <Selo
                      tom={
                        p.resposta === 'confirmado'
                          ? 'sucesso'
                          : p.resposta === 'recusado'
                            ? 'perigo'
                            : 'neutro'
                      }
                    >
                      {rotuloDaResposta[p.resposta]}
                    </Selo>
                  </li>
                ))}
                {c.participantesExternos.map((p) => (
                  <li key={`e-${p.id}`}>
                    <span className="foto foto--pequena" aria-hidden="true">
                      {p.nome ? iniciais(p.nome) : '–'}
                    </span>
                    <span className="participantes__nome">{p.nome ?? 'Dados eliminados'}</span>
                    <Selo>De fora</Selo>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {c.minhaResposta !== null && !c.cancelado ? (
            <section className="compromisso__resposta" aria-labelledby="titulo-resposta">
              <div>
                <h3 id="titulo-resposta" className="compromisso__secao">
                  Sua resposta
                </h3>
                <p className="campo__ajuda">
                  A resposta é só informativa: não cancela o compromisso nem tira você da lista.
                </p>
                <p className="campo__ajuda">Resposta atual: {rotuloDaResposta[c.minhaResposta]}.</p>
              </div>
              <div className="acoes">
                {respostasDeParticipante
                  .filter((r) => r !== 'sem_resposta')
                  .map((r) => (
                    <Botao
                      key={r}
                      pequeno
                      variante={c.minhaResposta === r ? 'primario' : 'secundario'}
                      aria-pressed={c.minhaResposta === r}
                      disabled={responder.isPending}
                      onClick={() => responder.mutate(r)}
                    >
                      {r === 'confirmado' ? 'Confirmar presença' : 'Recusar'}
                    </Botao>
                  ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
