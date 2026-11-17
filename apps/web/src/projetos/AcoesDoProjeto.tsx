import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  perfisComTodasAsHabilitacoes,
  type ProjetoFicha,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { useEquipe } from '../api/consultas';
import { useEtapasDeProjeto } from '../api/legislativo';
import { AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { useAcaoDoProjeto } from './useAcaoDoProjeto';

/**
 * Ações sobre o andamento do projeto: mover de etapa (o responsável, o Supervisor ou superior),
 * reatribuir e cancelar (Supervisor ou superior). Os dados se editam na guia Detalhes.
 */
export function AcoesDoProjeto({
  ficha,
  sessao,
}: {
  ficha: ProjetoFicha;
  sessao: RespostaDaSessao;
}) {
  const nivel = nivelDoPerfil[sessao.usuario.perfil];
  const supervisiona = nivel >= 3;
  const podeMover = supervisiona || ficha.responsavel.id === sessao.usuario.id;

  const { data: etapas } = useEtapasDeProjeto();
  const { data: equipe } = useEquipe();
  const destinos = (etapas ?? []).filter((e) => e.id !== ficha.etapa.id);
  const responsaveis = (equipe ?? []).filter(
    (u) =>
      u.situacao === 'ativo' &&
      u.id !== ficha.responsavel.id &&
      nivelDoPerfil[u.perfil] >= 2 &&
      (perfisComTodasAsHabilitacoes.includes(u.perfil) || u.habilitacoes.includes('LG')),
  );

  const [etapaId, setEtapaId] = useState('');
  const [observacao, setObservacao] = useState('');
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [justificativa, setJustificativa] = useState('');

  const mover = useAcaoDoProjeto(ficha.id, 'Projeto movido');
  const reatribuir = useAcaoDoProjeto(ficha.id, 'Responsável alterado');
  const cancelar = useAcaoDoProjeto(ficha.id, 'Projeto cancelado');

  if (ficha.status === 'cancelado' || (!podeMover && !supervisiona)) return null;

  return (
    <section className="ficha-acoes" aria-label="Ações do projeto">
      <AvisoDeErro erro={mover.error ?? reatribuir.error ?? cancelar.error} />

      {podeMover ? (
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
            ajuda="Reabrir um projeto encerrado é do Supervisor."
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
            <Botao
              pequeno
              disabled={!novoResponsavel}
              carregando={reatribuir.isPending}
              onClick={() => {
                reatribuir.mutate({
                  metodo: 'POST',
                  caminho: '/reatribuir',
                  corpo: { responsavelId: Number(novoResponsavel) },
                });
                setNovoResponsavel('');
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
              ajuda="Ao menos 10 caracteres. O projeto cancelado não se altera mais."
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
            Cancelar projeto
          </Botao>
        )
      ) : null}
    </section>
  );
}
