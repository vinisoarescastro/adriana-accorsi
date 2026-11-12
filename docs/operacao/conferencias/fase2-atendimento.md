# Conferência da fase 2: Atendimento

Roteiro de conferência manual. Os testes automatizados garantem as regras; este roteiro garante que **alguém olhou** as telas, inclusive no celular.

- **Quem executa:** a pessoa que vai apresentar o sistema (e, se possível, alguém do gabinete).
- **Estado:** **pendente**. Os itens "sim" já passam nos testes; falta alguém conferir na tela.

## Antes de começar

1. Ambiente local no ar (`como-rodar.md`), com `npm run ambiente:subir` (inclui o ClamAV; a primeira subida demora alguns minutos para baixar as assinaturas).
2. `CLAMAV_HOST=127.0.0.1` no `.env` (sem ele, o envio de documentos fica desligado em desenvolvimento).
3. Quatro usuários com habilitação AT: um Assessor Externo, um Interno, um Supervisor e um Administrador.

## Roteiro

| # | O que fazer | Resultado esperado | Automatizado | Manual (data e quem) |
| --- | --- | --- | --- | --- |
| 1 | Como Assessor Interno, em Demandas > Nova demanda, digitar um telefone inexistente | Pede o nome; ao registrar, mostra o protocolo no formato `XXXX-XXXX-XXXX` | sim | |
| 2 | Registrar outra demanda com o mesmo telefone | Diz "Pessoa já cadastrada" e não pede o nome | sim | |
| 3 | Abrir a demanda; copiar o endereço e abrir em outra janela | A ficha abre direto (link profundo `?demanda=`) | sim | |
| 4 | Mover a demanda para outra etapa | A situação muda sozinha conforme a etapa (Em andamento, Concluída) | sim | |
| 5 | Comentar mencionando um colega; depois remover o comentário | Fica a marca "Comentário removido por … em …", sem o texto | sim | |
| 6 | Anexar um PDF, um PNG e um ZIP | Aparecem na ficha; o clique baixa o arquivo (não abre na tela) | sim (API) | |
| 7 | Anexar um `.exe` renomeado para `.pdf` | Recusado com mensagem clara | sim | |
| 8 | Anexar o arquivo de teste EICAR (texto do antivírus de teste) dentro de um ZIP ou PDF | Recusado como infectado; nada é guardado | sim (cliente), manual (contêiner real) | |
| 9 | Parar o contêiner `clamav` e tentar anexar | Recusa por "verificação indisponível"; nada é guardado | sim | |
| 10 | Como Supervisor, cancelar com justificativa curta | O botão de confirmar fica desabilitado até 10 caracteres | sim | |
| 11 | Depois de cancelada, tentar mover, comentar ou editar | Nenhuma ação é oferecida; a API recusa | sim | |
| 12 | Como Assessor Externo, abrir Demandas | Só aparecem as demandas de que ele é responsável | sim | |
| 13 | Como Assessor Externo, abrir pelo endereço a demanda de outra pessoa | "Não encontrada" | sim | |
| 14 | Como Assessor Externo, abrir a própria demanda | Ficha reduzida, sem comentários, documentos nem histórico | sim | |
| 15 | Em Pessoas, como Assessor Interno | Cadastra e altera; não vê Inativar nem Eliminar dados | sim | |
| 16 | Como Administrador, eliminar os dados de uma pessoa | A pessoa vira "Dados eliminados"; a demanda e o protocolo continuam, sem nome nem telefone | sim | |
| 17 | No Painel, conferir os números e clicar em "Atrasadas" | Abre a lista já filtrada; a tabela por etapa tem os mesmos números | sim | |
| 18 | Em Auditoria, procurar o nome ou o telefone da pessoa eliminada | Não aparece em lugar nenhum da trilha | sim | |

## Em tela pequena (celular)

Repita os itens 1, 3, 6, 10 e 17 numa tela de 360 px e confira:

- [ ] A ficha abre ocupando a tela, com botão de fechar alcançável com o polegar.
- [ ] O quadro rola na horizontal sem quebrar o resto da página.
- [ ] Nenhuma informação depende só de cor (Atrasada, Urgente, Cancelada aparecem em texto).
- [ ] Os campos do formulário de nova demanda têm rótulo e não são cobertos pelo teclado.

## Defeitos encontrados

_(preencher durante a conferência)_
