import { describe, expect, it } from 'vitest';
import {
  ErroDeAmbiente,
  esquemaApi,
  esquemaPublico,
  esquemaWorker,
  validarAmbiente,
  variaveisProibidasNoPublico,
} from './ambiente.js';

const base = {
  NODE_ENV: 'test',
  HOSTNAME_APP: 'dominio.nucleodedados.com',
  HOSTNAME_PUBLICO: 'acompanhe.dominio.nucleodedados.com',
};

const armazenamento = {
  S3_ENDPOINT: 'http://127.0.0.1:9000',
  S3_BUCKET: 'gabinete',
  S3_ACCESS_KEY: 'chave',
  S3_SECRET_KEY: 'segredo-de-teste',
};

describe('validarAmbiente', () => {
  it('aceita a configuração completa da API', () => {
    const ambiente = validarAmbiente(esquemaApi, {
      ...base,
      ...armazenamento,
      DATABASE_URL_API: 'postgresql://app_api:x@127.0.0.1:5432/gabinete',
      SESSAO_SEGREDO: 'a'.repeat(32),
    });
    expect(ambiente.HOSTNAME_APP).toBe('dominio.nucleodedados.com');
  });

  it('recusa configuração incompleta e lista todos os problemas', () => {
    expect.assertions(3);
    try {
      validarAmbiente(esquemaApi, { ...base });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDeAmbiente);
      const mensagem = (erro as ErroDeAmbiente).message;
      expect(mensagem).toContain('DATABASE_URL_API');
      expect(mensagem).toContain('SESSAO_SEGREDO');
    }
  });

  it('trata variável vazia como não definida', () => {
    expect(() =>
      validarAmbiente(esquemaApi, {
        ...base,
        ...armazenamento,
        DATABASE_URL_API: 'postgresql://app_api:x@127.0.0.1:5432/gabinete',
        SESSAO_SEGREDO: '',
      }),
    ).toThrow(/SESSAO_SEGREDO/);
  });

  it('recusa segredo de sessão curto', () => {
    expect(() =>
      validarAmbiente(esquemaApi, {
        ...base,
        ...armazenamento,
        DATABASE_URL_API: 'postgresql://app_api:x@127.0.0.1:5432/gabinete',
        SESSAO_SEGREDO: 'curto',
      }),
    ).toThrow(/32 caracteres/);
  });

  it('recusa hostname com protocolo ou porta', () => {
    expect(() =>
      validarAmbiente(esquemaPublico, {
        ...base,
        HOSTNAME_APP: 'https://dominio.nucleodedados.com',
        DATABASE_URL_PUBLICO: 'postgresql://app_publico:x@127.0.0.1:5432/gabinete',
      }),
    ).toThrow(/HOSTNAME_APP/);
  });

  it('nunca inclui valores recebidos na mensagem de erro', () => {
    expect.assertions(1);
    try {
      validarAmbiente(esquemaApi, {
        ...base,
        ...armazenamento,
        DATABASE_URL_API: 'postgresql://app_api:x@127.0.0.1:5432/gabinete',
        SESSAO_SEGREDO: 'segredo-que-nao-pode-vazar',
        S3_ENDPOINT: 'isto-nao-e-uma-url-valida-e-secreta',
      });
    } catch (erro) {
      const mensagem = (erro as Error).message;
      expect(mensagem).not.toMatch(/segredo-que-nao-pode-vazar|isto-nao-e-uma-url/);
    }
  });

  it('o processo público recusa credenciais do armazenamento e da API', () => {
    const proibidas = { proibidas: variaveisProibidasNoPublico } as const;
    const publico = {
      ...base,
      DATABASE_URL_PUBLICO: 'postgresql://app_publico:x@127.0.0.1:5432/gabinete',
    };

    expect(validarAmbiente(esquemaPublico, publico, proibidas).NODE_ENV).toBe('test');
    expect(() =>
      validarAmbiente(esquemaPublico, { ...publico, ...armazenamento }, proibidas),
    ).toThrow(/S3_SECRET_KEY: não deve estar definida/);
    expect(() =>
      validarAmbiente(
        esquemaPublico,
        { ...publico, DATABASE_URL_API: 'postgresql://app_api:x@127.0.0.1:5432/gabinete' },
        proibidas,
      ),
    ).toThrow(/DATABASE_URL_API: não deve estar definida/);
  });

  it('exige e-mail remetente válido no worker', () => {
    expect(() =>
      validarAmbiente(esquemaWorker, {
        ...base,
        ...armazenamento,
        DATABASE_URL_WORKER: 'postgresql://app_worker:x@127.0.0.1:5432/gabinete',
        EMAIL_PROVEDOR: 'resend',
        EMAIL_API_KEY: 'chave',
        EMAIL_REMETENTE: 'sem-arroba',
      }),
    ).toThrow(/EMAIL_REMETENTE/);
  });
});
