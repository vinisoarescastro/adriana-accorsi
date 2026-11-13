# Conferência da fase 3: Cidadão

Roteiro de conferência manual. Os testes automatizados garantem as regras; este roteiro garante que **alguém olhou** as telas (a da equipe e a do cidadão), inclusive no celular, e **leu os e-mails**.

- **Quem executa:** a pessoa que vai apresentar o sistema (e, se possível, alguém do gabinete). Esta fase é o **marco de apresentação à Deputada**: vale conferir com calma o texto da página pública e dos e-mails.
- **Onde:** local (Mailpit recebe os e-mails sem enviar nada para fora) e, no fim, na VPS com o provedor real.
- **Estado:** **pendente**. Os itens "sim" já passam nos testes; falta alguém olhar.

## Antes de começar

1. `npm run ambiente:subir` (inclui o Mailpit em `http://127.0.0.1:8025`) e `npm run banco:preparar`.
2. No `.env`: `EMAIL_PROVEDOR=smtp`, `SMTP_HOST=127.0.0.1`, `SMTP_PORTA=1025`, `EMAIL_REMETENTE=avisos@exemplo.test`, `ARMAZENAMENTO_LOCAL=1` (se o S3 local não responder).
3. Em três terminais: `npm run dev -w @gabinete/api`, `npm run dev -w @gabinete/publico` e `npm run dev -w @gabinete/worker`; e `npm run dev -w @gabinete/web` para a tela da equipe.
4. Usuários: um Administrador, um Supervisor e um Assessor Interno (`npm run banco:semear`).
5. A página do cidadão abre em `http://127.0.0.1:3100`. O endereço que a equipe copia usa `HOSTNAME_PUBLICO`; para testar localmente troque o domínio pelo `127.0.0.1:3100` e `https` por `http`.

## Roteiro: a equipe

| # | O que fazer | Resultado esperado | Automatizado | Manual (data e quem) |
| --- | --- | --- | --- | --- |
| 1 | Como Interno, registrar uma demanda para uma pessoa nova, informando o **e-mail** | Aparece o texto de consentimento, com a caixa **desmarcada** | sim | |
| 2 | Registrar sem marcar a caixa; abrir a ficha | "Avisos desativados" | sim | |
| 3 | Na ficha, em "Acompanhamento do cidadão", ler o estado do link e abrir "O que o cidadão vê agora" | Link ativo; a prévia mostra só protocolo, situação, nome (primeiro nome) e novidades | sim | |
| 4 | Marcar "Li o texto ao cidadão…" e registrar o consentimento | "Avisos ativados", com data e origem; o histórico aparece | sim | |
| 5 | Publicar uma novidade para o cidadão | Aparece na lista e na prévia; **chega um e-mail no Mailpit** em poucos segundos | sim | |
| 6 | Ler o e-mail (texto e HTML) | Tem protocolo, a novidade e os links de acompanhamento e de descadastro; **não tem título, descrição nem prioridade**; vocabulário de cidadão | sim | |
| 7 | Como Supervisor, remover a novidade | Some da prévia; a ficha mostra "removido por…", e o texto continua na Auditoria | sim | |
| 8 | Como Supervisor, suspender o link e abrir o endereço na área pública | A página do cidadão responde "Não encontramos esta solicitação"; retomar reabre | sim | |
| 9 | Revogar o link | O botão some; a explicação diz que o protocolo e o telefone ainda funcionam; "Gerar novo link" reabre com outro endereço | sim | |
| 10 | Cancelar a demanda | A ficha fica só de leitura, sem formulário de novidade; **o link ainda pode ser gerido**; chega um e-mail de encerramento (sem o motivo) | sim | |
| 11 | Em Configurações como Administrador, mudar a política (nome completo, título visível, 30 dias) | Salva uma versão nova; a anterior aparece em "Versões anteriores"; a página do cidadão passa a mostrar o novo | sim | |
| 12 | Tentar 3 dias de validade | O botão fica desabilitado, com a mensagem do intervalo | sim | |
| 13 | Como Supervisor, abrir E-mails | Resumo por situação, e a lista com protocolo, motivo, situação, tentativas e observação; **sem o endereço de e-mail** | sim | |
| 14 | Como Interno, tentar abrir `/g/emails` | "Página não encontrada" | sim | |
| 15 | Em Pessoas, olhar a coluna "Avisos por e-mail" | Diz em texto: Ativados, Desativados, Sem e-mail ou E-mail recusado | sim | |

## Roteiro: o cidadão

| # | O que fazer | Resultado esperado | Automatizado | Manual (data e quem) |
| --- | --- | --- | --- | --- |
| 16 | Abrir o link do e-mail | Página simples: protocolo, situação em texto, andamento por etapas, novidades, contato do gabinete e o aviso de que quem tem o endereço acompanha | sim | |
| 17 | Procurar na página: título, descrição, prioridade, nome do responsável, comentários | **Nada disso aparece** (veja também o código-fonte da página) | sim | |
| 18 | Abrir um endereço inventado, um revogado e um expirado | O **mesmo** "Não encontramos esta solicitação", nos três | sim | |
| 19 | Na página inicial, consultar por protocolo e telefone (com e sem hífens, com máscara) | Mostra a mesma página, sem aviso de endereço | sim | |
| 20 | Errar o telefone 5 vezes | Na 6ª tentativa, "Muitas tentativas"; passados 5 minutos, volta | sim | |
| 21 | No e-mail, clicar em "Deixar de receber" | Abre a página com um botão; **ainda não** cancelou; ao clicar, "Pronto" | sim | |
| 22 | Publicar outra novidade na mesma demanda | **Não** chega e-mail; a ficha mostra "Avisos desativados" com origem "Descadastro pelo próprio cidadão" | sim | |
| 23 | Ver a página no celular (360 px) e com o leitor de tela ou o teclado | Texto legível sem rolar para o lado; foco visível; situação e etapas lidas em texto (nunca só cor) | | |
| 24 | Tentar salvar a página, imprimir e abrir em modo escuro | Imprime bem; respeita o modo escuro | | |

## Quando o provedor falha (opcional, local)

Pare o Mailpit e publique uma novidade: o ato **não falha**; na tela E-mails o envio aparece "Na fila" com a tentativa e o erro, e sai quando o Mailpit volta (o recuo é de 1, 2, 4... minutos).

## Na VPS (depois da implantação)

- [ ] SPF, DKIM e DMARC configurados no domínio remetente, e um e-mail de teste não cai no spam.
- [ ] O certificado do `HOSTNAME_PUBLICO` foi emitido.
- [ ] O log do Caddy do domínio público está desligado (o segredo do link vai no caminho).
- [ ] `verificar.sh` confere `publico` e `worker`.

## Defeitos encontrados

_(preencher durante a conferência)_
