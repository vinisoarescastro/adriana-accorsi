import type { RespostaDaSessao } from '@gabinete/compartilhado';
import {
  FileText,
  History,
  Link2,
  MessageSquare,
  Paperclip,
  SlidersHorizontal,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { nivelDoPerfil, pode } from '@gabinete/autorizacao';
import { chavesDoAtendimento, useFicha } from '../api/atendimento';
import { DadosEditaveis } from '../componentes/dados-editaveis';
import { DescricaoEditavel } from '../componentes/descricao-editavel';
import { Guias, PainelDaGuia, usePrefixoDeGuias, type ItemDeGuia } from '../componentes/guias';
import { Historico } from '../componentes/historico';
import { Modal } from '../componentes/modal';
import { respondePeloItem, todosOsResponsaveis } from '../componentes/responsaveis';
import { ResumoDaFicha } from '../componentes/resumo';
import { SeloDeAtraso, SeloDePrioridade, SeloDeStatus } from '../componentes/situacao';
import { Aviso, AvisoDeErro, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { FichaDaPessoa } from '../pessoas/FichaDaPessoa';
import { AcoesDaDemanda } from './AcoesDaDemanda';
import { AcompanhamentoDoCidadao } from './AcompanhamentoDoCidadao';
import { ComentariosDaDemanda, DocumentosDaDemanda } from './ComentariosEDocumentos';

type Guia = 'detalhes' | 'comentarios' | 'documentos' | 'cidadao' | 'historico' | 'acoes';

/**
 * Ficha da demanda: no topo, o que importa de relance (etapa, prioridade, atraso, responsável, prazo);
 * embaixo, guias para o resto. O Assessor Externo vê a dele sem comentários, documentos, cidadão e
 * histórico (a ficha completa é do Assessor Interno em diante): a API já devolve só o que ele pode ver.
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
  const [guia, setGuia] = useState<Guia>('detalhes');
  const [pessoaAberta, setPessoaAberta] = useState(false);
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const prefixo = usePrefixoDeGuias();

  const cancelada = ficha?.status === 'cancelada';
  const podeEditar =
    ficha !== undefined &&
    !cancelada &&
    (nivelDoPerfil[sessao.usuario.perfil] >= 3 || respondePeloItem(ficha, sessao.usuario.id));
  const guias: ItemDeGuia<Guia>[] = ficha
    ? [
        { id: 'detalhes', rotulo: 'Detalhes', icone: <FileText size={14} aria-hidden="true" /> },
        ...(ficha.completa
          ? ([
              {
                id: 'comentarios',
                rotulo: 'Comentários',
                icone: <MessageSquare size={14} aria-hidden="true" />,
                contagem: ficha.comentarios.length,
              },
              {
                id: 'documentos',
                rotulo: 'Documentos',
                icone: <Paperclip size={14} aria-hidden="true" />,
                contagem: ficha.documentos.length,
              },
              { id: 'cidadao', rotulo: 'Cidadão', icone: <Link2 size={14} aria-hidden="true" /> },
              {
                id: 'historico',
                rotulo: 'Histórico',
                icone: <History size={14} aria-hidden="true" />,
                contagem: ficha.movimentacoes.length,
              },
            ] as ItemDeGuia<Guia>[])
          : []),
        ...(cancelada
          ? []
          : ([
              {
                id: 'acoes',
                rotulo: 'Ações',
                icone: <SlidersHorizontal size={14} aria-hidden="true" />,
              },
            ] as ItemDeGuia<Guia>[])),
      ]
    : [];
  const painel = (g: Guia, conteudo: ReactNode) =>
    guias.some((x) => x.id === g) ? (
      <PainelDaGuia id={g} prefixo={prefixo} ativa={guia === g}>
        {conteudo}
      </PainelDaGuia>
    ) : null;

  return (
    <Modal
      titulo={ficha ? ficha.titulo : 'Demanda'}
      descricao={ficha ? `Protocolo ${ficha.protocolo}` : undefined}
      tamanho="xl"
      classe="modal--ficha"
      aoFechar={aoFechar}
    >
      {isLoading || error ? (
        <div className="ficha-topo">
          {isLoading ? <Carregando /> : null}
          <AvisoDeErro erro={error} />
        </div>
      ) : null}

      {ficha ? (
        <>
          <div className="ficha-topo">
            <div className="ficha-selos">
              {cancelada ? <SeloDeStatus status={ficha.status} /> : null}
              <Selo tom="primario" ponto>
                {ficha.etapa.nome}
              </Selo>
              <SeloDePrioridade prioridade={ficha.prioridade} />
              {ficha.atrasada ? <SeloDeAtraso /> : null}
            </div>
            <ResumoDaFicha
              responsaveis={todosOsResponsaveis(ficha.responsavel, ficha.corresponsaveis).map(
                (r) => r.nome,
              )}
              prazo={ficha.prazo}
              atrasada={ficha.atrasada}
              solicitante={{
                nome: ficha.solicitante.nome ?? 'Dados eliminados a pedido',
                telefone: ficha.solicitanteTelefone,
                // A ficha da pessoa só abre para quem pode consultar pessoas e se há dados a mostrar.
                ...(ficha.solicitante.nome !== null && pode('pessoas.consultar', autoridade)
                  ? { aoAbrir: () => setPessoaAberta(true) }
                  : {}),
              }}
            />
            {cancelada ? (
              <Aviso tipo="atencao" titulo="Demanda cancelada. Ela não se altera mais.">
                {ficha.justificativaCancelamento}
              </Aviso>
            ) : null}
          </div>

          <Guias
            rotulo="Seções da demanda"
            prefixo={prefixo}
            valor={guia}
            aoMudar={setGuia}
            itens={guias}
          />

          <div className="ficha-rolagem">
            {painel(
              'detalhes',
              <>
                <DadosEditaveis
                  caminho={`/api/demandas/${ficha.id}`}
                  chaveDaFicha={chavesDoAtendimento.ficha(ficha.id)}
                  chavesParaAtualizar={chavesDoAtendimento.tudo}
                  item={ficha}
                  area="AT"
                  podeEditar={podeEditar}
                  podeTrocarResponsaveis={pode('demandas.reatribuir', autoridade)}
                  extras={[
                    {
                      rotulo: 'Registrada',
                      valor: (
                        <>
                          {ficha.autor}
                          <span className="propriedades__apoio">
                            {formatarDataHora(ficha.criadoEm)}
                          </span>
                        </>
                      ),
                    },
                  ]}
                />
                <DescricaoEditavel
                  sessao={sessao}
                  caminho={`/api/demandas/${ficha.id}`}
                  chaveDaFicha={chavesDoAtendimento.ficha(ficha.id)}
                  chavesParaAtualizar={chavesDoAtendimento.tudo}
                  texto={ficha.descricao}
                  area="AT"
                  podeEditar={podeEditar}
                />
                {!ficha.completa ? (
                  <p className="campo__ajuda">
                    Ficha reduzida: comentários, documentos e histórico são do Assessor Interno em
                    diante.
                  </p>
                ) : null}
              </>,
            )}
            {ficha.completa
              ? painel(
                  'comentarios',
                  <ComentariosDaDemanda
                    demandaId={ficha.id}
                    comentarios={ficha.comentarios}
                    sessao={sessao}
                    somenteLeitura={cancelada}
                  />,
                )
              : null}
            {ficha.completa
              ? painel(
                  'documentos',
                  <DocumentosDaDemanda
                    demandaId={ficha.id}
                    documentos={ficha.documentos}
                    sessao={sessao}
                    somenteLeitura={cancelada}
                  />,
                )
              : null}
            {ficha.completa
              ? painel(
                  'cidadao',
                  <AcompanhamentoDoCidadao
                    demandaId={ficha.id}
                    solicitanteId={ficha.solicitante.nome === null ? null : ficha.solicitante.id}
                    cancelada={cancelada}
                    sessao={sessao}
                  />,
                )
              : null}
            {ficha.completa
              ? painel(
                  'historico',
                  <Historico movimentacoes={ficha.movimentacoes} inicio="Registrada em" />,
                )
              : null}
            {painel('acoes', <AcoesDaDemanda ficha={ficha} sessao={sessao} />)}
          </div>
        </>
      ) : null}
      {pessoaAberta && ficha ? (
        <FichaDaPessoa
          id={ficha.solicitante.id}
          sessao={sessao}
          comLinkParaPessoas
          aoFechar={() => setPessoaAberta(false)}
        />
      ) : null}
    </Modal>
  );
}
