# Conferência da fase 5: Legislativo

Roteiro de conferência manual. Os testes automatizados garantem as regras; este roteiro garante que **alguém olhou** as telas (projetos de lei, quadro, ficha, comissões, votações e beneficiários), inclusive no celular.

- **Quem executa:** a pessoa que vai apresentar o sistema (e, se possível, alguém do gabinete).
- **Estado:** **pendente da parte visual**. As regras foram exercitadas contra a API real (ver "Execução contra o ambiente real"); falta alguém olhar as telas, inclusive em 360 px.

## Antes de começar

1. `npm run ambiente:subir` e `npm run banco:preparar` (aplica a migração 0014).
2. Dados de demonstração com projetos e beneficiários: `npm run demonstracao -w @gabinete/api` (apaga os dados de uso do banco **local**; faça `pg_dump` antes, ver [como-rodar.md](../como-rodar.md)). Senha das contas novas: `Gabinete2026Demo`.
3. Em terminais separados: `npm run dev -w @gabinete/api` e `npm run dev -w @gabinete/web`.
4. Contas com a habilitação **LG**: o Chefe, o Supervisor e alguns Assessores Internos da demonstração têm. Para o item 18, uma conta **sem** LG (por exemplo, um Assessor Interno só com AT).
5. Para o celular: as ferramentas do navegador (modo celular, 360 px) ou um aparelho de verdade.

## Beneficiários

| #   | O que fazer                                                                                | Resultado esperado                                                                                  | Automatizado | Manual (data e quem) |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 1   | Abrir **Beneficiários** e olhar a lista                                                    | CNPJ com pontuação (`11.222.333/0001-81`), CEP com hífen, cidade e UF, natureza; só os ativos       | sim          |                      |
| 2   | Novo beneficiário: digitar um CNPJ com o último dígito errado e sair do campo              | O erro "CNPJ inválido" aparece, e o botão Cadastrar fica desabilitado                               | sim          |                      |
| 3   | Cadastrar com um CNPJ válido, deixando o complemento em branco                             | Cadastrado. Só o complemento é opcional: sem bairro, cidade ou CEP o botão não habilita             | sim          |                      |
| 4   | Cadastrar um CNPJ **alfanumérico** válido, por exemplo `12.ABC.345/01DE-35`                | Aceito, e a lista mostra o CNPJ com a pontuação                                                     | sim          |                      |
| 5   | Cadastrar outro beneficiário com o mesmo CNPJ de um ativo (com ou sem pontuação)           | Recusado ("Já existe um beneficiário ativo com este CNPJ")                                          | sim          |                      |
| 6   | Como Supervisor, inativar um beneficiário e cadastrar outro com o mesmo CNPJ               | Inativar libera o CNPJ; o filtro "Inativos" o mostra. Reativar o antigo com o CNPJ ocupado é recusado | sim          |                      |
| 7   | Como Assessor Interno, abrir um beneficiário                                               | Edita os dados, mas **não** vê "Inativar"                                                           | sim          |                      |
| 8   | Buscar por parte do nome, da razão social, da cidade e do CNPJ                             | Cada busca encontra o beneficiário                                                                  | sim          |                      |

## Projetos de lei

| #   | O que fazer                                                                                     | Resultado esperado                                                                                               | Automatizado | Manual (data e quem) |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 9   | Abrir **Projetos de lei**                                                                       | No alto, o consolidado (em andamento, atrasados, concluídos); abaixo, o **quadro** por etapa do fluxo federal    | sim          |                      |
| 10  | Clicar no cartão "Atrasados"                                                                    | Abre a lista já filtrada; os números batem                                                                       | sim          |                      |
| 11  | Novo projeto sem ementa, depois sem autoria                                                     | O botão Cadastrar fica desabilitado. Com título, ementa e autoria, cadastra; o número pode ficar em branco       | sim          |                      |
| 12  | Cadastrar com prazo de ontem                                                                    | Recusado ("O prazo não pode ser anterior a hoje"); editar o prazo para o passado depois é permitido              | sim          |                      |
| 13  | Cadastrar dois projetos com o mesmo número                                                      | O segundo é recusado, mesmo escrito em minúsculas. Sem número, pode quantos quiser                               | sim          |                      |
| 14  | Arrastar um cartão para outra coluna (e, em outra tentativa, usar "Mover para…" no cartão)      | O projeto muda de etapa e o histórico registra. Quem não é o responsável nem Supervisor não arrasta              | sim          |                      |
| 15  | Como Assessor Interno que **não** é o responsável, abrir o projeto                              | Lê tudo, mas **não** há guia Ações, nem "Editar dados", nem formulários de comissão e votação                    | sim          |                      |
| 16  | Mover um projeto concluído de volta a uma etapa em andamento, como Interno e como Supervisor    | Interno: recusado. Supervisor: reabre, e a trilha registra "reabrir"                                             | sim          |                      |
| 17  | Como Supervisor, reatribuir o projeto e depois cancelá-lo (justificativa curta, depois de 10 caracteres) | O botão só habilita com 10 caracteres; o projeto cancelado aparece com o selo e a ficha não oferece ação  | sim          |                      |
| 18  | Entrar com uma conta **sem a habilitação LG** e olhar o menu                                    | **Projetos de lei** e **Beneficiários** não aparecem. Abrir `/g/projetos` pelo endereço mostra "Não encontrado"  | sim          |                      |
| 19  | Entrar com uma conta só com **FI**                                                              | **Beneficiários** aparece; **Projetos de lei** não                                                               | sim          |                      |

## Ficha: dados, comissões e votações

| #   | O que fazer                                                                       | Resultado esperado                                                                                      | Automatizado | Manual (data e quem) |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 20  | Na guia **Detalhes**, editar o título, o número, os assuntos e os coautores       | Salva; a ficha mostra os dados novos; os coautores são um nome por linha                                | sim          |                      |
| 21  | Na guia **Tramitação**, registrar uma passagem por comissão com parecer           | Aparece na lista por data, com quem registrou; remover pede confirmação                                 | sim          |                      |
| 22  | Registrar uma votação                                                             | Há data, resultado e local; **não existe** campo de placar nem de votos individuais                     | sim          |                      |
| 23  | Tentar registrar comissão ou votação em um projeto cancelado                      | Nada é oferecido; a API recusa (409)                                                                    | sim          |                      |
| 24  | Na guia **Histórico**, olhar as etapas                                            | Cada passagem com quem fez e quando, a mais recente em cima                                             | sim          |                      |
| 25  | Como Supervisor, olhar a página **Fluxos** e o fluxo "Projeto de Lei"             | As etapas do fluxo federal; ajustar o nome ou a ordem de uma etapa reflete no quadro                    | sim          |                      |

## Em tela pequena (celular)

Repita os itens 9, 11, 14, 21 e 22 numa tela de 360 px e confira:

- [ ] O quadro rola na horizontal dentro do próprio quadro, e a página não rola.
- [ ] A ficha do projeto ocupa a tela, com "Fechar" alcançável com o polegar.
- [ ] Os campos de data abrem o seletor do aparelho.
- [ ] O menu "Mover para…" do cartão funciona no toque.
- [ ] O CNPJ digitado se formata ao sair do campo, e o erro aparece em texto, sem depender só de cor.
- [ ] Nenhuma informação depende só de cor (Atrasado, Cancelado, Inativo aparecem em texto).

## Execução contra o ambiente real (2026-11-17)

Antes da conferência visual, a API foi exercitada por HTTP contra o ambiente local de verdade: Postgres 17, API em execução, a migração 0014 aplicada sobre um banco que já tinha dados das fases 2 a 4 e a demonstração (25 projetos, 16 beneficiários) gerada. Sessões reais de cinco perfis: Chefe, Supervisor, Assessor Interno com LG, Assessor Interno sem LG, Assessor Interno só com FI e Assessor Externo. **41 de 41 verificações passaram.**

- Menu e acesso (itens 18 e 19): sem LG, a API de projetos responde 404 até para a ficha; só com FI, Beneficiários responde 200 e Projetos 404; o Externo não alcança nada.
- Consolidado (item 9): 19 em andamento, 6 atrasados, 3 concluídos, 1 arquivado, 2 cancelados; a lista filtrada por atrasados tem o mesmo número do consolidado, e a soma por etapa bate.
- Cadastro (itens 11 a 13): sem ementa é recusado; prazo no passado, 409; número repetido (em minúsculas), 409; sem número pode repetir; cancelar libera o número.
- Mover e reabrir (itens 14 a 17): o responsável move; etapa de outro fluxo é recusada; o Interno responsável não reabre um projeto encerrado, o Supervisor sim; o Interno não cancela (404); justificativa curta é recusada; o projeto cancelado responde 409 a qualquer alteração.
- Comissões e votações (itens 21 a 23): registram e aparecem na ficha; o campo extra de votos não é guardado; um Interno que não é o responsável é recusado (403).
- Beneficiários (itens 2 a 8): CNPJ inválido recusado; o do Financeiro cadastra sem complemento; CNPJ repetido, 409; o alfanumérico é aceito; o Interno não inativa; inativar libera o CNPJ e reativar com o CNPJ ocupado é recusado; a busca por cidade acha.
- O que esta execução **não** cobre: tudo o que depende de olhar a tela (arrastar o cartão, o erro do CNPJ ao sair do campo, a ficha com guias, o menu) e a conferência em tela de 360 px. Esses itens seguem pendentes para quem for apresentar o sistema.
- Detalhe do ambiente: os registros criados por esta execução foram apagados ao recriar a demonstração, depois de um `pg_dump` (`.dados/backups/`, fora do git).

## Defeitos encontrados

_(preencher durante a conferência)_
