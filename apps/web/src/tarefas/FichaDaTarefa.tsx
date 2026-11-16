import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  prioridades,
  type Prioridade,
  type RespostaDaSessao,
  type TarefaFicha,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { chamar } from '../api/cliente';
import { useEquipe } from '../api/consultas';
import { chavesDoTrabalho, useEtapasDeTarefa, useTarefa } from '../api/trabalho';
import { Modal } from '../componentes/modal';
import { useToast } from '../componentes/toast';
import { SeloDeAtraso, SeloDeStatus } from '../componentes/situacao';
import { Aviso, AvisoDeErro, Botao, Campo, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDaPrioridade } from '../rotulos';

/** Executa uma ação sobre a tarefa, atualiza a ficha na hora e invalida lista e painel. */
function useAcao(id: number, caminho: string, mensagem: string, metodo = 'POST') {
  const cliente = useQueryClient();
  const avisar = useToast();
  return useMutation({
    mutationFn: (corpo: unknown) =>
      chamar<TarefaFicha>(metodo, `/api/tarefas/${id}${caminho}`, { corpo }),
    onSuccess: async (ficha) => {
      cliente.setQueryData(chavesDoTrabalho.tarefa(id), ficha);
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
      avisar({ tom: 'sucesso', titulo: mensagem });
    },
  });
}

function AcoesDaTarefa({ ficha, sessao }: { ficha: TarefaFicha; sessao: RespostaDaSessao }) {
  const nivel = nivelDoPerfil[sessao.usuario.perfil];
  // Supervisor ou superior, ou o responsável, editam, movem e cancelam (RN-TAR-04).
  const podeAlterar = nivel >= 3 || ficha.responsavel.id === sessao.usuario.id;
  const podeReatribuir = nivel >= 2;

  const { data: etapas } = useEtapasDeTarefa();
  const { data: equipe } = useEquipe();
  const destinos = (etapas ?? []).filter((e) => e.id !== ficha.etapa.id);

  const [etapaId, setEtapaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [titulo, setTitulo] = useState(ficha.titulo);
  const [prioridade, setPrioridade] = useState<Prioridade>(ficha.prioridade);
  const [prazo, setPrazo] = useState(ficha.prazo ?? '');
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [justificativa, setJustificativa] = useState('');

  const mover = useAcao(ficha.id, '/mover', 'Tarefa movida');
  const editar = useAcao(ficha.id, '', 'Alterações salvas', 'PATCH');
  const reatribuir = useAcao(ficha.id, '/reatribuir', 'Tarefa passada adiante');
  const cancelar = useAcao(ficha.id, '/cancelar', 'Tarefa cancelada');
  const erro = mover.error ?? editar.error ?? reatribuir.error ?? cancelar.error;

  if (ficha.status === 'cancelada') return null;

  return (
    <div className="painel-do-usuario">
      <h3>Ações</h3>
      <AvisoDeErro erro={erro} />

      {podeAlterar ? (
        <>
          <div className="grade-formulario">
            <Campo
              rotulo="Mover para a etapa"
              ajuda="Reabrir uma tarefa concluída é do Supervisor."
            >
              {(p) => (
                <select {...p} value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {destinos.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Observação (opcional)">
              {(p) => (
                <input
                  {...p}
                  maxLength={1000}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                />
              )}
            </Campo>
          </div>
          <p>
            <Botao
              pequeno
              disabled={!etapaId || mover.isPending}
              onClick={() => {
                mover.mutate({ etapaId: Number(etapaId), ...(observacao ? { observacao } : {}) });
                setEtapaId('');
                setObservacao('');
              }}
            >
              Mover
            </Botao>
          </p>

          <div className="grade-formulario">
            <Campo rotulo="Título">
              {(p) => (
                <input
                  {...p}
                  maxLength={200}
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                />
              )}
            </Campo>
            <Campo rotulo="Prioridade">
              {(p) => (
                <select
                  {...p}
                  value={prioridade}
                  onChange={(e) => setPrioridade(e.target.value as Prioridade)}
                >
                  {prioridades.map((v) => (
                    <option key={v} value={v}>
                      {rotuloDaPrioridade[v]}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Prazo">
              {(p) => (
                <input
                  {...p}
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              )}
            </Campo>
          </div>
          <p>
            <Botao
              pequeno
              disabled={!titulo.trim() || editar.isPending}
              onClick={() =>
                editar.mutate({
                  titulo: titulo.trim(),
                  prioridade,
                  prazo: prazo || null,
                })
              }
            >
              Salvar alterações
            </Botao>
          </p>
        </>
      ) : null}

      {podeReatribuir ? (
        <>
          <Campo rotulo="Passar para" ajuda="Quem recebe é avisado.">
            {(p) => (
              <select
                {...p}
                value={novoResponsavel}
                onChange={(e) => setNovoResponsavel(e.target.value)}
              >
                <option value="">Escolha…</option>
                {(equipe ?? [])
                  .filter((u) => u.situacao === 'ativo' && u.id !== ficha.responsavel.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
              </select>
            )}
          </Campo>
          <p>
            <Botao
              pequeno
              disabled={!novoResponsavel || reatribuir.isPending}
              onClick={() => {
                reatribuir.mutate({ responsavelId: Number(novoResponsavel) });
                setNovoResponsavel('');
              }}
            >
              Passar a tarefa
            </Botao>
          </p>
        </>
      ) : null}

      {podeAlterar ? (
        <>
          <Campo rotulo="Cancelar a tarefa" ajuda="Explique o motivo (ao menos 10 caracteres).">
            {(p) => (
              <input
                {...p}
                maxLength={1000}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
              />
            )}
          </Campo>
          <p>
            <Botao
              pequeno
              variante="perigo"
              disabled={justificativa.trim().length < 10 || cancelar.isPending}
              onClick={() => cancelar.mutate({ justificativa: justificativa.trim() })}
            >
              Cancelar tarefa
            </Botao>
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Ficha da tarefa numa gaveta. O Assessor Externo só abre as dele (a API responde "não encontrada"). */
export function FichaDaTarefa({
  id,
  sessao,
  aoFechar,
}: {
  id: number;
  sessao: RespostaDaSessao;
  aoFechar: () => void;
}) {
  const { data: ficha, isLoading, error } = useTarefa(id);

  return (
    <Modal titulo={ficha ? ficha.titulo : 'Tarefa'} tamanho="lg" aoFechar={aoFechar}>
      {isLoading ? <Carregando /> : null}
      <AvisoDeErro erro={error} />

      {ficha ? (
        <>
          <p>
            <span className="acoes">
              <SeloDeStatus status={ficha.status} />
              {ficha.atrasada ? <SeloDeAtraso /> : null}
              <Selo>Etapa: {ficha.etapa.nome}</Selo>
            </span>
          </p>
          {ficha.status === 'cancelada' ? (
            <Aviso tipo="atencao" titulo="Tarefa cancelada. Ela não se altera mais.">
              {ficha.justificativaCancelamento}
            </Aviso>
          ) : null}

          <dl className="ficha">
            <dt>Responsável</dt>
            <dd>{ficha.responsavel.nome}</dd>
            <dt>Prioridade</dt>
            <dd>{rotuloDaPrioridade[ficha.prioridade]}</dd>
            <dt>Prazo</dt>
            <dd>{ficha.prazo ?? 'Sem prazo'}</dd>
            <dt>Criada por</dt>
            <dd>
              {ficha.criador} em {formatarDataHora(ficha.criadoEm)}
            </dd>
            {ficha.vinculo?.tipo === 'demanda' ? (
              <>
                <dt>Ligada à demanda</dt>
                <dd>
                  <Link to={`/g/demandas?demanda=${ficha.vinculo.id}`}>
                    Abrir a demanda {ficha.vinculo.id}
                  </Link>
                </dd>
              </>
            ) : null}
          </dl>
          {ficha.descricao ? (
            <>
              <h3>Descrição</h3>
              <p>{ficha.descricao}</p>
            </>
          ) : null}

          <AcoesDaTarefa ficha={ficha} sessao={sessao} key={`${ficha.id}-${ficha.etapa.id}`} />

          <div className="painel-do-usuario">
            <h3>Histórico</h3>
            <ol className="lista-simples">
              {ficha.movimentacoes.map((m) => (
                <li key={m.id}>
                  {formatarDataHora(m.criadaEm)}: {m.de ? `${m.de} → ` : 'Criada em '}
                  <strong>{m.para}</strong> por {m.autor}
                  {m.observacao ? ` (${m.observacao})` : ''}
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : null}
    </Modal>
  );
}
