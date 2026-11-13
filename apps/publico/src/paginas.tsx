import type { AcompanhamentoPublico, EtapaPublica, SituacaoPublica } from '@gabinete/compartilhado';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * Páginas do cidadão, renderizadas no servidor. Vocabulário de cidadão ("solicitação", "situação",
 * "andamento"), nada de "demanda", "etapa" ou "fluxo". Nenhum script: a página é só texto e um
 * formulário. Nada depende só de cor.
 */

const fuso = 'America/Sao_Paulo';
const data = new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, dateStyle: 'long' });
const dataEHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: fuso,
  dateStyle: 'long',
  timeStyle: 'short',
});

const rotuloDaSituacao: Record<SituacaoPublica, string> = {
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  arquivada: 'Encerrada',
  cancelada: 'Cancelada pelo gabinete',
};

export const nomeDoGabinete = 'Gabinete da Deputada Adriana Accorsi';

function Estrutura({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="referrer" content="no-referrer" />
        <title>{titulo}</title>
        <link rel="stylesheet" href="/estilo.css" />
      </head>
      <body>
        <header>
          <p className="gabinete">{nomeDoGabinete}</p>
          <p className="servico">
            <a href="/">Acompanhe a sua solicitação</a>
          </p>
        </header>
        <main>{children}</main>
        <footer>
          <p>Esta página mostra apenas o andamento da sua solicitação.</p>
        </footer>
      </body>
    </html>
  );
}

const documento = (pagina: ReactNode) => `<!doctype html>${renderToStaticMarkup(pagina)}`;

export function paginaInicial(): string {
  return documento(
    <Estrutura titulo="Acompanhe a sua solicitação">
      <h1>Acompanhe a sua solicitação</h1>
      <p>
        Informe o número de protocolo que você recebeu no atendimento e o telefone que você deixou
        com o gabinete.
      </p>
      <form method="post" action="/consultar">
        <p>
          <label htmlFor="protocolo">Número de protocolo</label>
          <input
            id="protocolo"
            name="protocolo"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="XXXX-XXXX-XXXX"
            maxLength={20}
            required
          />
        </p>
        <p>
          <label htmlFor="telefone">Telefone, com DDD</label>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            autoComplete="tel"
            placeholder="(67) 99999-0000"
            maxLength={25}
            required
          />
        </p>
        <p>
          <button type="submit">Consultar</button>
        </p>
      </form>
      <p className="ajuda">
        Se você recebeu um endereço (link) do gabinete, abra-o diretamente: não é preciso preencher
        nada aqui.
      </p>
    </Estrutura>,
  );
}

/** Uma só resposta para qualquer falha: link inexistente, revogado, expirado, suspenso ou dado errado. */
export function paginaNaoEncontrada(): string {
  return documento(
    <Estrutura titulo="Solicitação não encontrada">
      <h1>Não encontramos esta solicitação</h1>
      <p>
        Confira o endereço que você recebeu, ou o número de protocolo e o telefone. Se continuar sem
        encontrar, fale com o gabinete.
      </p>
      <p>
        <a href="/">Voltar ao início</a>
      </p>
    </Estrutura>,
  );
}

export function paginaMuitasTentativas(): string {
  return documento(
    <Estrutura titulo="Aguarde um instante">
      <h1>Muitas tentativas</h1>
      <p>Por segurança, aguarde alguns minutos antes de tentar de novo.</p>
    </Estrutura>,
  );
}

export function paginaDeErro(): string {
  return documento(
    <Estrutura titulo="Algo deu errado">
      <h1>Algo deu errado</h1>
      <p>Não foi possível mostrar esta página agora. Tente novamente em alguns minutos.</p>
    </Estrutura>,
  );
}

function descricaoDaEtapa(e: EtapaPublica): string {
  if (e.estado === 'prevista') return 'Próxima etapa';
  const quando = e.data ? ` em ${data.format(new Date(e.data))}` : '';
  return e.estado === 'atual' ? `Etapa atual${quando}` : `Concluída${quando}`;
}

export function paginaDeAcompanhamento(a: AcompanhamentoPublico, viaLink: boolean): string {
  return documento(
    <Estrutura titulo={`Solicitação ${a.protocolo}`}>
      <h1>Sua solicitação</h1>
      <p className="protocolo">
        Protocolo <strong>{a.protocolo}</strong>
      </p>
      <p className="situacao">
        Situação: <strong>{rotuloDaSituacao[a.situacao]}</strong>
      </p>
      {a.nome ? <p>Solicitante: {a.nome}</p> : null}
      {a.telefone ? <p>Telefone cadastrado: {a.telefone}</p> : null}
      {a.titulo ? <p>Assunto: {a.titulo}</p> : null}
      <p className="ajuda">
        Registrada em {data.format(new Date(a.criadoEm))}. Última atualização em{' '}
        {dataEHora.format(new Date(a.atualizadoEm))}.
      </p>

      {a.etapas.length > 0 ? (
        <section aria-labelledby="titulo-etapas">
          <h2 id="titulo-etapas">Como está o andamento</h2>
          <ol className="etapas">
            {a.etapas.map((e) => (
              <li key={`${e.rotulo}-${e.estado}`} className={`etapa etapa-${e.estado}`}>
                <strong>{e.rotulo}</strong>
                <span> — {descricaoDaEtapa(e)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section aria-labelledby="titulo-andamentos">
        <h2 id="titulo-andamentos">Novidades</h2>
        {a.andamentos.length === 0 ? (
          <p>Ainda não há novidades. Avisaremos aqui quando houver.</p>
        ) : (
          <ul className="andamentos">
            {a.andamentos.map((n) => (
              <li key={`${n.publicadoEm}-${n.texto}`}>
                <span className="data">{dataEHora.format(new Date(n.publicadoEm))}</span>
                <p>{n.texto}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-contato">
        <h2 id="titulo-contato">Dúvidas?</h2>
        <p>Fale com o gabinete{a.gabinete.nome ? ` (${a.gabinete.nome})` : ''}.</p>
        <ul className="contato">
          {a.gabinete.telefone ? <li>Telefone: {a.gabinete.telefone}</li> : null}
          {a.gabinete.email ? <li>E-mail: {a.gabinete.email}</li> : null}
        </ul>
      </section>

      {viaLink ? (
        <p className="aviso">
          Atenção: quem tiver o endereço desta página consegue acompanhar esta solicitação. Não o
          compartilhe.
        </p>
      ) : null}
    </Estrutura>,
  );
}

export function paginaDeDescadastro(token: string): string {
  return documento(
    <Estrutura titulo="Deixar de receber avisos">
      <h1>Deixar de receber avisos por e-mail</h1>
      <p>
        Você deixará de receber e-mails do gabinete sobre o andamento das suas solicitações. Isso
        vale na hora, e você pode pedir ao gabinete para voltar a receber quando quiser.
      </p>
      <form method="post" action={`/d/${token}`}>
        <p>
          <button type="submit">Deixar de receber avisos</button>
        </p>
      </form>
    </Estrutura>,
  );
}

export function paginaDescadastroConcluido(): string {
  return documento(
    <Estrutura titulo="Pronto">
      <h1>Pronto</h1>
      <p>Você não receberá mais avisos por e-mail do gabinete. Obrigado.</p>
    </Estrutura>,
  );
}

export const estilo = `
:root { color-scheme: light dark; --texto: #1b1f23; --fundo: #ffffff; --suave: #57606a; --borda: #d0d7de; --destaque: #0b5cad; }
@media (prefers-color-scheme: dark) { :root { --texto: #e6edf3; --fundo: #0d1117; --suave: #9aa4af; --borda: #30363d; --destaque: #6cb0ff; } }
* { box-sizing: border-box; }
body { margin: 0; font: 1.0625rem/1.55 system-ui, sans-serif; color: var(--texto); background: var(--fundo); }
header, main, footer { max-width: 40rem; margin: 0 auto; padding: 0 1rem; }
header { padding-top: 1rem; border-bottom: 1px solid var(--borda); }
.gabinete { margin: 0; font-weight: 700; }
.servico { margin: 0 0 .75rem; }
a { color: var(--destaque); }
h1 { font-size: 1.5rem; line-height: 1.25; margin: 1.5rem 0 .75rem; }
h2 { font-size: 1.2rem; margin: 1.75rem 0 .5rem; }
label { display: block; font-weight: 600; margin-bottom: .25rem; }
input { width: 100%; font: inherit; padding: .65rem .75rem; border: 2px solid var(--suave); border-radius: .4rem; color: inherit; background: var(--fundo); }
input:focus, button:focus, a:focus { outline: 3px solid var(--destaque); outline-offset: 2px; }
button { font: inherit; font-weight: 700; padding: .7rem 1.25rem; border: 2px solid var(--destaque); border-radius: .4rem; background: var(--destaque); color: #fff; cursor: pointer; min-height: 2.75rem; }
.protocolo { font-size: 1.25rem; letter-spacing: .04em; }
.situacao { font-size: 1.15rem; }
.ajuda, .data { color: var(--suave); font-size: .95rem; }
.aviso { border: 2px solid var(--suave); border-radius: .4rem; padding: .75rem; margin-top: 2rem; }
.etapas, .andamentos { list-style: none; padding: 0; margin: 0; }
.etapa { padding: .5rem 0 .5rem .75rem; border-left: 4px solid var(--borda); margin-bottom: .25rem; }
.etapa-atual { border-left-color: var(--destaque); }
.etapa-concluida { border-left-style: solid; }
.etapa-prevista { border-left-style: dashed; color: var(--suave); }
.andamentos li { border-bottom: 1px solid var(--borda); padding: .5rem 0; }
.andamentos p { margin: .25rem 0 0; }
.contato { padding-left: 1.2rem; }
footer { color: var(--suave); font-size: .9rem; padding-bottom: 2rem; }
`;
