# @gabinete/worker

Envia os e-mails da fila (outbox) ao cidadão. **Nenhuma automação decide**: o worker só entrega o que o ato do usuário gravou, depois de reconferir que o cidadão ainda consente e que o link ainda vale.

## Como funciona

1. O ato (publicar andamento, mover para etapa visível, concluir, cancelar) grava uma linha em `envio_notificacao`, na mesma transação.
2. A cada poucos segundos o worker reivindica um lote (`FOR UPDATE SKIP LOCKED`), reconfere e envia.
3. Sucesso: `enviado`. Falha temporária: volta para a fila com recuo exponencial (1, 2, 4... até 60 minutos), até 5 tentativas. Falha permanente (o provedor recusou o endereço): `falhou`, e o e-mail da pessoa fica marcado como inválido. Consentimento cancelado, link suspenso ou revogado: `cancelado`.
4. Limite de envio por hora (`LIMITE_EMAILS_POR_HORA`, padrão 30) para proteger a reputação do domínio.
5. Um envio que ficou "enviando" por mais de 10 minutos (o processo caiu) volta para a fila.

## Organização

| Arquivo              | O que tem                                                               |
| -------------------- | ----------------------------------------------------------------------- |
| `src/processador.ts` | O ciclo: reivindicar, reconferir, enviar, registrar o resultado         |
| `src/canal.ts`       | `CanalDeNotificacao`: Resend (HTTP) e SMTP (Mailpit em desenvolvimento) |
| `src/modelos.ts`     | Modelos de e-mail em texto e HTML (minuta para revisão jurídica)        |
| `src/principal.ts`   | Ponto de entrada                                                        |

O worker usa o papel `app_worker`: lê pela visão `vw_envio_para_enviar` e só atualiza `envio_notificacao`.

## Rodar

```
npm run dev -w @gabinete/worker
```

Em desenvolvimento use o Mailpit (`EMAIL_PROVEDOR=smtp`, `SMTP_HOST=127.0.0.1`, `SMTP_PORTA=1025`): ele recebe tudo e não envia nada para fora. Em produção, `EMAIL_PROVEDOR=resend` e `EMAIL_API_KEY`. Ver [ADR 0009](../../docs/arquitetura/decisoes/0009-area-publica-e-envio-de-email.md) e [dominio-e-dns.md](../../docs/operacao/dominio-e-dns.md) (SPF, DKIM e DMARC).
