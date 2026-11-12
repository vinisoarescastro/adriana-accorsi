import { Aviso, Botao, Campo, Selo } from '../componentes/ui';

/** Catálogo do sistema de design: tudo o que existe, num só lugar, para conferir à vista. */
export function PaginaSistema() {
  return (
    <main className="conteudo" style={{ maxWidth: '60rem', margin: '0 auto' }}>
      <h1>Sistema de design</h1>
      <p>
        Catálogo dos componentes. A paleta é provisória até a identidade visual da Deputada (PV-D).
      </p>

      <section className="catalogo-secao">
        <h2>Botões</h2>
        <div className="catalogo-amostras">
          <Botao>Primário</Botao>
          <Botao variante="secundario">Secundário</Botao>
          <Botao variante="perigo">Perigo</Botao>
          <Botao disabled>Desabilitado</Botao>
          <Botao pequeno>Pequeno</Botao>
        </div>
      </section>

      <section className="catalogo-secao">
        <h2>Campos</h2>
        <Campo rotulo="Campo comum" ajuda="Texto de ajuda ligado ao campo.">
          {(p) => <input {...p} defaultValue="Valor" />}
        </Campo>
        <Campo rotulo="Campo com erro" erro="Mensagem de erro ligada ao campo.">
          {(p) => <input {...p} defaultValue="Inválido" />}
        </Campo>
      </section>

      <section className="catalogo-secao">
        <h2>Avisos</h2>
        <Aviso tipo="sucesso" titulo="Operação concluída." />
        <Aviso tipo="atencao" titulo="Confira antes de continuar." />
        <Aviso tipo="erro" titulo="Não foi possível concluir.">
          Detalhes que o usuário pode corrigir.
        </Aviso>
        <p className="campo__ajuda">
          Nenhum aviso depende só de cor: todos começam com uma palavra que diz o que são.
        </p>
      </section>

      <section className="catalogo-secao">
        <h2>Selos</h2>
        <div className="catalogo-amostras">
          <Selo tipo="ativo">Ativo</Selo>
          <Selo tipo="inativo">Inativo</Selo>
          <Selo>Neutro</Selo>
        </div>
      </section>

      <section className="catalogo-secao">
        <h2>Tabela</h2>
        <div className="cartao tabela-rolavel">
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
                  <Selo tipo="ativo">Ativo</Selo>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
