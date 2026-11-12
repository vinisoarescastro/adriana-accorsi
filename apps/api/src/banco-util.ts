/**
 * O Drizzle embrulha o erro do Postgres: o código SQLSTATE e o nome da restrição ficam em
 * `erro.cause`. Estas funções leem os dois lugares.
 */
interface ErroDoPostgres {
  code?: string;
  constraint_name?: string;
  message?: string;
}

function origemDoErro(erro: unknown): ErroDoPostgres {
  if (typeof erro !== 'object' || erro === null) return {};
  const direto = erro as ErroDoPostgres & { cause?: unknown };
  if (direto.code) return direto;
  return typeof direto.cause === 'object' && direto.cause !== null
    ? (direto.cause as ErroDoPostgres)
    : {};
}

export const codigoDoPostgres = (erro: unknown) => origemDoErro(erro).code;
export const restricaoViolada = (erro: unknown) => origemDoErro(erro).constraint_name;
export const violouUnicidade = (erro: unknown) => codigoDoPostgres(erro) === '23505';

/** Mensagem do erro do Postgres, embrulhado pelo Drizzle ou não (o erro de COMMIT não é embrulhado). */
export const mensagemDoPostgres = (erro: unknown): string => origemDoErro(erro).message ?? '';
