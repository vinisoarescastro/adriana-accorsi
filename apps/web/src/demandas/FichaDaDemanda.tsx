import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { useEffect, useRef } from 'react';
import { useFicha } from '../api/atendimento';
import { Aviso, AvisoDeErro, Botao, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDaPrioridade, rotuloDoStatus } from '../rotulos';
import { AcoesDaDemanda } from './AcoesDaDemanda';
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
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titulo.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  return (
    <aside className="gaveta" role="dialog" aria-modal="false" aria-labelledby="titulo-da-ficha">
      <div className="gaveta__topo">
        <h2 id="titulo-da-ficha" ref={titulo} tabIndex={-1}>
          {ficha ? `${ficha.protocolo}: ${ficha.titulo}` : 'Demanda'}
        </h2>
        <Botao variante="secundario" onClick={aoFechar} aria-label="Fechar a ficha">
          Fechar
        </Botao>
      </div>

      {isLoading ? <Carregando /> : null}
      <AvisoDeErro erro={error} />

      {ficha ? (
        <>
          <p>
            <Selo tipo={ficha.status === 'em_andamento' ? 'ativo' : 'inativo'}>
              {rotuloDoStatus[ficha.status]}
            </Selo>{' '}
            {ficha.atrasada ? <Selo>Atrasada</Selo> : null} <Selo>Etapa: {ficha.etapa.nome}</Selo>
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
              />
              <DocumentosDaDemanda
                demandaId={ficha.id}
                documentos={ficha.documentos}
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
    </aside>
  );
}
