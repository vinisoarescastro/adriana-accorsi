import { sessao } from '@gabinete/banco';
import { afterEach, describe, expect, inject, it } from 'vitest';
import {
  hostnameDeTeste,
  iniciarAmbiente,
  senhaDeTeste,
  type Ambiente,
} from '../teste/auxiliares.js';

const hora = 3_600_000;
let a: Ambiente;

afterEach(async () => {
  await a.encerrar();
});

const novo = async (opcoes: Parameters<typeof iniciarAmbiente>[1] = {}) => {
  a = await iniciarAmbiente(inject('urlAdminDeTeste'), opcoes);
  return a;
};

describe('entrar', () => {
  it('abre a sessão, define o cookie seguro e devolve as páginas alcançáveis', async () => {
    await novo();
    const { email } = await a.criarUsuario({ perfil: 'administrador' });

    const resposta = await a.entrar(email, senhaDeTeste);
    expect(resposta.statusCode).toBe(200);

    const corpo = resposta.json();
    expect(corpo.usuario).toMatchObject({ email, perfil: 'administrador' });
    expect(corpo.usuario.habilitacoes.sort()).toEqual(['AG', 'AT', 'FI', 'LG']);
    expect(corpo.senhaTrocaObrigatoria).toBe(false);
    expect(corpo.paginasAlcancaveis.map((p: { id: string }) => p.id)).toEqual([
      'painel',
      'equipe',
      'fluxos',
      'auditoria',
      'configuracoes',
    ]);

    const cookie = resposta.cookies.find((c) => c.name === 'sessao');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/', maxAge: 43_200 });
    expect(resposta.headers['cache-control']).toBe('no-store');

    // O banco só guarda o hash do ticket, nunca o ticket.
    const linhas = await a.conexao.bd.select().from(sessao);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]?.ticketHash).toMatch(/^[0-9a-f]{64}$/);
    expect(linhas[0]?.ticketHash).not.toContain(cookie!.value);

    expect((await a.trilha('acesso.entrada')).length).toBe(1);
  });

  it('em produção o cookie é __Host-, Secure, e só aceita a origem da aplicação', async () => {
    await novo({ producao: true });
    const { email } = await a.criarUsuario({ perfil: 'administrador' });

    const boa = await a.app.inject({
      method: 'POST',
      url: '/api/acesso/entrar',
      payload: { email, senha: senhaDeTeste },
      headers: { origin: `https://${hostnameDeTeste}` },
    });
    expect(boa.statusCode).toBe(200);
    expect(boa.cookies[0]).toMatchObject({ name: '__Host-sessao', secure: true, httpOnly: true });

    const ruim = await a.app.inject({
      method: 'POST',
      url: '/api/acesso/entrar',
      payload: { email, senha: senhaDeTeste },
      headers: { origin: 'https://site-malicioso.example' },
    });
    expect(ruim.statusCode).toBe(403);
    expect(ruim.json().codigo).toBe('origem_nao_permitida');
  });

  it('e-mail inexistente e senha errada dão exatamente a mesma resposta e o mesmo atraso', async () => {
    await novo();
    const { email } = await a.criarUsuario({ perfil: 'administrador' });

    const inexistente = await a.entrar('ninguem@exemplo.test', 'qualquer-senha');
    const errada = await a.entrar(email, 'senha-errada', '10.0.0.2');

    expect(inexistente.statusCode).toBe(401);
    expect(errada.statusCode).toBe(401);
    expect(errada.body).toBe(inexistente.body);
    expect(a.dormidas).toEqual([250, 250]);
    expect(inexistente.cookies).toHaveLength(0);
  });

  it('o atraso cresce 250 ms por tentativa, saturando em 1 s', async () => {
    await novo();
    for (let i = 0; i < 6; i += 1) await a.entrar('ninguem@exemplo.test', 'x');
    expect(a.dormidas).toEqual([250, 500, 750, 1000, 1000, 1000]);
  });

  it('bloqueia a conta por 15 minutos após 5 erros, sem revelar o bloqueio', async () => {
    await novo();
    const { email } = await a.criarUsuario({ perfil: 'administrador' });

    const erradas = [];
    for (let i = 0; i < 5; i += 1) erradas.push(await a.entrar(email, `errada-${i}`));
    const bloqueada = await a.entrar(email, senhaDeTeste);

    expect(bloqueada.statusCode).toBe(401);
    expect(bloqueada.body).toBe(erradas[0]?.body);
    expect((await a.trilha('acesso.bloqueio')).length).toBe(1);

    a.relogio.avancar(14 * 60_000);
    expect((await a.entrar(email, senhaDeTeste)).statusCode).toBe(401);

    a.relogio.avancar(61_000);
    expect((await a.entrar(email, senhaDeTeste)).statusCode).toBe(200);
  });

  it('um erro isolado não bloqueia, e o acerto zera a contagem', async () => {
    await novo();
    const { email } = await a.criarUsuario({ perfil: 'administrador' });

    for (let i = 0; i < 4; i += 1) await a.entrar(email, 'errada');
    expect((await a.entrar(email, senhaDeTeste)).statusCode).toBe(200);
    for (let i = 0; i < 4; i += 1) await a.entrar(email, 'errada');
    expect((await a.entrar(email, senhaDeTeste)).statusCode).toBe(200);
  });

  it('recusa usuário inativo com a mesma resposta genérica', async () => {
    await novo();
    await a.criarUsuario({ perfil: 'administrador' });
    const { email, usuarioId } = await a.criarUsuario({ perfil: 'assessor_interno' });
    await a.banco.conectar('migracao')
      .cliente`UPDATE usuario SET situacao = 'inativo' WHERE id = ${usuarioId}`;

    const resposta = await a.entrar(email, senhaDeTeste);
    expect(resposta.statusCode).toBe(401);
    expect(resposta.json().codigo).toBe('credenciais_invalidas');
  });

  it('recusa corpo inválido sem tocar no banco', async () => {
    await novo();
    const resposta = await a.app.inject({
      method: 'POST',
      url: '/api/acesso/entrar',
      payload: { email: 1 },
    });
    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().codigo).toBe('requisicao_invalida');
  });

  it('limita as tentativas de entrada por IP (429)', async () => {
    await novo({ limites: { entradasPorMinuto: 3 } });
    const codigos: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      codigos.push((await a.entrar('ninguem@exemplo.test', 'x', '10.9.9.9')).statusCode);
    }
    expect(codigos).toEqual([401, 401, 401, 429, 429]);
    // Outro IP não é afetado.
    expect((await a.entrar('ninguem@exemplo.test', 'x', '10.8.8.8')).statusCode).toBe(401);
  });
});

describe('sessão', () => {
  it('expira por inatividade (5 h) e a atividade a mantém', async () => {
    await novo();
    const { email } = await a.criarUsuario({ perfil: 'administrador' });
    const cookie = await a.sessaoDe(email);

    a.relogio.avancar(4 * hora);
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(200);
    a.relogio.avancar(4 * hora);
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(200);
    a.relogio.avancar(5 * hora + 1000);
    const vencida = await a.chamar('GET', '/api/acesso/sessao', { cookie });
    expect(vencida.statusCode).toBe(401);
    expect(vencida.json().codigo).toBe('nao_autenticado');
  });

  it('expira em 12 h mesmo com atividade contínua', async () => {
    await novo();
    const { email } = await a.criarUsuario({ perfil: 'administrador' });
    const cookie = await a.sessaoDe(email);

    for (let i = 0; i < 2; i += 1) {
      a.relogio.avancar(4 * hora);
      expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(200);
    }
    a.relogio.avancar(4 * hora + 1000);
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(401);
    expect(await a.conexao.bd.select().from(sessao)).toHaveLength(0);
  });

  it('sair encerra a sessão e limpa o cookie', async () => {
    await novo();
    const { email } = await a.criarUsuario({ perfil: 'administrador' });
    const cookie = await a.sessaoDe(email);

    const saida = await a.chamar('POST', '/api/acesso/sair', { cookie });
    expect(saida.statusCode).toBe(204);
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(401);
  });

  it('cookie inválido ou ausente é recusado, e o inválido é limpo', async () => {
    await novo();
    expect((await a.chamar('GET', '/api/acesso/sessao')).statusCode).toBe(401);
    const invalido = await a.chamar('GET', '/api/acesso/sessao', {
      cookie: 'sessao=ticket-forjado',
    });
    expect(invalido.statusCode).toBe(401);
    expect(invalido.headers['set-cookie']).toMatch(/sessao=;/);
  });

  it('usuário inativado perde a sessão no ato', async () => {
    await novo();
    await a.criarUsuario({ perfil: 'administrador' });
    const { email, usuarioId } = await a.criarUsuario({ perfil: 'supervisor' });
    const cookie = await a.sessaoDe(email);
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(200);

    await a.banco.conectar('migracao')
      .cliente`UPDATE usuario SET situacao = 'inativo' WHERE id = ${usuarioId}`;
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(401);
  });

  it('a sessão fixa as habilitações do momento da entrada', async () => {
    await novo();
    await a.criarUsuario({ perfil: 'administrador' });
    const { email } = await a.criarUsuario({ perfil: 'assessor_interno', habilitacoes: ['AT'] });
    const cookie = await a.sessaoDe(email);
    const corpo = (await a.chamar('GET', '/api/acesso/sessao', { cookie })).json();
    expect(corpo.usuario.habilitacoes).toEqual(['AT']);
  });
});

describe('primeiro acesso e troca de senha', () => {
  it('a senha inicial só abre a troca de senha, e nenhuma outra tela', async () => {
    await novo({
      registrarRotas: (app) => {
        app.get('/api/_teste/painel', { config: { operacao: 'painel.abrir' } }, async () => ({
          ok: true,
        }));
      },
    });
    const { email, senhaInicial } = await a.criarUsuario({
      perfil: 'administrador',
      trocaPendente: true,
    });
    const cookie = await a.sessaoDe(email, senhaInicial);

    const sessaoAtual = (await a.chamar('GET', '/api/acesso/sessao', { cookie })).json();
    expect(sessaoAtual.senhaTrocaObrigatoria).toBe(true);
    expect(sessaoAtual.paginasAlcancaveis).toEqual([]);

    const bloqueada = await a.chamar('GET', '/api/_teste/painel', { cookie });
    expect(bloqueada.statusCode).toBe(403);
    expect(bloqueada.json().codigo).toBe('troca_de_senha_obrigatoria');
  });

  it('troca a senha, libera as telas, encerra as outras sessões e registra sem a senha', async () => {
    await novo({
      registrarRotas: (app) => {
        app.get('/api/_teste/painel', { config: { operacao: 'painel.abrir' } }, async () => ({
          ok: true,
        }));
      },
    });
    const { email, senhaInicial } = await a.criarUsuario({
      perfil: 'administrador',
      trocaPendente: true,
    });
    const atual = await a.sessaoDe(email, senhaInicial);
    const outra = await a.sessaoDe(email, senhaInicial);
    const novaSenha = 'uma-senha-nova-e-boa-2026';

    const troca = await a.chamar('POST', '/api/acesso/trocar-senha', {
      cookie: atual,
      corpo: { senhaAtual: senhaInicial, novaSenha },
    });
    expect(troca.statusCode).toBe(204);

    expect((await a.chamar('GET', '/api/_teste/painel', { cookie: atual })).statusCode).toBe(200);
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie: outra })).statusCode).toBe(401);
    expect((await a.entrar(email, senhaInicial)).statusCode).toBe(401);
    expect((await a.entrar(email, novaSenha)).statusCode).toBe(200);

    const registros = await a.trilha('acesso.senha_trocada');
    expect(registros).toHaveLength(1);
    expect(JSON.stringify(await a.trilha())).not.toContain(novaSenha);
    const [inicial] = await a.banco.conectar('api').cliente`SELECT usada_em FROM senha_inicial`;
    expect(inicial?.usada_em).not.toBeNull();
  });

  it('recusa senha atual errada (e conta para o bloqueio) e senha nova fraca', async () => {
    await novo();
    const { email, senhaInicial } = await a.criarUsuario({
      perfil: 'administrador',
      trocaPendente: true,
    });
    const cookie = await a.sessaoDe(email, senhaInicial);

    const errada = await a.chamar('POST', '/api/acesso/trocar-senha', {
      cookie,
      corpo: { senhaAtual: 'nao-e-essa', novaSenha: 'uma-senha-nova-e-boa-2026' },
    });
    expect(errada.statusCode).toBe(403);
    expect(errada.json().codigo).toBe('senha_atual_incorreta');

    const fraca = await a.chamar('POST', '/api/acesso/trocar-senha', {
      cookie,
      corpo: { senhaAtual: senhaInicial, novaSenha: 'curta' },
    });
    expect(fraca.statusCode).toBe(422);
    expect(fraca.json()).toMatchObject({ codigo: 'senha_fraca' });
    expect(fraca.json().detalhes.length).toBeGreaterThan(0);

    for (let i = 0; i < 4; i += 1) {
      await a.chamar('POST', '/api/acesso/trocar-senha', {
        cookie,
        corpo: { senhaAtual: 'nao-e-essa', novaSenha: 'uma-senha-nova-e-boa-2026' },
      });
    }
    // Cinco erros bloquearam a conta: a sessão foi encerrada e o login recusado.
    expect((await a.chamar('GET', '/api/acesso/sessao', { cookie })).statusCode).toBe(401);
    expect((await a.entrar(email, senhaInicial)).statusCode).toBe(401);
  });

  it('a senha inicial vencida não entra, mas a senha errada continua dando a resposta genérica', async () => {
    await novo();
    const { email, senhaInicial } = await a.criarUsuario({
      perfil: 'administrador',
      trocaPendente: true,
    });
    const venceuHa1s = new Date(a.relogio.agora.getTime() - 1000).toISOString();
    await a.banco.conectar('migracao')
      .cliente`UPDATE senha_inicial SET expira_em = ${venceuHa1s}::timestamptz`;

    const vencida = await a.entrar(email, senhaInicial);
    expect(vencida.statusCode).toBe(403);
    expect(vencida.json().codigo).toBe('senha_inicial_vencida');
    expect((await a.entrar(email, 'errada')).json().codigo).toBe('credenciais_invalidas');
  });
});

describe('autorização nas rotas', () => {
  it('rota sem operação declarada impede o servidor de subir', async () => {
    await expect(
      novo({
        registrarRotas: (app) => {
          app.get('/api/_teste/sem-declaracao', async () => ({ ok: true }));
        },
      }),
    ).rejects.toThrow(/não declara uma operação/);
  });

  it('o decisor recusa como se a rota não existisse (404), e autoriza quem pode', async () => {
    await novo({
      registrarRotas: (app) => {
        app.get('/api/_teste/equipe', { config: { operacao: 'equipe.administrar' } }, async () => ({
          ok: true,
        }));
      },
    });
    await a.criarUsuario({ perfil: 'administrador' });
    const chefe = await a.criarUsuario({ perfil: 'chefe' });
    const supervisor = await a.criarUsuario({ perfil: 'supervisor' });
    const parlamentar = await a.criarUsuario({ perfil: 'parlamentar' });

    const cookieChefe = await a.sessaoDe(chefe.email);
    const cookieSupervisor = await a.sessaoDe(supervisor.email);
    const cookieParlamentar = await a.sessaoDe(parlamentar.email);

    expect((await a.chamar('GET', '/api/_teste/equipe', { cookie: cookieChefe })).statusCode).toBe(
      200,
    );

    const recusada = await a.chamar('GET', '/api/_teste/equipe', { cookie: cookieSupervisor });
    const inexistente = await a.chamar('GET', '/api/_teste/nao-existe', {
      cookie: cookieSupervisor,
    });
    expect(recusada.statusCode).toBe(404);
    expect(recusada.body).toBe(inexistente.body);
    expect(
      (await a.chamar('GET', '/api/_teste/equipe', { cookie: cookieParlamentar })).statusCode,
    ).toBe(404);
  });

  it('as páginas da barra seguem o perfil', async () => {
    await novo();
    await a.criarUsuario({ perfil: 'administrador' });
    const externo = await a.criarUsuario({ perfil: 'assessor_externo' });
    const corpo = (
      await a.chamar('GET', '/api/acesso/sessao', { cookie: await a.sessaoDe(externo.email) })
    ).json();
    expect(corpo.paginasAlcancaveis.map((p: { id: string }) => p.id)).toEqual([
      'painel',
      'equipe',
      'fluxos',
      'configuracoes',
    ]);
  });

  it('a saúde é pública e o restante exige sessão', async () => {
    await novo();
    expect((await a.chamar('GET', '/api/saude')).statusCode).toBe(200);
    expect((await a.chamar('GET', '/api/qualquer-coisa')).statusCode).toBe(401);
  });

  it('requisição de outra origem que altera dados é recusada', async () => {
    await novo();
    const resposta = await a.app.inject({
      method: 'POST',
      url: '/api/acesso/sair',
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(resposta.statusCode).toBe(403);
    expect(resposta.json().codigo).toBe('origem_nao_permitida');
  });
});
