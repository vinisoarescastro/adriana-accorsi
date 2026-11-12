# CLAUDE.md

Orientação para agentes de IA que trabalham neste repositório.

## Projeto

Sistema de gestão do gabinete da Deputada Federal Adriana Accorsi, derivado do Mandatus, para **um único gabinete**. Leia primeiro:

1. `docs/plano/plano-de-implementacao.md`: decisões, fases e critérios de aceite.
2. `docs/plano/progresso.md`: em que fase estamos.
3. `docs/referencia/mandatus-documentacao-tecnica-e-funcional.md`: análise do Mandatus.

## Regras que não se negociam

- **Nunca altere a pasta do Mandatus** (`C:\Users\Vinicius Soares\Documents\Repositórios\mandatus`). Só leitura. Se algo for aproveitado, copie para este repositório e adapte.
- **Não implemente além da fase em andamento** e não comece uma fase sem aprovação do usuário.
- **Não invente regras da CEAP.** Valores, categorias e prazos vêm de parâmetros configuráveis com vigência, levantados da norma vigente.
- **Nunca coloque segredos no repositório.** Use `.env` (ignorado) e mantenha `.env.exemplo` atualizado.

## Princípios de arquitetura

1. Autorização em um único lugar (pacote `autorizacao`). Nada de checagem de perfil espalhada.
2. Operação e auditoria na mesma transação. A trilha é imutável (gatilho no banco).
3. Status e saldos são derivados, nunca armazenados em coluna.
4. Demanda, tarefa, projeto, emenda e despesa percorrem etapas pelo mecanismo único de movimentação.
5. Nada é público por padrão. O cidadão vê uma projeção explícita, nunca o registro interno filtrado.
6. Nenhuma automação decide: o worker só gera avisos e envios.
7. Dinheiro é `numeric` no banco e texto na API. Nunca float, nunca negativo.
8. Quem lança despesa não aprova, exceto Chefe de Gabinete e Administrador, e a coincidência é sempre registrada.

## Organização

- **Não deixe pastas vazias.** Só existe pasta que tenha arquivo. Crie a pasta junto com o primeiro arquivo dela, e não use `.gitkeep`.
- **Toda rota da API declara a operação** (`config: { operacao }`, definida em `packages/autorizacao`) ou é `publica`; sem isso o servidor não sobe. Quem não alcança uma operação recebe 404. Toda escrita grava a trilha na mesma transação (`registrarTrilha(tx, ...)`).
- Ao criar uma operação, acrescente-a em `operacoes.ts` **e** na matriz esperada de `decisor.test.ts` (escrita à mão).
- Erros do Postgres vêm embrulhados pelo Drizzle (`erro.cause`), exceto os de COMMIT: use `apps/api/src/banco-util.ts`.
- Migrações SQL já aplicadas **não se editam** (o checksum é conferido): crie outra. O esquema do Drizzle é escrito à mão e um teste o compara com o banco migrado.
- Testes: `npm test` roda tudo (exige Docker para a integração). Antes de dizer que algo está pronto, rode formatação, lint, tipos e testes.
- `apps/api` e `apps/publico` são Fastify. A API fica organizada por módulo: uma pasta com rotas, serviço e schemas.
- `apps/publico` só lê a visão pública do banco, com o papel `app_publico`. Não importa o pacote `banco` inteiro e não tem rota de escrita (exceto a consulta por protocolo, que é POST de leitura).
- `packages/banco` é o único lugar que conhece SQL e o esquema.
- Telas e arquivos longos devem ser divididos por responsabilidade.
- Decisões técnicas vão em `docs/arquitetura/decisoes/NNNN-titulo.md`.

## Idioma e estilo

- Domínio, interface, documentação e commits em português. Nomes de ferramenta e padrões técnicos podem ficar em inglês.
- Datas sempre no fuso `America/Sao_Paulo`.
- Commits: `tipo: assunto` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).

## Definição de pronto

Fase fechada somente com: critérios de aceite passando, fases anteriores sem regressão, CI verde, `docs/` atualizada, roteiro de conferência executado (inclusive em tela pequena), implantação no ambiente de apresentação e `progresso.md` atualizado.
