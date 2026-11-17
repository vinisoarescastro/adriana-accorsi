import {
  resultadosDeVotacao,
  type ProjetoFicha,
  type ResultadoDeVotacaoDto,
  type TramitacaoDto,
  type VotacaoDto,
} from '@gabinete/compartilhado';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { BotaoDeIcone } from '../componentes/dicas';
import { useConfirmacao } from '../componentes/modal';
import { formatarPrazo } from '../componentes/quadro';
import { Botao, Campo, AvisoDeErro, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDoResultadoDaVotacao } from '../rotulos';
import { useAcaoDoProjeto } from './useAcaoDoProjeto';

const tomDoResultado: Record<ResultadoDeVotacaoDto, 'sucesso' | 'perigo' | 'neutro'> = {
  aprovado: 'sucesso',
  aprovado_com_emendas: 'sucesso',
  rejeitado: 'perigo',
  retirado_de_pauta: 'neutro',
  adiado: 'neutro',
};

/**
 * Tramitação do projeto: a passagem por comissões (com o parecer) e as votações (só a data e o
 * resultado, sem placar individual). Quem pode alterar registra e remove; os demais só leem.
 */
export function TramitacaoDoProjeto({
  ficha,
  podeAlterar,
}: {
  ficha: ProjetoFicha;
  podeAlterar: boolean;
}) {
  return (
    <div className="ficha-acoes" aria-label="Tramitação do projeto">
      <ComissoesDoProjeto ficha={ficha} podeAlterar={podeAlterar} />
      <VotacoesDoProjeto ficha={ficha} podeAlterar={podeAlterar} />
    </div>
  );
}

function ComissoesDoProjeto({ ficha, podeAlterar }: { ficha: ProjetoFicha; podeAlterar: boolean }) {
  const acao = useAcaoDoProjeto(ficha.id);
  const { pedir, elemento } = useConfirmacao();
  const [comissao, setComissao] = useState('');
  const [data, setData] = useState('');
  const [parecer, setParecer] = useState('');

  const remover = (t: TramitacaoDto) =>
    pedir({
      titulo: 'Remover a passagem pela comissão?',
      mensagem: `${t.comissao}, em ${formatarPrazo(t.data)}.`,
      rotuloDeConfirmar: 'Remover',
      perigo: true,
      aoConfirmar: () => acao.mutate({ metodo: 'DELETE', caminho: `/tramitacoes/${t.id}` }),
    });

  return (
    <section className="ficha-acoes__grupo" aria-label="Comissões">
      <h4 className="ficha-acoes__titulo">Comissões</h4>
      <AvisoDeErro erro={acao.error} />
      {ficha.tramitacoes.length === 0 ? (
        <p className="campo__ajuda">Nenhuma passagem por comissão registrada.</p>
      ) : (
        <ul className="lista-simples">
          {ficha.tramitacoes.map((t) => (
            <li key={t.id}>
              <strong>{t.comissao}</strong> · {formatarPrazo(t.data)}
              {t.parecer ? <span className="ficha-texto"> — {t.parecer}</span> : null}
              <span className="propriedades__apoio">
                {' '}
                {t.registradoPor}, {formatarDataHora(t.registradoEm)}
              </span>
              {podeAlterar ? (
                <BotaoDeIcone
                  rotulo={`Remover a passagem por ${t.comissao}`}
                  icone={<Trash2 size={14} aria-hidden="true" />}
                  onClick={() => remover(t)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {podeAlterar ? (
        <form
          aria-label="Registrar passagem por comissão"
          className="ficha-edicao"
          onSubmit={(e) => {
            e.preventDefault();
            acao.mutate(
              {
                metodo: 'POST',
                caminho: '/tramitacoes',
                corpo: {
                  comissao: comissao.trim(),
                  data,
                  ...(parecer.trim() ? { parecer: parecer.trim() } : {}),
                },
              },
              {
                onSuccess: () => {
                  setComissao('');
                  setData('');
                  setParecer('');
                },
              },
            );
          }}
        >
          <Campo rotulo="Comissão">
            {(p) => (
              <input
                {...p}
                required
                maxLength={200}
                value={comissao}
                onChange={(e) => setComissao(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Data">
            {(p) => (
              <input
                {...p}
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Parecer (opcional)">
            {(p) => (
              <textarea
                {...p}
                rows={2}
                maxLength={2000}
                value={parecer}
                onChange={(e) => setParecer(e.target.value)}
              />
            )}
          </Campo>
          <div className="acoes">
            <Botao
              type="submit"
              pequeno
              icone={<Plus size={14} aria-hidden="true" />}
              disabled={!comissao.trim() || !data}
              carregando={acao.isPending}
            >
              Registrar comissão
            </Botao>
          </div>
        </form>
      ) : null}
      {elemento}
    </section>
  );
}

function VotacoesDoProjeto({ ficha, podeAlterar }: { ficha: ProjetoFicha; podeAlterar: boolean }) {
  const acao = useAcaoDoProjeto(ficha.id);
  const { pedir, elemento } = useConfirmacao();
  const [data, setData] = useState('');
  const [resultado, setResultado] = useState<ResultadoDeVotacaoDto>('aprovado');
  const [local, setLocal] = useState('');

  const remover = (v: VotacaoDto) =>
    pedir({
      titulo: 'Remover a votação?',
      mensagem: `${rotuloDoResultadoDaVotacao[v.resultado]}, em ${formatarPrazo(v.data)}.`,
      rotuloDeConfirmar: 'Remover',
      perigo: true,
      aoConfirmar: () => acao.mutate({ metodo: 'DELETE', caminho: `/votacoes/${v.id}` }),
    });

  return (
    <section className="ficha-acoes__grupo" aria-label="Votações">
      <h4 className="ficha-acoes__titulo">Votações</h4>
      <AvisoDeErro erro={acao.error} />
      {ficha.votacoes.length === 0 ? (
        <p className="campo__ajuda">Nenhuma votação registrada.</p>
      ) : (
        <ul className="lista-simples">
          {ficha.votacoes.map((v) => (
            <li key={v.id}>
              <Selo tom={tomDoResultado[v.resultado]}>
                {rotuloDoResultadoDaVotacao[v.resultado]}
              </Selo>{' '}
              {formatarPrazo(v.data)}
              {v.local ? ` · ${v.local}` : ''}
              <span className="propriedades__apoio">
                {' '}
                {v.registradoPor}, {formatarDataHora(v.registradoEm)}
              </span>
              {podeAlterar ? (
                <BotaoDeIcone
                  rotulo={`Remover a votação de ${formatarPrazo(v.data)}`}
                  icone={<Trash2 size={14} aria-hidden="true" />}
                  onClick={() => remover(v)}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {podeAlterar ? (
        <form
          aria-label="Registrar votação"
          className="ficha-edicao"
          onSubmit={(e) => {
            e.preventDefault();
            acao.mutate(
              {
                metodo: 'POST',
                caminho: '/votacoes',
                corpo: { data, resultado, ...(local.trim() ? { local: local.trim() } : {}) },
              },
              {
                onSuccess: () => {
                  setData('');
                  setLocal('');
                },
              },
            );
          }}
        >
          <Campo rotulo="Data da votação">
            {(p) => (
              <input
                {...p}
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            )}
          </Campo>
          <Campo rotulo="Resultado" ajuda="Só o resultado: o placar individual não se registra.">
            {(p) => (
              <select
                {...p}
                value={resultado}
                onChange={(e) => setResultado(e.target.value as ResultadoDeVotacaoDto)}
              >
                {resultadosDeVotacao.map((r) => (
                  <option key={r} value={r}>
                    {rotuloDoResultadoDaVotacao[r]}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo rotulo="Local (opcional)">
            {(p) => (
              <input
                {...p}
                maxLength={200}
                placeholder="Plenário ou a comissão"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
              />
            )}
          </Campo>
          <div className="acoes">
            <Botao
              type="submit"
              pequeno
              icone={<Plus size={14} aria-hidden="true" />}
              disabled={!data}
              carregando={acao.isPending}
            >
              Registrar votação
            </Botao>
          </div>
        </form>
      ) : null}
      {elemento}
    </section>
  );
}
