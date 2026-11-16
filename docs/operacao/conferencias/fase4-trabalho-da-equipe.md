# Conferência da fase 4: Trabalho da equipe

Roteiro de conferência manual. Os testes automatizados garantem as regras; este roteiro garante que **alguém olhou** as telas (tarefas, sino, agenda, eventos e presença), inclusive no celular.

- **Quem executa:** a pessoa que vai apresentar o sistema (e, se possível, alguém do gabinete).
- **Estado:** **pendente**. Os itens "sim" já passam nos testes; falta alguém olhar.

## Antes de começar

1. `npm run ambiente:subir` e `npm run banco:preparar` (aplica a migração 0009).
2. Em terminais separados: `npm run dev -w @gabinete/api`, `npm run dev -w @gabinete/web` e `npm run dev -w @gabinete/worker` (o worker gera os avisos de prazo e envia os e-mails).
3. Usuários de cada perfil (`npm run banco:semear`): Parlamentar, Administrador, Chefe, Supervisor, Assessor Interno e Assessor Externo, **com as habilitações AT e AG** (sem AG a Agenda não aparece; sem AT não aparecem Eventos nem Demandas).
4. Para o celular: as ferramentas do navegador (modo celular, 360 px) ou um aparelho de verdade.

## Tarefas e sino

| #   | O que fazer                                                                                  | Resultado esperado                                                                                      | Automatizado | Manual (data e quem) |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 1   | Como Supervisor, em Tarefas > Nova tarefa, designar uma tarefa ao Assessor Interno, com prazo | A tarefa é criada na etapa "A fazer"; abre a ficha com o histórico                                      | sim          |                      |
| 2   | Entrar como Assessor Interno e olhar o sino                                                  | "Avisos (1 novo)" em texto; ao abrir, a frase "Uma tarefa foi designada a você" e o título; "Abrir" leva à tarefa | sim          |                      |
| 3   | Como Assessor Externo, abrir Tarefas e tentar criar uma tarefa                               | Só aparece "Nova tarefa" para si mesmo: **não há** escolha de responsável                              | sim          |                      |
| 4   | Como Externo, abrir pelo endereço a tarefa de outra pessoa (`?tarefa=<id>`)                  | "Não encontrado"                                                                                        | sim          |                      |
| 5   | Como responsável, mover a tarefa para "Concluída"                                            | Situação "Concluída"; a demanda ligada (se houver) **não** muda                                         | sim          |                      |
| 6   | Como Assessor Interno, tentar mover a tarefa concluída de volta para "Em andamento"          | Recusado (só o Supervisor reabre)                                                                       | sim          |                      |
| 7   | Cancelar uma tarefa com justificativa curta, e depois com 10 caracteres                      | O botão fica desabilitado até 10 caracteres; cancelada, a ficha não oferece ação                        | sim          |                      |
| 8   | Criar uma tarefa com prazo de ontem                                                          | Recusado ("O prazo não pode ser anterior a hoje"); alterar o prazo para o passado depois é permitido   | sim          |                      |
| 9   | No Painel, olhar o bloco "Tarefas" e clicar em "Tarefas atrasadas"                           | Abre a lista já filtrada; os números batem com a lista                                                  | sim          |                      |
| 10  | Marcar um aviso como lido e depois "Marcar todos como lidos"                                 | A contagem some do botão; os avisos lidos continuam na caixa, sem o "Novo:"                             | sim          |                      |
| 11  | Em uma demanda, comentar mencionando um colega                                               | O colega recebe um aviso "Você foi mencionado em um comentário", sem o texto do comentário              | sim          |                      |

## Avisos de prazo (worker)

| #   | O que fazer                                                                                              | Resultado esperado                                                                                  | Automatizado | Manual (data e quem) |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 12  | Com o worker rodando, criar uma tarefa que vence amanhã e esperar a próxima hora cheia (ou reiniciar o worker) | O responsável recebe "Um prazo está chegando"                                                       | sim          |                      |
| 13  | Reiniciar o worker várias vezes no mesmo dia                                                             | **Não** nasce aviso repetido do mesmo prazo no mesmo dia                                            | sim          |                      |
| 14  | Como Chefe, em Configurações > Avisos de prazo, mudar a antecedência para 7 dias                         | Salva; tarefas que vencem em até 7 dias passam a avisar. Como Supervisor, o bloco nem aparece       | sim          |                      |
| 15  | Parar o banco por alguns segundos com o worker rodando                                                   | O worker registra a falha e **continua vivo**; volta a funcionar sozinho                            | sim          |                      |

## Agenda

| #   | O que fazer                                                                                              | Resultado esperado                                                                                          | Automatizado | Manual (data e quem) |
| --- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 16  | Como Assessor Interno, marcar um compromisso e indicar um colega                                         | O compromisso nasce "Participantes" e "Envolve a Parlamentar" **ligado**; o colega recebe aviso de indicação | sim          |                      |
| 17  | Como Interno, olhar as opções de "Quem vê o compromisso"                                                 | Não aparece "Restrito". Como Supervisor, aparece                                                            | sim          |                      |
| 18  | Como Supervisor, criar um compromisso Restrito; depois olhar a agenda como Interno e como Externo        | **Não aparece nada**, nem como "horário ocupado". O Chefe, o Administrador e a Parlamentar o veem           | sim          |                      |
| 19  | Como Externo, olhar um compromisso de "Participantes" de que não participa                               | Só "Horário ocupado", sem título, local nem participantes                                                   | sim          |                      |
| 20  | Como Parlamentar, abrir "Minha agenda" e depois desligá-la                                               | Ligada: só o que a envolve ou onde ela foi indicada. Desligada: toda a agenda                               | sim          |                      |
| 21  | Marcar um compromisso **sem** indicar a Parlamentar, só com a marca ligada                               | Ela vê o compromisso, mas **não** recebe aviso. Só a indicação explícita avisa                              | sim          |                      |
| 22  | Como participante, "Recusar"                                                                             | O compromisso continua, e você continua na lista (com "Recusado"); a tela explica que a resposta é só informativa | sim          |                      |
| 23  | Remarcar o horário de um compromisso com participantes                                                   | Quem já estava recebe "Um compromisso seu foi remarcado"; só os **novos** indicados recebem o aviso de indicação | sim          |                      |
| 24  | Cancelar um compromisso                                                                                  | Os participantes recebem o aviso; some da agenda; a ficha fica só de leitura                                | sim          |                      |
| 25  | Bloquear um horário, e depois marcar um compromisso no mesmo horário                                     | O bloqueio aparece como "Indisponível" (sem motivo); o compromisso novo mostra o **aviso** de conflito, mas é salvo | sim          |                      |
| 26  | Tentar consultar um período muito longo pela barra de endereço da API                                    | Recusado (o período máximo é de 62 dias)                                                                    | sim          |                      |

## Eventos e presença

| #   | O que fazer                                                                                              | Resultado esperado                                                                                  | Automatizado | Manual (data e quem) |
| --- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| 27  | Como Interno, cadastrar um evento                                                                        | Aparece na lista de abertos; o Externo só o acompanha (não cadastra)                                | sim          |                      |
| 28  | **No celular (360 px):** como Externo, abrir o evento, tocar no telefone, digitar e tocar em Registrar    | Presença registrada em **2 toques**; o campo volta vazio para o próximo                             | sim          |                      |
| 29  | **No celular:** registrar uma pessoa que não está cadastrada                                             | A tela pede o nome (o campo já vem com o foco) e registra em **3 toques**; a pessoa passa a constar em Pessoas | sim          |                      |
| 30  | Registrar a mesma pessoa duas vezes no mesmo evento                                                      | Recusado ("Esta pessoa já consta")                                                                  | sim          |                      |
| 31  | Como Externo, abrir a lista de presença                                                                  | Só as presenças que ele registrou. O Interno vê a lista nominal inteira                             | sim          |                      |
| 32  | Corrigir a própria presença em até 30 minutos; depois olhar o botão "Corrigir" depois dos 30 minutos     | Dentro da janela: corrige. Depois: o botão some para o Externo, e o Interno ainda corrige           | sim          |                      |
| 33  | Como Supervisor, remover uma presença (com motivo curto e depois com 10 caracteres)                      | O botão só habilita com 10 caracteres; a linha some; o motivo fica na Auditoria                     | sim          |                      |
| 34  | Deixar passar a data do evento sem encerrar                                                              | O evento **continua aberto** e aceita presença. Só o Supervisor o encerra                           | sim          |                      |
| 35  | Encerrar o evento e tentar registrar, corrigir ou remover presença                                       | Nada é oferecido; a API recusa (409)                                                                | sim          |                      |

## Em tela pequena (celular)

Repita os itens 2, 10, 16, 20, 28 e 29 numa tela de 360 px e confira:

- [ ] O sino abre como um painel que cabe na tela e fecha ao escolher "Abrir".
- [ ] A gaveta da tarefa, do compromisso e do evento ocupa a tela, com "Fechar" alcançável com o polegar.
- [ ] Os campos de data e hora (datetime-local) abrem o seletor do aparelho.
- [ ] O campo de telefone da presença é grande e abre o teclado numérico.
- [ ] Nenhuma informação depende só de cor (Atrasada, Novo, Recusado, Encerrado aparecem em texto).
- [ ] Não há rolagem horizontal da página (as tabelas rolam dentro do próprio quadro).

## Execução contra o ambiente real (2026-11-16)

Antes da conferência visual, a API e o worker foram exercitados por HTTP contra o ambiente local de verdade: Postgres 17, a migração 0009 aplicada sobre um banco que já tinha dados das fases 2 e 3 (e os invariantes de subida passaram), API e worker como processos, e um usuário de cada perfil. **27 verificações, 27 corretas.** Cobre os itens 1, 3, 4, 5, 6, 8, 9, 14, 16 a 22, 27 a 31 e 33 a 35 pela API. **Não cobre** nada visual nem tela pequena: esses itens seguem pendentes.

- **Worker de prazos (item 12 e 13), com o processo real:** três tarefas venciam no dia seguinte. Ao subir, o worker gerou **3 avisos de prazo próximo**. Reiniciado em seguida, no mesmo dia, gerou **0** (a chave única por dia segura a repetição).
- Agenda: o Externo viu o compromisso de "Participantes" só como horário ocupado e **nada** do Restrito; o Chefe viu os dois; a "minha agenda" da Parlamentar trouxe os dois que a envolvem.
- Presença: pessoa nova sem nome respondeu 409 pedindo o nome; com o nome, foi criada no ato. O Interno não removeu (404); o Supervisor removeu com motivo e encerrou; encerrado, a presença respondeu 409.
- Detalhe do ambiente: o login permite 10 tentativas por minuto por origem. Quem roda vários perfis em sequência recebe 429 e precisa esperar um minuto.
- Detalhe do ambiente: um usuário semeado que nunca entrou tem a senha inicial vencida em 72 horas; para o teste, a senha foi trocada no banco local e a vigência encerrada.

## Defeitos encontrados

_(preencher durante a conferência)_
