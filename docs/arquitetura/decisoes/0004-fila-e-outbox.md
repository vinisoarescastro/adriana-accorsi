# 0004. Fila de tarefas e padrão outbox

- Estado: proposta (a fase 3 seguiu o padrão outbox sem o pg-boss; ver [0009](0009-area-publica-e-envio-de-email.md))
- Data: 2026-11-10

## Contexto

Há três tipos de trabalho fora da requisição: avisos de prazo (de hora em hora), envio de e-mail ao cidadão e geração do pacote de documentos financeiros. O Mandatus usava só um temporizador. Aqui o e-mail exige repetição com recuo, registro de falhas e garantia de que o envio não se perde nem duplica.

## Decisão

- **pg-boss** como fila, usando o PostgreSQL existente.
- **Padrão outbox** para notificações: o ato que gera a notificação grava uma linha em `envio_notificacao` **na mesma transação** do ato; o worker lê as pendentes, envia e atualiza o estado. Falha de envio nunca desfaz o ato.
- **Idempotência:** cada linha de outbox tem identificador próprio, enviado ao provedor; reprocessar não duplica.
- **Repetição** com recuo exponencial para falhas temporárias; falha permanente marca o e-mail da pessoa como inválido e gera alerta.
- **Limite de envio por hora**, para proteger a reputação do domínio.
- O worker usa o papel `app_worker`, que só insere em `aviso` e atualiza `envio_notificacao`.
- Interface `CanalDeNotificacao` com implementação de e-mail; WhatsApp (fase 9) seria outra implementação.
- A geração de avisos de prazo usa tarefa agendada do pg-boss; uma passagem que falha não derruba o processo, e há uma execução por dia por prazo.

## Alternativas consideradas

- **BullMQ com Redis:** mais um serviço a operar para um volume pequeno.
- **Temporizador simples:** sem repetição, sem visibilidade, sem garantia de não duplicar.
- **Enviar o e-mail na própria requisição:** acopla a disponibilidade do provedor ao ato do usuário; descartado.

## Consequências

- Tudo o que importa fica no Postgres e entra no mesmo backup.
- O volume de um gabinete é baixo; se um dia crescer muito, a interface permite trocar a fila.
