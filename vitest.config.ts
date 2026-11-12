import { defineConfig } from 'vitest/config';

/**
 * Três camadas (ADR 0005):
 * - unidade: rápida, sem Docker (`*.test.ts`);
 * - web: componentes React em jsdom (`apps/web/**\/*.test.{ts,tsx}`);
 * - integração: contra um Postgres 17 de verdade em contêiner (`*.integracao.test.ts`).
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unidade',
          environment: 'node',
          include: ['apps/*/src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
          exclude: ['**/*.integracao.test.ts', 'apps/web/**', '**/node_modules/**'],
        },
      },
      {
        test: {
          name: 'web',
          environment: 'jsdom',
          include: ['apps/web/src/**/*.test.{ts,tsx}'],
          setupFiles: ['apps/web/src/teste/preparar.ts'],
        },
      },
      {
        test: {
          name: 'integracao',
          environment: 'node',
          include: ['apps/*/src/**/*.integracao.test.ts', 'packages/*/src/**/*.integracao.test.ts'],
          exclude: ['**/node_modules/**'],
          globalSetup: ['packages/banco/src/teste/global.ts'],
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
