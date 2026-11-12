# Domínio, DNS e e-mail

Estado: **a configurar** (depende de PV-E: acesso ao DNS de `nucleodedados.com` e à VPS, e do nome real do subdomínio). O domínio é **provisório**, para apresentar à Deputada.

## Endereços

| Uso | Endereço | Quando |
| --- | --- | --- |
| Aplicação da equipe | `dominio.nucleodedados.com` (o nome real do subdomínio é pendência) | Fase 1 |
| Página do cidadão | `acompanhe.dominio.nucleodedados.com` | Fase 3 |

As duas ficam em **origens separadas**, para que o cookie e a política de segurança não se misturem.

## Registros a criar

| Tipo | Nome | Valor | Para quê |
| --- | --- | --- | --- |
| `A` | `dominio` | IP da VPS | Aplicação |
| `A` | `acompanhe.dominio` | IP da VPS | Página do cidadão (fase 3) |
| `AAAA` | os mesmos | IPv6 da VPS, se houver | Opcional |

O certificado HTTPS é obtido e renovado **sozinho** pelo Caddy (Let's Encrypt), desde que as portas 80 e 443 estejam abertas e o DNS já aponte para a VPS. Não há curinga.

## E-mail ao cidadão (fase 3)

O e-mail de andamento sairá de um domínio remetente. Antes do primeiro envio real, configurar:

| Registro | O que faz |
| --- | --- |
| **SPF** | Diz quais servidores podem enviar em nome do domínio (o do provedor de e-mail escolhido) |
| **DKIM** | Assina as mensagens; o provedor fornece a chave a publicar |
| **DMARC** | Diz o que fazer com mensagem que falha SPF e DKIM, e para onde mandar relatórios |

Os valores exatos vêm do provedor (Resend, SES ou Brevo). Comece com DMARC em `p=none` (só observa), confira os relatórios, e endureça depois. Verifique a entregabilidade com uma caixa de teste antes de usar com cidadãos.

## Trocar de domínio depois

Ver `implantacao.md`. É só configuração, mas links já enviados ao cidadão com o domínio antigo deixam de funcionar: troque antes de usar com cidadãos reais.
