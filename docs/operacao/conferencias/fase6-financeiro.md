# Conferência da fase 6: Financeiro

Roteiro de conferência manual. Os testes automatizados garantem as regras; este roteiro garante que **alguém olhou** as telas (emendas, CEAP e o bloco financeiro do painel), inclusive no celular.

- **Quem executa:** a pessoa que vai apresentar o sistema (e, se possível, quem cuida das contas do gabinete).
- **Estado:** aguardando a conferência manual. As regras foram exercitadas por testes e contra a API real (ver "Execução contra o ambiente real").

## Antes de começar

1. `npm run ambiente:subir` e `npm run banco:preparar` (aplica as migrações 0015 e 0016).
2. Dados de demonstração com emendas e CEAP: `npm run demonstracao -w @gabinete/api` (apaga os dados de uso do banco **local**; faça `pg_dump` antes, ver [como-rodar.md](../como-rodar.md)). Senha das contas novas: `Gabinete2026Demo`.
3. Em terminais separados: `npm run dev -w @gabinete/api` e `npm run dev -w @gabinete/web`.
4. Contas: o **Chefe** (`helena.vasconcelos@exemplo.test`, tem LG e FI), um **Supervisor** com FI (Camila Albuquerque), um **Assessor Interno** com FI (Marcos Vinícius Prado), a **Parlamentar** e o **Administrador** (`parlamentar@exemplo.test`, `administrador@exemplo.test`), e uma conta **sem** FI e sem LG para os itens de acesso.
5. **Os valores da demonstração são fictícios** (cota mensal de R$ 45.000,00, emendas inventadas). No ambiente real, a cota é cadastrada em CEAP > Parâmetros, conferida na norma.
6. Para o celular: as ferramentas do navegador (modo celular, 360 px) ou um aparelho de verdade.

## Emendas

| #   | O que fazer                                                                                   | Resultado esperado                                                                                                            | Automatizado | Manual (data e quem) |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 1   | Abrir **Emendas**                                                                             | No alto, a situação (em andamento, atrasadas, concluídas) e os valores em reais; abaixo, o quadro por etapa                   | sim          |                      |
| 2   | Abrir uma emenda e olhar a barra de valores                                                   | Utilizado, a executar e disponível somam o valor disponibilizado; o texto alternativo da barra traz os três valores          | sim          |                      |
| 3   | Nova emenda: digitar `75.000,50`                                                              | Cadastra com R$ 75.000,50 (a API recebe `75000.50`). Valor zero, negativo ou com três casas é recusado                        | sim          |                      |
| 4   | Na emenda, guia **Destinações**: destinar a um beneficiário um valor maior que o disponível   | Recusado ("O valor excede o disponível da emenda"). Com um valor que cabe, o comprometido sobe e o disponível desce          | sim          |                      |
| 5   | Registrar uma execução maior que a destinação, e outra com data de amanhã                     | As duas são recusadas. Uma execução válida aumenta o utilizado, e **não há como editá-la nem apagá-la**                       | sim          |                      |
| 6   | Cancelar uma destinação que já tem execução                                                   | Recusado. Sem execução, cancela (com justificativa de 10 caracteres) e o valor volta a ficar disponível                       | sim          |                      |
| 7   | Alterar o valor disponibilizado para menos do que já foi destinado                            | Recusado. O histórico do valor mostra cada valor, quem definiu e quando                                                       | sim          |                      |
| 8   | Mover a emenda entre as etapas (arrastar e "Mover para…")                                     | A etapa muda e o histórico registra; o status deriva da etapa (não há campo de status)                                        | sim          |                      |
| 9   | Como **Administrador** ou **Parlamentar**, usar **Valores em uma data** e escolher um dia passado | Mostra os valores e a etapa daquele dia; para o Chefe o botão **não** aparece                                              | sim          |                      |
| 10  | Entrar com conta sem LG e sem FI, e com conta que só tem FI                                   | Sem LG nem FI, **Emendas** não aparece (rota e API respondem como inexistente). Só com FI, consulta os valores, mas não cadastra, destina nem move | sim          |                      |

## CEAP

| #   | O que fazer                                                                                       | Resultado esperado                                                                                                              | Automatizado | Manual (data e quem) |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 11  | Abrir **CEAP**, aba **Saldo**                                                                     | Saldo atual, cota do mês, aguardando análise e a tabela mês a mês (cota, consumido, saldo acumulado, encerrado)                 | sim          |                      |
| 12  | Como Chefe ou Administrador, abrir **Parâmetros** e cadastrar a cota com vigência a partir de 1º de janeiro | O saldo passa a crescer a cada mês. Sem cota num mês, a aba Saldo avisa quais meses estão descobertos                         | sim          |                      |
| 13  | Tentar alterar uma cota já cadastrada                                                             | Não existe edição: encerra-se a vigência e abre-se outra; vigências que se sobrepõem são recusadas                              | sim          |                      |
| 14  | Como Assessor Interno, **Lançar despesa** com CPF/CNPJ do fornecedor errado                       | "CPF ou CNPJ inválido" e o botão desabilitado. Com o documento certo, lança (a API recebe só os caracteres, sem pontuação)      | sim          |                      |
| 15  | Anexar o comprovante (PDF) e **Enviar para análise** (e antes, tentar sem o comprovante)          | Sem comprovante, categorias que o exigem recusam o envio. Com ele, a despesa passa a Em análise e **consome saldo**              | sim          |                      |
| 16  | Como Supervisor, abrir uma despesa que **ele mesmo lançou** e ir à guia **Ações**                 | "Você lançou esta despesa": não há botão Aprovar; pede-se a outro Supervisor, ao Chefe, ao Administrador ou à Parlamentar       | sim          |                      |
| 17  | Como **Chefe**, aprovar uma despesa que ele mesmo lançou                                          | Aviso de que a decisão ficará marcada; depois, o selo "Decidida por quem lançou" na ficha e na lista                           | sim          |                      |
| 18  | Reprovar uma despesa com o motivo "curto"                                                         | O botão só habilita com 10 caracteres; a despesa reprovada para de consumir saldo                                               | sim          |                      |
| 19  | Aprovar, e depois **Apresentada à Câmara** e **Ressarcida**                                       | O histórico registra cada passo; despesa decidida **não se edita** (valor, data, fornecedor)                                    | sim          |                      |
| 20  | Como Supervisor, **encerrar** um mês e tentar lançar uma despesa com data nele                    | Recusado ("A competência … está encerrada"). Reabrir libera                                                                     | sim          |                      |
| 21  | Enviar para análise uma despesa maior que o saldo disponível                                      | O envio é recusado com "Saldo insuficiente" e o saldo do mês; o consumo só começa ao entrar em análise, e o saldo não fica negativo | sim          |                      |
| 22  | Como Chefe, aba **Relatório**: escolher o período, ver o resumo e baixar o pacote de comprovantes | Resumo por categoria e por status, com as decididas por quem lançou; o ZIP traz os comprovantes. Supervisor **não** vê a aba    | sim          |                      |
| 23  | Como Administrador ou Parlamentar, reconstituir o saldo em uma data passada                       | O saldo daquele dia, igual ao que a tela mostrava então (as despesas voltam à etapa em que estavam)                             | sim          |                      |
| 24  | Entrar com conta sem FI                                                                           | **CEAP** não aparece no menu; `/g/ceap` pelo endereço mostra "Não encontrado"                                                   | sim          |                      |

## Painel

| #   | O que fazer                                         | Resultado esperado                                                                                         | Automatizado | Manual (data e quem) |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 25  | Como Chefe, abrir o **Painel**                      | O bloco **Financeiro** (saldo da CEAP, emendas disponíveis, a executar e despesas em análise), com 4 cartões | sim          |                      |
| 26  | Como Assessor Interno sem FI nem LG                 | O bloco financeiro não aparece                                                                             | sim          |                      |

## Em tela pequena (celular)

Repita os itens 1, 2, 11, 14 e 16 numa tela de 360 px e confira:

- [ ] O quadro de emendas rola na horizontal dentro do próprio quadro, e a página não rola.
- [ ] A tabela mês a mês da CEAP rola dentro do quadro, sem estourar a página.
- [ ] Os formulários (nova emenda, nova despesa) cabem na tela, e os botões ficam ao alcance.
- [ ] Os cartões financeiros do painel ficam em uma ou duas colunas, sem texto cortado.

## Execução contra o ambiente real

Executada em 2026-11-17 com Postgres 17 e a API reais, numa **cópia** do banco local (descartada depois), com as migrações 0015 e 0016 aplicadas sobre um banco que já tinha dados das fases 2 a 5, e a demonstração gerada em seguida:

- Gerador de demonstração: 9 emendas, 17 destinações, 11 execuções, 72 despesas da CEAP, 8 competências encerradas.
- Sessão do Chefe: o saldo da CEAP, o consolidado das emendas e o bloco financeiro do painel responderam com valores coerentes com as parcelas (cota de R$ 45.000,00 por mês, saldo acumulado, meses encerrados marcados).
- Os testes de integração exercitam, contra o Postgres real, as regras acima: destinação maior que o disponível, execução maior que a destinação, segregação de quem lança e decide, consumo concorrente de saldo, competência encerrada e reconstituição por data.

Os resultados do roteiro manual (colunas "Manual") ficam em branco até a conferência.
