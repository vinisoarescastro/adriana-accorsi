# 0003. Autorização

- Estado: proposta
- Data: 2026-11-10

## Contexto

O Mandatus concentra a decisão em um único componente (`DecisorDeAutorizacao`) e deriva a navegação dele. Sem política de linha por gabinete, o decisor passa a ser a principal barreira entre perfis.

## Decisão

- O pacote `packages/autorizacao` contém a definição de **operações** (nome, nível mínimo, habilitação exigida, se é pública) e o decisor.
- Cada rota Fastify **declara a operação** que realiza; um gancho `preHandler` chama o decisor. Rota sem operação declarada é recusada (falha fechada), e um teste lista as rotas para garantir isso.
- Passos do decisor: operação pública? sessão válida? nível do perfil? habilitação? registro existe e o usuário alcança o registro-pai?
- O **alcance** é composto em um ponto único; só o Assessor Externo é limitado ao que é seu. Tarefa, documento e comentário herdam o alcance do registro vinculado.
- Cada operação declara `nivelMinimo`, a habilitação e, quando preciso, `perfisAdicionais` e `perfisExcluidos`. O perfil **Parlamentar** não ocupa degrau da escala: é tratado como nível 3 nas operações de Atendimento, Agenda, Legislativo, tarefas e eventos, tem as consultas listadas em `03` (3.4.1) via `perfisAdicionais`, e fica em `perfisExcluidos` nas operações de administração. Na CEAP ele tem acesso total (decisão de 2026-11-17), então não é excluído das escritas. Existe um único usuário ativo com esse perfil, garantido por índice parcial.
- A resposta da sessão traz as **páginas alcançáveis**, calculadas pelo mesmo decisor.
- Recusa e inexistência respondem igual.
- Uma **matriz perfil × operação** é gerada da definição e vira teste que roda em toda fase.

## Alternativas consideradas

- **Guards por decorador (NestJS):** descartado junto com o NestJS.
- **CASL ou biblioteca de políticas:** poderia servir, mas o modelo (nível e habilitação, alcance herdado) é simples o bastante para código próprio, e uma dependência a menos reduz superfície.
- **Autorização no banco (política de linha por perfil):** complexa para o ganho; o isolamento entre perfis é regra de negócio, não de inquilino.

## Consequências

- A definição única é a fonte da verdade para rotas, navegação, testes e documentação (`03-perfis-e-permissoes.md`).
- Adicionar uma rota sem declarar operação quebra o teste de cobertura.
