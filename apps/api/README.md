# @gabinete/api

API Fastify da área interna: sessão, autorização, equipe, identidade do gabinete, auditoria, fluxos, atendimento (pessoas, demandas, comentários, documentos e painel) e o lado da equipe do cidadão (política, link, andamentos, consentimento e fila de e-mails).

## Organização

Uma pasta por módulo, cada uma com `rotas.ts` (HTTP), `servico.ts` (regras e transação) e, quando preciso, `regras.ts` (regras puras):

| Pasta            | O que tem                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `acesso/`        | Login, sessão (ticket no servidor), bloqueio, política de senha, troca de senha, autenticação e CSRF |
| `equipe/`        | Usuários, perfis, habilitações, redefinição de senha, regras de concessão                            |
| `gabinete/`      | Identidade da Parlamentar e do gabinete, foto                                                        |
| `auditoria/`     | Consulta da trilha e histórico de um registro                                                        |
| `fluxos/`        | Etapas por tipo de processo (consultar, ajustar, estruturar)                                         |
| `armazenamento/` | Fotos e arquivos: S3 (produção) ou disco (só desenvolvimento)                                        |
| `pessoas/`       | Cadastro por telefone, inativar, eliminar dados pessoais (LGPD)                                      |
| `demandas/`      | Registro atômico, movimentação, reatribuir, cancelar, lista, quadro, ficha, link de acompanhamento   |
| `comentarios/`   | Comentários internos com menção (nunca públicos)                                                     |
| `documentos/`    | Envio com verificação de tipo e antivírus (ClamAV), download como anexo                              |
| `painel/`        | Números do painel de atendimento                                                                     |
| `publicacao/`    | Política de publicação versionada, link de acompanhamento, prévia e andamentos publicáveis           |
| `notificacoes/`  | Consentimento de e-mail (LGPD) e a fila de e-mails visível ao Supervisor                             |

## Regras que valem para toda rota

- **Toda rota declara a operação** que realiza (`config: { operacao: '...' }`, definida em `@gabinete/autorizacao`) ou é `publica`. Sem isso, **o servidor não sobe**. O decisor confere nível e habilitação antes do handler.
- Quem não alcança uma operação recebe **404**, igual a uma rota inexistente.
- Toda escrita grava a trilha **na mesma transação** (`registrarTrilha(tx, ...)`).
- Erros do Postgres vêm embrulhados pelo Drizzle (`erro.cause`) **ou** não (erros de COMMIT, como as regras diferidas). Use `banco-util.ts`, que lê os dois.
- Respostas da API nunca são guardadas em cache (`Cache-Control: no-store`).

## Rodar e testar

Ver [docs/operacao/como-rodar.md](../../docs/operacao/como-rodar.md). Os testes de integração (`*.integracao.test.ts`) sobem Postgres e S3 reais em contêiner e exercitam a API de ponta a ponta com `app.inject`.
