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
@font-face { font-family: 'Poppins'; font-weight: 400; font-style: normal; font-display: swap; src: url('/fonte/400.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-weight: 500; font-style: normal; font-display: swap; src: url('/fonte/500.woff2') format('woff2'); }
@font-face { font-family: 'Poppins'; font-weight: 600; font-style: normal; font-display: swap; src: url('/fonte/600.woff2') format('woff2'); }
:root { color-scheme: light dark; --texto: #18181b; --fundo: #f4f5f7; --superficie: #ffffff; --suave: #52525b; --borda: #e4e4e7; --borda-forte: #d4d4d8; --destaque: #2563eb; --botao: #2563eb; --botao-hover: #1d4ed8; --sombra: 0 1px 2px rgba(24,24,27,.04), 0 6px 20px rgba(24,24,27,.05); --degrade: linear-gradient(160deg, #1e3a8a 0%, #172554 60%, #0f1b3d 100%); }
@media (prefers-color-scheme: dark) { :root { --texto: #fafafa; --fundo: #09090b; --superficie: #121214; --suave: #a1a1aa; --borda: #27272a; --borda-forte: #3f3f46; --destaque: #60a5fa; --sombra: none; --degrade: linear-gradient(160deg, #1e3a8a 0%, #14275e 55%, #0b1534 100%); } }
* { box-sizing: border-box; }
body { margin: 0; font: 400 1rem/1.55 'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--texto); background: var(--fundo); -webkit-font-smoothing: antialiased; }
header { background: var(--degrade); color: #fff; padding: 1.25rem 1rem; }
header > * { max-width: 40rem; margin-left: auto; margin-right: auto; }
main, footer { max-width: 40rem; margin: 0 auto; padding: 0 1rem; }
main { background: var(--superficie); border-radius: 1rem; box-shadow: var(--sombra); padding: 1.5rem 1.5rem 1.75rem; margin-top: 1.5rem; }
@media (prefers-color-scheme: dark) { main { border: 1px solid var(--borda); } }
.gabinete { margin: 0; font-weight: 600; font-size: 1.125rem; letter-spacing: -.01em; }
.servico { margin: .25rem 0 0; font-size: .875rem; }
header a { color: rgba(255,255,255,.85); }
a { color: var(--destaque); }
h1 { font-size: 1.375rem; font-weight: 600; line-height: 1.25; letter-spacing: -.015em; margin: 0 0 .75rem; }
h2 { font-size: 1.0625rem; font-weight: 600; margin: 1.75rem 0 .5rem; }
label { display: block; font-size: .875rem; font-weight: 500; margin-bottom: .25rem; }
input { width: 100%; font: inherit; min-height: 2.75rem; padding: .5rem .75rem; border: 1px solid var(--borda-forte); border-radius: .5rem; color: inherit; background: var(--superficie); }
input:focus, button:focus, a:focus { outline: none; box-shadow: 0 0 0 2px var(--superficie), 0 0 0 4px var(--destaque); }
input:focus { border-color: var(--destaque); }
button { font: inherit; font-weight: 500; padding: 0 1.25rem; border: 1px solid transparent; border-radius: .5rem; background: var(--botao); color: #fff; cursor: pointer; min-height: 2.75rem; }
button:hover { background: var(--botao-hover); }
.protocolo { font-size: 1.25rem; font-weight: 500; letter-spacing: .04em; font-variant-numeric: tabular-nums; }
.situacao { font-size: 1.0625rem; }
.ajuda, .data { color: var(--suave); font-size: .8125rem; }
.aviso { border: 1px solid var(--borda); background: var(--fundo); border-radius: .75rem; padding: .75rem 1rem; margin-top: 2rem; font-size: .875rem; color: var(--suave); }
.etapas, .andamentos { list-style: none; padding: 0; margin: 0; }
.etapa { padding: .5rem 0 .5rem .75rem; border-left: 3px solid var(--borda-forte); margin-bottom: .25rem; }
.etapa-atual { border-left-color: var(--destaque); font-weight: 500; }
.etapa-concluida { border-left-style: solid; }
.etapa-prevista { border-left-style: dashed; color: var(--suave); }
.andamentos li { border-bottom: 1px solid var(--borda); padding: .75rem 0; }
.andamentos p { margin: .25rem 0 0; }
.contato { padding-left: 1.2rem; }
footer { color: var(--suave); font-size: .8125rem; padding: 1rem 1rem 2rem; }
`;
