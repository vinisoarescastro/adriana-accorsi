import { nivelDoPerfil } from '@gabinete/autorizacao';
import type { DespesaFicha, RespostaDaSessao } from '@gabinete/compartilhado';
import { Ban, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useEtapasDeDespesa } from '../api/financeiro';
import { Aviso, AvisoDeErro, Botao, Campo } from '../componentes/ui';
import { useAcaoDaDespesa } from './useAcaoDaDespesa';

export function AcoesDaDespesa({
  ficha,
  sessao,
}: {
  ficha: DespesaFicha;
  sessao: RespostaDaSessao;
}) {
  const nivel = nivelDoPerfil[sessao.usuario.perfil];
  const eLancador = ficha.lancadaPor.id === sessao.usuario.id;
  const podeMexer = nivel >= 3 || eLancador || ficha.responsavel.id === sessao.usuario.id;
  const podeDecidir = nivel >= 3;
  const proprioPermitido = ['chefe', 'administrador', 'parlamentar'].includes(
    sessao.usuario.perfil,
  );
  const { data: etapas } = useEtapasDeDespesa();
  const enviar = useAcaoDaDespesa(ficha.id, 'Enviada para análise');
  const decidir = useAcaoDaDespesa(ficha.id);
  const cancelar = useAcaoDaDespesa(ficha.id, 'Despesa cancelada');
  const acompanhar = useAcaoDaDespesa(ficha.id, 'Despesa movida');
  const [motivo, setMotivo] = useState('');
  const [reprovando, setReprovando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [etapaId, setEtapaId] = useState('');

  if (ficha.status === 'cancelada') return null;
  const proximas = (etapas ?? []).filter((e) => {
    const de: Record<string, string[]> = {
      aprovada: ['Apresentada à Câmara'],
      apresentada: ['Ressarcida', 'Glosada pela Câmara'],
      reprovada: ['Arquivada'],
      glosada: ['Arquivada'],
    };
    return (de[ficha.status] ?? []).includes(e.nome);
  });
  const bloqueadaPelaSegregacao = ficha.status === 'em_analise' && eLancador && !proprioPermitido;

  return (
    <section className="ficha-acoes" aria-label="Ações da despesa">
      <AvisoDeErro erro={enviar.error ?? decidir.error ?? cancelar.error ?? acompanhar.error} />

      {ficha.status === 'lancada' && podeMexer ? (
        <div className="ficha-acoes__grupo">
          <h4 className="ficha-acoes__titulo">Enviar para análise</h4>
          <p className="campo__ajuda">
            Depois de enviada, a despesa já reduz o saldo e não se edita mais. Exige o comprovante,
            quando a categoria o pede.
          </p>
          <div className="acoes">
            <Botao
              pequeno
              carregando={enviar.isPending}
              onClick={() => enviar.mutate({ metodo: 'POST', caminho: '/enviar' })}
            >
              Enviar para análise
            </Botao>
          </div>
        </div>
      ) : null}

      {ficha.status === 'em_analise' && podeDecidir ? (
        <div className="ficha-acoes__grupo">
          <h4 className="ficha-acoes__titulo">Decisão</h4>
          {bloqueadaPelaSegregacao ? (
            <Aviso tipo="info" titulo="Você lançou esta despesa.">
              Quem lança não decide: peça a outro Supervisor, ao Chefe, ao Administrador ou à
              Parlamentar.
            </Aviso>
          ) : (
            <>
              {eLancador ? (
                <p className="campo__ajuda">
                  Você lançou esta despesa. A decisão ficará marcada como &quot;pelo próprio
                  lançador&quot; no relatório e na trilha.
                </p>
              ) : null}
              {reprovando ? (
                <div className="ficha-edicao">
                  <Campo rotulo="Motivo da reprovação" ajuda="Ao menos 10 caracteres.">
                    {(p) => (
                      <textarea
                        {...p}
                        rows={2}
                        maxLength={1000}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                      />
                    )}
                  </Campo>
                  <div className="acoes">
                    <Botao
                      pequeno
                      variante="perigo"
                      disabled={motivo.trim().length < 10}
                      carregando={decidir.isPending}
                      onClick={() =>
                        decidir.mutate({
                          metodo: 'POST',
                          caminho: '/decidir',
                          corpo: { decisao: 'reprovar', motivo: motivo.trim() },
                        })
                      }
                    >
                      Confirmar a reprovação
                    </Botao>
                    <Botao pequeno variante="secundario" onClick={() => setReprovando(false)}>
                      Voltar
                    </Botao>
                  </div>
                </div>
              ) : (
                <div className="acoes">
                  <Botao
                    pequeno
                    icone={<Check size={14} aria-hidden="true" />}
                    carregando={decidir.isPending}
                    onClick={() =>
                      decidir.mutate({
                        metodo: 'POST',
                        caminho: '/decidir',
                        corpo: { decisao: 'aprovar' },
                      })
                    }
                  >
                    Aprovar
                  </Botao>
                  <Botao
                    pequeno
                    variante="secundario"
                    icone={<X size={14} aria-hidden="true" />}
                    onClick={() => setReprovando(true)}
                  >
                    Reprovar
                  </Botao>
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {podeDecidir && proximas.length > 0 ? (
        <div className="ficha-acoes__grupo">
          <h4 className="ficha-acoes__titulo">Acompanhamento</h4>
          <div className="linha-acao">
            <Campo rotulo="Passar para">
              {(p) => (
                <select {...p} value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
                  <option value="">Escolha…</option>
                  {proximas.map((e) => (
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
              carregando={acompanhar.isPending}
              onClick={() => {
                acompanhar.mutate({
                  metodo: 'POST',
                  caminho: '/mover',
                  corpo: { etapaId: Number(etapaId) },
                });
                setEtapaId('');
              }}
            >
              Passar
            </Botao>
          </div>
        </div>
      ) : null}

      {(ficha.status === 'lancada' || ficha.status === 'em_analise') && podeMexer ? (
        cancelando ? (
          <div className="ficha-edicao">
            <Campo
              rotulo="Justificativa do cancelamento"
              ajuda="Ao menos 10 caracteres. O valor volta ao saldo."
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
            Cancelar despesa
          </Botao>
        )
      ) : null}
    </section>
  );
}
