import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  perfisComTodasAsHabilitacoes,
  type EmendaFicha,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { useEquipe } from '../api/consultas';
import { useEtapasDeEmenda } from '../api/financeiro';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { useAcaoDaEmenda } from './useAcaoDaEmenda';

/** Mover de etapa (o responsável, o Supervisor ou superior), reatribuir e cancelar (Supervisor ou superior). */
export function AcoesDaEmenda({ ficha, sessao }: { ficha: EmendaFicha; sessao: RespostaDaSessao }) {
  const nivel = nivelDoPerfil[sessao.usuario.perfil];
  const supervisiona = nivel >= 3;
  const podeMover = supervisiona || ficha.responsavel.id === sessao.usuario.id;
  const { data: etapas } = useEtapasDeEmenda();
  const { data: equipe } = useEquipe();
  const [etapaId, setEtapaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [novo, setNovo] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const mover = useAcaoDaEmenda(ficha.id, 'Emenda movida');
  const reatribuir = useAcaoDaEmenda(ficha.id, 'Responsável alterado');
  const cancelar = useAcaoDaEmenda(ficha.id, 'Emenda cancelada');

  if (ficha.status === 'cancelada' || (!podeMover && !supervisiona)) return null;
  const responsaveis = (equipe ?? []).filter(
    (u) =>
      u.situacao === 'ativo' &&
      u.id !== ficha.responsavel.id &&
      nivelDoPerfil[u.perfil] >= 2 &&
      (perfisComTodasAsHabilitacoes.includes(u.perfil) || u.habilitacoes.includes('LG')),
  );

  return (
    <section className="ficha-acoes" aria-label="Ações da emenda">
      <AvisoDeErro erro={mover.error ?? reatribuir.error ?? cancelar.error} />
      {podeMover ? (
        <div className="ficha-acoes__grupo">
          <h4 className="ficha-acoes__titulo">Etapa</h4>
          <div className="linha-acao">
            <Campo rotulo="Mover para a etapa">
              {(p) => (
                <select {...p} value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {(etapas ?? [])
                    .filter((e) => e.id !== ficha.etapa.id)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                </select>
              )}
            </Campo>
            <Botao
              pequeno
              disabled={!etapaId}
              carregando={mover.isPending}
              onClick={() => {
                mover.mutate({
                  metodo: 'POST',
                  caminho: '/mover',
                  corpo: {
                    etapaId: Number(etapaId),
                    ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
                  },
                });
                setEtapaId('');
                setObservacao('');
              }}
            >
              Mover
            </Botao>
          </div>
          <Campo
            rotulo="Observação (opcional)"
            ajuda="Reabrir uma emenda encerrada é do Supervisor."
          >
            {(p) => (
              <textarea
                {...p}
                rows={2}
                maxLength={1000}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            )}
          </Campo>
        </div>
      ) : null}

      {supervisiona ? (
        <div className="ficha-acoes__grupo">
          <h4 className="ficha-acoes__titulo">Responsável</h4>
          <div className="linha-acao">
            <Campo rotulo="Passar para">
              {(p) => (
                <select {...p} value={novo} onChange={(e) => setNovo(e.target.value)}>
                  <option value="">Escolha…</option>
                  {responsaveis.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              )}
            </Campo>
            <Botao
              pequeno
              disabled={!novo}
              carregando={reatribuir.isPending}
              onClick={() => {
                reatribuir.mutate({
                  metodo: 'POST',
                  caminho: '/reatribuir',
                  corpo: { responsavelId: Number(novo) },
                });
                setNovo('');
              }}
            >
              Reatribuir
            </Botao>
          </div>
        </div>
      ) : null}

      {supervisiona ? (
        cancelando ? (
          <div className="ficha-edicao">
            <Campo
              rotulo="Justificativa do cancelamento"
              ajuda="Ao menos 10 caracteres. Só se cancela a emenda sem valor destinado."
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
                disabled={justificativa.trim().length < 10}
                carregando={cancelar.isPending}
                onClick={() =>
                  cancelar.mutate({
                    metodo: 'POST',
                    caminho: '/cancelar',
                    corpo: { justificativa: justificativa.trim() },
                  })
                }
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
            Cancelar emenda
          </Botao>
        )
      ) : null}
    </section>
  );
}
