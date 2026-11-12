import {
  contaAcesso,
  criarUsuarioPorComando,
  gerarVerificador,
  type Conexao,
  type UsuarioCriado,
} from '@gabinete/banco';
import { criarBancoDeTeste, type BancoDeTeste } from '@gabinete/banco/teste';
import type { Area, Perfil } from '@gabinete/compartilhado';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Armazenamento } from '../armazenamento/armazenamento.js';
import { construirServidor, type DependenciasDoServidor } from '../servidor.js';

declare module 'vitest' {
  export interface ProvidedContext {
    /** URL administrativa do Postgres de teste, fornecida pelo globalSetup do pacote banco. */
    urlAdminDeTeste: string;
  }
}

/** Armazenamento em memória para os testes da API (o S3 tem teste próprio). */
export class ArmazenamentoEmMemoria implements Armazenamento {
  readonly objetos = new Map<string, { bytes: Buffer; tipo: string }>();

  async guardar(chave: string, bytes: Buffer, tipo: string) {
    this.objetos.set(chave, { bytes, tipo });
  }
  async ler(chave: string) {
    return this.objetos.get(chave) ?? null;
  }
  async remover(chave: string) {
    this.objetos.delete(chave);
  }
}

export const senhaDeTeste = 'SenhaDeTeste#2026';
export const segredoDeTeste = 'segredo-de-teste-com-mais-de-32-caracteres!!';
export const hostnameDeTeste = 'dominio.exemplo.test';

export interface Relogio {
  agora: Date;
  avancar(ms: number): void;
}

export interface Ambiente {
  readonly banco: BancoDeTeste;
  readonly conexao: Conexao;
  readonly app: FastifyInstance;
  readonly relogio: Relogio;
  readonly armazenamento: ArmazenamentoEmMemoria;
  /** Esperas pedidas pelo servidor (o atraso por tentativa errada), sem esperar de verdade. */
  readonly dormidas: number[];
  /** Cria um usuário já com a senha trocada (senhaDeTeste). Se for o primeiro, deve ser administrador. */
  criarUsuario(dados: {
    perfil: Perfil;
    email?: string;
    habilitacoes?: readonly Area[];
    trocaPendente?: boolean;
  }): Promise<UsuarioCriado & { senha: string }>;
  entrar(email: string, senha: string, ip?: string): Promise<LightMyRequestResponse>;
  /** Entra e devolve o cookie pronto para as chamadas seguintes. */
  sessaoDe(email: string, senha?: string): Promise<string>;
  chamar(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    opcoes?: { cookie?: string; corpo?: unknown; ip?: string; cabecalhos?: Record<string, string> },
  ): Promise<LightMyRequestResponse>;
  trilha(operacao?: string): Promise<
    {
      operacao: string;
      entidade: string;
      registro_id: string | null;
      autor_id: string | null;
      valor_novo: unknown;
    }[]
  >;
  encerrar(): Promise<void>;
}

export async function iniciarAmbiente(
  urlAdminDeTeste: string,
  opcoes: {
    producao?: boolean;
    limites?: DependenciasDoServidor['limites'];
    registrarRotas?: DependenciasDoServidor['registrarRotas'];
  } = {},
): Promise<Ambiente> {
  const banco = await criarBancoDeTeste(urlAdminDeTeste);
  const conexao = banco.conectar('api');

  const relogio: Relogio = {
    agora: new Date('2026-11-12T12:00:00-03:00'),
    avancar(ms) {
      this.agora = new Date(this.agora.getTime() + ms);
    },
  };
  const dormidas: number[] = [];
  const armazenamento = new ArmazenamentoEmMemoria();

  const app = await construirServidor({
    ambiente: {
      NODE_ENV: opcoes.producao ? 'production' : 'test',
      HOSTNAME_APP: hostnameDeTeste,
      SESSAO_SEGREDO: segredoDeTeste,
    },
    conexao,
    armazenamento,
    agora: () => relogio.agora,
    dormir: async (ms) => {
      dormidas.push(ms);
    },
    limites: { entradasPorMinuto: 1000, geralPorMinuto: 10_000, ...opcoes.limites },
    ...(opcoes.registrarRotas ? { registrarRotas: opcoes.registrarRotas } : {}),
  });

  let contador = 0;
  const nomeDoCookie = opcoes.producao ? '__Host-sessao' : 'sessao';

  const ambiente: Ambiente = {
    banco,
    conexao,
    app,
    relogio,
    armazenamento,
    dormidas,
    async criarUsuario(dados) {
      contador += 1;
      const email = dados.email ?? `usuario${contador}@exemplo.test`;
      const criado = await conexao.bd.transaction((tx) =>
        criarUsuarioPorComando(tx, {
          email,
          nome: `Usuário ${contador}`,
          perfil: dados.perfil,
          ...(dados.habilitacoes ? { habilitacoes: dados.habilitacoes } : {}),
          // A senha inicial dos testes vale por muito tempo (o relógio é falso).
          validadeDaSenhaEmHoras: 24 * 365,
        }),
      );
      if (dados.trocaPendente) return { ...criado, senha: criado.senhaInicial };

      await conexao.bd
        .update(contaAcesso)
        .set({
          verificadorSenha: await gerarVerificador(senhaDeTeste),
          senhaTrocaObrigatoria: false,
        })
        .where(eq(contaAcesso.email, email));
      return { ...criado, senha: senhaDeTeste };
    },
    entrar(email, senha, ip = '10.0.0.1') {
      return app.inject({
        method: 'POST',
        url: '/api/acesso/entrar',
        payload: { email, senha },
        remoteAddress: ip,
      });
    },
    async sessaoDe(email, senha = senhaDeTeste) {
      const resposta = await ambiente.entrar(email, senha);
      const cookie = resposta.cookies.find((c) => c.name === nomeDoCookie);
      if (!cookie) throw new Error(`Sem cookie de sessão: ${resposta.statusCode} ${resposta.body}`);
      return `${cookie.name}=${cookie.value}`;
    },
    chamar(metodo, url, o = {}) {
      return app.inject({
        method: metodo,
        url,
        ...(o.corpo !== undefined ? { payload: o.corpo as object } : {}),
        headers: { ...(o.cookie ? { cookie: o.cookie } : {}), ...o.cabecalhos },
        remoteAddress: o.ip ?? '10.0.0.1',
      });
    },
    async trilha(operacao) {
      const { cliente } = banco.conectar('api');
      return operacao
        ? cliente`SELECT operacao, entidade, registro_id, autor_id, valor_novo FROM trilha WHERE operacao = ${operacao} ORDER BY id`
        : cliente`SELECT operacao, entidade, registro_id, autor_id, valor_novo FROM trilha ORDER BY id`;
    },
    async encerrar() {
      await app.close();
      await banco.encerrar();
    },
  };
  return ambiente;
}
