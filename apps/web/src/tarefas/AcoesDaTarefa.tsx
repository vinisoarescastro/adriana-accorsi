import { nivelDoPerfil } from '@gabinete/autorizacao';
import type { RespostaDaSessao, TarefaFicha } from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { chamar } from '../api/cliente';
import { chavesDoTrabalho, useEtapasDeTarefa } from '../api/trabalho';
import { CampoComMencoes, idsMencionados, useColegas } from '../componentes/mencoes';
import { respondePeloItem } from '../componentes/responsaveis';
import { useToast } from '../componentes/toast';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';

/** Executa uma ação sobre a tarefa, atualiza a ficha na hora e invalida lista e painel. */
function useAcao(id: number, caminho: string, mensagem: string) {
  const cliente = useQueryClient();
  const avisar = useToast();
  return useMutation({
    mutationFn: (corpo: unknown) =>
      chamar<TarefaFicha>('POST', `/api/tarefas/${id}${caminho}`, { corpo }),
    onSuccess: async (ficha) => {
      cliente.setQueryData(chavesDoTrabalho.tarefa(id), ficha);
      await cliente.invalidateQueries({ queryKey: chavesDoTrabalho.tudo });
      avisar({ tom: 'sucesso', titulo: mensagem });
    },
    onError: (erro) =>
      avisar({ tom: 'erro', titulo: 'Não foi possível concluir', texto: erro.message }),
  });
}

/**
 * Ações sobre o andamento da tarefa: mover de etapa e cancelar. Os dados (título, responsáveis,
 * prazo, prioridade e descrição) se editam na guia Detalhes.
 */
export function AcoesDaTarefa({ ficha, sessao }: { ficha: TarefaFicha; sessao: RespostaDaSessao }) {
  // Supervisor ou superior, ou um dos responsáveis, movem e cancelam (RN-TAR-04).
  const podeAlterar =
    nivelDoPerfil[sessao.usuario.perfil] >= 3 || respondePeloItem(ficha, sessao.usuario.id);

  const { data: etapas } = useEtapasDeTarefa();
  const colegas = useColegas(sessao);
  const destinos = (etapas ?? []).filter((e) => e.id !== ficha.etapa.id);

  const [etapaId, setEtapaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [justificativa, setJustificativa] = useState('');

  const mover = useAcao(ficha.id, '/mover', 'Tarefa movida');
  const cancelar = useAcao(ficha.id, '/cancelar', 'Tarefa cancelada');
  const erro = mover.error ?? cancelar.error;

  if (ficha.status === 'cancelada' || !podeAlterar) return null;

  return (
    <section className="ficha-acoes" aria-label="Ações da tarefa">
      <AvisoDeErro erro={erro} />

      <div className="ficha-acoes__grupo">
        <h4 className="ficha-acoes__titulo">Etapa</h4>
        <div className="linha-acao">
          <Campo rotulo="Mover para a etapa">
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
          <Botao
            pequeno
            disabled={!etapaId || mover.isPending}
            onClick={() => {
              mover.mutate({
                etapaId: Number(etapaId),
                ...(observacao.trim()
                  ? { observacao: observacao.trim(), mencoes: idsMencionados(observacao, colegas) }
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
          ajuda="Reabrir uma tarefa concluída é do Supervisor. Mencione colegas com @."
          valor={observacao}
          aoMudar={setObservacao}
          colegas={colegas}
          linhas={2}
          maxLength={1000}
        />
      </div>

      {cancelando ? (
        <div className="ficha-edicao">
          <Campo
            rotulo="Justificativa do cancelamento"
            ajuda="Ao menos 10 caracteres. A tarefa cancelada não se altera mais."
          >
            {(p) => (
              <textarea
                {...p}
                rows={2}
                maxLength={1000}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
              />
            )}
          </Campo>
          <div className="acoes">
            <Botao
              pequeno
              variante="perigo"
              disabled={justificativa.trim().length < 10 || cancelar.isPending}
              onClick={() => cancelar.mutate({ justificativa: justificativa.trim() })}
            >
              Confirmar o cancelamento
            </Botao>
            <Botao pequeno variante="secundario" onClick={() => setCancelando(false)}>
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
          onClick={() => setCancelando(true)}
        >
          Cancelar tarefa
        </Botao>
      )}
    </section>
  );
}
