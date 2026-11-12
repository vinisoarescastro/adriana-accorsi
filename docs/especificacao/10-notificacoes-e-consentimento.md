# 10. Notificações e consentimento (LGPD)

Estado: **minuta para revisão jurídica**. Os textos abaixo são propostos pelo projeto e não substituem a análise de quem responde juridicamente pelo gabinete.

## 10.1 Princípios

1. O canal é só para **andamento da solicitação** do próprio cidadão.
2. **Consentimento explícito**, registrado, desmarcado por padrão, cancelável a qualquer momento.
3. Mínimo de dados no e-mail: nada de título interno, descrição, prioridade ou dado financeiro.
4. Nunca usar o canal para divulgação do mandato ou comunicação política. Em período eleitoral, isso tem implicações legais; o gabinete deve validar com sua assessoria jurídica.
5. O envio nunca bloqueia nem desfaz o ato que o gerou.

## 10.2 O que dispara um e-mail

| Evento | E-mail? |
| --- | --- |
| Andamento publicado | Sim, com o texto publicado |
| Mudança para etapa visível ao cidadão | Sim, com o rótulo público |
| Conclusão (etapa de Conclusão) | Sim |
| Cancelamento pelo gabinete | Sim, com o texto padrão de encerramento |
| Comentário interno, tarefa, mudança de prioridade, mudança de responsável | **Nunca** |
| Qualquer dado financeiro ou legislativo | **Nunca** |

## 10.3 Registro do consentimento

Campos na pessoa:

| Campo | Observação |
| --- | --- |
| E-mail | Opcional; validado |
| Consentimento de notificação | sim ou não; começa **não** |
| Data e hora do consentimento | |
| Origem | Quem registrou, e por qual meio (atendimento telefônico, presencial, formulário) |
| Versão do texto aceito | Referência ao texto vigente na data |
| Data do cancelamento | Quando houver |

Mudanças ficam na trilha. Eliminar os dados pessoais da pessoa encerra o consentimento e apaga o e-mail.

## 10.4 Texto de consentimento (minuta, versão 1)

Para o atendente ler ou exibir ao cidadão:

> Posso avisar o senhor(a) por e-mail quando houver novidade sobre esta solicitação? Usaremos o seu e-mail **somente** para informar o andamento do pedido que o(a) senhor(a) fez ao gabinete da Deputada Adriana Accorsi. Não enviaremos propaganda. O(A) senhor(a) pode deixar de receber a qualquer momento, pelo link que vai em cada mensagem ou avisando o gabinete.

Registrar, junto do "sim", a versão 1 do texto e quem o apresentou.

## 10.5 Modelo do e-mail de andamento (minuta)

**Remetente:** Gabinete da Deputada Adriana Accorsi <nome do remetente a definir no domínio>

**Assunto:** Novidade sobre a sua solicitação (protocolo {PROTOCOLO})

**Corpo:**

> Olá, {primeiro nome}.
>
> Há uma novidade sobre a sua solicitação, protocolo **{PROTOCOLO}**:
>
> **Situação:** {rótulo público da etapa}
>
> {texto do andamento publicado, quando houver}
>
> Para acompanhar, acesse: {link de acompanhamento}
>
> Em caso de dúvida, fale com o gabinete: {contato do gabinete}
>
> Você recebe esta mensagem porque autorizou o aviso por e-mail sobre esta solicitação. Para deixar de receber, acesse: {link de descadastro}
>
> Gabinete da Deputada Adriana Accorsi

Regras do modelo:
- Vocabulário de cidadão: "solicitação", não "demanda"; "situação" e "andamento", não "etapa" e "fluxo".
- Nunca incluir o título da demanda, salvo se a política de publicação o exibir e o gabinete decidir incluí-lo (padrão: não).
- Nunca incluir prazos nem previsões (previsão não é compromisso).
- Versões em texto simples e em HTML.

## 10.6 Descadastro

- Link único por mensagem, sem exigir login. Um clique cancela e mostra confirmação.
- A equipe também pode registrar o cancelamento a pedido do cidadão (por telefone, por exemplo).
- O cancelamento vale imediatamente para todos os envios ainda não feitos.

## 10.7 Entregabilidade e operação

- Domínio remetente com SPF, DKIM e DMARC configurados antes do primeiro envio real.
- Volume baixo no início, para construir reputação.
- Limite de envio por hora.
- Repetição com recuo para falhas temporárias; falhas permanentes (e-mail inexistente) marcam o e-mail como inválido na pessoa e geram alerta à equipe.
- Fila visível ao Supervisor (enviado, falhou, cancelado).

## 10.8 Pontos em aberto

1. Revisão jurídica do texto de consentimento e do modelo de e-mail.
2. Nome e endereço do remetente, e contato do gabinete a constar no e-mail.
3. Quando e como o cidadão informa o e-mail (no atendimento? na página pública?). Proposta: só pela equipe, na fase 3; formulário público fica para depois, por exigir confirmação do e-mail.
4. Prazo de retenção do histórico de envios.
