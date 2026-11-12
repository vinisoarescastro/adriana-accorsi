# 06. Fluxos de utilização

Estado: rascunho da fase 0. Exemplos com nomes e valores inventados, só para ilustrar. Cada fluxo é candidato a roteiro de conferência e a teste de ponta a ponta.

## F01. Primeiro acesso do Administrador

1. O primeiro Administrador é criado por **comando de linha** na instalação (não é rota).
2. Entra com e-mail e senha inicial.
3. Antes de qualquer outra tela, o sistema exige a troca da senha (mínimo de 10 caracteres).
4. Abre o Painel. A barra lateral mostra só as páginas que o perfil alcança.
5. Cadastra a equipe: nome, e-mail, perfil, habilitações. A senha inicial aparece uma única vez e tem validade.

## F01b. A Deputada usa o sistema

1. O Administrador cria o usuário da Deputada com o perfil Parlamentar (só pode haver um ativo). A conta é pessoal.
2. Ela entra com o próprio login, troca a senha e abre o Painel completo.
3. Em "minha agenda" vê os compromissos que a envolvem (marcados por padrão) e, quando precisa, toda a agenda, inclusive os Restritos.
4. Pode registrar demandas e tarefas, mover registros e supervisionar projetos e emendas.
5. Na CEAP, consulta despesas, saldo, relatório e pacote. Não lança nem decide.
6. Não vê telas de administração (equipe, parâmetros, política de publicação).

## F02. Atendimento: do telefonema ao protocolo

Exemplo: Maria liga pedindo a poda de uma árvore.

1. A assessora abre Demandas, escolhe nova demanda e busca a pessoa pelo telefone. Se Maria não existe, cadastra na mesma tela.
2. Pergunta se Maria quer receber avisos por e-mail; se sim, registra o e-mail e o consentimento, lendo o texto padrão.
3. Preenche o título ("Poda de árvore na Rua das Flores"). Prioridade e prazo são opcionais. Sem responsável indicado, ela é a responsável.
4. Ao salvar, o sistema devolve o protocolo, algo como `K7M2-9PQ4-XA3N` (ilustrativo), e o link do acompanhamento.

## F03. Condução da demanda

1. O responsável move a demanda de etapa; o status é o papel da etapa de destino.
2. A equipe conversa nos comentários internos (e menciona colegas com @, o que gera aviso).
3. Anexa documentos e, se for o caso, cria uma tarefa vinculada ("Ligar para a prefeitura até sexta"), designada a um colega.
4. Quando há novidade para o cidadão, alguém redige um andamento. Ele não é cópia de comentário. Se o cidadão consentiu, recebe e-mail.
5. Ao chegar em etapa de Conclusão, o status deixa de ser em andamento. Se não houver como resolver, um supervisor cancela com justificativa.

## F04. O cidadão acompanha

- **Por link:** abre sem login; vê protocolo, situação em vocabulário de cidadão, linha do tempo só com as etapas visíveis, andamentos escritos para ele e a identificação do gabinete. Link inválido, revogado ou expirado mostra sempre a mesma página de não encontrado, com 404.
- **Por protocolo:** informa o protocolo (com ou sem hífens, em qualquer caixa) e o telefone do atendimento. Se não confere, mensagem única; após 5 falhas da mesma origem, aguarda 5 minutos.
- **Por e-mail:** recebe a novidade e acessa o link. Pode se descadastrar com um clique.

## F05. Organizar o dia

1. A assessora marca um compromisso "Visita ao hospital" na agenda, escolhe os participantes e deixa o nível padrão (Participantes): os colegas veem o horário ocupado, mas não o conteúdo.
2. Para uma reunião política sensível, um supervisor cria o compromisso **Restrito**: só participantes, Chefe e Administrador o veem.
3. Os indicados recebem aviso e respondem; recusar não cancela nada.
4. O worker, de hora em hora, avisa quem tem tarefa ou prazo vencendo e quem já passou do prazo.

## F06. Evento e presença em campo

1. Alguém cadastra o evento "Audiência no bairro".
2. No dia, pelo celular, o assessor registra a presença pelo telefone de cada pessoa; quem não está cadastrada é criada na hora, informando o nome.
3. Um erro de digitação pode ser corrigido por quem registrou em até 30 minutos; depois, por Assessor Interno ou superior.
4. Um supervisor encerra o evento; depois disso não se registra presença.

## F07. Emenda: da destinação à execução

Exemplo: emenda individual de R$ 250.000,00 (valor ilustrativo).

1. O gabinete cadastra beneficiários (por CNPJ) e a emenda, que nasce na etapa Disponível.
2. Destina R$ 75.000,00 a um beneficiário: o comprometido sobe, o disponível cai para R$ 175.000,00. Tentar destinar mais que o disponível é recusado.
3. Registra a execução conforme o dinheiro sai (R$ 60.000,00, por exemplo, não superior ao destinado e sem data futura). Destinação com execução não se cancela.
4. O painel mostra o consolidado; o Administrador pode reconstituir a composição dos valores em uma data passada.

## F08. CEAP: despesa

1. Um assessor lança a despesa (categoria, valor, data do documento, fornecedor) e anexa o comprovante. Sem comprovante, ela não segue para análise.
2. Ela entra em análise e já reduz o saldo.
3. Um supervisor que **não** foi quem lançou aprova ou reprova (reprovar exige motivo). A decisão é terminal.
4. Se quem lançou é o Chefe ou o Administrador, pode decidir a própria despesa; o sistema marca "decisão pelo próprio lançador", e o relatório a lista.
5. Se o saldo cair abaixo do limite, gera-se aviso.
6. Ao fim do período, o Chefe baixa o pacote de documentos e o relatório de prestação de contas.

## F09. Projeto de lei

Cadastra-se título, ementa, autoria e número; o projeto percorre as etapas do fluxo; registram-se comissões e votações; o painel e o quadro mostram os atrasados.

## F10. Exportar e administrar

- Um supervisor com a habilitação do módulo exporta a relação em arquivo. O arquivo traz exatamente o que a tela mostraria a ele, e a exportação fica na trilha.
- Chefe ou Administrador altera perfil e habilitações; as sessões do usuário caem no ato.
- O Administrador altera a política de publicação ou um parâmetro da CEAP; a versão anterior é preservada.
