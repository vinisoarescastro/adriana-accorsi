import { Inbox, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Abas } from '../componentes/abas';
import { CabecalhoDaPagina } from '../componentes/cabecalho';
import { Cartao } from '../componentes/cartao';
import { BotaoDeIcone, Dica, DicaDeUso, EstadoVazio } from '../componentes/dicas';
import { Modal, useConfirmacao } from '../componentes/modal';
import { BarraDeFerramentas, EsqueletoDeCartoes, EsqueletoDeTabela } from '../componentes/tabela';
import { useToast } from '../componentes/toast';
import { Aviso, Botao, Campo, Selo } from '../componentes/ui';

/** Catálogo do sistema de design: tudo o que existe, num só lugar, para conferir à vista. */
export function PaginaSistema() {
  const avisar = useToast();
  const [aba, setAba] = useState<'a' | 'b' | 'c'>('a');
  const [modal, setModal] = useState(false);
  const { pedir, elemento: confirmacao } = useConfirmacao();

  return (
    <main className="conteudo">
      <CabecalhoDaPagina
        titulo="Sistema de design"
        descricao="Catálogo dos componentes do Design System de referência, como aplicados no gabinete."
      />

      <div className="pilha">
        <Cartao titulo="Botões" descricao="Hierarquia de ações: uma primária por tela.">
          <div className="acoes">
            <Botao>
              <Plus size={16} aria-hidden="true" /> Primário
            </Botao>
            <Botao variante="secundario">Secundário</Botao>
            <Botao variante="fantasma">Fantasma</Botao>
            <Botao variante="perigo">Perigo</Botao>
            <Botao disabled>Desabilitado</Botao>
            <Botao pequeno>Pequeno</Botao>
            <BotaoDeIcone rotulo="Editar" icone={<Pencil size={16} aria-hidden="true" />} />
            <BotaoDeIcone
              rotulo="Excluir"
              variante="perigo"
              icone={<Trash2 size={16} aria-hidden="true" />}
            />
          </div>
        </Cartao>

        <Cartao
          titulo="Formulários"
          descricao="Rótulo sempre visível; ajuda e erro ligados ao campo."
        >
          <div className="grade-formulario">
            <Campo rotulo="Campo comum" ajuda="Texto de ajuda ligado ao campo.">
              {(p) => <input {...p} defaultValue="Valor" />}
            </Campo>
            <Campo rotulo="Campo com erro" erro="Mensagem de erro ligada ao campo.">
              {(p) => <input {...p} defaultValue="Inválido" />}
            </Campo>
          </div>
        </Cartao>

        <Cartao titulo="Feedbacks" descricao="Avisos fixos e notificações passageiras.">
          <Aviso tipo="sucesso" titulo="Operação concluída." />
          <Aviso tipo="atencao" titulo="Confira antes de continuar." />
          <Aviso tipo="erro" titulo="Não foi possível concluir.">
            Detalhes que o usuário pode corrigir.
          </Aviso>
          <div className="acoes">
            <Botao
              variante="secundario"
              onClick={() =>
                avisar({ tom: 'sucesso', titulo: 'Salvo', texto: 'Alterações gravadas.' })
              }
            >
              Mostrar toast
            </Botao>
            <Dica texto="Texto de apoio ao passar o mouse ou focar">
              <Botao variante="fantasma">Dica (tooltip)</Botao>
            </Dica>
          </div>
          <DicaDeUso>Orientação contextual discreta, sem ocupar um aviso inteiro.</DicaDeUso>
        </Cartao>

        <Cartao titulo="Status" descricao="O texto diz a situação; cor e ponto só reforçam.">
          <div className="acoes">
            <Selo tom="sucesso" ponto>
              Ativo
            </Selo>
            <Selo tom="atencao" ponto>
              Atenção
            </Selo>
            <Selo tom="perigo" ponto>
              Atrasado
            </Selo>
            <Selo tom="info">Informação</Selo>
            <Selo tom="primario">Destaque</Selo>
            <Selo>Neutro</Selo>
          </div>
        </Cartao>

        <Cartao titulo="Navegação e modais">
          <Abas
            rotulo="Exemplo de abas"
            valor={aba}
            aoMudar={setAba}
            itens={[
              { id: 'a', rotulo: 'Primeira' },
              { id: 'b', rotulo: 'Segunda' },
              { id: 'c', rotulo: 'Terceira' },
            ]}
          />
          <div className="acoes">
            <Botao variante="secundario" onClick={() => setModal(true)}>
              Abrir modal
            </Botao>
            <Botao
              variante="perigo"
              onClick={() =>
                pedir({
                  titulo: 'Excluir o exemplo?',
                  mensagem: 'Esta ação não pode ser desfeita.',
                  rotuloDeConfirmar: 'Excluir',
                  perigo: true,
                  aoConfirmar: () => avisar({ tom: 'info', titulo: 'Exemplo excluído' }),
                })
              }
            >
              Pedir confirmação
            </Botao>
          </div>
        </Cartao>

        <Cartao titulo="Tabela e busca">
          <BarraDeFerramentas rotulo="Buscar no exemplo">
            <Campo rotulo="Buscar">
              {(p) => <input {...p} type="search" placeholder="Nome" />}
            </Campo>
            <Botao type="submit" variante="secundario">
              <Search size={16} aria-hidden="true" /> Buscar
            </Botao>
          </BarraDeFerramentas>
          <div className="tabela-rolavel">
            <table className="tabela">
              <caption>Exemplo de tabela</caption>
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Maria</td>
                  <td>
                    <Selo tom="sucesso" ponto>
                      Ativo
                    </Selo>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Cartao>

        <Cartao titulo="Carregamento e estado vazio">
          <EsqueletoDeCartoes quantidade={3} />
          <EsqueletoDeTabela linhas={2} colunas={3} />
          <EstadoVazio
            icone={<Inbox size={20} />}
            titulo="Nada por aqui"
            texto="Quando houver itens, eles aparecem nesta lista."
          />
        </Cartao>
      </div>

      {modal ? (
        <Modal
          titulo="Exemplo de modal"
          descricao="Foco preso, Esc e clique fora fecham."
          aoFechar={() => setModal(false)}
          rodape={<Botao onClick={() => setModal(false)}>Entendi</Botao>}
        >
          <p>Conteúdo do modal.</p>
        </Modal>
      ) : null}
      {confirmacao}
    </main>
  );
}
