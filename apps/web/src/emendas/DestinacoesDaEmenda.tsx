import { nivelDoPerfil } from '@gabinete/autorizacao';
import {
  formatarCnpj,
  formatarReais,
  type DestinacaoDto,
  type EmendaFicha,
  type RespostaDaSessao,
} from '@gabinete/compartilhado';
import { Ban, Plus } from 'lucide-react';
import { useState } from 'react';
import { useBeneficiarios } from '../api/legislativo';
import { useEtapasDeEmenda } from '../api/financeiro';
import {
  CampoDeDinheiro,
  dinheiroValido,
  normalizarDinheiroDigitado,
} from '../componentes/campo-de-dinheiro';
import { formatarPrazo } from '../componentes/quadro';
import { AvisoDeErro, Botao, Campo, Selo } from '../componentes/ui';
import { hojeNoGabinete } from '../formatos';
import { useAcaoDaEmenda } from './useAcaoDaEmenda';

/** Nova destinação a um beneficiário ativo. O valor não passa do disponível (o servidor e o banco conferem). */
function NovaDestinacao({ ficha }: { ficha: EmendaFicha }) {
  const acao = useAcaoDaEmenda(ficha.id, 'Destinação registrada');
  const [busca, setBusca] = useState('');
  const [beneficiarioId, setBeneficiarioId] = useState('');
  const [valor, setValor] = useState('');
  const [finalidade, setFinalidade] = useState(ficha.finalidade);
  const { data } = useBeneficiarios({ pagina: 1, busca, situacao: 'ativo', natureza: '' });
  const ok = beneficiarioId && dinheiroValido(valor) && finalidade.trim();

  return (
    <form
      className="ficha-edicao"
      aria-label="Nova destinação"
      onSubmit={(e) => {
        e.preventDefault();
        acao.mutate(
          {
            metodo: 'POST',
            caminho: '/destinacoes',
            corpo: {
              beneficiarioId: Number(beneficiarioId),
              valor: normalizarDinheiroDigitado(valor),
              finalidade: finalidade.trim(),
            },
          },
          { onSuccess: () => setValor('') },
        );
      }}
    >
      <AvisoDeErro erro={acao.error} />
      <Campo
        rotulo="Buscar beneficiário"
        ajuda="Pelo nome, pela razão social, pela cidade ou pelo CNPJ."
      >
        {(p) => <input {...p} value={busca} onChange={(e) => setBusca(e.target.value)} />}
      </Campo>
      <Campo rotulo="Beneficiário" obrigatorio>
        {(p) => (
          <select
            {...p}
            required
            value={beneficiarioId}
            onChange={(e) => setBeneficiarioId(e.target.value)}
          >
            <option value="">Escolha…</option>
            {(data?.itens ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nomeFantasia} · {b.cidade}/{b.estado} · {formatarCnpj(b.cnpj)}
              </option>
            ))}
          </select>
        )}
      </Campo>
      <CampoDeDinheiro
        rotulo="Valor"
        valor={valor}
        aoMudar={setValor}
        ajuda={`Disponível para destinar: ${formatarReais(ficha.valores.disponivel)}.`}
      />
      <Campo rotulo="Finalidade" obrigatorio>
        {(p) => (
          <textarea
            {...p}
            required
            rows={2}
            maxLength={2000}
            value={finalidade}
            onChange={(e) => setFinalidade(e.target.value)}
          />
        )}
      </Campo>
      <div className="acoes">
        <Botao
          type="submit"
          pequeno
          icone={<Plus size={14} aria-hidden="true" />}
          disabled={!ok}
          carregando={acao.isPending}
        >
          Destinar
        </Botao>
      </div>
    </form>
  );
}

function Destinacao({
  ficha,
  d,
  podeAcompanhar,
  supervisiona,
}: {
  ficha: EmendaFicha;
  d: DestinacaoDto;
  podeAcompanhar: boolean;
  supervisiona: boolean;
}) {
  const { data: etapas } = useEtapasDeEmenda();
  const mover = useAcaoDaEmenda(ficha.id, 'Destinação movida');
  const executar = useAcaoDaEmenda(ficha.id, 'Execução registrada');
  const cancelar = useAcaoDaEmenda(ficha.id, 'Destinação cancelada');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeNoGabinete());
  const [observacao, setObservacao] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const base = `/destinacoes/${d.id}`;
  const aberta = !d.cancelada && podeAcompanhar;

  return (
    <li className={`destinacao${d.cancelada ? ' destinacao--cancelada' : ''}`}>
      <div className="destinacao__topo">
        <div>
          <strong>{d.beneficiario.nome}</strong>
          <span className="propriedades__apoio">{formatarCnpj(d.beneficiario.cnpj)}</span>
        </div>
        <div className="destinacao__valor">
          {formatarReais(d.valor)}
          {d.cancelada ? (
            <Selo tom="perigo">Cancelada</Selo>
          ) : (
            <Selo tom="primario" ponto>
              {d.etapa.nome}
            </Selo>
          )}
        </div>
      </div>
      <p className="destinacao__finalidade">{d.finalidade}</p>
      {!d.cancelada ? (
        <p className="campo__ajuda">
          Executado {formatarReais(d.executado)} · a executar {formatarReais(d.aExecutar)}
        </p>
      ) : (
        <p className="campo__ajuda">Cancelada: {d.justificativaCancelamento}</p>
      )}
      {d.execucoes.length > 0 ? (
        <ul className="lista-simples">
          {d.execucoes.map((e) => (
            <li key={e.id}>
              {formatarPrazo(e.data)} · <strong>{formatarReais(e.valor)}</strong>
              {e.observacao ? ` — ${e.observacao}` : ''}
              <span className="propriedades__apoio"> {e.registradoPor}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {aberta ? (
        <>
          <AvisoDeErro erro={mover.error ?? executar.error ?? cancelar.error} />
          <div className="linha-acao">
            <Campo rotulo="Mover para a etapa">
              {(p) => (
                <select
                  {...p}
                  value=""
                  onChange={(e) =>
                    e.target.value &&
                    mover.mutate({
                      metodo: 'POST',
                      caminho: `${base}/mover`,
                      corpo: { etapaId: Number(e.target.value) },
                    })
                  }
                >
                  <option value="">{d.etapa.nome}</option>
                  {(etapas ?? [])
                    .filter((x) => x.id !== d.etapa.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.nome}
                      </option>
                    ))}
                </select>
              )}
            </Campo>
          </div>
          {d.aExecutar !== '0.00' ? (
            <form
              className="ficha-edicao"
              aria-label={`Registrar execução de ${d.beneficiario.nome}`}
              onSubmit={(e) => {
                e.preventDefault();
                executar.mutate(
                  {
                    metodo: 'POST',
                    caminho: `${base}/execucoes`,
                    corpo: {
                      valor: normalizarDinheiroDigitado(valor),
                      data,
                      ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
                    },
                  },
                  {
                    onSuccess: () => {
                      setValor('');
                      setObservacao('');
                    },
                  },
                );
              }}
            >
              <CampoDeDinheiro
                rotulo="Valor executado"
                valor={valor}
                aoMudar={setValor}
                ajuda={`Falta executar ${formatarReais(d.aExecutar)}.`}
              />
              <Campo rotulo="Data da execução">
                {(p) => (
                  <input
                    {...p}
                    type="date"
                    required
                    max={hojeNoGabinete()}
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                  />
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
              <div className="acoes">
                <Botao
                  type="submit"
                  pequeno
                  disabled={!dinheiroValido(valor) || !data}
                  carregando={executar.isPending}
                >
                  Registrar execução
                </Botao>
              </div>
            </form>
          ) : null}
        </>
      ) : null}

      {!d.cancelada && supervisiona && d.execucoes.length === 0 ? (
        cancelando ? (
          <div className="ficha-edicao">
            <Campo
              rotulo="Justificativa do cancelamento"
              ajuda="Ao menos 10 caracteres. O valor volta ao disponível da emenda."
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
                    caminho: `${base}/cancelar`,
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
            Cancelar destinação
          </Botao>
        )
      ) : null}
    </li>
  );
}

/** As destinações da emenda e as execuções de cada uma. */
export function DestinacoesDaEmenda({
  ficha,
  sessao,
}: {
  ficha: EmendaFicha;
  sessao: RespostaDaSessao;
}) {
  const nivel = nivelDoPerfil[sessao.usuario.perfil];
  const supervisiona = nivel >= 3 && ficha.status !== 'cancelada';
  const podeAcompanhar =
    ficha.status !== 'cancelada' && (nivel >= 3 || ficha.responsavel.id === sessao.usuario.id);
  return (
    <div className="ficha-acoes" aria-label="Destinações">
      {ficha.destinacoes.length === 0 ? (
        <p className="campo__ajuda">Nenhuma destinação. O valor inteiro está disponível.</p>
      ) : (
        <ul className="destinacoes">
          {ficha.destinacoes.map((d) => (
            <Destinacao
              key={d.id}
              ficha={ficha}
              d={d}
              podeAcompanhar={podeAcompanhar}
              supervisiona={supervisiona}
            />
          ))}
        </ul>
      )}
      {podeAcompanhar ? (
        <section className="ficha-acoes__grupo" aria-label="Destinar a um beneficiário">
          <h4 className="ficha-acoes__titulo">Nova destinação</h4>
          <NovaDestinacao ficha={ficha} />
        </section>
      ) : null}
    </div>
  );
}
