# 0012. Legislativo: beneficiários, projetos de lei e a integração com os dados abertos da Câmara

- Estado: aceita
- Data: 2026-11-17

## Contexto

A fase 5 dá ao gabinete o acompanhamento dos projetos de lei da Deputada e o cadastro de beneficiários (municípios, órgãos e entidades), que as emendas da fase 6 vão reutilizar. Os riscos são: criar uma máquina de estados própria para o projeto; gravar o atraso ou o status em coluna, que envelhece sem ninguém escrever; aceitar um CNPJ que a Receita não aceitaria (inclusive o novo formato alfanumérico); e deixar o legislativo aparecer para quem não tem a habilitação LG. A tarefa 5.8 pede ainda decidir se vale integrar os dados abertos da Câmara.

## Decisão

**Projeto de lei**

- Percorre o fluxo federal (`projeto_lei`, migração 0006) pelo **mecanismo único de movimentação**, como a demanda e a tarefa. Não há máquina de estados própria. O banco recusa etapa de outro fluxo.
- **Sem coluna de status nem de atraso.** O status deriva do papel da etapa (ou "cancelado"); o atraso é "prazo vencido e ainda em andamento", calculado na leitura. Um teste adianta o relógio e vê o mesmo registro virar atrasado sem nenhuma escrita.
- **Número opcional até o protocolo**, único entre os projetos não cancelados e sem diferenciar maiúsculas (índice parcial). Cancelar libera o número.
- **Autoria é uma coluna do projeto** (obrigatória, junto de título e ementa, RN-PRO-01). O modelo de dados do plano só previa os coautores.
- **Tipo de proposição e assunto vêm da tabela `categoria`** (vocabulário controlado), com um conjunto inicial. Uma categoria não se apaga: só se inativa, e a inativa deixa de ser oferecida em projetos novos, sem sumir dos projetos antigos.
- **Quem altera** (editar, mover, assuntos, coautores, comissões e votações): o responsável, o Supervisor ou superior (RN-PRO-03). **Reatribuir e cancelar**: Supervisor ou superior. **Reabrir** um projeto encerrado: Supervisor ou superior, como nas tarefas (a especificação não dizia; esta é a leitura conservadora).
- **Cancelar exige justificativa de 10 caracteres**, e o projeto cancelado não se altera mais (gatilho no banco).
- **Responsável**: usuário ativo, de nível Assessor Interno ou superior e com a habilitação LG.
- **Comissões e votações** são registros do projeto. A votação guarda data, resultado e, opcionalmente, o local; **nunca o placar individual** (RN-PRO-05). Comissão e votação podem ser corrigidas e removidas; a trilha guarda o que aconteceu.
- **Sem aviso nem comentário no projeto nesta fase.** O aviso e o worker de prazos cobrem tarefa e demanda; incluir o projeto exige ampliar a visão `vw_prazo_aberto` e os tipos de registro do aviso, e fica para depois.

**Beneficiário**

- Dados de pessoa jurídica: a trilha pode guardar o CNPJ.
- **CNPJ validado em três camadas**: no contrato compartilhado (a tela e a API), no serviço e no banco (`cnpj_valido`, restrição `CHECK`). Aceita o **CNPJ alfanumérico**, que a Receita Federal adota a partir de julho de 2026: 12 posições de dígitos ou letras maiúsculas e 2 dígitos verificadores, com o valor de cada caractere igual ao código ASCII menos 48. O CNPJ numérico é o caso particular. Um CNPJ de 14 caracteres iguais é recusado.
- **Sem dois ativos com o mesmo CNPJ.** Inativar libera o CNPJ; reativar com o CNPJ já ocupado é recusado.
- Endereço completo obrigatório (CEP de 8 números, logradouro, número, bairro, cidade, estado em uma das 27 UFs); só o complemento é opcional.

**Autorização**

- Operações novas: `projetos.consultar`, `projetos.registrar`, `projetos.alterar`, `projetos.supervisionar`, `projetos.vocabularios`, `beneficiarios.consultar`, `beneficiarios.manter` e `beneficiarios.inativar`.
- O legislativo exige LG; **beneficiários aceitam LG ou FI**. Sem a habilitação, a página não aparece e a API responde "não encontrado", até para ler. O Assessor Externo não alcança nada daqui (nível mínimo 2).
- O worker e a área pública não têm acesso algum às tabelas novas (um teste confere).

**Integração com os dados abertos da Câmara (tarefa 5.8): avaliada, não implementada**

O que se confirmou no portal oficial (dadosabertos.camara.leg.br): existe uma API RESTful e há arquivos para baixar, atualizados diariamente, em CSV, XLSX, ODS, JSON e XML. Entre eles: proposições por ano de apresentação (com a **tramitação mais recente**, não o histórico), autores das proposições e votações com as proposições afetadas. O portal não mostra nesta consulta a chave de acesso nem os limites de uso; é preciso conferi-los ao implementar.

Decisão: **valeria a pena, mas fica para uma fase futura**, por estas razões:

1. O gabinete acompanha o projeto pela etapa **interna**, que mistura o que a Câmara faz com o que o gabinete faz (redigir, articular). A tramitação oficial seria um dado a mais ao lado da etapa, **nunca a substituta dela**. Princípio da arquitetura: nenhuma automação decide.
2. Para casar um projeto do gabinete com a proposição da Câmara é preciso a sigla do tipo, o número e o ano, e guardar o identificador da proposição. Os projetos do gabinete só ganham número depois do protocolo.
3. Exige que algum processo fale com a internet. O worker tem hoje um papel de banco mínimo (só insere avisos e envia e-mails); ganharia um segundo papel de saída e uma tabela própria para o que traz.
4. Os termos de uso, os limites de requisições e a estabilidade dos formatos precisam ser conferidos.

Quando for implementar: atualização diária pelos arquivos em lote, só das proposições que o gabinete acompanha, em modo leitura; mostrar na ficha, numa guia "Tramitação oficial", com a data da última atualização; manter a etapa interna como está.

## Alternativas consideradas

- **Guardar o atraso ou o status em coluna.** Descartado: envelhece sozinho e já foi recusado para demanda e tarefa.
- **Digitar o CNPJ só como número.** Descartado: a Receita Federal passa a emitir CNPJ alfanumérico em 2026; um cadastro só numérico recusaria CNPJs válidos.
- **Número do projeto obrigatório.** Descartado: o projeto nasce em redação, antes do protocolo.
- **Placar individual das votações.** Descartado pela regra RN-PRO-05 (volume e ruído sem uso no gabinete).
- **Implementar a integração com a Câmara agora.** Adiado pelas razões acima; o custo e o risco não se justificam antes de o gabinete usar o módulo.

## Consequências

- O consolidado, o quadro e os atrasados são leituras puras: nada precisa ser recalculado nem corrigido.
- Um CNPJ errado é recusado na tela, na API e no banco, inclusive por quem escreve SQL direto.
- Os beneficiários já estão prontos para as emendas (fase 6), que não precisam de outro cadastro.
- Projeto de lei e beneficiário ficam fora da busca de histórico por registro e dos avisos até uma fase seguinte.
