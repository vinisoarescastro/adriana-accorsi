# @gabinete/publico

Área pública do cidadão: acompanha a própria solicitação pelo **link** ou pelo **protocolo e telefone**. Fastify, com páginas em JSX renderizadas no servidor (sem JavaScript no navegador).

## O que garante

- **Sem login, sem cookie, somente leitura, `noindex`** (`robots.txt` com `Disallow: /`, cabeçalho `X-Robots-Tag`, `Referrer-Policy: no-referrer`, CSP fechada, `no-store`).
- Só lê as visões `vw_acompanhamento_*` com o papel `app_publico`. Não importa o pacote `banco` inteiro: só `@gabinete/banco/publico`.
- Duas escritas, ambas **nominais** e feitas por funções do banco: a consulta por protocolo (um POST de leitura que registra o acesso) e o descadastro de e-mail.
- Link inválido, revogado, suspenso, expirado ou inexistente: o **mesmo** 404 e o mesmo corpo.
- 5 falhas na consulta bloqueiam a origem por 5 minutos (429), com atraso crescente. Só o hash da origem existe, na memória.
- Vocabulário de cidadão: "solicitação", "situação", "novidades".

## Organização

| Arquivo            | O que tem                                           |
| ------------------ | --------------------------------------------------- |
| `src/servidor.ts`  | Rotas, cabeçalhos de segurança e tratamento de erro |
| `src/paginas.tsx`  | As páginas e o CSS (servido em `/estilo.css`)       |
| `src/limitador.ts` | O limite de tentativas da consulta                  |
| `src/principal.ts` | Ponto de entrada: só aceita a conexão `app_publico` |

## Rodar

```
npm run dev -w @gabinete/publico    # http://127.0.0.1:3100
```

Variáveis: `DATABASE_URL_PUBLICO`, `HOSTNAME_APP`, `HOSTNAME_PUBLICO`, `HOST_PUBLICO` e `PORTA_PUBLICO` (opcionais). Em produção o processo **recusa** subir se receber o segredo da aplicação, as credenciais do armazenamento ou as de outros papéis.

Os testes (`*.integracao.test.ts`) sobem um Postgres de verdade e conferem a página inteira: nada de campo interno em lugar nenhum do HTML. Ver [ADR 0009](../../docs/arquitetura/decisoes/0009-area-publica-e-envio-de-email.md).
