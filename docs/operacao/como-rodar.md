# Como rodar

Estado: fase 1 implementada. Existem a API (`apps/api`), o front (`apps/web`) e os pacotes `banco`, `autorizacao` e `compartilhado`. O app público e o worker entram nas fases 3 e 4. Implantação na VPS: ver [implantacao.md](implantacao.md).

## Requisitos

| Ferramenta | Versão | Observação |
| --- | --- | --- |
| Node.js | 24 (arquivo `.nvmrc`; `engines` aceita 24.x) | Use `nvm use` se tiver o nvm |
| npm | 11 ou superior | Já vem com o Node 24 |
| Docker e Docker Compose | recentes | Só para o ambiente local (Postgres, S3Mock, Mailpit) |

## Primeira vez

```
npm install
cp .env.exemplo .env     # no PowerShell: Copy-Item .env.exemplo .env
```

Preencha o `.env`. O `.env` nunca é versionado.

## Ambiente local

```
npm run ambiente:subir     # sobe Postgres, S3Mock, Mailpit e ClamAV
npm run ambiente:descer    # para os serviços, mantendo os dados
npm run ambiente:limpar    # para e APAGA os dados locais
```

| Serviço | Endereço | Credenciais de desenvolvimento |
| --- | --- | --- |
| PostgreSQL 17 | `127.0.0.1:${POSTGRES_PORTA}` (padrão 5432), banco `gabinete` | usuário `dev`, senha `dev` (superusuário local) |
| S3Mock (S3 de desenvolvimento) | `http://127.0.0.1:9090`, bucket `gabinete` | qualquer chave de acesso |
| ClamAV (antivírus) | `127.0.0.1:3310` | sem autenticação. A primeira subida baixa as assinaturas (alguns minutos); até ficar `healthy`, o envio de documentos é recusado |
| Mailpit | SMTP `127.0.0.1:1025`, interface `http://127.0.0.1:8025` | sem autenticação |

Todas as portas escutam só em `127.0.0.1`. As credenciais são apenas de desenvolvimento local e nunca devem ser usadas em outro lugar. O Mailpit recebe todo e-mail e não envia nada para fora.

Se a porta 5432 estiver ocupada (comum no Windows, ou se você já tem outro Postgres), defina `POSTGRES_PORTA` no `.env` (por exemplo `55432`) e use a mesma porta nas URLs de conexão.

## Banco de dados

Com o Postgres local no ar e o `.env` preenchido (ver `.env.exemplo`):

```
npm run banco:preparar                       # cria os papéis e aplica as migrações
npm run banco:verificar                      # confere os invariantes de segurança
npm run banco:criar-administrador -- --email voce@exemplo.com --nome "Seu Nome"
npm run banco:semear                         # opcional: dados FICTÍCIOS de desenvolvimento
```

- `banco:preparar` usa a conexão administrativa (`DATABASE_URL_ADMIN`) só para criar os papéis. Depois disso, cada processo usa o seu papel.
- `banco:criar-administrador` mostra a senha inicial **uma única vez**; ela vale 72 horas e a troca é obrigatória no primeiro acesso. O comando recusa rodar se já houver um administrador.
- `banco:semear` recusa bancos que não sejam locais e bancos que já tenham usuários. As contas semeadas usam e-mails `@exemplo.test` e senhas aleatórias mostradas uma única vez.

Mais detalhes em [packages/banco/README.md](../../packages/banco/README.md).

## Qualidade

```
npm run lint              # ESLint (inclui limite de 400 linhas por arquivo)
npm run typecheck         # TypeScript em todos os pacotes
npm test                  # Todos os testes (unidade e integração)
npm run test:unidade      # Só unidade, sem Docker
npm run test:integracao   # Só integração: sobe um Postgres 17 real em contêiner (exige Docker)
npm run format            # Prettier (escreve)
npm run format:conferir   # Prettier (só confere; é o que a CI roda)
```

A CI (`.github/workflows/ci.yml`) roda formatação, lint, tipos e testes em cada push e pull request.

## Versões das ferramentas

TypeScript está em **6.0.x** de propósito: o `typescript-eslint` ainda não aceita o TypeScript 7. Não atualize o TypeScript sem conferir a compatibilidade do `typescript-eslint`.

## Rodar a aplicação em desenvolvimento

Com o ambiente local no ar (`npm run ambiente:subir`), o `.env` preenchido e o banco preparado (`npm run banco:preparar`):

```
npm run banco:criar-administrador -- --email voce@exemplo.com --nome "Seu Nome"   # ou: npm run banco:semear
npm run dev -w @gabinete/api    # API em http://127.0.0.1:3000
npm run dev -w @gabinete/web    # front em http://localhost:5173 (o Vite encaminha /api para a API)
```

Para a API guardar fotos em disco, sem o servidor S3 local, defina `ARMAZENAMENTO_LOCAL=1` (só vale em `NODE_ENV=development`).

Variáveis da API (validadas na subida; o processo recusa configuração inválida): `NODE_ENV`, `HOSTNAME_APP`, `HOSTNAME_PUBLICO`, `DATABASE_URL_API`, `SESSAO_SEGREDO` (32+ caracteres), `S3_*`, `HOST_API` e `PORTA_API` (opcionais). A API também **recusa** subir com `DATABASE_URL_ADMIN` ou `DATABASE_URL_MIGRACAO` definidas.

## Testes

`npm test` roda tudo: unidade, interface (jsdom) e integração (Postgres e S3 reais em contêiner; exige Docker). Para só uma camada: `npm run test:unidade`, `npx vitest run --project web`, `npm run test:integracao`.

## O que ainda não existe

App público e e-mail ao cidadão (fase 3), worker de avisos (fase 4), módulos de negócio (fases 4 a 7). O atendimento (fase 2) já existe. Ver [o plano](../plano/plano-de-implementacao.md).
