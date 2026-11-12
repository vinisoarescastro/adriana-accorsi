# @gabinete/compartilhado

Schemas Zod, enums e tipos usados por `web`, `api` e (depois) `publico` e `worker`. É o contrato entre o front e a API: no lugar de um contrato OpenAPI gerado, front e back importam os **mesmos** schemas.

| Arquivo       | O que tem                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `ambiente.ts` | Validação da configuração por variáveis de ambiente (o processo recusa subir com configuração inválida; as mensagens nunca trazem os valores) |
| `perfis.ts`   | Perfis, áreas (habilitações) e situações                                                                                                      |
| `acesso.ts`   | Contratos de login, sessão, troca de senha e os códigos de erro estáveis                                                                      |
| `equipe.ts`   | Contratos da equipe, da identidade do gabinete e da trilha                                                                                    |
| `fluxos.ts`   | Contratos dos fluxos de trabalho                                                                                                              |

Não pode depender de nada específico de servidor ou de navegador.
