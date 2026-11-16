import { pode } from '@gabinete/autorizacao';
import type {
  AcompanhamentoInterno,
  AndamentoDto,
  RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Copy, Pause, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { chavesDoAtendimento } from '../api/atendimento';
import { useAcompanhamento } from '../api/cidadao';
import { chamar } from '../api/cliente';
import { MenuSuspenso, type ItemDeMenu } from '../componentes/menu';
import { useConfirmacao } from '../componentes/modal';
import { ConsentimentoDeNotificacao } from '../componentes/ConsentimentoDeNotificacao';
import { Aviso, AvisoDeErro, Botao, Campo, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDoEstadoDoLink } from '../rotulos';

const limiteDoAndamento = 600;

const rotuloDaSituacaoPublica = {
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  arquivada: 'Encerrada',
  cancelada: 'Cancelada pelo gabinete',
} as const;

/** A prévia usa a MESMA projeção do cidadão: o que está aqui é exatamente o que ele vê. */
function Previa({ previa }: { previa: AcompanhamentoInterno['previa'] }) {
  if (!previa) {
    return (
      <p className="campo__ajuda">
        Hoje o cidadão não vê nada (o link está suspenso, ou o prazo de publicação já passou).
      </p>
    );
  }
  return (
    <div className="previa-publica" aria-label="Pré-visualização do que o cidadão vê">
      <p>
        Protocolo <strong>{previa.protocolo}</strong> · Situação:{' '}
        <strong>{rotuloDaSituacaoPublica[previa.situacao]}</strong>
      </p>
      {previa.nome ? <p>Solicitante: {previa.nome}</p> : null}
      {previa.telefone ? <p>Telefone: {previa.telefone}</p> : null}
      {previa.titulo ? <p>Assunto: {previa.titulo}</p> : null}
      {previa.etapas.length > 0 ? (
        <ol className="lista-simples">
          {previa.etapas.map((e, i) => (
            <li key={`${i}-${e.rotulo}-${e.estado}`}>
              <strong>{e.rotulo}</strong>:{' '}
              {e.estado === 'prevista'
                ? 'próxima etapa'
                : `${e.estado === 'atual' ? 'etapa atual' : 'concluída'}${e.data ? ` em ${formatarDataHora(e.data)}` : ''}`}
            </li>
          ))}
        </ol>
      ) : null}
      {previa.andamentos.length > 0 ? (
        <ul className="lista-simples">
          {previa.andamentos.map((a) => (
            <li key={`${a.publicadoEm}-${a.texto}`}>
              {formatarDataHora(a.publicadoEm)}: {a.texto}
            </li>
          ))}
        </ul>
      ) : (
        <p className="campo__ajuda">Sem novidades publicadas.</p>
      )}
    </div>
  );
}

function Andamento({
  a,
  podeRemover,
  aoRemover,
  desabilitado,
}: {
  a: AndamentoDto;
  podeRemover: boolean;
  aoRemover: () => void;
  desabilitado: boolean;
}) {
  return (
    <li className="historico__item">
      <span className="historico__ponto" aria-hidden="true" />
      <div className="historico__conteudo">
        {a.removido ? (
          <span className="historico__obs">
            <em>
              Removido por {a.removidoPor} em {a.removidoEm ? formatarDataHora(a.removidoEm) : ''}{' '}
              (some da página do cidadão; o texto fica no histórico).
            </em>
          </span>
        ) : (
          <span className="historico__titulo novidade__texto">{a.texto}</span>
        )}
        <span className="historico__meta">
          {formatarDataHora(a.publicadoEm)} · por {a.autor}
        </span>
        {!a.removido && podeRemover ? (
          <Botao
            pequeno
            variante="fantasma"
            className="novidade__remover"
            onClick={aoRemover}
            disabled={desabilitado}
          >
            Remover andamento
          </Botao>
        ) : null}
      </div>
    </li>
  );
}

/**
 * O lado da equipe do acompanhamento do cidadão: o link, a prévia e os andamentos publicáveis.
 * Andamento é um texto escrito DE PROPÓSITO para o cidadão: não existe jeito de publicar um
 * comentário interno, e a prioridade nunca aparece.
 */
export function AcompanhamentoDoCidadao({
  demandaId,
  solicitanteId,
  cancelada,
  sessao,
}: {
  demandaId: number;
  solicitanteId: number | null;
  cancelada: boolean;
  sessao: RespostaDaSessao;
}) {
  const cliente = useQueryClient();
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const { data, isLoading, error } = useAcompanhamento(demandaId, pode('link.obter', autoridade));
  const [texto, setTexto] = useState('');
  const [copiado, setCopiado] = useState(false);

  const atualizar = () => cliente.invalidateQueries({ queryKey: chavesDoAtendimento.tudo });
  const acao = useMutation({
    mutationFn: (caminho: 'revogar' | 'regenerar' | 'suspender' | 'retomar') =>
      chamar<AcompanhamentoInterno>('POST', `/api/demandas/${demandaId}/link/${caminho}`),
    onSuccess: atualizar,
  });
  const publicar = useMutation({
    mutationFn: () =>
      chamar<AndamentoDto[]>('POST', `/api/demandas/${demandaId}/andamentos`, { corpo: { texto } }),
    onSuccess: async () => {
      setTexto('');
      await atualizar();
    },
  });
  const remover = useMutation({
    mutationFn: (id: number) => chamar<AndamentoDto[]>('DELETE', `/api/andamentos/${id}`),
    onSuccess: atualizar,
  });

  if (!pode('link.obter', autoridade)) return null;

  const copiar = async (link: string) => {
    await navigator.clipboard?.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };
  const { pedir, elemento: confirmacao } = useConfirmacao();
  const gere = pode('link.gerir', autoridade);

  const itensDoMenu: ItemDeMenu[] = data
    ? [
        ...(data.estado === 'ativa'
          ? [
              {
                rotulo: 'Suspender link',
                icone: <Pause size={16} aria-hidden="true" />,
                desabilitado: acao.isPending,
                aoEscolher: () => acao.mutate('suspender'),
              },
            ]
          : []),
        ...(data.estado === 'suspensa'
          ? [
              {
                rotulo: 'Retomar link',
                icone: <Play size={16} aria-hidden="true" />,
                desabilitado: acao.isPending,
                aoEscolher: () => acao.mutate('retomar'),
              },
            ]
          : []),
        {
          rotulo: 'Gerar novo link',
          icone: <RefreshCw size={16} aria-hidden="true" />,
          desabilitado: acao.isPending,
          aoEscolher: () =>
            pedir({
              titulo: 'Gerar um novo link?',
              mensagem: 'O link antigo deixa de funcionar.',
              rotuloDeConfirmar: 'Gerar novo link',
              aoConfirmar: () => acao.mutate('regenerar'),
            }),
        },
        ...(data.estado !== 'revogada'
          ? [
              {
                rotulo: 'Revogar link',
                icone: <Ban size={16} aria-hidden="true" />,
                perigo: true,
                separadorAntes: true,
                desabilitado: acao.isPending,
                aoEscolher: () =>
                  pedir({
                    titulo: 'Revogar o link?',
                    mensagem:
                      'O segredo é apagado e não há volta (só gerando um novo). A consulta por protocolo e telefone continua valendo.',
                    rotuloDeConfirmar: 'Revogar link',
                    perigo: true,
                    aoConfirmar: () => acao.mutate('revogar'),
                  }),
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="cidadao" aria-labelledby="titulo-acompanhamento">
      {confirmacao}
      <h3 id="titulo-acompanhamento" className="somente-leitor">
        Acompanhamento do cidadão
      </h3>
      {isLoading ? <Carregando /> : null}
      <AvisoDeErro erro={error ?? acao.error ?? publicar.error ?? remover.error} />

      {data ? (
        <>
          <section className="cidadao__link" aria-label="Link de acompanhamento">
            <div className="cidadao__topo">
              <Selo tom={data.estado === 'ativa' ? 'sucesso' : 'neutro'} ponto>
                {rotuloDoEstadoDoLink[data.estado]}
              </Selo>
              {gere ? <MenuSuspenso rotulo="Gerenciar o link" itens={itensDoMenu} /> : null}
            </div>
            {data.link ? (
              <div className="cidadao__endereco">
                <code className="link-de-acompanhamento">{data.link}</code>
                <Botao
                  pequeno
                  variante="secundario"
                  icone={
                    copiado ? (
                      <Check size={14} aria-hidden="true" />
                    ) : (
                      <Copy size={14} aria-hidden="true" />
                    )
                  }
                  onClick={() => void copiar(data.link as string)}
                >
                  {copiado ? 'Link copiado' : 'Copiar link'}
                </Botao>
              </div>
            ) : (
              <p className="campo__ajuda">
                O link foi revogado: o cidadão ainda pode consultar pelo protocolo e telefone. Gere
                um novo link se quiser reabri-lo.
              </p>
            )}
            <p className="campo__ajuda cidadao__aviso">
              Quem tiver o link acompanha a solicitação. Compartilhe só com o próprio cidadão.
            </p>
          </section>

          <section aria-label="Novidades para o cidadão">
            <h4 className="ficha-secao">Novidades para o cidadão</h4>
            {cancelada ? (
              <Aviso tipo="atencao" titulo="Demanda cancelada: não recebe novos andamentos." />
            ) : pode('andamentos.publicar', autoridade) ? (
              <div className="cidadao__novidade">
                <Campo
                  rotulo="Nova novidade para o cidadão"
                  ajuda={`O cidadão lê este texto, sem o seu nome. Escreva para ele, sem dados internos. ${texto.length}/${limiteDoAndamento}`}
                >
                  {(p) => (
                    <textarea
                      {...p}
                      rows={2}
                      maxLength={limiteDoAndamento}
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                    />
                  )}
                </Campo>
                <Botao
                  pequeno
                  disabled={!texto.trim() || publicar.isPending}
                  onClick={() => publicar.mutate()}
                >
                  Publicar para o cidadão
                </Botao>
              </div>
            ) : null}
            {data.andamentos.length > 0 ? (
              <ol className="historico">
                {data.andamentos.map((a) => (
                  <Andamento
                    key={a.id}
                    a={a}
                    podeRemover={!cancelada && pode('andamentos.remover', autoridade)}
                    aoRemover={() => remover.mutate(a.id)}
                    desabilitado={remover.isPending}
                  />
                ))}
              </ol>
            ) : (
              <p className="campo__ajuda">Nenhuma novidade publicada ainda.</p>
            )}
          </section>

          <details className="cidadao__previa">
            <summary>O que o cidadão vê agora</summary>
            <Previa previa={data.previa} />
          </details>
        </>
      ) : null}

      {solicitanteId && data?.notificacao ? (
        <ConsentimentoDeNotificacao pessoaId={solicitanteId} sessao={sessao} />
      ) : null}
    </div>
  );
}
