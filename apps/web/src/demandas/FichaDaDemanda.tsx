import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useFicha } from '../api/atendimento';
import { Modal } from '../componentes/modal';
import { SeloDeAtraso, SeloDeStatus } from '../componentes/situacao';
import { Aviso, AvisoDeErro, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDaPrioridade } from '../rotulos';
import { AcoesDaDemanda } from './AcoesDaDemanda';
import { AcompanhamentoDoCidadao } from './AcompanhamentoDoCidadao';
import { ComentariosDaDemanda, DocumentosDaDemanda } from './ComentariosEDocumentos';

/**
 * Ficha da demanda numa gaveta. O Assessor Externo vê a dele sem comentários, documentos e histórico
 * (a ficha completa é do Assessor Interno em diante): a API já devolve só o que ele pode ver.
 */
export function FichaDaDemanda({
  id,
  sessao,
  aoFechar,
}: {
  id: number;
  sessao: RespostaDaSessao;
  aoFechar: () => void;
}) {
  const { data: ficha, isLoading, error } = useFicha(id);

  return (
    <Modal
      titulo={ficha ? `${ficha.protocolo}: ${ficha.titulo}` : 'Demanda'}
      tamanho="xl"
      aoFechar={aoFechar}
    >
      {isLoading ? <Carregando /> : null}
      <AvisoDeErro erro={error} />

      {ficha ? (
        <>
          <p>
            <span className="acoes">
              <SeloDeStatus status={ficha.status} />
              {ficha.atrasada ? <SeloDeAtraso /> : null}
              <Selo>Etapa: {ficha.etapa.nome}</Selo>
            </span>
          </p>
          {ficha.status === 'cancelada' ? (
            <Aviso tipo="atencao" titulo="Demanda cancelada. Ela não se altera mais.">
              {ficha.justificativaCancelamento}
            </Aviso>
          ) : null}

          <dl className="ficha">
            <dt>Solicitante</dt>
            <dd>
              {ficha.solicitante.nome ?? 'Dados eliminados a pedido'}
              {ficha.solicitanteTelefone ? ` · ${ficha.solicitanteTelefone}` : ''}
            </dd>
            <dt>Responsável</dt>
            <dd>{ficha.responsavel.nome}</dd>
            <dt>Prioridade</dt>
            <dd>{rotuloDaPrioridade[ficha.prioridade]}</dd>
            <dt>Prazo</dt>
            <dd>{ficha.prazo ?? 'Sem prazo'}</dd>
            <dt>Registrada por</dt>
            <dd>
              {ficha.autor} em {formatarDataHora(ficha.criadoEm)}
            </dd>
          </dl>
          {ficha.descricao ? (
            <>
              <h3>Descrição</h3>
              <p>{ficha.descricao}</p>
            </>
          ) : null}

          <AcoesDaDemanda ficha={ficha} sessao={sessao} />

          {ficha.completa ? (
            <>
              <ComentariosDaDemanda
                demandaId={ficha.id}
                comentarios={ficha.comentarios}
                sessao={sessao}
                somenteLeitura={ficha.status === 'cancelada'}
              />
              <DocumentosDaDemanda
                demandaId={ficha.id}
                documentos={ficha.documentos}
                sessao={sessao}
                somenteLeitura={ficha.status === 'cancelada'}
              />
              <AcompanhamentoDoCidadao
                demandaId={ficha.id}
                solicitanteId={ficha.solicitante.nome === null ? null : ficha.solicitante.id}
                cancelada={ficha.status === 'cancelada'}
                sessao={sessao}
              />
              <div className="painel-do-usuario">
                <h3>Histórico</h3>
                <ol className="lista-simples">
                  {ficha.movimentacoes.map((m) => (
                    <li key={m.id}>
                      {formatarDataHora(m.criadaEm)}: {m.de ? `${m.de} → ` : 'Registrada em '}
                      <strong>{m.para}</strong> por {m.autor}
                      {m.observacao ? ` (${m.observacao})` : ''}
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            <p className="campo__ajuda">
              Ficha reduzida: comentários, documentos e histórico são do Assessor Interno em diante.
            </p>
          )}
        </>
      ) : null}
    </Modal>
  );
}
