import { nivelDoPerfil, pode } from '@gabinete/autorizacao';
import type { DemandaFicha, RespostaDaSessao } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { chavesDoAtendimento } from '../api/atendimento';
import { chamar } from '../api/cliente';
import { useFluxos } from '../api/consultas';
import { CampoComMencoes, idsMencionados, useColegas } from '../componentes/mencoes';
import { respondePeloItem } from '../componentes/responsaveis';
import { useToast } from '../componentes/toast';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';

/** Executa uma ação sobre a demanda, atualiza a ficha na hora e invalida lista, quadro e painel. */
function useAcao(id: number, caminho: string, mensagem: string) {
  const cliente = useQueryClient();
  const avisar = useToast();
  return useMutation({
    mutationFn: (corpo: unknown) =>
      chamar<DemandaFicha>('POST', `/api/demandas/${id}${caminho}`, { corpo }),
    onSuccess: async (ficha) => {
      cliente.setQueryData(chavesDoAtendimento.ficha(id), ficha);
      await cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });
      avisar({ tom: 'sucesso', titulo: mensagem });
    },
    onError: (erro) =>
      avisar({ tom: 'erro', titulo: 'Não foi possível concluir', texto: erro.message }),
  });
}

/**
 * Ações sobre o andamento da demanda: mover de etapa e cancelar. Os dados (título, responsáveis,
 * prazo, prioridade e descrição) se editam na guia Detalhes.
 */
export function AcoesDaDemanda({
  ficha,
  sessao,
}: {
  ficha: DemandaFicha;
  sessao: RespostaDaSessao;
}) {
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  // Supervisor ou superior, ou um dos responsáveis, movem (RN-DEM-08).
  const podeAlterar =
    nivelDoPerfil[sessao.usuario.perfil] >= 3 || respondePeloItem(ficha, sessao.usuario.id);
  const podeCancelar = pode('demandas.cancelar', autoridade);

  const { data: fluxos } = useFluxos();
  const colegas = useColegas(sessao, 'AT');
  const etapas = (fluxos?.find((f) => f.tipo === 'demanda')?.etapas ?? []).filter(
    (e) => e.situacao === 'ativa' && e.id !== ficha.etapa.id,
  );

  const [etapaId, setEtapaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  const mover = useAcao(ficha.id, '/mover', 'Demanda movida');
  const cancelar = useAcao(ficha.id, '/cancelar', 'Demanda cancelada');
  const erro = mover.error ?? cancelar.error;

  if (ficha.status === 'cancelada') return null;

  return (
    <section className="ficha-acoes" aria-label="Ações da demanda">
      <AvisoDeErro erro={erro} />

      {podeAlterar ? (
        <div className="ficha-acoes__grupo">
          <h4 className="ficha-acoes__titulo">Etapa</h4>
          <div className="linha-acao">
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
            <Botao
              pequeno
              disabled={!etapaId || mover.isPending}
              onClick={() => {
                mover.mutate({
                  etapaId: Number(etapaId),
                  ...(observacao.trim()
                    ? {
                        observacao: observacao.trim(),
                        mencoes: idsMencionados(observacao, colegas),
                      }
                    : {}),
                });
                setEtapaId('');
                setObservacao('');
              }}
            >
              Mover
            </Botao>
          </div>
          <CampoComMencoes
            rotulo="Observação (opcional)"
            ajuda="Mencione colegas com @."
            valor={observacao}
            aoMudar={setObservacao}
            colegas={colegas}
            linhas={2}
            maxLength={1000}
          />
        </div>
      ) : (
        <p className="campo__ajuda">
          Só os responsáveis, o Supervisor ou superior movem esta demanda.
        </p>
      )}

      {podeCancelar ? (
        confirmandoCancelamento ? (
          <div className="ficha-edicao">
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
          </div>
        ) : (
          <Botao
            pequeno
            variante="fantasma"
            className="botao--perigo-suave"
            icone={<Ban size={14} aria-hidden="true" />}
            onClick={() => setConfirmandoCancelamento(true)}
          >
            Cancelar demanda
          </Botao>
        )
      ) : null}
    </section>
  );
}
