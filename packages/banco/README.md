# @gabinete/banco

Único lugar que conhece SQL e o esquema. Aqui ficam as migrações, o esquema do Drizzle, os papéis de banco, os invariantes de subida, a trilha e os comandos de linha.

## Como funciona

- **Migrações SQL** em `migracoes/`, numeradas (`0001-...sql`). São a **fonte da verdade** do esquema, inclusive gatilhos, restrições e permissões. Uma migração aplicada **não pode ser editada** (o checksum é conferido): crie outra.
- **Esquema do Drizzle** em `src/esquema/`, escrito à mão para consultas tipadas. Um teste de integração compara com o banco migrado e falha se divergirem.
- **Papéis** (`app_migracao`, `app_api`, `app_worker`, `app_publico`) são criados pelo comando `banco:papeis` com a conexão administrativa. As migrações só concedem permissões.
- **Invariantes** (`src/invariantes.ts`) são verificados na subida da aplicação (`exigirInvariantes`) e pelo comando `banco:verificar`.
- **Trilha** (`src/trilha.ts`): `registrarTrilha(tx, ...)` deve ser chamada dentro da transação da operação.

## Comandos (a partir da raiz)

| Comando                                                     | O que faz                                                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm run banco:papeis`                                      | Cria os papéis e prepara o banco (usa `DATABASE_URL_ADMIN`)                                    |
| `npm run banco:migrar`                                      | Aplica as migrações pendentes (usa `DATABASE_URL_MIGRACAO`)                                    |
| `npm run banco:preparar`                                    | `papeis` e `migrar`, em sequência                                                              |
| `npm run banco:verificar`                                   | Roda os invariantes e sai com erro se algum falhar                                             |
| `npm run banco:criar-administrador -- --email x --nome "Y"` | Cria o **primeiro** administrador (recusa se já existir). Mostra a senha inicial uma única vez |
| `npm run banco:semear`                                      | Dados **fictícios** para desenvolvimento. Recusa banco não local e banco com usuários          |

## Cuidados para quem desenvolve

- **Datas voltam como texto.** O Drizzle configura o cliente `postgres` para devolver `timestamptz` como texto no SQL cru. Com o Drizzle, as colunas já vêm como `Date`.
- **Erros do Drizzle vêm embrulhados.** A mensagem original do Postgres (por exemplo, o nome da restrição violada) fica em `erro.cause`. Quem trata erro de banco deve olhar `cause`.
- **Ids de `bigint` no SQL cru voltam como texto.** Com o Drizzle (`mode: 'number'`) vêm como número.
- **`information_schema` só mostra o que o papel atual acessa.** Para verificações de segurança, use o catálogo (`pg_class`, `pg_attribute`).
- **A área pública não deve importar este pacote inteiro.** Quando ela existir (fase 3), terá uma entrada de exportação própria, só com a leitura da visão pública.

## Testes

- `*.test.ts`: unidade, sem Docker.
- `*.integracao.test.ts`: contra um Postgres 17 real (Testcontainers). Cada arquivo cria um banco isolado. Exige Docker.
