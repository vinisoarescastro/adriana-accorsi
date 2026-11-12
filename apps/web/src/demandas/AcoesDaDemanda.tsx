import { nivelDoPerfil, pode } from '@gabinete/autorizacao';
import {
  prioridades,
  type DemandaFicha,
  type Prioridade,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chavesDoAtendimento } from '../api/atendimento';
import { chamar } from '../api/cliente';
import { useEquipe, useFluxos } from '../api/consultas';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { rotuloDaPrioridade } from '../rotulos';

/** Executa uma ação sobre a demanda, atualiza a ficha na hora e invalida lista, quadro e painel. */
function useAcao(id: number, caminho: string, metodo = 'POST') {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (corpo: unknown) =>
      chamar<DemandaFicha>(metodo, `/api/demandas/${id}${caminho}`, { corpo }),
    onSuccess: async (ficha) => {
      cliente.setQueryData(chavesDoAtendimento.ficha(id), ficha);
      await cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });
    },
  });
}

export function AcoesDaDemanda({
  ficha,
  sessao,
}: {
  ficha: DemandaFicha;
  sessao: RespostaDaSessao;
}) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  // Supervisor ou superior, ou o responsável, editam e movem (RN-DEM-08).
  const podeAlterar =
    nivelDoPerfil[sessao.usuario.perfil] >= 3 || ficha.responsavel.id === sessao.usuario.id;
  const podeReatribuir = pode('demandas.reatribuir', autoridade);
  const podeCancelar = pode('demandas.cancelar', autoridade);

  const { data: fluxos } = useFluxos();
  const { data: equipe } = useEquipe();
  const etapas = (fluxos?.find((f) => f.tipo === 'demanda')?.etapas ?? []).filter(
    (e) => e.situacao === 'ativa' && e.id !== ficha.etapa.id,
  );
  const responsaveis = (equipe ?? []).filter(
    (u) =>
      u.situacao === 'ativo' &&
      u.id !== ficha.responsavel.id &&
      (u.habilitacoes.includes('AT') || ['administrador', 'parlamentar'].includes(u.perfil)),
  );

  const [etapaId, setEtapaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [titulo, setTitulo] = useState(ficha.titulo);
  const [prioridade, setPrioridade] = useState<Prioridade>(ficha.prioridade);
  const [prazo, setPrazo] = useState(ficha.prazo ?? '');
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  const mover = useAcao(ficha.id, '/mover');
  const editar = useAcao(ficha.id, '', 'PATCH');
  const reatribuir = useAcao(ficha.id, '/reatribuir');
  const cancelar = useAcao(ficha.id, '/cancelar');
  const erro = mover.error ?? editar.error ?? reatribuir.error ?? cancelar.error;

  if (ficha.status === 'cancelada') return null;

  return (
    <div className="painel-do-usuario">
      <h3>Ações</h3>
      <AvisoDeErro erro={erro} />

      {podeAlterar ? (
        <>
          <div className="grade-formulario">
            <Campo rotulo="Mover para a etapa">
              {(p) => (
                <select {...p} value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {etapas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nomeInterno}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Campo rotulo="Observação (opcional)">
              {(p) => (
                <input
                  {...p}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  maxLength={1000}
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
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={200}
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
              variante="secundario"
              disabled={!titulo.trim() || editar.isPending}
              onClick={() => editar.mutate({ titulo, prioridade, prazo: prazo || null })}
            >
              Salvar alterações
            </Botao>
          </p>
        </>
      ) : (
        <p className="campo__ajuda">
          Só o responsável, o Supervisor ou superior alteram esta demanda.
        </p>
      )}

      {podeReatribuir ? (
        <>
          <Campo rotulo="Reatribuir para">
            {(p) => (
              <select
                {...p}
                value={novoResponsavel}
                onChange={(e) => setNovoResponsavel(e.target.value)}
              >
                <option value="">Escolha…</option>
                {responsaveis.map((u) => (
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
              variante="secundario"
              disabled={!novoResponsavel || reatribuir.isPending}
              onClick={() => {
                reatribuir.mutate({ responsavelId: Number(novoResponsavel) });
                setNovoResponsavel('');
              }}
            >
              Reatribuir
            </Botao>
          </p>
        </>
      ) : null}

      {podeCancelar ? (
        confirmandoCancelamento ? (
          <>
            <Campo
              rotulo="Justificativa do cancelamento"
              ajuda="Ao menos 10 caracteres. A demanda cancelada não se altera mais."
            >
              {(p) => (
                <textarea
                  {...p}
                  rows={2}
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  maxLength={1000}
                />
              )}
            </Campo>
            <div className="acoes">
              <Botao
                pequeno
                variante="perigo"
                disabled={justificativa.trim().length < 10 || cancelar.isPending}
                onClick={() => cancelar.mutate({ justificativa })}
              >
                Confirmar o cancelamento
              </Botao>
              <Botao
                pequeno
                variante="secundario"
                onClick={() => setConfirmandoCancelamento(false)}
              >
                Voltar
              </Botao>
            </div>
          </>
        ) : (
          <Botao pequeno variante="perigo" onClick={() => setConfirmandoCancelamento(true)}>
            Cancelar demanda
          </Botao>
        )
      ) : null}
    </div>
  );
}
