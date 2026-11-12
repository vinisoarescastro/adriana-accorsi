# Conferência da fase 1: Fundação

Roteiro de conferência manual. Os testes automatizados garantem as regras; este roteiro garante que **alguém olhou** as telas, inclusive no celular. A definição de pronto da fase exige que ele seja executado.

- **Quem executa:** a pessoa que vai apresentar o sistema (e, se possível, alguém do gabinete).
- **Onde:** no ambiente de apresentação (VPS) e, antes, no ambiente local.
- **Estado:** **pendente**. Os itens da coluna "Automatizado" já passam nos testes; os da coluna "Manual" precisam de uma pessoa.

## Antes de começar

1. Ambiente no ar (`implantacao.md`) ou local (`como-rodar.md`).
2. Primeiro administrador criado por linha de comando, com a senha inicial anotada.
3. Navegador atualizado. Para a conferência em tela pequena, use um celular de verdade ou as ferramentas do navegador (modo celular, 360 px de largura).

## Roteiro

| # | O que fazer | Resultado esperado | Automatizado | Manual (data e quem) |
| --- | --- | --- | --- | --- |
| 1 | Abrir o endereço da aplicação sem estar logado, em qualquer caminho (por exemplo `/g/equipe`) | Mostra a tela "Entrar" | sim | |
| 2 | Entrar com e-mail inexistente e depois com a senha errada | A **mesma** mensagem nos dois casos | sim | |
| 3 | Errar a senha 5 vezes seguidas na mesma conta | A conta fica bloqueada por 15 minutos; a mensagem continua a mesma | sim | |
| 4 | Entrar com a senha inicial do administrador | Vai direto para "Troque a senha inicial"; nenhuma outra tela abre | sim | |
| 5 | Trocar a senha (tente uma curta, uma igual ao e-mail, e depois uma boa) | As curtas e óbvias são recusadas com a explicação; a boa entra no Painel | sim | |
| 6 | Criar um usuário de cada perfil em Equipe | A senha inicial aparece **uma vez**, com aviso; copiar e fechar a esconde | sim | |
| 7 | Entrar como cada perfil e olhar o menu | O Assessor Externo não vê Auditoria; o Supervisor não vê Auditoria; Chefe, Parlamentar e Administrador veem | sim | |
| 8 | Como Supervisor, digitar `/g/auditoria` na barra de endereço | "Página não encontrada" | sim | |
| 9 | Como Chefe, tentar criar um Administrador ou um Parlamentar | O perfil não aparece na lista | sim | |
| 10 | Mudar o perfil de um usuário logado em outra janela | A outra janela é deslogada na próxima ação | sim | |
| 11 | Em Auditoria (como Chefe), conferir as ações acima | Cada ação aparece com autor, data e hora no fuso de São Paulo | sim | |
| 12 | Em Configurações (como Chefe), preencher a identidade e enviar uma foto PNG | Aparece no cabeçalho e na página | sim (API) | |
| 13 | Enviar um arquivo que não é imagem renomeado para `.png` | Recusado com mensagem clara | sim (API) | |
| 14 | Em Fluxos, ajustar o rótulo público de "Em triagem" (como Supervisor) | Salva; só a Demanda tem rótulo público | sim | |
| 15 | Em Fluxos (como Administrador), tentar desativar a etapa de Entrada | Recusado com mensagem | sim | |
| 16 | Sair e tentar voltar com o botão "voltar" do navegador | Pede entrada de novo | sim | |

## Em tela pequena (celular)

Repita os itens 1, 4, 5, 6, 7 e 12 numa tela de 360 px de largura e confira:

- [ ] O menu vira uma gaveta aberta pelo botão "Menu", e fecha ao escolher uma página.
- [ ] Nenhum texto fica cortado e não há rolagem horizontal da **página** (as tabelas rolam dentro do próprio quadro).
- [ ] Os botões e campos são fáceis de tocar (altura mínima de 44 px).
- [ ] A senha inicial é legível e dá para copiar.
- [ ] O foco do teclado é sempre visível ao navegar com a tecla Tab.

## Acessibilidade rápida

- [ ] Navegar só com o teclado: o "Pular para o conteúdo" aparece com a tecla Tab; todo botão e link é alcançável.
- [ ] Os avisos de erro e sucesso começam com uma palavra ("Erro:", "Pronto:", "Atenção:"): nenhum depende só de cor.
- [ ] O contraste da paleta foi medido por teste automatizado (4,5:1).

## Infraestrutura (depende da VPS)

| # | O que fazer | Resultado esperado | Estado |
| --- | --- | --- | --- |
| I1 | Acessar `https://<domínio>` | Abre com cadeado válido, sem aviso do navegador | pendente (PV-E) |
| I2 | Conferir os cabeçalhos de segurança (por exemplo, em securityheaders.com) | CSP, HSTS, X-Frame-Options presentes | pendente (testado localmente) |
| I3 | Rodar `bash infra/scripts/verificar.sh` | "TUDO CERTO" | pendente |
| I4 | Rodar o backup e **restaurar em banco novo** (`backup-e-restauracao.md`) | Restauração conferida; anotar o tempo | feito localmente; pendente na VPS |
| I5 | Trocar o hostname em `.env.producao` e reimplantar | Funciona sem mudar código | pendente |

## Resultado

Preencher ao executar: data, quem conferiu, o que falhou e o que foi corrigido.
