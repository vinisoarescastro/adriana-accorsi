# Gabinete Adriana Accorsi

Sistema de gestão integrada do gabinete da Deputada Federal Adriana Accorsi: atendimento a cidadãos, tarefas e agenda da equipe, acompanhamento de projetos de lei, emendas parlamentares e prestação de contas da CEAP, com trilha de auditoria.

É derivado do Mandatus (plataforma multi-gabinete), simplificado para **um único gabinete**.

> **Estado:** fase 0 (planejamento) aprovada; fase 1 (fundação) fechada na CI; fase 2 (atendimento) implementada, com a CI verde; fase 3 (cidadão: área pública e e-mail) encerrada por aceite; fase 4 (trabalho da equipe: tarefas, agenda, eventos, presença e avisos) encerrada por aceite; fase 5 (legislativo: beneficiários e projetos de lei) implementada e verificada localmente. Faltam a conferência manual da fase 5, a CI dela e a implantação na VPS. Veja o [plano de implementação](docs/plano/plano-de-implementacao.md) e o [progresso](docs/plano/progresso.md).

## Documentação

| Onde                                       | O que tem                                                    |
| ------------------------------------------ | ------------------------------------------------------------ |
| [docs/plano/](docs/plano/)                 | Plano de implementação por fase e registro de progresso      |
| [docs/especificacao/](docs/especificacao/) | O que o sistema faz: regras, perfis, requisitos              |
| [docs/arquitetura/](docs/arquitetura/)     | Como é construído: stack, modelo de dados, decisões (ADR)    |
| [docs/operacao/](docs/operacao/)           | Como rodar, implantar, fazer backup, roteiros de conferência |
| [docs/referencia/](docs/referencia/)       | Material do Mandatus, somente leitura                        |

Índice completo em [docs/README.md](docs/README.md).

## Estrutura planejada

Só existem no repositório as pastas que têm arquivos. Cada pasta de código é criada, já com conteúdo, na fase em que passa a ser necessária. Hoje existem `packages/compartilhado/` e `docs/`; as configurações comuns de TypeScript, ESLint, Prettier e Vitest ficam na raiz.

```
apps/        Aplicações executáveis
  web/         SPA React da equipe (Vite)
  api/         API Fastify: regras, sessão, auditoria
  publico/     Página do cidadão (Fastify + JSX, somente leitura)
  worker/      Avisos de prazo e envio de e-mail
packages/    Código compartilhado entre as aplicações
  compartilhado/  Schemas Zod, enums e tipos
  banco/          Esquema, migrações SQL, gatilhos e visões
  autorizacao/    Decisor de autorização, perfis e habilitações
infra/       Caddy, scripts de implantação, backup e restauração
tests/e2e/   Testes de ponta a ponta (Playwright)
docs/        Documentação
```

## Stack

React 19 + Vite (front), Fastify + Zod (API e área pública), PostgreSQL 17 com Drizzle, pg-boss (fila), Cloudflare R2 (arquivos), Resend (e-mail), Caddy (HTTPS). Detalhes e justificativas em [docs/arquitetura/decisoes/](docs/arquitetura/decisoes/).

## Como rodar

```
npm install
npm run ambiente:subir   # Postgres, S3Mock e Mailpit locais (Docker)
npm run lint && npm run typecheck && npm test
```

Detalhes em [docs/operacao/como-rodar.md](docs/operacao/como-rodar.md).

## Convenções

- Texto da interface e documentação em português.
- Commits em português, no formato `tipo: assunto` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
- Uma fase só fecha quando a documentação está atualizada (ver "Definição de pronto" no plano).
- Regras para agentes de IA em [CLAUDE.md](CLAUDE.md).
