# @gabinete/autorizacao

O **único** lugar onde a decisão de autorização acontece (ADR 0003). Usado pela API (para decidir) e pelo front (só como dica de interface).

| Arquivo        | O que tem                                                                               |
| -------------- | --------------------------------------------------------------------------------------- |
| `operacoes.ts` | Definição única das operações: nível mínimo, habilitação, perfis adicionais e excluídos |
| `decisor.ts`   | `decidir(operacao, autoridade)`; o Parlamentar conta como nível 3                       |
| `concessao.ts` | Quem pode conceder e alterar cada perfil                                                |
| `paginas.ts`   | Páginas da barra e a operação que cada uma exige (falha fechada)                        |
| `alcance.ts`   | `composicaoDeAlcance`: só o Assessor Externo é limitado ao que é seu                    |

**Ao criar uma operação nova:** acrescente em `operacoes.ts` **e** na matriz esperada de `decisor.test.ts` (escrita à mão, de propósito: se a definição mudar por engano, o teste quebra).
