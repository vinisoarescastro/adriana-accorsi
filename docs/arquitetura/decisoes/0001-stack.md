# 0001. Stack do projeto

- Estado: aceita (Drizzle confirmado em 2026-11-12)
- Data: 2026-11-10

## Contexto

O sistema substitui, para um único gabinete, o Mandatus (C# .NET, multi-inquilino). O mantenedor é uma pessoa, a hospedagem é uma VPS própria e o front deve ser React. Em vez de portar o código C#, o Mandatus serve como especificação.

## Decisão

| Camada | Escolha |
| --- | --- |
| Front da equipe | React 19, TypeScript, Vite, React Router, TanStack Query |
| API | Fastify com Zod |
| Área pública | Fastify com templates JSX, app separado, somente leitura |
| Banco | PostgreSQL 17 |
| Acesso a dados | Drizzle, com migrações em SQL |
| Gerenciador de pacotes | npm com workspaces |
| Fila e tarefas de fundo | pg-boss |
| Testes | Vitest, Testcontainers (Postgres real) e Playwright |
| E-mail | Provedor transacional, começando por Resend, atrás da interface `CanalDeNotificacao` |
| Arquivos | S3 compatível: Cloudflare R2 em produção, S3Mock (Adobe) no desenvolvimento e nos testes (o MinIO deixou de ser publicado no Docker Hub) |
| Infra | Docker Compose com Caddy, api, publico, worker e Postgres, em VPS |

## Alternativas consideradas

- **API em NestJS:** mais estrutura, porém mais cerimônia e peso do que um cliente único pede. A organização por módulos fica por convenção e lint.
- **Área pública em Astro:** um segundo framework para quatro páginas. Descartado em favor de Fastify com JSX.
- **Full-stack (React Router 7, TanStack Start, Next.js):** reduziria peças, mas mistura front e regra de negócio e enfraquece a separação da área pública.
- **ASP.NET (manter o backend do Mandatus):** reaproveitaria mais, mas o objetivo era mudar de stack.
- **Prisma:** o plano depende de gatilhos, visões e restrições em SQL.
- **BullMQ com Redis:** mais um serviço a operar para um volume pequeno.
- **pnpm:** melhor em monorepos, mas o npm foi preferido por já vir com o Node.

## Consequências

- Uma linguagem (TypeScript) de ponta a ponta, com schemas Zod compartilhados entre front, API e área pública.
- Sem política de linha por gabinete, a proteção de dados vem do decisor de autorização único, de uma camada única de acesso a dados e de testes.
- O npm é menos rigoroso que o pnpm: fixar a versão do Node (`.nvmrc` e `engines`) e versionar o `package-lock.json`.
- A organização por módulos na API depende de disciplina, imposta por lint e registrada no `CLAUDE.md`.
