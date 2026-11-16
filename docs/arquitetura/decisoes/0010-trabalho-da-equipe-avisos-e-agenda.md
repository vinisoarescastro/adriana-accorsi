# 0010. Trabalho da equipe: avisos, worker de prazos e visibilidade da agenda

- Estado: aceita
- Data: 2026-11-16

## Contexto

A fase 4 dá à equipe tarefas, agenda, eventos com presença e uma caixa de avisos. Os riscos são: aviso que vaza dado ou mostra um registro que o destinatário não alcança; compromisso Restrito que aparece, nem que seja como "horário ocupado"; um worker com poder demais; e uma automação que decide em vez de só avisar.

## Decisão

**Avisos**

- O aviso é uma linha sem texto, sem dado pessoal e sem valor: só `destinatario_id`, `natureza`, `registro_tipo`, `registro_id`, as datas e uma chave única. A frase sai da natureza (`frasesDeAviso`, em `@gabinete/compartilhado`) e o título é lido do registro **no momento da leitura**, para quem o alcança. Quem não alcança o registro não vê o aviso, mesmo que ele exista (RN-AVI-03).
- Aponta para o registro por `registro_tipo` e `registro_id`, sem a tabela `vinculo` (mesma razão da movimentação e do comentário: evitar referência circular).
- Nasce **na transação do ato** (`criarAvisos`), e nunca avisa quem praticou o ato. Só a leitura (`lido_em`) e a expiração (`expira_em`) mudam depois; um gatilho recusa o resto.
- Não lido expira em 60 dias; lido, 30 dias depois da leitura (nunca alonga a vida do aviso). O expurgo é o do worker.
- **Décima natureza, `mencao`.** O modelo falava de nove naturezas, mas a regra RN-COM-03 pede aviso à menção em comentário, e nenhuma das nove serve. Ficam dez.

**Worker de prazos**

- Roda no mesmo processo do worker de e-mail, de hora em hora. O papel `app_worker` só consegue: ler a visão `vw_prazo_aberto` (prazo, responsável, tipo e id: sem título), **inserir** em `aviso`, e chamar `antecedencia_do_aviso_de_prazo()` e `expurgar_avisos(agora)`. Qualquer outra leitura ou escrita é recusada, e o teste tenta.
- O aviso de prazo leva uma chave única `natureza:tipo:id:AAAA-MM-DD` (a data é a do gabinete): o mesmo prazo não avisa duas vezes no mesmo dia, ainda que o worker reinicie. Sem `RETURNING`: o papel não lê `aviso`, então a contagem do que nasceu vem do número de linhas inseridas.
- Um item que falha não impede os outros. Uma passagem que falha é registrada, **não derruba o processo** e é repetida em 5 minutos.
- A antecedência (padrão 3 dias corridos, de 1 a 30) é o parâmetro `antecedencia_aviso_prazo`, alterado por Chefe ou Administrador, com trilha.

**Visibilidade da agenda**

- Uma única função decide (`nivelDeVisao`): `completo`, `ocupado` ou `oculto`. A agenda, os próximos, a leitura de um compromisso, o conflito e o alcance do aviso usam a mesma.
- **Restrito alheio nem aparece como ocupado**; "Participantes" aparece como ocupado, sem título, local nem participantes (o item não tem sequer um id). Quem vê o conteúdo: participante, criador, Chefe, Administrador e Parlamentar (RN-AGE-03).
- Conflito de horário é **só aviso**: o compromisso é salvo. Compromisso que o ator não pode ver nunca vira "conflito" para ele.
- A marca "envolve a Parlamentar" vem ligada e **nunca gera aviso**; só a indicação explícita a avisa (RN-AGE-08).

**Eventos e presença**

- Encerrar é decisão de um Supervisor: nenhuma rotina encerra por data. A presença não se altera em evento encerrado, e isso vale também no banco (gatilho).
- A presença é por telefone; se a pessoa não existe, a API responde 409 com o detalhe `nome`, e o cadastro nasce no ato quando o nome vem. Quem registrou corrige em até 30 minutos (relógio da aplicação); depois, Assessor Interno em diante. Remover apaga a linha e deixa o motivo na trilha. A trilha guarda só ids.

## Consequências

- Os módulos que vêm (despesa aguardando análise, saldo abaixo do limite) só acrescentam naturezas e tipos de registro por migração, e o alcance de cada um em `ServicoDeAvisos.registrosAlcancaveis`. Registro de tipo sem regra de alcance **não aparece** (falha fechada).
- O pg-boss segue sem necessidade: de hora em hora, com idempotência pela chave, basta. Fica avaliado e descartado para o volume de um gabinete.
