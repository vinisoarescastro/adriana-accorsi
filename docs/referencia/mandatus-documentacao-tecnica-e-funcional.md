# Mandatus: documentação técnica e funcional

Nov 10, 2026 · @Vinicius Soares Castro

## 1. Visão geral

O Mandatus é uma plataforma multi-inquilino (SaaS) de gestão integrada de gabinetes parlamentares: cada gabinete contratante trabalha em um espaço isolado pelo banco de dados, e o cidadão atendido acompanha a própria solicitação sem criar conta. Esta versão do documento descreve o código do ramo `main` (commit `1ea8625`, de 13/09/2026), lido sem executar nem alterar a aplicação. Ela substitui a versão anterior, que descrevia um checkout desatualizado (commit `25f926e`, de 31/08/2026).

**Estado em uma linha.** Segundo o README e o plano, as sete entregas (E1 a E7) estão concluídas; a leitura do código confirma que cada módulo tem serviço, rotas e tela. O que resta é operacional e de decisão externa (seção 11).

**Finalidade.** Substituir planilhas, mensagens e memória por um sistema único onde o gabinete atende cidadãos, distribui e acompanha tarefas, controla a agenda do parlamentar, acompanha projetos de lei, administra emendas e presta contas da verba indenizatória, tudo com trilha de auditoria.

**Público-alvo.**

- Gabinetes de mandatos municipais, estaduais e federais. A esfera declarada define os fluxos de projeto de lei e de emenda provisionados.
- A equipe do gabinete, em cinco perfis: Administrador do Gabinete, Chefe, Supervisor, Assessor Interno e Assessor Externo.
- Cidadãos atendidos, que só leem a página pública de acompanhamento.
- O operador da plataforma, que cadastra gabinetes, contrata módulos e presta suporte.

**Problemas que resolve.**

- O cidadão deixa de ligar para saber o andamento: recebe um link ou consulta pelo número do protocolo.
- O trabalho da equipe fica distribuído e visto: tarefas com responsável e prazo, agenda com níveis de privacidade, avisos de prazo.
- Dados de um gabinete nunca aparecem em outro: o isolamento é imposto pelo banco, não pela disciplina de quem programa.
- Dinheiro público tem saldo derivado, nunca editado, e toda decisão sobre despesa guarda quem lançou e quem decidiu.
- Cada ato fica registrado em trilha imutável, na mesma transação da operação.

### 1.1 As sete entregas

| Entrega | Conteúdo | Estado no código |
| --- | --- | --- |
| E1 Fundação | Isolamento no banco, acesso e sessão, equipe e habilitações, fluxos, ciclo de vida do gabinete, auditoria | Implementada |
| E2 Atendimento | Pessoas, protocolo, demandas, comentários internos, documentos, painel de atendimento | Implementada |
| E3 Área pública | Página do cidadão por link e por protocolo, política de publicação, andamentos publicáveis | Implementada |
| E4 Organização do trabalho | Tarefas, agenda, eventos, presença, avisos internos, menções | Implementada, com avisos de prazo gerados pelo Worker |
| E5 Legislativo | Projetos de lei (comissões e votações), beneficiários | Implementada |
| E6 Financeiro | Emendas parlamentares com destinações e execuções, verba indenizatória com despesas, pacote de documentos financeiros | Implementada |
| E7 Consolidação | Painel completo, exportação, busca, administração da plataforma (usuários, configurações, painel) | Implementada |

### 1.2 Números do repositório

| Item | Valor | Como obtive |
| --- | --- | --- |
| Arquivos versionados | 727 | `git ls-files` |
| Rotas de API | 211 | Contagem de `MapGet`, `MapPost`, `MapPut` e `MapDelete` |
| Migrações EF Core | 30 | Pasta de migrações |
| Invariantes de subida | 13 | `src/Mandatus.Invariantes/` |
| Testes | 900 verdes, segundo o README (135 de domínio, 598 de integração, 167 de front), medidos em 10/09/2026 | Do README; não executei. Contei cerca de 700 métodos `[Fact]` e `[Theory]` no backend |
| Entidades de domínio | 24 de gabinete e 9 de plataforma | Arquivos em `Mandatus.Domain` |

### 1.3 Onde roda

Cinco contêineres em uma VPS: Caddy, Api, Publico, Worker e Postgres. O README informa produção desde 25/08/2026, com HTTPS, backup diário e restauração provada. Três domínios: um para a aplicação (`usemandatus.com`, conforme verifiquei no ar), um para a área pública do cidadão e um para o site institucional, que desde 13/09/2026 vive em outro repositório (`vinisoarescastro/mandatus-site`).

## 2. Funcionalidades

O gabinete tem 16 páginas, mais o sino de avisos e a busca global; a plataforma tem 6. A tabela mostra o que cada módulo faz e quantas rotas de API tem. "Implementado" significa que li o serviço e as rotas; só verifiquei em tela, no ar, o que a seção 12 lista.

### 2.1 Gabinete

| Página ou recurso | O que faz | Rotas | Estado |
| --- | --- | --- | --- |
| Painel | Retrato do gabinete por blocos (atendimento, tarefas, agenda, legislativo, emendas, verbas, equipe, pendências), contados das mesmas linhas das listagens | 2 | Implementado |
| Equipe | Cadastrar usuário, perfil, situação, habilitações, redefinir senha, histórico | 12 | Implementado |
| Fluxos de trabalho | Etapas por tipo de processo (5 tipos), papel, rótulo público, visibilidade, prazo padrão, ordem | 9 | Implementado |
| Pessoas | Cidadãos por telefone; alterar, inativar, eliminar dados pessoais | 8 | Implementado |
| Demandas | Registro com protocolo, lista e quadro por etapa, ficha, mover, reatribuir, cancelar | 8 | Implementado |
| Comentários internos | Texto interno na ficha, com menção a colegas; remoção com marca | 5 | Implementado |
| Documentos | Anexar, baixar e remover (PDF, PNG, JPEG, ZIP, até 25 MB) | 6 | Implementado |
| Publicação | Política versionada, link, prévia, revogar, regenerar, suspender; andamentos para o cidadão | 12 | Implementado |
| Tarefas | Criar, alterar, mover, reatribuir, cancelar; vínculo a qualquer registro | 7 | Implementado |
| Agenda | Consultar por período, próximos, compromissos com participantes internos e externos e 3 níveis de visibilidade, resposta, bloqueios de indisponibilidade | 12 | Implementado |
| Eventos | Cadastrar, alterar, encerrar, evento mais próximo | 10 (com presença) | Implementado |
| Presença | Registrar por telefone em poucos toques, corrigir, remover, lista nominal | incluídas em Eventos | Implementado |
| Beneficiários | Cadastro de municípios, órgãos e entidades por CNPJ | 5 | Implementado |
| Projetos de lei | Cadastro, quadro, consolidado, assuntos, mover, comissões, votações, cancelar | 17 (com beneficiários) | Implementado |
| Emendas | Emenda, tipos, destinações a beneficiários, execuções, quadro, consolidado, reconstituição de valores por data | 41 (com verbas) | Implementado |
| Verbas indenizatórias | Verba por vigência, categorias, despesas com comprovante, aprovação e reprovação, relatório, saldo por data, pacote de documentos | incluídas acima | Implementado |
| Auditoria | Trilha do gabinete, operações, histórico por registro | 4 | Implementado |
| Configurações | Identidade do parlamentar (nome, cargo, partido, mandato, contato), foto do gabinete | 3 | Implementado |
| Avisos (sino) | Caixa pessoal; marcar como lido | 2 | Implementado |
| Busca global | Pesquisa nos registros que o usuário alcança | 1 | Implementado |
| Exportação | Arquivos de demandas, tarefas, agenda, projetos, emendas, despesas e presença | 7 | Implementado |
| Perfil | Trocar a própria senha e foto | 9 (com acesso) | Implementado |

### 2.2 Plataforma (operador)

| Página | O que faz | Estado |
| --- | --- | --- |
| Painel da plataforma | Retrato da carteira de gabinetes | Implementado |
| Gabinetes | Cadastrar, módulos contratados, provisionar, criar administrador, ativar, suspender, reativar, encerrar, eliminar; pacote financeiro | Implementado |
| Usuários da plataforma | Criar e administrar usuários de gabinete e da plataforma | Implementado |
| Suporte | Abrir e encerrar acessos de suporte, ver quais estão abertos | Implementado |
| Auditoria da plataforma | Trilha separada da dos gabinetes | Implementado |
| Configurações | Parâmetros globais | Implementado |

### 2.3 Área pública

Aplicativo Razor separado com quatro páginas: início, consulta por protocolo, acompanhamento por link e erro. Sem login, sem cookie, somente leitura.

### 2.4 Processo de fundo

O Worker executa uma tarefa: a **geração de avisos de prazo**, de hora em hora. Gera o aviso de prazo próximo (3 dias de antecedência) e o de prazo vencido, um por dia por prazo. Só consegue inserir na tabela `aviso`.

### 2.5 O que continua parcial ou pendente

- Antecedência do aviso de prazo fixa em 3 dias; torná-la configurável (RF-V16) está marcada como adiada no código.
- Expurgo de avisos expirados (RF-V18) também adiado, e o Worker não tem permissão de DELETE.
- Presença, tela pequena: a conformidade em celular depende de conferência manual (ver seção 11).
- Conjuntos de fluxo por esfera: roteiro de conferência com a casa legislativa pendente (PV-03).

## 3. Regras de negócio

As regras abaixo foram lidas do código, das mensagens de recusa dos serviços e das migrações SQL. Os códigos RN, RF, V e DT entre parênteses são os que o próprio código cita; a especificação em `docs/especificacao/` define cada um.

### 3.1 Isolamento e contexto de gabinete

- Toda tabela de escopo de gabinete tem política de linha habilitada e forçada: `gabinete_id = app_gabinete_atual()` para ler e gravar. Sem contexto, a consulta devolve zero linhas.
- O gabinete vem da sessão, nunca do corpo, da rota ou de cabeçalho.
- Chaves estrangeiras entre tabelas de gabinete são compostas, o que impede vínculo entre gabinetes.
- Registro de outro gabinete responde como inexistente, igual a "não alcança" (V-07, V-10).
- Exceção declarada: a leitura entre gabinetes existe só nas tabelas que a declaram, em uma segunda política apenas de leitura (`leitura_no_escopo_de_plataforma`), conferida pelo invariante 12.

### 3.2 Decisão de autorização em sete passos

O `DecisorDeAutorizacao` é o único lugar da decisão; a primeira falha encerra.

1. A operação é pública? Vai direto ao passo 7.
2. Há sessão válida?
3. O escopo da conta serve à operação? Conta de gabinete não faz operação de plataforma. Conta de plataforma só faz operação de gabinete com acesso de suporte ativo, e operações marcadas como vedadas ao suporte são recusadas mesmo assim.
4. O gabinete está Ativo? Se não, responde indisponibilidade, antes de olhar o perfil.
5. O nível do perfil alcança a operação?
6. O usuário tem a habilitação exigida, com o módulo contratado e vigente?
7. O registro pertence ao gabinete, e o usuário alcança o registro-pai?

A autoridade efetiva é a interseção de nível e habilitação (RN-P05). O alcance herdado vem de um ponto único (`ComposicaoDeAlcance`): só o Assessor Externo é limitado ao que é seu. A barra de navegação usa o mesmo decisor: página sem a habilitação não aparece, nem vazia nem bloqueada.

### 3.3 Acesso e senha

| Regra | Valor no código |
| --- | --- |
| Entrada | Por e-mail e senha (o campo `identificador` virou `email` em 02/09/2026) |
| Tentativas até bloquear a conta | 5 |
| Duração do bloqueio | 15 minutos |
| Inatividade que expira a sessão | 5 horas |
| Validade absoluta da sessão | 12 horas |
| Atraso por tentativa errada | 250 ms × tentativa, saturando em 4 |
| Tamanho mínimo da senha | 10 caracteres, sem exigência de composição |
| Recusadas | Lista curta de senhas óbvias; senha igual ao e-mail |

- E-mail inexistente e senha errada dão a mesma mensagem e consomem o mesmo tempo.
- O formato do e-mail só é exigido em valor novo: contas antigas com identificadores sem formato de e-mail continuam entrando (D-77).
- Trocar a própria senha exige a atual e encerra as outras sessões. Mudar perfil, habilitação, situação ou senha de alguém encerra as sessões dele no ato.
- Foto de perfil: PNG ou JPEG até 2 MB, verificada pelo conteúdo.

### 3.4 Demandas e protocolo

- Protocolo, link, demanda, movimentação de entrada, vínculo e trilha entram na mesma transação.
- O protocolo tem 12 caracteres aleatórios em três grupos de quatro, alfabeto de 31 símbolos sem 0, O, 1, I e L, sem sequência. Não muda, nem após cancelamento (gatilho no banco).
- Título obrigatório. Sem responsável indicado, quem registrou vira o responsável. Prioridade padrão: Média (agora com valor Urgente, a partir da migração `BeneficiarioCompletoEPrioridadeUrgente`).
- Registrar e consultar: Assessor Externo ou superior, mas o Assessor Externo só vê as demandas de que é responsável. Ficha completa: Assessor Interno ou superior.
- Editar e mover: Supervisor ou superior, ou o responsável. Reatribuir e cancelar: Supervisor ou superior. Cancelar exige justificativa de 10 caracteres ou mais; demanda cancelada não se altera.
- A demanda nasce na etapa de papel Entrada e muda de etapa pelo mecanismo único de movimentação. Não existe coluna de status: o status é derivado do papel da etapa.
- Concluir a última tarefa de uma demanda não a conclui. O serviço de demandas só conta tarefas pendentes, para avisar.

### 3.5 Publicação ao cidadão e área pública

| Operação | Quem faz | Efeito |
| --- | --- | --- |
| Obter link e pré-visualizar | Assessor Interno ou superior | A prévia usa a mesma projeção pública do cidadão |
| Revogar e regenerar o link | Supervisor ou superior | Revogar apaga o segredo, não tem volta e deixa a consulta por protocolo de pé |
| Suspender e retomar | Supervisor ou superior | Reversível, mesmo link; fecha as duas vias públicas |
| Publicar andamento | Assessor Interno ou superior | Texto curto escrito para o cidadão; sem autor na página |
| Remover andamento | Supervisor ou superior | Some da página no ato; a linha e o texto ficam na trilha |
| Alterar política de publicação | Administrador do Gabinete | Fecha a versão vigente e abre a seguinte |

- Nada é público por padrão. A política define exibir título (não é o padrão), exibição do nome (completo, primeiro nome ou não exibir), do telefone (completo, mascarado ou não exibir) e expiração do link entre 7 e 1.825 dias. O prazo é validado e gravado, mas nenhum código ou política de linha o aplica: o estado Expirada nunca é gravado (RN-075 está adiada).
- Não existe operação que transforme comentário interno em andamento público, nem que publique documento ou dado de tarefa, projeto, emenda ou verba. A prioridade da demanda nunca é publicada.
- Link inválido, revogado, expirado, inexistente ou de gabinete suspenso respondem com o mesmo 404 e o mesmo corpo. O segredo do link nunca vai para a trilha.
- Consulta por protocolo exige o telefone do atendimento. Limite por origem: 5 falhas bloqueiam por 5 minutos, com atraso de 250 ms × tentativa; a contagem fica em memória, guarda só o hash da origem e esquece após 15 minutos. Todo fracasso dá a mesma mensagem e 404; excesso de tentativas dá 429.

### 3.6 Pessoas, documentos e comentários

- Telefone normalizado identifica a pessoa: não há segunda pessoa ativa com o mesmo telefone. Pessoa não é apagada: é inativada (Supervisor ou superior).
- Eliminar dados pessoais (Administrador do Gabinete): nome, telefone e contatos viram nulos, a situação vira Dados eliminados, a linha permanece para que protocolo, link e histórico funcionem.
- Documentos: até 25 MB; PDF, PNG, JPEG e ZIP reconhecidos pelos primeiros bytes. Alcance herdado do registro. Bytes gravados antes do registro e apagados se o registro falhar. Remover marca como removido.
- Comentário interno nunca tem operação que o publique. Remover deixa marca com autor e data. Cada um remove o próprio; o de terceiro exige Supervisor.

### 3.7 Tarefas

- Título obrigatório. O Assessor Externo cria tarefa só para si; designar outra pessoa exige Assessor Interno ou superior.
- Prazo não pode ser anterior a hoje na criação (alterar depois pode).
- Tarefa pode se vincular a qualquer registro; herda o alcance do registro vinculado, e vínculo fora do alcance é recusado.
- Mover e editar: Supervisor ou superior, ou o responsável. Reabrir tarefa concluída: Supervisor ou superior. Cancelar exige justificativa.
- A tarefa chama o mecanismo único de etapa. Paginação: 25 por página, máximo 100.

### 3.8 Agenda, eventos e presença

- Compromisso exige título. Nível de visibilidade padrão: Participantes. Aberto é visível na agenda do gabinete; Participantes esconde o conteúdo e pode mostrar o horário como ocupado; Restrito não aparece de forma alguma, nem como horário ocupado.
- Criar ou tornar Restrito: Supervisor ou superior. Ver o Restrito de outros sem ser participante: só Chefe e Administrador. Criar e ver são autoridades diferentes.
- Participantes internos respondem (sem resposta, confirmado, recusado), mas a resposta é só informativa: recusar não remove o participante nem cancela o compromisso.
- Bloqueios de indisponibilidade se criam e se cancelam, e entram na agenda.
- Evento: nome obrigatório; encerrar é decisão de alguém (Supervisor ou superior), nunca derivada da data. Presença não se registra em evento encerrado.
- Presença por telefone; se o telefone não está cadastrado, informa-se o nome e a pessoa é criada no ato. Quem registrou corrige a própria presença em até 30 minutos; depois, Assessor Interno ou superior. Remover exige justificativa e apaga a linha, com o motivo na trilha.

### 3.9 Avisos e menções

- São 9 naturezas: designação e reatribuição de tarefa, indicação em compromisso, remarcação e cancelamento de compromisso, prazo próximo, prazo vencido, despesa aguardando análise e saldo abaixo do limite. Só as duas de prazo nascem por tempo (Worker); as outras sete nascem do ato, na transação do módulo que o pratica.
- Quem não alcança o registro de origem não recebe o aviso (RF-V13). Aviso tem estado de leitura marcado pelo destinatário e data de expiração.
- O aviso de prazo é gerado de hora em hora, uma vez por dia por prazo, com 3 dias de antecedência, e a falha de uma passagem não derruba o processo.
- Mencionar um colega em texto gera aviso a ele, se ele alcançar o registro; o nome continua no texto.

### 3.10 Projetos de lei e beneficiários

- Projeto exige título, ementa e autoria; não pode haver dois projetos ativos com o mesmo número; prazo não pode ser anterior a hoje na criação. Nasce na etapa de Entrada do fluxo da esfera.
- Mover: Supervisor ou superior, ou o Assessor Interno responsável. Etapa de destino precisa ser do fluxo de Projeto de Lei do gabinete e estar ativa. Cancelar exige justificativa.
- Comissões e votações são registradas no projeto.
- Beneficiário exige nome fantasia, razão social, CNPJ e endereço completo (CEP, logradouro, número, bairro, cidade, estado; só o complemento é opcional). Não há dois ativos com o mesmo CNPJ.
- Sem a habilitação Legislativo, o módulo não aparece; a página de beneficiários aceita Legislativo ou Financeiro.

### 3.11 Emendas parlamentares

- Exige identificação e finalidade; exercício entre 2000 e 2100; prazos de destinação, empenho e execução não anteriores a hoje na criação.
- Os valores são derivados: disponibilizado, comprometido (soma das destinações ativas), utilizado (execuções), disponível e a executar. Não há coluna de saldo.
- O valor da emenda não pode ficar abaixo do já comprometido. A destinação não pode exceder o disponível, nem ficar abaixo do já executado. A execução não pode exceder a destinação, nem ter data futura.
- Destinação com execução registrada não se cancela: dinheiro executado saiu e não volta ao disponível. Cancelar emenda ou destinação exige justificativa; o valor da destinação cancelada volta ao disponível.
- Valor não pode ser negativo nem zero em um lançamento.
- Acompanhar: Assessor Interno ou superior com Legislativo. Ver valores: Legislativo ou Financeiro. Supervisionar: Supervisor. Reconstituir a composição em uma data: Administrador do Gabinete.

### 3.12 Verba indenizatória e despesas

- Tudo exige a habilitação Financeiro. Lançar despesa: Assessor Interno ou superior. Supervisionar: Supervisor. Reconstituir saldo em uma data: Administrador do Gabinete.
- A verba tem vigência livre (o fim não pode ser anterior ao início), limite de alerta e prazo de prestação de contas. Não recebe despesa nova depois de encerrada, e não se encerra com despesas aguardando análise.
- Despesa exige descrição, valor maior que zero, responsável e data não futura. Precisa de comprovante anexado antes de ser submetida à análise. Não pode exceder o saldo.
- Despesa em análise já reduz o saldo. Aprovar ou reprovar é terminal: a despesa decidida não se edita nem se move. Reprovar exige motivo. Cancelar devolve o valor ao saldo e exige justificativa.
- **Segregação de função revogada:** a regra "quem lança não aprova" existiu e foi revogada (P-66, DT-114), com a migração 026 removendo a restrição do banco. O motivo registrado é operacional: gabinete pequeno tem um só supervisor com a habilitação Financeiro, e a regra deixava a despesa parada. Hoje quem lançou pode decidir; o que resta é a rastreabilidade (lançamento e decisão ficam em colunas distintas, e a auditoria enxerga quando coincidem). O comentário de abertura de `ServicoDeVerbas` ainda descreve a regra antiga (ver seção 11).
- Categorias de despesa se criam, renomeiam e desativam; a última ativa não se desativa.
- O pacote de documentos financeiros por período (pela data de envio do documento) pode ser baixado pelo gabinete (Chefe ou superior) ou gerado pela plataforma. A eliminação do gabinete é recusada enquanto houver pacote pendente.
- Nada de verba, emenda ou projeto alcança a área pública.

### 3.13 Exportação

- Exigir Supervisor ou superior, e a habilitação do módulo exportado (AT, AG, LG ou FI). Sem a habilitação, a exportação não acontece, nem vazia.
- Cada exportação usa a mesma leitura da tela, com o mesmo filtro, e só renderiza. Exportar escreve na trilha, na mesma transação.

### 3.14 Fluxos, ciclo de vida do gabinete e suporte

- Cada tipo de processo tem exatamente uma etapa de Entrada, uma de Arquivamento e ao menos uma de Conclusão; etapas desses papéis não se desativam. Mudar o papel de etapa já usada é recusado. Estruturar: Administrador do Gabinete; ajustar: Supervisor.
- Gabinete: Em preparo, Ativo, Suspenso, Encerrado, Eliminado. A ativação exige esfera, módulo contratado, fluxos completos, política de publicação vigente e administrador ativo, e a recusa lista o que falta. Suspender e encerrar exigem motivo; suspender derruba as sessões. Eliminar só a partir de Encerrado, com dupla confirmação (digitar a identificação interna).
- Provisionar copia os modelos padrão da esfera; mudar o modelo depois não afeta gabinetes já provisionados.
- Acesso de suporte: justificativa de 15 caracteres ou mais, prazo de 15 minutos a 8 horas (padrão 2 h), expiração automática, registro nas duas trilhas.
- Usuários da plataforma: e-mail único na plataforma inteira; gabinete suspenso ou encerrado não recebe credencial nova. Editar a foto do gabinete: Chefe ou Administrador, vedado ao suporte.

## 4. Fluxos de utilização

Os exemplos usam nomes e valores inventados, só para ilustrar o comportamento descrito no código.

### 4.1 Colocar um gabinete no ar (operador da plataforma)

1. O operador entra com conta de plataforma e abre Gabinetes. Cadastra nome, identificação interna, titular do mandato, fuso horário e módulos contratados. O gabinete nasce **Em preparo**.
2. Declara a esfera (municipal, estadual ou federal) e provisiona: fluxos, categorias e política de publicação da esfera são copiados para o gabinete.
3. Cria a conta do primeiro Administrador do Gabinete. A senha inicial aparece uma única vez.
4. Tenta ativar. Se faltar algo, a resposta lista cada pendência.
5. Com tudo em ordem, o gabinete fica **Ativo** e a equipe pode entrar.

O primeiro administrador da plataforma é criado por comando de linha, e existe um segundo comando que semeia um banco local com dados fictícios (e recusa rodar sobre banco que não seja local ou que já tenha gabinete). Nenhum dos dois é rota.

### 4.2 Primeiro acesso

1. A pessoa informa e-mail e senha inicial.
2. Antes de qualquer outra tela, o sistema exige a troca da senha (mínimo de 10 caracteres).
3. Depois, abre o Painel. Se a senha inicial venceu, o acesso é recusado e o administrador precisa gerar outra.
4. A barra lateral mostra só as páginas que o perfil e as habilitações alcançam.

### 4.3 Atendimento: do telefonema ao protocolo

Exemplo: Maria liga pedindo a poda de uma árvore.

1. A assessora abre Demandas, escolhe nova demanda e busca a pessoa pelo telefone. Se Maria não existe, cadastra na mesma tela.
2. Preenche o título ("Poda de árvore na Rua das Flores"); prioridade e prazo são opcionais. Sem responsável indicado, ela é a responsável.
3. Ao salvar, o sistema devolve o protocolo em três grupos de quatro, algo como `K7M2-9PQ4-XA3N` (ilustrativo), e o link do acompanhamento.

### 4.4 Condução

1. O responsável move a demanda de etapa; o status é o papel da etapa de destino.
2. A equipe conversa nos comentários internos (e menciona colegas com @, que geram aviso a eles).
3. Anexa documentos à ficha e, se for o caso, cria uma tarefa vinculada: "Ligar para a prefeitura até sexta", designada a um colega.
4. Quando há novidade para o cidadão, alguém redige um andamento. Ele não é cópia de comentário.
5. Ao chegar em etapa de Conclusão, o status deixa de ser em andamento. Se não houver como resolver, um supervisor cancela com justificativa.

### 4.5 O cidadão acompanha

- **Por link:** abre sem login; vê protocolo, situação em vocabulário de cidadão, linha do tempo só com as etapas marcadas como visíveis, andamentos escritos para ele e a identificação do gabinete. Link inválido, revogado, expirado ou de gabinete suspenso mostra sempre a mesma página de não encontrado, com 404.
- **Por protocolo:** informa protocolo (com ou sem hífens, em qualquer caixa) e o telefone dado no atendimento. Se não confere, mensagem única; após 5 falhas da mesma origem, aguarda 5 minutos.
- Cada acesso válido vira uma ocorrência na trilha do gabinete, sem dados do visitante.

### 4.6 Organizar o dia

1. A assessora marca um compromisso "Visita ao hospital" na agenda, escolhe os participantes internos e deixa o nível padrão (Participantes): os colegas veem o horário ocupado, mas não o conteúdo.
2. Para uma reunião política sensível, um supervisor cria o compromisso **Restrito**: só participantes, Chefe e Administrador o veem.
3. Os indicados recebem aviso e respondem (confirmar ou recusar); recusar não cancela nada.
4. O Worker, de hora em hora, avisa quem tem tarefa ou prazo vencendo em até 3 dias e quem já passou do prazo.

### 4.7 Evento e presença em campo

1. Alguém cadastra o evento "Audiência no bairro".
2. No dia, pelo celular, o assessor registra a presença pelo telefone de cada pessoa; quem não está cadastrada é criada na hora, informando o nome.
3. Um erro de digitação pode ser corrigido por quem registrou em até 30 minutos. Depois, corrige um Assessor Interno ou superior.
4. Um supervisor encerra o evento; depois disso não se registra presença.

### 4.8 Emenda: da destinação à execução

Exemplo: emenda individual de R$ 250.000,00 (valor ilustrativo).

1. O gabinete cadastra beneficiários (por CNPJ) e a emenda, que nasce na etapa de Entrada do fluxo da esfera.
2. Destina R$ 75.000,00 a um beneficiário: o comprometido sobe, o disponível cai para R$ 175.000,00. Tentar destinar mais que o disponível é recusado.
3. Registra a execução conforme o dinheiro sai (R$ 60.000,00, por exemplo, não superior ao destinado e sem data futura). Destinação com execução não se cancela.
4. O painel mostra o consolidado; o Administrador pode reconstituir a composição dos valores em uma data passada.

### 4.9 Verba indenizatória

1. Cria-se a verba do período (por exemplo, agosto), com valor disponibilizado e limite de alerta.
2. Um assessor lança a despesa, escolhe o responsável e anexa o comprovante; sem comprovante, ela não segue para análise.
3. Em análise, a despesa já reduz o saldo. Quem decide aprova ou reprova (reprovar exige motivo); a decisão é terminal.
4. Se o saldo cair abaixo do limite, gera-se aviso. Ao fim, o pacote de documentos do período pode ser baixado.

### 4.10 Projeto de lei

Cadastra-se título, ementa, autoria e número; o projeto percorre as etapas do fluxo da esfera; registram-se comissões e votações; o painel e o quadro mostram os atrasados.

### 4.11 Exportar e administrar

- Um supervisor com a habilitação do módulo exporta a relação em arquivo. O arquivo traz exatamente o que a tela mostraria a ele, e a exportação fica na trilha.
- Chefe ou Administrador altera perfil e habilitações; as sessões do usuário caem no ato.
- O operador abre acesso de suporte com justificativa e prazo; o acesso expira sozinho e aparece na trilha do próprio gabinete.

## 5. Perfis e permissões

A autoridade de um usuário de gabinete é a interseção de dois eixos: o **nível** do perfil e a **habilitação** (AT Atendimento, LG Legislativo, FI Financeiro, AG Agenda). Um sem o outro não autoriza. Tarefas, documentos, comentários, exportação e avisos não têm habilitação própria: herdam o alcance do registro a que se ligam ou exigem só nível.

### 5.1 Perfis

| Nível | Perfil | Particularidades |
| --- | --- | --- |
| 5 | Administrador do Gabinete | Tem todas as habilitações dos módulos contratados, não removíveis. Concede qualquer perfil, altera a política de publicação, elimina dados pessoais, reconstitui valores |
| 4 | Chefe | Administra equipe e habilitações, vê auditoria e produtividade da equipe, baixa o pacote financeiro, vê compromissos Restritos; não concede o perfil de Administrador |
| 3 | Supervisor | Supervisiona: reatribui, cancela, remove, revoga link, encerra evento, exporta, cria compromisso Restrito |
| 2 | Assessor Interno | Opera: ficha completa, comentários, documentos, andamentos, tarefas para terceiros, compromissos, projetos, lançamento de despesa |
| 1 | Assessor Externo | Registra e consulta só o que é dele; cria tarefa só para si; registra presença |
| Plataforma | Administrador da Plataforma | Conta sem gabinete: gabinetes, usuários, suporte, auditoria e configurações da plataforma. Só entra em gabinete por acesso de suporte |

### 5.2 Matriz das operações de gabinete

Nível mínimo lido nas declarações de cada serviço. "Qualquer" significa que o perfil mais baixo alcança, e o recorte por alcance faz o resto.

| Operação | Nível mínimo | Habilitação |
| --- | --- | --- |
| Painel (abrir), equipe (ver), fluxos (consultar), avisos próprios | Assessor Externo | não exige |
| Painel: bloco de atendimento | Assessor Externo | AT |
| Painel: bloco de tarefas | Assessor Externo | não exige |
| Painel: composição e produtividade da equipe | Chefe | não exige |
| Atender demanda e pessoa; registrar e consultar | Assessor Externo | AT |
| Ficha da demanda; manter pessoa; comentar; anexar documento | Assessor Interno | AT (comentar e anexar herdam do registro) |
| Editar e mover demanda | Supervisor, ou o responsável | AT |
| Reatribuir, cancelar; inativar pessoa; remover comentário de terceiro, documento, andamento | Supervisor | AT ou herdada |
| Link, prévia, política (consultar); publicar andamento | Assessor Interno | AT |
| Revogar, regenerar, suspender link | Supervisor | AT |
| Alterar política de publicação; eliminar dados pessoais | Administrador do Gabinete | AT |
| Tarefas: trabalhar com a própria | Assessor Externo | não exige |
| Tarefas: designar a outra pessoa | Assessor Interno | não exige |
| Tarefas: supervisionar | Supervisor | não exige |
| Agenda: consultar | Assessor Externo | AG |
| Agenda: marcar compromisso | Assessor Interno | AG |
| Agenda: compromisso Restrito (criar) | Supervisor | AG |
| Eventos: acompanhar; registrar presença | Assessor Externo | AT |
| Eventos: organizar; lista nominal; corrigir presença | Assessor Interno | AT |
| Eventos: encerrar; remover presença | Supervisor | AT |
| Projetos de lei: acompanhar | Assessor Interno | LG |
| Projetos de lei: supervisionar | Supervisor | LG |
| Beneficiários: consultar e manter | Assessor Interno | LG ou FI |
| Beneficiários: inativar | Supervisor | LG ou FI |
| Emendas: acompanhar | Assessor Interno | LG |
| Emendas: ver valores | Assessor Interno | LG ou FI |
| Emendas: supervisionar | Supervisor | LG |
| Emendas: reconstituir composição | Administrador do Gabinete | LG |
| Verbas: lançar despesa | Assessor Interno | FI |
| Verbas: supervisionar | Supervisor | FI |
| Verbas: reconstituir saldo | Administrador do Gabinete | FI |
| Pacote de documentos financeiros (baixar no gabinete) | Chefe | não exige |
| Exportar relação | Supervisor | a do módulo exportado |
| Auditoria do gabinete | Chefe | não exige |
| Histórico de um registro | Assessor Interno | não exige |
| Equipe: administrar | Chefe | não exige |
| Fluxos: ajustar; estruturar | Supervisor; Administrador do Gabinete | não exige |
| Identidade do gabinete: consultar; editar foto | Assessor Externo; Chefe (vedado ao suporte) | não exige |

### 5.3 Plataforma

Gabinetes (consultar, manter, eliminar), usuários da plataforma (consultar, administrar, criar), suporte (abrir), painel, auditoria e configurações (consultar, alterar parâmetro global) são operações de escopo de plataforma, sem nível nem habilitação. O pacote financeiro de um gabinete também é gerado pela plataforma.

### 5.4 Regras de concessão e fronteiras

- Só se concede perfil igual ou inferior ao próprio; o Chefe não concede Administrador (V-13). Quem concede perfil e habilitação: Chefe ou Administrador.
- Nenhum gabinete fica sem administrador (gatilho no banco, verificado no commit).
- A conta de plataforma não trabalha dentro de gabinete sem suporte ativo; a conta de gabinete não alcança a plataforma (V-05, V-06).
- Uma permissão ausente faz a página sumir do menu, e a rota responde como se não existisse.

## 6. Estrutura de dados

O banco é PostgreSQL 17.11. O contexto EF Core declara 42 conjuntos de entidades: 9 globais e 33 de gabinete. Há 30 migrações EF Core, acompanhadas de scripts SQL explícitos para o que o EF não expressa (política de linha, restrições, gatilhos, visões). Enums são gravados como texto, e os nomes são em snake\_case.

### 6.1 Entidades globais

| Entidade | Papel |
| --- | --- |
| Gabinete | Cliente: esfera, fuso, situação, identidade do parlamentar (cargo, partido, mandato), campos públicos, foto |
| Conta de acesso | E-mail único na plataforma, verificador Argon2id, escopo, bloqueio |
| Módulo contratado | Quais dos 4 módulos o gabinete contratou |
| Modelo padrão e parâmetro global | Conteúdo copiado no provisionamento; parâmetros operacionais |
| Sessão | Ticket no servidor: perfil, habilitações fixadas, validade |
| Acesso de suporte | Justificativa, prazo, situação |
| Protocolo emitido | Registro global que garante a unicidade do protocolo |
| Trilha da plataforma | Atos sobre gabinetes, contas, módulos e modelos |

### 6.2 Entidades de gabinete

| Grupo | Entidades |
| --- | --- |
| Equipe e fluxo | Usuário, Habilitação, Tipo de processo, Etapa, Categoria, Política de publicação |
| Atendimento | Pessoa, Demanda, Comentário interno, Menção, Publicação de andamento, Documento |
| Ligação | Movimentação (transição de etapa, comum a todos os tipos) e Vínculo (liga movimentação, comentário, documento, tarefa, compromisso ou aviso ao registro) |
| Trabalho | Tarefa, Aviso |
| Agenda | Compromisso, Participante interno, Participante externo, Bloqueio de indisponibilidade, Evento, Participação em evento |
| Legislativo | Beneficiário, Projeto de lei, Assunto do projeto, Tramitação em comissão, Votação do projeto |
| Financeiro | Emenda, Destinação, Execução da destinação, Verba indenizatória, Despesa |
| Auditoria | Trilha do gabinete |

### 6.3 Relações e garantias que importam

- Toda tabela de gabinete tem `gabinete_id`, política de linha forçada e chaves estrangeiras compostas. Contei 33 políticas `isolamento_por_gabinete` nas migrações SQL.
- Demanda, tarefa, projeto, emenda, destinação e despesa percorrem etapas pelo mecanismo único (Etapa, Movimentação, Vínculo). Não há tabela de histórico de cada um: o histórico é lido das movimentações.
- Demanda → Pessoa (solicitante), Usuário (responsável e autor), Etapa (atual). Tarefa se liga a demanda, pessoa, compromisso, projeto, emenda ou despesa por Vínculo.
- Emenda → Destinação (→ Beneficiário) → Execução. Verba → Despesa (→ Categoria, Documento de comprovante).
- **Não há coluna de saldo.** Disponibilizado, comprometido, utilizado e saldo são calculados por `ComposicaoDeValores` e por visões. Toda coluna monetária precisa estar declarada na lista de valores cadastrados (invariante 13), e não pode ser negativa (invariante 4). Valor monetário trafega como texto na API.
- Trilha de auditoria imutável por gatilho (UPDATE, DELETE, TRUNCATE recusados).
- Gatilho diferido impede gabinete sem administrador. Gatilho impede mudança de protocolo.
- Pessoa e documento não são apagados em operação comum; presença é a exceção declarada (remover apaga a linha, e o motivo fica na trilha).

### 6.4 Armazenamento fora do banco

Os bytes dos documentos e das fotos ficam em balde privado da Cloudflare R2 (cliente S3), sem URL direta; em desenvolvimento, na falta de credencial, usa-se o sistema de arquivos, e fora de Development o processo se recusa a subir assim.

## 7. Arquitetura e tecnologias

O backend é um código C# único (.NET 10) que roda como três processos sobre PostgreSQL 17. A interface interna é uma SPA em React servida pelo mesmo processo da API; a área do cidadão é um aplicativo Razor Pages separado.

### 7.1 Processos

| Processo | Função | Conecta ao banco como | Observações |
| --- | --- | --- | --- |
| Caddy | Termina HTTPS, renova certificados, encaminha | não conecta | Único com portas abertas (80 e 443); três domínios: aplicação, área pública e site institucional |
| Api | API da área interna e front estático | `mandatus_app` | Mesma origem do front, cookie SameSite Strict; 211 rotas |
| Publico | Páginas do cidadão | `mandatus_app` | Sem credencial do R2; uma só instância por requisito |
| Worker | Avisos de prazo, de hora em hora | `mandatus_worker` | Só INSERT em `aviso`, conferido pelo invariante 11 |
| Postgres | Banco | não aplicável | Sem porta publicada |

Três papéis de banco: `mandatus_migracao` (dono do esquema), `mandatus_app` (sem propriedade e sem BYPASSRLS) e `mandatus_worker` (sem concessão padrão de escrita).

### 7.2 Organização do código

| Projeto | Conteúdo |
| --- | --- |
| `Mandatus.Domain` | Entidades e enumerações; sem referência a EF Core nem a ASP.NET |
| `Mandatus.Application` | Serviços por módulo (27 pastas), decisor de autorização, composição de alcance, contratos |
| `Mandatus.Infrastructure` | EF Core, repositórios, migrações, Argon2id, armazenamento R2 e sistema de arquivos |
| `Mandatus.Api` | Rotas minimal API por módulo, sessão por cookie, OpenAPI, comandos de bootstrap e semeadura |
| `Mandatus.Publico` | Razor Pages: início, consulta, acompanhamento, erro |
| `Mandatus.Worker` | Serviço hospedado de geração de avisos |
| `Mandatus.Invariantes` | 13 verificações que impedem a subida |
| `Mandatus.Hospedagem` | Proxy reverso confiável, proteção de dados do cookie |
| `web/` | React 19, React Router 7, TanStack Query 5, TypeScript 5.9, Vite 7, Vitest |
| `tests/` | xUnit (unidade e integração com Testcontainers) |

Tamanho aproximado: 62 mil linhas de C# em `src/` (sem migrações), 31 mil em `tests/`, 48 mil no front (8,4 mil são o contrato gerado). Os estilos do front são escritos à mão em `web/src/estilos/` (tokens, base, componentes, páginas), sem Tailwind; essa é uma diferença em relação ao `docs/arquitetura/stack.md` e ao roteiro de tela pequena, que ainda citam Tailwind.

O contrato OpenAPI está em `contratos/mandatus-api.json`, e os tipos TypeScript são gerados dele. O pipeline reprova se o gerado divergir do versionado.

### 7.3 Os 13 invariantes de subida

O processo não sobe se qualquer um falhar. Comuns: o papel não é dono de tabela de gabinete (1); sem BYPASSRLS (2); política de linha habilitada e forçada em toda tabela de gabinete (3); coluna monetária não negativa (4); gatilhos de imutabilidade da trilha (5); sem coluna de saldo armazenado (6); sessão com ticket no servidor (7); visões com security invoker (9); chave estrangeira com gabinete\_id (10); leitura entre gabinetes só onde declarada, e só leitura (12); toda coluna monetária declarada como valor cadastrado (13). Exclusivos: aplicativo público sem rota de escrita (8) e escrita do worker restrita à lista declarada (11).

### 7.4 Integração contínua e implantação

- O pipeline tem três trabalhos: conferir o estático, compilar e testar o backend, e gerar o contrato e conferir o front.
- Conferições estáticas por script: travessões, declarações duplicadas, classes de componente, fidelidade das folhas de estilo, identificação dos componentes, desfechos das operações, links e âncoras da documentação. Aviso de compilação é erro.
- Em push para `main`, as três imagens (api, publico, worker) são publicadas no GHCR com a etiqueta `main` e o hash do commit.
- A VPS usa `compose.producao.yaml` e scripts de implantação, backup, restauração e versão em `scripts/implantacao/`, que não li em detalhe.

### 7.5 Documentação do repositório

`docs/` tem especificação (21 documentos normativos), arquitetura (stack, design system, tokens, mapa de componentes, fronteira com o site), execução (plano, etapas, decisões técnicas DT, pendências PV, progresso, histórico) e operação (como rodar, implantar, conferências manuais). `CLAUDE.md` e `docs/agentes/` orientam agentes de IA.

## 8. Interface e experiência do usuário

Não usei a aplicação em um navegador: a avaliação vem da leitura do front, dos roteiros de conferência do repositório e, para o que está no ar, da verificação da seção 12.

### 8.1 Estrutura e navegação

- SPA com React Router (`BrowserRouter`). Rotas com prefixo `/g/` para o gabinete (por exemplo `/g/demandas`, `/g/tarefas`, `/g/agenda`, `/g/emendas/:id`) e `/p/` para a plataforma. Há links profundos para registros (`/g/demandas?demanda=<id>`), e o front sem sessão mostra a tela de entrada em qualquer endereço. Isso corrige a limitação da versão anterior do documento, que descrevia navegação em memória.
- O gabinete tem 16 páginas, e a plataforma 6. A barra lateral mostra só as páginas que a sessão alcança, decididas no servidor pelo mesmo decisor das rotas (`paginasAlcancaveis` na resposta da sessão). Falha fechada: página não declarada não aparece.
- Sino de avisos como gaveta (não é página), busca global, ações de criação no topo, foto de perfil e do gabinete, e cabeçalho com o nome do gabinete e o parlamentar.
- Datas sempre no fuso do gabinete, não no do navegador.
- Existe uma página de catálogo do sistema de design dentro da própria aplicação (`/sistema`).

### 8.2 Consistência visual

- Sistema de design com tokens (`tokens.css`, `docs/arquitetura/tokens.md`) e catálogo de componentes. Scripts conferem classes declaradas, identificação `data-componente`, e que não haja cópia das folhas de estilo.
- Contraste da paleta medido por teste (`contraste.teste.ts`).
- Fichas de registro (demanda, emenda, verba, gabinete) em gavetas e páginas de detalhe, com cerca de mil linhas cada.
- Texto da interface em português e sem travessões, regra imposta por script.

### 8.3 Área pública

CSS escrito à mão, páginas renderizadas no servidor, vocabulário de cidadão (solicitação em vez de demanda), `noindex` e `robots.txt` com `Disallow: /`, aviso na página de que quem tem o endereço acessa. A página responde primeiro o que o cidadão veio saber.

### 8.4 Responsividade e acessibilidade

- Barra fixa em tela larga e gaveta em tela estreita; presença foi desenhada para poucos toques em celular.
- O repositório agora tem um script de conferência em tela pequena (`scripts/conferir-tela-pequena.mjs`) e roteiros com resultados para E5 e E7 em `docs/operacao/conferencias/`. O próprio roteiro admite que isso garante que alguém olhou, mas não impede regressão. Não executei o script.
- Gráficos precisam de equivalente textual ou tabular, e nenhuma informação pode depender só de cor (critério 10 de E7, segundo o plano).

## 9. Integrações e automações

### 9.1 Serviços externos efetivamente usados

| Serviço | Uso | Observação |
| --- | --- | --- |
| Cloudflare R2 (API S3) | Documentos e fotos | Balde privado; credenciais por segredo; testado contra MinIO |
| Let's Encrypt, via Caddy | Certificados dos três domínios | Renovação automática |
| GitHub Actions e GHCR | Pipeline e imagens | Imagens só em push para `main`, após os testes |
| Backup externo | Backup diário saindo da VPS, com restauração provada | Segundo o README; scripts não lidos em detalhe |

Não há integração com e-mail, SMS, WhatsApp ou outro canal de notificação ao cidadão ou à equipe fora da aplicação: o gabinete copia o link e o envia manualmente, e os avisos são internos. A senha inicial é mostrada ao criador da conta (canal controlado está pendente, PV-05).

### 9.2 Como os módulos conversam

- Demanda, tarefa, projeto, emenda, destinação e despesa **chamam** o mecanismo único de movimentação; nenhum tem máquina de estados própria.
- Listagem, painel, busca e exportação usam o mesmo ponto de alcance e a mesma leitura; nenhum escreve consulta própria.
- A pré-visualização interna chama a mesma projeção pública do cidadão.
- Tarefa, comentário, documento e andamento se ligam ao registro por Vínculo e herdam o alcance dele.
- Avisos nascem nos módulos que praticam o ato, dentro da mesma transação; menções são um serviço chamado por Demandas, Comentários, Tarefas e outros.
- Toda escrita grava a trilha na mesma transação (`IUnidadeDeTrabalho`); exportar também grava.
- O serviço de demandas conhece tarefas só por uma interface que conta pendências, e o de tarefas conhece projetos só por uma interface que devolve o responsável: um não pode concluir o outro.

### 9.3 Automações

- **Em vigor:** geração horária de avisos de prazo; expiração de sessão por inatividade (5 h) ou validade absoluta (12 h); bloqueio temporário de conta; expiração automática do acesso de suporte; renovação de certificado; backup diário; geração do contrato no pipeline; avisos por ação (designação, reatribuição, indicação e remarcação em compromisso, despesa em análise, saldo abaixo do limite).
- **Previstas e adiadas:** antecedência configurável do aviso de prazo, expurgo de avisos, expiração do link público.
- **Princípio de projeto:** nenhuma automação decide. Concluir a última tarefa não conclui a demanda, um evento passado não se encerra sozinho, "atrasado" é derivado na leitura e não gravado, e o Worker só consegue inserir avisos.

## 10. Segurança e auditoria

Leitura de código, não teste de intrusão. Os achados negativos são hipóteses a confirmar.

### 10.1 Controles presentes

- **Isolamento no banco:** política de linha forçada em 33 tabelas, papéis sem propriedade nem BYPASSRLS, `SET LOCAL` por transação, chaves compostas, e 13 invariantes que impedem a subida.
- **Leitura entre gabinetes controlada:** só por uma segunda política de leitura, declarada e conferida (invariante 12), usada pela administração da plataforma.
- **Autenticação:** Argon2id; mensagem e tempo iguais para e-mail inexistente e senha errada; bloqueio após 5 falhas; sessão com ticket no servidor, invalidável no ato; troca de senha encerra as outras sessões.
- **Cookie:** `HttpOnly`, `SameSite=Strict`, `Secure` fora de desenvolvimento, sem expiração deslizante.
- **Autorização:** decisor único em sete passos; recusa e inexistência respondem igual; a barra de navegação usa o mesmo decisor; vedar ao suporte é possível por operação (`vedadaAoSuporte`), hoje aplicado à edição da foto do gabinete.
- **Dinheiro:** valores exatos (`decimal`/`numeric`), texto na API, nenhum valor negativo, nenhum saldo armazenado, decisão de despesa terminal, trilha de quem lançou e de quem decidiu.
- **Borda:** HTTPS com HSTS de um ano, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, cabeçalho Server removido, Caddy sem API de administração; domínios separados para aplicação, área pública e site.
- **Área pública:** invariante que recusa rotas de escrita (exceto a consulta por protocolo, listada nominalmente), projeção por contrato sem tipos do domínio, respostas idênticas, `noindex`, limite por origem sem guardar o endereço, Razor que escapa o conteúdo.
- **Arquivos:** tipo pelo conteúdo, balde privado sem URL direta, download como anexo, foto só PNG ou JPEG até 2 MB, processo público sem credencial do R2.
- **Segredos:** fora do repositório; segredo do link nunca na trilha; consulta pública por POST para não pôr o telefone na URL. Comandos de bootstrap e semeadura são de linha de comando; a semeadura recusa banco não local.

### 10.2 Auditoria

- Trilha do gabinete e trilha da plataforma, imutáveis por gatilho. Operação e trilha compartilham a transação: falha na trilha desfaz a operação.
- Cada entrada tem origem (usuário do gabinete, acesso de suporte, acesso público, administrador da plataforma), autor, valor anterior e novo, e justificativa quando há.
- Registram-se também exportações, acessos do cidadão (sem perfil do visitante), tentativas de entrada e operações de valor (destinação, execução, despesa aprovada e reprovada).
- Consulta: Chefe ou superior para a trilha do gabinete; Assessor Interno para o histórico de um registro; conta de plataforma para a da plataforma.
- O texto de andamento publicado e removido fica na trilha, para reconstituir o que esteve público.

### 10.3 Possíveis fragilidades

| Ponto | Observação | Gravidade estimada |
| --- | --- | --- |
| Sem Content-Security-Policy | Não encontrei CSP no Caddyfile nem no código. Sem ela, não há defesa em profundidade contra XSS na SPA e nas páginas públicas | Média |
| Bloqueio de conta sem limite por IP | 5 falhas bloqueiam a conta por 15 min; não achei limitador de requisições no acesso interno. Quem conhece um e-mail pode manter a conta bloqueada | Média |
| Limite da consulta por protocolo em memória | Zera ao reiniciar e não serve a mais de uma réplica; declarado em DT-70 | Baixa, ciente |
| Antiforgery desligado em várias rotas | Envios de arquivo (documentos, foto de perfil, foto do gabinete, usuários da plataforma) desligam o antiforgery; a defesa contra CSRF é `SameSite=Strict` | Baixa |
| ZIP aceito | Tipo reconhecido pelos primeiros bytes; um ZIP pode conter qualquer coisa. Não há antivírus | Média |
| Vedação ao suporte pouco usada | Aplicada a uma operação. Não verifiquei se alterar a política de publicação ou outras decisões do gabinete têm barreira equivalente para conta de suporte | A confirmar |
| Expiração do link público não aplicada | O prazo é configurável e nada o aplica (RN-075 adiada) | Baixa a média |
| Segregação de função em despesas revogada | Quem lança pode aprovar; decisão de negócio registrada (DT-114). A garantia passa a ser só de rastreabilidade | Decisão aceita; relevante para prestação de contas |
| Sem segundo fator | Recomendado e adiado (PV-04); a conta de plataforma é o alvo de maior valor | Média |
| Senha inicial sem canal controlado | Mostrada ao criador da conta (PV-05) | Baixa a média |
| Link como credencial | O endereço dá acesso; há aviso, revogação, regeneração e suspensão | Inerente ao desenho |

## 11. Pontos de atenção e oportunidades

Nada abaixo foi corrigido: é registro para decisão.

### 11.1 Documentação que ficou para trás do código

1. O comentário de abertura de `ServicoDeVerbas` (e a descrição de critérios próximos) ainda afirma "quem lança não aprova", embora a migração 026 e um comentário mais abaixo no mesmo arquivo tenham revogado a regra. Comentários de código podem ficar defasados, e este documento tomou cuidado extra onde cita regras vindas de comentários.
2. `docs/arquitetura/stack.md` continua citando Quartz.NET, Tailwind, shadcn/ui, React Hook Form, Zod e Recharts. Não encontrei Quartz.NET no código (o Worker usa `BackgroundService` com temporizador), e o `package.json` do front não tem Tailwind, React Hook Form, Zod nem Recharts.
3. O README diz "HTTPS nos dois domínios", mas o Caddyfile tem três blocos (aplicação, área pública e site institucional). O README também mostra `Host=localhost` na cadeia de conexão do exemplo; nesta estação, o guia `como-rodar.md` do `main` não menciona `127.0.0.1`. O ajuste para `127.0.0.1` que eu havia visto estava em um ramo local apagado (`fix/ambiente-local-host-ipv4`, commit `19d19a3`) e não está no `main`.
4. O roteiro de tela pequena descreve o front como Tailwind, o que o `package.json` atual não confirma.
5. O plano diz que o que resta é operacional: implantar E6 e E7 na VPS. A produção que verifiquei (seção 12) já tem emendas, verbas e agenda funcionando.

### 11.2 Funcionalidade parcial ou adiada (marcada \[I\] ou \[D\] no código e no plano)

- Antecedência configurável do aviso de prazo (RF-V16) e expurgo de avisos (RF-V18).
- Expiração do link público (RN-075).
- Assinatura externa de agenda (V-70, depende de IE-07): teste pulado de propósito. O outro teste pulado depende de credencial real do R2.
- Segundo fator de autenticação (PV-04) e canal controlado da senha inicial (PV-05).
- Equipe de operação e suporte (PV-06) e conferência dos conjuntos de fluxo por esfera com a casa legislativa (PV-03): bloqueia ativar gabinete real, não a construção.
- Sem canal de notificação externo ao cidadão (e-mail, mensagem).

### 11.3 Riscos técnicos

- **Um único servidor:** banco, aplicação e proxy compartilham uma VPS (8 GB de RAM). Há backup com restauração provada; não li o plano de recuperação de desastre.
- **Instância única obrigatória no público:** escalar horizontalmente a área pública exige antes mover a contagem de tentativas para armazenamento compartilhado.
- **Postgres fixo em 17.11:** correções de segurança exigem troca deliberada.
- **Contrato gerado grande e arquivos de tela longos:** o contrato tem 8,4 mil linhas, e fichas de demanda, emenda, verba e gabinete passam de mil linhas cada. São pontos de custo de manutenção.
- **Mudança de domínio recente:** em 13/09/2026 a aplicação saiu de `/app` para a raiz de outro domínio e o site foi separado. Links antigos foram descartados sem ponte, por decisão registrada.
- **Governança do R2:** a jurisdição e a conta pessoal foram decididas em 25/08/2026 (PV-01 e PV-08); a conta permanecer pessoal é um risco de titularidade que a própria pendência registra.
- **Conformidade em tela pequena:** há roteiro e script, mas o próprio documento admite que eles não impedem regressão.

### 11.4 Oportunidades de melhoria

1. Cabeçalho Content-Security-Policy na borda.
2. Limite de requisições por IP no acesso interno, além do bloqueio por conta.
3. Estender a vedação ao suporte às decisões do gabinete sobre exposição ao cidadão, ou documentar por que não.
4. Aplicar a expiração do link, ou remover o campo da política.
5. Revisar a revogação da segregação de função com quem presta contas ao tribunal, ou exigir segunda aprovação quando houver mais de um supervisor.
6. Atualizar README, `stack.md` e comentários defasados para o estado real; incluir no `main` o ajuste de `127.0.0.1` se ainda for necessário.
7. Segundo fator para a conta de plataforma.
8. Notificação ao cidadão sobre mudança de andamento, que hoje depende de consulta ativa.
9. Dividir as telas de mais de mil linhas por responsabilidade.

## 12. Limites da análise e verificação em produção

### 12.1 O que esta versão do documento cobre

O código do `main` em `1ea8625` (13/09/2026), lido por busca e leitura direcionada: estrutura do repositório, `README` e `CLAUDE.md`, as 211 rotas, todas as declarações de autorização dos serviços, as mensagens de recusa dos serviços de tarefas, agenda, eventos, presença, legislativo, emendas, verbas, pacote, plataforma e acesso, o Worker, os invariantes 12 e 13, a lista de páginas alcançáveis, o Caddyfile, o compose de produção e o pipeline.

### 12.2 O que não li ou não fiz

- Não executei a aplicação, os testes, as migrações nem os scripts. Contagem de 900 testes e data de produção vêm do README.
- Não li todos os arquivos: por exemplo, os scripts de implantação e backup, a maior parte dos testes, os 21 documentos de especificação, o detalhe do painel da plataforma, da busca global e das migrações mais recentes.
- Regras retiradas de comentários do código podem estar defasadas (aconteceu com a segregação de despesas). Onde o serviço e o comentário divergiam, dei prioridade à migração e ao código.
- Não abri a aplicação em navegador.

### 12.3 Verificação feita na aplicação em produção (usemandatus.com)

Feita em uma etapa anterior desta análise, com uma conta de Administrador do Gabinete fornecida pelo usuário, no gabinete "Gabinete Deputada Estadual Estrela", e apenas com leituras (GET) depois do login. A senha não foi registrada.

| Área | Resposta | O que vi |
| --- | --- | --- |
| Painel | 200 | Blocos de atendimento, tarefas, agenda, legislativo, emendas, verbas, avisos e pendências |
| Equipe, Fluxos, Pessoas, Demandas | 200 | 1 usuário; 5 tipos de fluxo completos (Demanda 7 etapas, Tarefa 5, Projeto de Lei 12, Emenda 9, Despesa de Verba 5); 2 pessoas; 2 demandas |
| Tarefas, Eventos | 200 | 1 tarefa; 1 evento |
| Agenda | 200 com `de` e `ate` | Vazia em novembro de 2026; sem esses parâmetros responde 400 |
| Avisos | 200 | Caixa vazia |
| Projetos, Beneficiários, Emendas, Verbas | 200 | 1 projeto, 1 beneficiário, 2 emendas com valores, 1 verba ativa com saldo e despesas |
| Auditoria | 200 | 68 entradas, com operações de projeto, emenda, destinação, execução, despesa aprovada e reprovada, evento, presença, compromisso e tarefa |
| Sessão | 200 | Perfil Administrador do Gabinete; 16 páginas alcançáveis, as mesmas do código do `main`; fuso America/Sao\_Paulo |

O conjunto de páginas, os campos da sessão e o login por e-mail coincidem com o código do `main` lido nesta versão, o que sugere que a produção roda esse código. Não confirmei o hash da imagem em execução. Efeitos colaterais da verificação: o login criou uma sessão e uma entrada na trilha de acesso, e uma primeira tentativa com o campo errado recebeu 401.

### 12.4 Histórico desta análise

Uma primeira versão do documento descrevia um checkout local desatualizado (31/08/2026, 151 commits atrás do remoto), e por isso afirmou erradamente que E4, E5 e E6 não estavam implementadas. A verificação em produção e a atualização do repositório local corrigiram isso, e esta versão foi reescrita do zero sobre o código atual.
