import { pode } from '@gabinete/autorizacao';
import type {
  AcompanhamentoInterno,
  AndamentoDto,
  RespostaDaSessao,
} from '@gabinete/compartilhado';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { chavesDoAtendimento } from '../api/atendimento';
import { useAcompanhamento } from '../api/cidadao';
import { chamar } from '../api/cliente';
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
          {previa.etapas.map((e) => (
            <li key={`${e.rotulo}-${e.estado}`}>
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
    <li>
      <span className="campo__ajuda">
        {formatarDataHora(a.publicadoEm)} · por {a.autor}
      </span>
      {a.removido ? (
        <p>
          <em>
            Removido por {a.removidoPor} em {a.removidoEm ? formatarDataHora(a.removidoEm) : ''}{' '}
            (some da página do cidadão; o texto fica no histórico).
          </em>
        </p>
      ) : (
        <>
          <p>{a.texto}</p>
          {podeRemover ? (
            <Botao pequeno variante="secundario" onClick={aoRemover} disabled={desabilitado}>
              Remover andamento
            </Botao>
          ) : null}
        </>
      )}
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
  const gere = pode('link.gerir', autoridade);

  return (
    <div className="painel-do-usuario" aria-labelledby="titulo-acompanhamento">
      <h3 id="titulo-acompanhamento">Acompanhamento do cidadão</h3>
      {isLoading ? <Carregando /> : null}
      <AvisoDeErro erro={error ?? acao.error ?? publicar.error ?? remover.error} />

      {data ? (
        <>
          <p>
            <Selo tipo={data.estado === 'ativa' ? 'ativo' : 'inativo'}>
              {rotuloDoEstadoDoLink[data.estado]}
            </Selo>
          </p>
          {data.link ? (
            <p>
              <code className="link-de-acompanhamento">{data.link}</code>{' '}
              <Botao pequeno variante="secundario" onClick={() => void copiar(data.link as string)}>
                {copiado ? 'Link copiado' : 'Copiar link'}
              </Botao>
            </p>
          ) : (
            <p className="campo__ajuda">
              O link foi revogado: o cidadão ainda pode consultar pelo protocolo e telefone. Gere um
              novo link se quiser reabri-lo.
            </p>
          )}
          <p className="campo__ajuda">
            Quem tiver o link acompanha a solicitação. Compartilhe só com o próprio cidadão.
          </p>

          {gere ? (
            <div className="acoes">
              {data.estado === 'ativa' ? (
                <Botao
                  pequeno
                  variante="secundario"
                  disabled={acao.isPending}
                  onClick={() => acao.mutate('suspender')}
                >
                  Suspender link
                </Botao>
              ) : null}
              {data.estado === 'suspensa' ? (
                <Botao
                  pequeno
                  variante="secundario"
                  disabled={acao.isPending}
                  onClick={() => acao.mutate('retomar')}
                >
                  Retomar link
                </Botao>
              ) : null}
              <Botao
                pequeno
                variante="secundario"
                disabled={acao.isPending}
                onClick={() => {
                  if (window.confirm('Gerar um novo link? O link antigo deixa de funcionar.')) {
                    acao.mutate('regenerar');
                  }
                }}
              >
                Gerar novo link
              </Botao>
              {data.estado !== 'revogada' ? (
                <Botao
                  pequeno
                  variante="perigo"
                  disabled={acao.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Revogar o link? O segredo é apagado e não há volta (só gerando um novo). A consulta por protocolo e telefone continua valendo.',
                      )
                    ) {
                      acao.mutate('revogar');
                    }
                  }}
                >
                  Revogar link
                </Botao>
              ) : null}
            </div>
          ) : null}

          <details>
            <summary>O que o cidadão vê agora</summary>
            <Previa previa={data.previa} />
          </details>

          <h4>Novidades para o cidadão</h4>
          <ul className="lista-simples">
            {data.andamentos.map((a) => (
              <Andamento
                key={a.id}
                a={a}
                podeRemover={!cancelada && pode('andamentos.remover', autoridade)}
                aoRemover={() => remover.mutate(a.id)}
                desabilitado={remover.isPending}
              />
            ))}
            {data.andamentos.length === 0 ? <li>Nenhuma novidade publicada ainda.</li> : null}
          </ul>

          {cancelada ? (
            <Aviso tipo="atencao" titulo="Demanda cancelada: não recebe novos andamentos." />
          ) : pode('andamentos.publicar', autoridade) ? (
            <>
              <Campo
                rotulo="Nova novidade para o cidadão"
                ajuda={`O cidadão lê este texto, sem o seu nome. Escreva para ele, sem dados internos. ${texto.length}/${limiteDoAndamento}`}
              >
                {(p) => (
                  <textarea
                    {...p}
                    rows={3}
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
            </>
          ) : null}
        </>
      ) : null}

      {solicitanteId && data?.notificacao ? (
        <ConsentimentoDeNotificacao pessoaId={solicitanteId} sessao={sessao} />
      ) : null}
    </div>
  );
}
