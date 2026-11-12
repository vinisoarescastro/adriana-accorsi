import { esquemaProvisionamento, validarAmbiente } from '@gabinete/compartilhado';
import { criarPapeis, papeisDeAplicacao, prepararBanco, senhaDaUrl } from '../papeis.js';
import { executar } from './executar.js';

/**
 * Cria os papéis de banco e prepara o banco. Roda com a conexão administrativa
 * (DATABASE_URL_ADMIN), que só deve existir para este comando.
 */
await executar(async () => {
  const ambiente = validarAmbiente(esquemaProvisionamento);

  await criarPapeis(ambiente.DATABASE_URL_ADMIN, {
    migracao: senhaDaUrl(ambiente.DATABASE_URL_MIGRACAO, papeisDeAplicacao.migracao),
    api: senhaDaUrl(ambiente.DATABASE_URL_API, papeisDeAplicacao.api),
    worker: senhaDaUrl(ambiente.DATABASE_URL_WORKER, papeisDeAplicacao.worker),
    publico: senhaDaUrl(ambiente.DATABASE_URL_PUBLICO, papeisDeAplicacao.publico),
  });
  await prepararBanco(ambiente.DATABASE_URL_ADMIN);

  console.log('Papéis de banco criados e banco preparado.');
});
