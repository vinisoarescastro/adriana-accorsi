# 0009. Área pública, projeção em visões e envio de e-mail

- Estado: aceita
- Data: 2026-11-13

## Contexto

A fase 3 abre o sistema ao cidadão: ele acompanha a própria solicitação sem criar conta, e é avisado por e-mail. Os riscos são vazar dado interno, expor o cidadão a quem tem um link e depender de um provedor de e-mail que pode falhar. O Mandatus filtrava o registro interno na hora de exibir; aqui a regra é o contrário: **nada é público por padrão**.

## Decisão

**Projeção pública em visões do banco**

- O app público lê só três visões (`vw_acompanhamento_publico`, `..._etapas`, `..._andamentos`) e escreve só por duas funções nominais (`registrar_acesso_publico`, `descadastrar_por_token`) e uma de consulta (`consultar_protocolo`). O papel `app_publico` não tem **nenhum** direito nas tabelas internas; um teste tenta ler cada uma e espera "permission denied".
- As visões valem com os direitos do dono do esquema (não `security_invoker`, que exigiria dar acesso às tabelas ao papel público). Os campos publicáveis estão listados em um teste: se uma coluna entra na visão sem querer, ele quebra.
- A política de publicação (título, nome, telefone, validade do link) é aplicada **dentro da visão**: o app nunca recebe o dado que a política oculta.
- A leitura da projeção (`@gabinete/banco/publico`) é um arquivo único, usado pelo app público e pela **pré-visualização da equipe**: a prévia mostra exatamente o que o cidadão verá. O app público importa só esse arquivo, nunca o pacote do banco inteiro.

**Link e consulta**

- O link de acompanhamento leva o segredo no caminho (`/a/<segredo>`). Qualquer falha (inexistente, revogado, suspenso, expirado, formato errado) responde com o mesmo 404 e o mesmo corpo.
- A consulta por protocolo exige o telefone do atendimento, por POST. O limite (5 falhas, 5 minutos, atraso crescente) vive na memória do processo, com um hash da origem e um sal que nasce com o processo: nenhum endereço de visitante vai para o disco, o banco ou o log.
- A expiração é **derivada**: vale `desfecho + dias da política vigente`, calculada na visão. Não há coluna que guarde o prazo, e mudar a política muda o efeito sobre todos os links.
- O descadastro tem uma página com botão (o GET só mostra; o POST desliga), porque programas de e-mail abrem links para gerar prévia.

**E-mail por outbox**

- O ato (publicar andamento, mover para etapa visível, concluir, cancelar) grava a linha em `envio_notificacao` **na mesma transação**; só enfileira se a pessoa está ativa, tem e-mail válido, tem consentimento vigente e o link está ativo.
- O worker reconfere tudo no último instante (o consentimento pode ter sido cancelado depois do ato), envia pelo canal (`CanalDeNotificacao`: Resend em produção, SMTP no desenvolvimento), repete com recuo exponencial e registra o resultado. Falha permanente marca o e-mail como inválido; falha temporária não desfaz nada.
- O worker lê pela visão `vw_envio_para_enviar` e só atualiza `envio_notificacao`. Reivindica lotes com `FOR UPDATE SKIP LOCKED`, então dois workers não enviam o mesmo e-mail.
- **Desvio do ADR 0004:** a fase 3 não usa o pg-boss. Uma consulta periódica sobre a tabela basta para o volume de um gabinete e evita uma dependência a mais. O pg-boss entra se a fase 4 (avisos de prazo agendados) justificar.

**Consentimento**

- Histórico que só acrescenta (`consentimento_notificacao`); o vigente é o mais recente, e "sim" exige a versão do texto lido ao cidadão e quem o registrou. A trilha guarda só o valor, a origem e a versão: nunca e-mail nem nome.

## Consequências

- Alterar o que é público é alterar uma migração e o teste de colunas, de propósito.
- O app público e o worker não compartilham arquivo de ambiente com a API em produção: cada um recebe só o que precisa (o público nunca vê o segredo da aplicação nem o armazenamento). Em desenvolvimento há um único `.env`, então a recusa de variáveis alheias só vale em produção.
- Perder `SESSAO_SEGREDO` impede o worker de montar o link do e-mail (a cópia cifrada do segredo fica ilegível), como já ocorria para a equipe.
- O limite de tentativas na memória zera quando o processo reinicia: aceitável com instância única; com mais de uma, passa a ser um limite por instância.
