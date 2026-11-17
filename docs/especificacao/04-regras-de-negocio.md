# 04. Regras de negócio

Estado: rascunho da fase 0. Cada regra tem um identificador estável (`RN-`) para ser citado em testes. Derivadas do Mandatus; as marcadas **[novo]** não existiam lá ou mudaram.

## 4.1 Acesso e senha

| Id | Regra |
| --- | --- |
| RN-ACE-01 | Entrada por e-mail e senha |
| RN-ACE-02 | 5 tentativas erradas bloqueiam a conta por 15 minutos |
| RN-ACE-03 | Sessão expira após 5 horas de inatividade ou 12 horas absolutas |
| RN-ACE-04 | Atraso por tentativa errada: 250 ms × tentativa, saturando em 4 |
| RN-ACE-05 | Senha mínima de 10 caracteres, sem exigência de composição; recusada lista curta de senhas óbvias e senha igual ao e-mail |
| RN-ACE-06 | E-mail inexistente e senha errada dão a mesma mensagem e consomem o mesmo tempo |
| RN-ACE-07 | Trocar a própria senha exige a atual e encerra as outras sessões |
| RN-ACE-08 | Mudar perfil, habilitação, situação ou senha de alguém encerra as sessões dele no ato |
| RN-ACE-09 | Primeiro acesso: troca de senha obrigatória antes de qualquer outra tela. Senha inicial de uso único e com validade |
| RN-ACE-10 | Foto de perfil: PNG ou JPEG até 2 MB, verificada pelo conteúdo |
| RN-ACE-11 | **[novo]** Limite de requisições por IP no login, além do bloqueio por conta |
| RN-ACE-12 | **[novo]** A conta do perfil Parlamentar é pessoal e intransferível: existe um único usuário ativo com o perfil, e a trilha atribui os atos a ele. Segundo fator obrigatório a partir da fase 8 |

## 4.2 Demandas e protocolo

| Id | Regra |
| --- | --- |
| RN-DEM-01 | Protocolo, link, demanda, movimentação de entrada, vínculo e trilha entram na mesma transação; falha em qualquer um impede a criação |
| RN-DEM-02 | Protocolo de 12 caracteres aleatórios em três grupos de quatro, alfabeto de 31 símbolos sem `0 O 1 I L`, sem sequência. Imutável (gatilho), nunca reutilizado |
| RN-DEM-03 | Protocolo aceito com ou sem hífens, em qualquer caixa |
| RN-DEM-04 | Título obrigatório. Sem responsável indicado, quem registrou é o responsável. Prioridade padrão Média (Baixa, Média, Alta, Urgente) |
| RN-DEM-05 | A demanda nasce na etapa de papel Entrada e muda de etapa pelo mecanismo único de movimentação |
| RN-DEM-06 | Não existe coluna de status: o status é derivado do papel da etapa |
| RN-DEM-07 | Registrar e consultar: Assessor Externo ou superior, mas o Assessor Externo só vê as demandas de que é responsável. Ficha completa: Assessor Interno ou superior |
| RN-DEM-08 | Editar e mover: Supervisor ou superior, ou o responsável. Reatribuir e cancelar: Supervisor ou superior |
| RN-DEM-09 | Cancelar exige justificativa de 10 caracteres ou mais; demanda cancelada não se altera, e a ficha fica só de leitura: não recebe nem perde comentário ou documento (ler e baixar continuam) |
| RN-DEM-10 | Concluir a última tarefa de uma demanda não a conclui; o serviço só conta tarefas pendentes, para avisar |
| RN-DEM-11 | Demanda não é apagada |

## 4.3 Pessoas, documentos e comentários

| Id | Regra |
| --- | --- |
| RN-PES-01 | Telefone normalizado identifica a pessoa: não há segunda pessoa ativa com o mesmo telefone |
| RN-PES-02 | Pessoa não é apagada: é inativada (Supervisor ou superior) |
| RN-PES-03 | Eliminar dados pessoais (Administrador): nome, telefone, e-mail e contatos viram nulos, situação "Dados eliminados"; a linha permanece para que protocolo, link e histórico funcionem. Consentimento é encerrado |
| RN-DOC-01 | Documentos até 25 MB; PDF, PNG, JPEG e ZIP reconhecidos pelos primeiros bytes. Alcance herdado do registro |
| RN-DOC-02 | Bytes gravados antes do registro e apagados se o registro falhar. Remover marca como removido |
| RN-DOC-03 | **[novo]** Verificação de antivírus antes de aceitar o documento |
| RN-COM-01 | Comentário interno nunca tem operação que o publique |
| RN-COM-02 | Remover deixa marca com autor e data. Cada um remove o próprio; o de terceiro exige Supervisor |
| RN-COM-03 | Menção a colega em texto gera aviso a ele, se ele alcançar o registro; o nome continua no texto |

## 4.4 Publicação ao cidadão e área pública

| Id | Regra |
| --- | --- |
| RN-PUB-01 | Nada é público por padrão |
| RN-PUB-02 | Política de publicação: exibir título (padrão não); exibição do nome (completo, primeiro nome, não exibir); exibição do telefone (completo, mascarado, não exibir); expiração do link em dias após o desfecho (padrão 90) |
| RN-PUB-03 | Alterar a política é do Administrador e fecha a versão vigente e abre a seguinte |
| RN-PUB-04 | Obter link e pré-visualizar: Assessor Interno ou superior; a prévia usa a mesma projeção pública do cidadão |
| RN-PUB-05 | Revogar e regenerar o link: Supervisor ou superior. Revogar apaga o segredo, não tem volta e deixa a consulta por protocolo de pé |
| RN-PUB-06 | Suspender e retomar: Supervisor ou superior. Reversível, mesmo link; fecha as duas vias públicas |
| RN-PUB-07 | Publicar andamento: Assessor Interno ou superior. Texto curto escrito para o cidadão, sem autor na página. Remover: Supervisor; some da página, a linha e o texto ficam na trilha |
| RN-PUB-08 | Não existe operação que transforme comentário interno em andamento público, nem que publique documento ou dado de tarefa, projeto, emenda ou CEAP. A prioridade da demanda nunca é publicada |
| RN-PUB-09 | Link inválido, revogado, expirado ou inexistente respondem com o mesmo 404 e o mesmo corpo. O segredo do link nunca vai para a trilha |
| RN-PUB-10 | Consulta por protocolo exige o telefone do atendimento, enviada por POST. 5 falhas por origem bloqueiam 5 minutos, com atraso crescente; só o hash da origem é guardado, por 15 minutos. Todo fracasso dá a mesma mensagem e 404; excesso dá 429 |
| RN-PUB-11 | **[novo]** A expiração do link é aplicada: após o prazo, o link responde como inexistente |
| RN-PUB-12 | Cada acesso válido vira ocorrência na trilha, sem dados do visitante |

## 4.5 Notificação ao cidadão **[novo]**

| Id | Regra |
| --- | --- |
| RN-NOT-01 | Só se notifica quem consentiu e tem e-mail cadastrado |
| RN-NOT-02 | O consentimento é registrado com data, origem (quem registrou e como) e versão do texto aceito. Começa desmarcado |
| RN-NOT-03 | Cancelar o consentimento vale na hora, por link de descadastro em todo e-mail ou por pedido registrado pela equipe |
| RN-NOT-04 | O canal é só para andamento da própria solicitação. Não se envia divulgação de mandato ou comunicação política por este canal |
| RN-NOT-05 | O envio nasce de um evento gravado na mesma transação do ato (outbox) e é feito pelo worker; falha de envio nunca desfaz o ato; envio é repetido com recuo |
| RN-NOT-06 | O e-mail não contém título da demanda, descrição nem dado financeiro; contém o texto do andamento publicado, o protocolo e o link de acompanhamento |
| RN-NOT-07 | Há limite de envio por hora para proteger a reputação do domínio |
| RN-NOT-08 | O resultado de cada envio (enviado, falhou, cancelado) fica registrado e visível ao Supervisor |

## 4.6 Tarefas

| Id | Regra |
| --- | --- |
| RN-TAR-01 | Título obrigatório. O Assessor Externo cria tarefa só para si; designar outra pessoa exige Assessor Interno ou superior |
| RN-TAR-02 | Prazo não pode ser anterior a hoje na criação (alterar depois pode) |
| RN-TAR-03 | Tarefa pode se vincular a qualquer registro; herda o alcance do registro vinculado; vínculo fora do alcance é recusado |
| RN-TAR-04 | Mover e editar: Supervisor ou superior, ou o responsável. Reabrir tarefa concluída: Supervisor ou superior. Cancelar exige justificativa |
| RN-TAR-05 | Paginação: 25 por página, máximo 100 |

## 4.7 Agenda, eventos e presença

| Id | Regra |
| --- | --- |
| RN-AGE-01 | Compromisso exige título. Visibilidade padrão: Participantes |
| RN-AGE-02 | Aberto é visível na agenda do gabinete; Participantes esconde o conteúdo e pode mostrar o horário como ocupado; Restrito não aparece de forma alguma, nem como horário ocupado |
| RN-AGE-03 | Criar ou tornar Restrito: Supervisor ou superior. Ver o Restrito de outros sem ser participante: só Chefe, Administrador e Parlamentar |
| RN-AGE-04 | Participantes internos respondem (sem resposta, confirmado, recusado), mas a resposta é só informativa |
| RN-AGE-05 | Participante externo é pessoa ou beneficiário já cadastrado; não tem acesso, aviso nem presença |
| RN-AGE-06 | Bloqueios de indisponibilidade se criam e cancelam, entram na agenda e na detecção de conflito, sem descrever motivo |
| RN-AGE-07 | Consultar a agenda exige período (`de` e `ate`) |
| RN-AGE-08 | **[novo]** A agenda do gabinete é a agenda da Parlamentar. Todo compromisso tem a marca "envolve a Parlamentar", **ligada por padrão**. Compromisso marcado aparece na agenda dela, **sem gerar aviso**. Só a indicação explícita dela como participante interno gera aviso e permite resposta. Desmarcar é possível (por exemplo, compromisso interno da equipe). Ela vê todos os compromissos, inclusive Restritos, mas a visão "minha agenda" mostra primeiro os que a envolvem |
| RN-EVE-01 | Evento: nome obrigatório; encerrar é decisão de alguém (Supervisor ou superior), nunca derivada da data. Presença não se registra em evento encerrado |
| RN-EVE-02 | Presença por telefone; se não cadastrado, informa-se o nome e a pessoa é criada no ato |
| RN-EVE-03 | Quem registrou corrige a própria presença em até 30 minutos; depois, Assessor Interno ou superior. Remover exige justificativa, apaga a linha e deixa o motivo na trilha |

## 4.8 Avisos e menções

| Id | Regra |
| --- | --- |
| RN-AVI-01 | Nove naturezas: designação e reatribuição de tarefa, indicação em compromisso, remarcação e cancelamento de compromisso, prazo próximo, prazo vencido, despesa aguardando análise, saldo abaixo do limite |
| RN-AVI-02 | Só as duas de prazo nascem por tempo (worker); as outras sete nascem do ato, na transação do módulo |
| RN-AVI-03 | Quem não alcança o registro de origem não recebe o aviso; se perde o alcance depois, o aviso deixa de ser exibido |
| RN-AVI-04 | O aviso de prazo é gerado de hora em hora, uma vez por dia por prazo. **[novo]** Antecedência configurável (padrão 3 dias corridos) |
| RN-AVI-05 | Aviso não tem conteúdo próprio, dado pessoal nem valor monetário. Estado lido ou não lido, marcado pelo destinatário |
| RN-AVI-06 | **[novo]** Expurgo de avisos expirados (30 dias após leitura, 60 se não lido). Expirar não altera registro algum |

## 4.9 Projetos de lei e beneficiários

| Id | Regra |
| --- | --- |
| RN-PRO-01 | Projeto exige título, ementa e autoria; não pode haver dois projetos ativos com o mesmo número; prazo não anterior a hoje na criação |
| RN-PRO-02 | Nasce na etapa de Entrada do fluxo federal |
| RN-PRO-03 | Mover: Supervisor ou superior, ou o Assessor Interno responsável. Etapa de destino precisa ser do fluxo de Projeto de Lei e estar ativa |
| RN-PRO-04 | Cancelar exige justificativa |
| RN-PRO-05 | Coautores como lista de nomes; votação com data e resultado, sem placar individual; comissões com data e parecer |
| RN-BEN-01 | Beneficiário exige nome fantasia, razão social, CNPJ válido (dígito verificador) e endereço completo (CEP, logradouro, número, bairro, cidade, estado; só o complemento é opcional) |
| RN-BEN-02 | Não há dois beneficiários ativos com o mesmo CNPJ |
| RN-PRO-06 | **[fase 5]** O número é opcional até o protocolo; único entre os projetos não cancelados, sem diferenciar maiúsculas; cancelar libera o número |
| RN-PRO-07 | **[fase 5]** Reatribuir e cancelar são do Supervisor ou superior; mover, editar e acompanhar (assuntos, coautores, comissões, votações) são do responsável ou do Supervisor ou superior. Reabrir um projeto encerrado é do Supervisor ou superior |
| RN-PRO-08 | **[fase 5]** O status deriva do papel da etapa e o atraso do prazo vencido com o projeto em andamento; ambos calculados na leitura, nunca gravados |
| RN-BEN-03 | **[fase 5]** O CNPJ aceita o formato numérico e o alfanumérico (Receita Federal, a partir de julho de 2026), conferido pelo dígito verificador na tela, na API e no banco. Inativar libera o CNPJ |

## 4.10 Emendas parlamentares

| Id | Regra |
| --- | --- |
| RN-EME-01 | Exige identificação e finalidade; exercício entre 2000 e 2100; prazos de destinação, empenho e execução não anteriores a hoje na criação |
| RN-EME-02 | Valores derivados: disponibilizado, comprometido (soma das destinações ativas), utilizado (execuções), disponível e a executar. Não há coluna de saldo |
| RN-EME-03 | O valor da emenda não pode ficar abaixo do comprometido. A destinação não pode exceder o disponível nem ficar abaixo do já executado. A execução não pode exceder a destinação nem ter data futura |
| RN-EME-04 | Destinação com execução registrada não se cancela. Cancelar emenda ou destinação exige justificativa; o valor da destinação cancelada volta ao disponível |
| RN-EME-05 | Valor de lançamento não pode ser negativo nem zero |
| RN-EME-06 | Acompanhar: Assessor Interno ou superior com LG. Ver valores: LG ou FI. Supervisionar: Supervisor. Reconstituir a composição em uma data: Administrador |

## 4.11 CEAP

Ver `08-ceap.md`, que detalha parâmetros, apuração mensal e a regra de segregação.

## 4.12 Exportação

| Id | Regra |
| --- | --- |
| RN-EXP-01 | Exige Supervisor ou superior e a habilitação do módulo exportado. Sem a habilitação, a exportação não acontece, nem vazia |
| RN-EXP-02 | Usa a mesma leitura da tela, com o mesmo filtro, e só renderiza |
| RN-EXP-03 | Exportar escreve na trilha, na mesma transação |

## 4.13 Fluxos

| Id | Regra |
| --- | --- |
| RN-FLU-01 | Cada tipo de processo tem exatamente uma etapa de Entrada, uma de Arquivamento e ao menos uma de Conclusão |
| RN-FLU-02 | Etapas desses papéis não se desativam. Etapa com registros não se desativa |
| RN-FLU-03 | Mudar o papel de etapa já usada é recusado |
| RN-FLU-04 | Estruturar: Administrador; ajustar: Supervisor |
| RN-FLU-05 | Nenhuma regra depende de identificador fixo nem de posição de etapa. A ordem é só de apresentação |

## 4.14 Auditoria

| Id | Regra |
| --- | --- |
| RN-AUD-01 | Toda escrita grava a trilha na mesma transação; falha na trilha desfaz a operação |
| RN-AUD-02 | A trilha é imutável (UPDATE, DELETE e TRUNCATE recusados por gatilho) |
| RN-AUD-03 | Cada entrada tem origem (usuário, acesso público, comando de linha), autor, momento, valor anterior e novo, justificativa quando há |
| RN-AUD-04 | A trilha nunca contém senha nem segredo de link |
| RN-AUD-05 | Registram-se também exportações, acessos do cidadão (sem perfil do visitante), tentativas de entrada e operações de valor |
