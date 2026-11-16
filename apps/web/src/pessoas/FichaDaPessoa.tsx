import type { RespostaDaSessao } from '@gabinete/compartilhado';
import { pode } from '@gabinete/autorizacao';
import { ExternalLink, FileText, Mail, MapPin, Phone, UsersRound } from 'lucide-react';
import { Link } from 'react-router';
import { usePessoa } from '../api/atendimento';
import { Avatar } from '../componentes/avatar';
import { Modal } from '../componentes/modal';
import { Propriedades } from '../componentes/propriedades';
import { AvisoDeErro, Botao, Carregando, Selo } from '../componentes/ui';
import { formatarDataHora } from '../formatos';
import { rotuloDaSituacao, rotuloDosAvisos } from './rotulos-da-pessoa';

/**
 * A pessoa atendida, com tudo o que o gabinete sabe dela, num modal. Abre por cima de qualquer tela
 * (a ficha da demanda, por exemplo) e também pelo endereço `/g/pessoas?pessoa=ID`.
 */
export function FichaDaPessoa({
  id,
  sessao,
  aoFechar,
  comLinkParaPessoas,
}: {
  id: number;
  sessao: RespostaDaSessao;
  aoFechar: () => void;
  /** Mostra "Abrir em Pessoas" (quando o modal não está já na página Pessoas). */
  comLinkParaPessoas?: boolean;
}) {
  const { data: p, isLoading, error } = usePessoa(id);
  const autoridade = { perfil: sessao.usuario.perfil, habilitacoes: sessao.usuario.habilitacoes };
  const eliminada = p?.situacao === 'dados_eliminados';

  return (
    <Modal
      titulo={p ? (p.nomeCompleto ?? 'Dados eliminados') : 'Pessoa'}
      descricao={p ? `Cadastrada em ${formatarDataHora(p.criadoEm)}` : undefined}
      tamanho="md"
      aoFechar={aoFechar}
      rodape={
        p ? (
          <>
            {comLinkParaPessoas && pode('pessoas.consultar', autoridade) ? (
              <Link
                className="botao botao--fantasma rodape-esquerda"
                to={`/g/pessoas?pessoa=${p.id}`}
                onClick={aoFechar}
              >
                <ExternalLink size={14} aria-hidden="true" />
                Abrir em Pessoas
              </Link>
            ) : null}
            <Link
              className="botao botao--secundario"
              to={`/g/demandas?solicitante=${p.id}&visao=lista`}
              onClick={aoFechar}
            >
              <FileText size={14} aria-hidden="true" />
              Ver demandas
            </Link>
            <Botao onClick={aoFechar}>Fechar</Botao>
          </>
        ) : null
      }
    >
      {isLoading ? <Carregando /> : null}
      <AvisoDeErro erro={error} />
      {p ? (
        <div className="pessoa-ficha">
          <div className="pessoa-ficha__topo">
            <Avatar nome={p.nomeCompleto ?? '?'} colorido />
            <div>
              <strong className="pessoa-ficha__nome">{p.nomeCompleto ?? 'Dados eliminados'}</strong>
              <div className="pessoa-ficha__selos">
                <Selo tom={p.situacao === 'ativa' ? 'sucesso' : 'neutro'} ponto>
                  {rotuloDaSituacao[p.situacao]}
                </Selo>
              </div>
            </div>
          </div>

          {eliminada ? (
            <p className="campo__ajuda">
              Os dados pessoais foram eliminados a pedido. Protocolos e histórico continuam, sem
              identificá-la.
            </p>
          ) : (
            <Propriedades
              colunas
              itens={[
                {
                  rotulo: 'Telefone',
                  valor: (
                    <span className="pessoa-ficha__linha">
                      <Phone size={14} aria-hidden="true" />
                      {p.telefone ?? '-'}
                    </span>
                  ),
                },
                {
                  rotulo: 'E-mail',
                  valor: (
                    <span className="pessoa-ficha__linha">
                      <Mail size={14} aria-hidden="true" />
                      {p.email ?? 'Não informado'}
                    </span>
                  ),
                },
                {
                  rotulo: 'Avisos por e-mail',
                  valor: (
                    <span className="pessoa-ficha__linha">
                      <UsersRound size={14} aria-hidden="true" />
                      {rotuloDosAvisos(p)}
                    </span>
                  ),
                },
                p.endereco
                  ? {
                      rotulo: 'Endereço',
                      valor: (
                        <span className="pessoa-ficha__linha">
                          <MapPin size={14} aria-hidden="true" />
                          {p.endereco}
                        </span>
                      ),
                    }
                  : null,
                p.contatos ? { rotulo: 'Outros contatos', valor: p.contatos } : null,
              ]}
            />
          )}
        </div>
      ) : null}
    </Modal>
  );
}
