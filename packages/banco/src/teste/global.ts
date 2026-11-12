import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';
import { criarPapeis } from '../papeis.js';
import { senhasDeTeste } from './auxiliares.js';

declare module 'vitest' {
  export interface ProvidedContext {
    /** URL administrativa (superusuário) do Postgres de teste, apontando para o banco `postgres`. */
    urlAdminDeTeste: string;
  }
}

/**
 * Sobe UM Postgres 17 de verdade para toda a rodada de integração e cria os papéis
 * (que são do cluster). Cada arquivo de teste cria o próprio banco isolado.
 */
export default async function iniciar(projeto: TestProject) {
  const contêiner = await new PostgreSqlContainer('postgres:17')
    .withUsername('admin')
    .withPassword('admin')
    .withDatabase('postgres')
    .start();

  const urlAdmin = contêiner.getConnectionUri();
  await criarPapeis(urlAdmin, senhasDeTeste);
  projeto.provide('urlAdminDeTeste', urlAdmin);

  return async () => {
    await contêiner.stop();
  };
}
