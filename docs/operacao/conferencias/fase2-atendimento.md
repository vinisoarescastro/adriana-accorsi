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
| 11 | Depois de cancelada, tentar mover, editar, reatribuir, comentar ou anexar documento | Nenhuma ação é oferecida; a API recusa (409). Comentários e documentos já existentes continuam visíveis e baixáveis | sim | |
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

## Execução contra o ambiente real (2026-11-13)

Antes da conferência visual, a API foi exercitada por HTTP contra o ambiente local de verdade: Postgres 17, **ClamAV real** (1.5.4) e dados semeados, com um usuário de cada perfil. **28 verificações: 27 corretas e 1 divergente** (o comentário em demanda cancelada, corrigido logo depois; ver "Defeitos e decisões"). Cobre os itens 1, 2, 4 a 8, 9 a 18 pela API. **Não cobre** nada visual nem tela pequena: esses itens seguem pendentes.

- Item 8: o EICAR dentro de um ZIP foi recusado (400) e nada foi guardado. O EICAR solto dentro de um PDF **não** é detectado pelo ClamAV (a assinatura só vale no início do arquivo); por isso o teste correto é o ZIP.
- Item 9: com o contêiner do ClamAV parado, o envio respondeu **503 "verificação indisponível"** e nada foi guardado (falha fechada).
- Armazenamento: nesta execução usou-se disco local (`ARMAZENAMENTO_LOCAL=1`), porque o S3Mock do ambiente respondeu 500 a qualquer chamada nesta máquina (o S3 é coberto pelos testes de integração).
- Porta do Postgres: a 5432 estava ocupada; usou-se `POSTGRES_PORTA=55432`, como o `como-rodar.md` prevê.

## Defeitos e decisões

- **Comentário em demanda cancelada (corrigido em 2026-11-13):** a API aceitava comentário e documento. Decisão do usuário: a ficha cancelada é **só de leitura**. Agora criar e remover comentário e anexar e remover documento respondem 409, e a tela esconde esses controles. Ler e baixar continuam permitidos.
- _(preencher o que a conferência visual encontrar)_
