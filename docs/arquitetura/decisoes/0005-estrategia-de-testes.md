# 0005. Estratégia de testes

- Estado: proposta
- Data: 2026-11-10

## Contexto

O valor do Mandatus está em regras que dependem do banco: gatilhos (trilha imutável, protocolo imutável, sempre um administrador, segregação de função), visões (conjunto publicável, saldo), restrições e papéis. Teste sem Postgres de verdade dá falsa segurança.

## Decisão

| Camada | Ferramenta | O que cobre |
| --- | --- | --- |
| Unidade e componentes | Vitest | Regras puras, schemas Zod, componentes React |
| Integração | Vitest com Testcontainers (Postgres 17 real) | Serviços, rotas, gatilhos, visões, papéis de banco, outbox |
| Ponta a ponta | Playwright | Fluxos completos no navegador e conferência de tela pequena |

- Integração roda sempre contra **Postgres real**, com migrações aplicadas. Não se usa SQLite nem banco em memória.
- Suítes que valem em **todas as fases**: matriz de permissão, alcance, trilha, invariantes de banco, área pública, dinheiro e segregação (ver `05-requisitos.md`).
- Testes de propriedade (por exemplo, com fast-check) para as somas de emenda e CEAP: o disponível nunca fica negativo, as somas sempre fecham, a reconstituição por data confere.
- A CI roda tudo em cada push; imagens só são publicadas com a CI verde.
- Cada fase tem um **roteiro de conferência manual** em `docs/operacao/conferencias/`, executado também em tela pequena.

## Alternativas consideradas

- **Jest:** mais lento com TypeScript moderno e sem vantagem aqui.
- **Cypress:** válido; Playwright é mais rápido e cobre mais navegadores.
- **SQLite em memória:** não executa gatilhos e visões do Postgres.

## Consequências

- A CI precisa de Docker (disponível nos executores do GitHub Actions).
- Os testes de integração são mais lentos que os de unidade; manter a camada de unidade grande e a de integração focada.
