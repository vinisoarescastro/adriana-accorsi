import { describe, expect, it } from 'vitest';
import { CanalResend, type ErroDeEnvio, type MensagemDeEmail } from './canal.js';
import { montarEmail, type DadosDoEmail } from './modelos.js';

const dados = (extra: Partial<DadosDoEmail> = {}): DadosDoEmail => ({
  evento: 'andamento_publicado',
  primeiroNome: 'Maria',
  protocolo: 'K7M2-9PQ4-XA3N',
  rotulo: 'Em análise',
  texto: 'Equipe vistoriou o local.',
  linkDeAcompanhamento: 'https://acompanhe.exemplo.test/a/segredo',
  linkDeDescadastro: 'https://acompanhe.exemplo.test/d/token',
  gabinete: { nome: 'Gabinete X', telefone: '(67) 3000-0000', email: 'contato@exemplo.test' },
  ...extra,
});

describe('modelos de e-mail (RN-NOT-04, 06)', () => {
  it('leva protocolo, situação, texto do andamento e os dois links, em vocabulário de cidadão', () => {
    const { assunto, texto, html } = montarEmail(dados());
    expect(assunto).toBe('Novidade sobre a sua solicitação (protocolo K7M2-9PQ4-XA3N)');
    for (const parte of [
      'Olá, Maria.',
      'K7M2-9PQ4-XA3N',
      'Situação: Em análise',
      'Equipe vistoriou o local.',
      'https://acompanhe.exemplo.test/a/segredo',
      'https://acompanhe.exemplo.test/d/token',
      '(67) 3000-0000',
      'autorizou o aviso por e-mail',
    ]) {
      expect(texto, parte).toContain(parte);
    }
    expect(html).toContain('href="https://acompanhe.exemplo.test/a/segredo"');
    expect(html).toContain('href="https://acompanhe.exemplo.test/d/token"');
    for (const proibido of ['demanda', 'etapa', 'fluxo', 'prioridade', 'prazo']) {
      expect(texto.toLowerCase(), proibido).not.toContain(proibido);
    }
  });

  it('cada evento tem o seu texto; o cancelamento usa texto padrão, sem o motivo', () => {
    expect(montarEmail(dados({ evento: 'conclusao', texto: null })).assunto).toContain('concluída');
    expect(montarEmail(dados({ evento: 'etapa_visivel', texto: null })).assunto).toContain(
      'Atualização',
    );
    const cancelamento = montarEmail(
      dados({ evento: 'cancelamento', texto: 'Pedido duplicado do cidadão' }),
    );
    expect(cancelamento.assunto).toContain('encerrada');
    expect(cancelamento.texto).not.toContain('duplicado');
    expect(cancelamento.texto).toContain('fale com o gabinete');
  });

  it('escapa HTML do texto publicado (ninguém injeta marcação no e-mail)', () => {
    const { html } = montarEmail(dados({ texto: '<script>alert(1)</script> & "aspas"' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });

  it('sem nome nem contato, o e-mail continua completo', () => {
    const { texto } = montarEmail(
      dados({ primeiroNome: '', gabinete: { nome: null, telefone: null, email: null } }),
    );
    expect(texto.startsWith('Olá.')).toBe(true);
    expect(texto).toContain('Gabinete da Deputada Adriana Accorsi');
  });
});

describe('canal Resend', () => {
  const mensagem: MensagemDeEmail = {
    idDoEnvio: 42,
    para: 'maria@exemplo.test',
    assunto: 'Assunto',
    texto: 'texto',
    html: '<p>html</p>',
    linkDeDescadastro: 'https://acompanhe.exemplo.test/d/token',
  };
  const canalCom = (resposta: () => Response | Promise<Response>) =>
    new CanalResend('chave-secreta', 'avisos@exemplo.test', 'Gabinete', async () => resposta());

  it('envia com chave de idempotência por envio e cabeçalhos de descadastro; devolve o id do provedor', async () => {
    let pedido: { url: string; init: RequestInit } | undefined;
    const canal = new CanalResend(
      'chave-secreta',
      'avisos@exemplo.test',
      'Gabinete',
      async (url, init) => {
        pedido = { url: String(url), init: init as RequestInit };
        return new Response(JSON.stringify({ id: 'abc123' }), { status: 200 });
      },
    );
    expect(await canal.enviar(mensagem)).toEqual({ idNoProvedor: 'abc123' });
    expect(pedido!.url).toBe('https://api.resend.com/emails');
    const cabecalhos = pedido!.init.headers as Record<string, string>;
    expect(cabecalhos['Idempotency-Key']).toBe('envio-42');
    expect(cabecalhos.Authorization).toBe('Bearer chave-secreta');
    const corpo = JSON.parse(String(pedido!.init.body));
    expect(corpo.from).toBe('Gabinete <avisos@exemplo.test>');
    expect(corpo.headers['List-Unsubscribe']).toBe('<https://acompanhe.exemplo.test/d/token>');
    expect(corpo.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('429 e 5xx são temporários; 4xx é permanente; falha de rede é temporária; a chave nunca aparece no erro', async () => {
    const tipoDe = async (resposta: () => Response | Promise<Response>) => {
      try {
        await canalCom(resposta).enviar(mensagem);
        return 'ok';
      } catch (erro) {
        expect((erro as Error).message).not.toContain('chave-secreta');
        return (erro as ErroDeEnvio).tipo;
      }
    };
    expect(await tipoDe(() => new Response('', { status: 429 }))).toBe('temporario');
    expect(await tipoDe(() => new Response('', { status: 503 }))).toBe('temporario');
    expect(await tipoDe(() => new Response('', { status: 422 }))).toBe('permanente');
    expect(await tipoDe(() => new Response('', { status: 401 }))).toBe('permanente');
    expect(await tipoDe(() => Promise.reject(new TypeError('fetch failed: chave-secreta')))).toBe(
      'temporario',
    );
  });
});
