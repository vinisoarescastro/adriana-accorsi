# 09. Fluxos de trabalho (conjuntos federais)

Estado: **proposta para validação (PV-A)**. Fonte: modelos padrão do Mandatus (documento `20-modelos-padrao`), conjunto federal. Os próprios autores do Mandatus recomendam percorrer cada fluxo, linha por linha, com quem opera aquela casa legislativa. Leia como sugestão a conferir.

Tudo aqui é ponto de partida: o gabinete ajusta depois. As regras estruturais valem sempre: uma Entrada, uma Arquivamento e ao menos uma Conclusão por tipo, e nenhuma regra depende da posição da etapa.

Papéis: **Entrada** (onde o registro nasce), **Intermediária**, **Conclusão** (desfecho com resultado), **Arquivamento** (encerramento administrativo).

## 9.1 Demanda

O único fluxo com rótulo público e visibilidade ao cidadão.

| Ordem | Nome interno | Papel | Rótulo público | Visível | Prazo padrão |
| --- | --- | --- | --- | --- | --- |
| 1 | Recebida | Entrada | Recebida | sim | |
| 2 | Em triagem | Intermediária | Em análise | sim | 2 dias |
| 3 | Em andamento | Intermediária | Em andamento | sim | 15 dias |
| 4 | Aguardando terceiros | Intermediária | Em andamento | sim | 30 dias |
| 5 | Concluída | Conclusão | Concluída | sim | |
| 6 | Sem solução | Conclusão | Concluída | sim | |
| 7 | Arquivada | Arquivamento | Encerrada | sim | |

Notas:
- "Em andamento" e "Aguardando terceiros" compartilham o rótulo público: internamente a diferença importa, para o cidadão ambas significam "está andando".
- "Sem solução" é Conclusão, não arquivamento: houve trabalho e houve resposta.

## 9.2 Tarefa

| Ordem | Nome interno | Papel | Prazo padrão |
| --- | --- | --- | --- |
| 1 | A fazer | Entrada | |
| 2 | Em andamento | Intermediária | |
| 3 | Concluída | Conclusão | |
| 4 | Encerrada | Arquivamento | |

Deliberadamente curto. Tarefa com fluxo longo vira projeto.

## 9.3 Projeto de lei (Câmara dos Deputados)

| Ordem | Nome interno | Papel | Prazo padrão |
| --- | --- | --- | --- |
| 1 | Em redação | Entrada | |
| 2 | Protocolado | Intermediária | |
| 3 | Na comissão de constituição e justiça | Intermediária | |
| 4 | Nas comissões de mérito | Intermediária | |
| 5 | Pronto para pauta | Intermediária | |
| 6 | Em votação | Intermediária | |
| 7 | Na casa revisora | Intermediária | |
| 8 | Aprovado, aguardando sanção | Intermediária | |
| 9 | Sancionado | Conclusão | |
| 10 | Vetado | Conclusão | |
| 11 | Rejeitado | Conclusão | |
| 12 | Arquivado | Arquivamento | |

Notas:
- "Vetado" é Conclusão: o veto encerra a tramitação e é resultado com valor político. Arquivar é o que acontece ao fim da legislatura ou quando o gabinete desiste.
- "Na casa revisora" existe só no fluxo federal (bicameral).

**Pontos a conferir com a Câmara (PV-A):** o fluxo real de uma proposição na Câmara tem mais variantes (regime de tramitação, comissões especiais, urgência, plenário e Senado como casa revisora, retorno à origem). O conjunto acima é o arranjo mais comum; o gabinete deve dizer o que realmente acompanha. Uma opção é complementar o acompanhamento com os dados abertos da Câmara (avaliar na fase 5).

## 9.4 Emenda parlamentar (federal)

Aplica-se à emenda e a cada destinação.

| Ordem | Nome interno | Papel | Prazo padrão |
| --- | --- | --- | --- |
| 1 | Disponível | Entrada | |
| 2 | Indicada | Intermediária | |
| 3 | Em análise pelo órgão | Intermediária | 60 dias |
| 4 | Empenhada | Intermediária | |
| 5 | Liquidada | Intermediária | |
| 6 | Paga | Intermediária | |
| 7 | Executada | Conclusão | |
| 8 | Não executada | Conclusão | |
| 9 | Encerrada | Arquivamento | |

Notas:
- O conjunto federal separa empenho, liquidação e pagamento, como a execução orçamentária federal é acompanhada.
- "Não executada" é Conclusão: uma emenda que perdeu o exercício sem execução é um fato do mandato e precisa aparecer como tal.

**Tipos de emenda (proposta, a conferir):** Emenda individual · Emenda de bancada estadual · Emenda de comissão · Transferência especial · Transferência com finalidade definida. O próprio Mandatus alerta que a nomenclatura federal mudou nos últimos anos (emendas de relator, modalidades de transferência). A lista é editável.

## 9.5 Despesa da CEAP

Ver `08-ceap.md`, item 8.8. Decidido o fluxo **com** acompanhamento do ressarcimento (etapas pós-aprovação).

## 9.6 Vocabulários

**Assuntos de projeto de lei:** Saúde · Educação · Assistência social · Segurança pública · Mobilidade e transporte · Infraestrutura e obras · Meio ambiente · Habitação · Cultura · Esporte e lazer · Desenvolvimento econômico · Trabalho e renda · Agricultura · Tributação · Administração pública · Transparência e controle · Direitos humanos · Criança e adolescente · Pessoa idosa · Pessoa com deficiência · Mulher · Animais · Homenagens e datas comemorativas.

**Tipos de proposição:** Projeto de lei ordinária · Projeto de lei complementar · Projeto de resolução · Projeto de decreto legislativo · Indicação · Requerimento · Moção. Para a Câmara, conferir a nomenclatura (por exemplo, requerimentos de informação e emendas a proposição são tipos próprios).

**Naturezas de documento:** Comprovante · Nota fiscal · Minuta · Justificativa · Parecer · Ofício · Plano de trabalho · Foto · Lista assinada · Outro.

## 9.7 Parâmetros operacionais padrão

| Parâmetro | Padrão |
| --- | --- |
| Limite de "parado": demanda | 14 dias |
| Limite de "parado": projeto de lei | 60 dias |
| Limite de "parado": emenda | 60 dias |
| Limite de "parado": despesa | 7 dias |
| Limite de "parado": tarefa | 7 dias |
| Antecedência do aviso de prazo | 3 dias corridos, configurável (o Mandatus especifica 2 dias úteis e implementa 3 corridos; aqui fica configurável) |
| Expiração de aviso lido / não lido | 30 / 60 dias |
| Duração presumida em conflito de agenda | 1 hora |
| Janela para remover o próprio comentário | 15 minutos |
| Prioridade padrão de demanda | Média |
| Comprovante obrigatório em despesa | Sim |
| Período de referência dos painéis | Mês corrente |
| Expiração do link após desfecho | 90 dias |

## 9.8 Validação (PV-A)

Antes da fase 5, percorrer com alguém do gabinete que opere a Câmara: o fluxo de projeto de lei, o fluxo de emenda, os tipos de emenda e de proposição, e os limites de "parado". O custo de errar aqui é uma correção de cadastro enquanto não houver registros usando a etapa. Com registros, a etapa não pode ser desativada.
