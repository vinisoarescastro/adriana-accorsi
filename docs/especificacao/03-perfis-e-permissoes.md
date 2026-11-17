# 03. Perfis e permissões

Estado: rascunho da fase 0. Derivado do Mandatus, sem o escopo de plataforma.

## 3.1 Modelo

A autoridade de um usuário é a **interseção de dois eixos**: o **nível** do perfil e a **habilitação** (AT Atendimento, AG Agenda, LG Legislativo, FI Financeiro). Um sem o outro não autoriza. Tarefas, documentos, comentários, exportação e avisos não têm habilitação própria: herdam o alcance do registro a que se ligam ou exigem só nível.

## 3.2 Perfis

| Nível | Perfil | Particularidades |
| --- | --- | --- |
| fora da escala | Parlamentar | A Deputada. Perfil à parte, um único usuário ativo. Vê tudo (inclusive Restritos, auditoria e produtividade), opera e acompanha todos os módulos como um Supervisor, tem acesso total à CEAP e não administra o sistema (usuários, política de publicação, eliminação de dados, fluxos). Conta pessoal e intransferível (ver 3.4.1) |
| 5 | Administrador | Tem todas as habilitações, não removíveis. Concede qualquer perfil, altera a política de publicação, elimina dados pessoais, reconstitui valores, altera parâmetros da CEAP |
| 4 | Chefe de Gabinete | Administra equipe e habilitações, vê auditoria e produtividade, baixa o pacote financeiro, vê compromissos Restritos, pode decidir despesa que ele mesmo lançou. Não concede o perfil de Administrador |
| 3 | Supervisor | Supervisiona: reatribui, cancela, remove, revoga link, encerra evento, exporta, cria compromisso Restrito, decide despesa que outro lançou |
| 2 | Assessor Interno | Opera: ficha completa, comentários, documentos, andamentos, tarefas para terceiros, compromissos, projetos, lançamento de despesa |
| 1 | Assessor Externo | Registra e consulta só o que é dele; cria tarefa só para si; registra presença |

## 3.3 Decisor de autorização

Único lugar da decisão. A primeira falha encerra.

1. A operação é pública? Vai direto ao passo 6.
2. Há sessão válida?
3. O sistema está operacional (não em manutenção declarada)?
4. O nível do perfil alcança a operação?
5. O usuário tem a habilitação exigida?
6. O registro existe, e o usuário alcança o registro-pai?

Regras:
- A autoridade efetiva é a interseção de nível e habilitação. Cada operação declara o nível mínimo e pode declarar perfis adicionais ou excluídos (usado pelo Parlamentar, ver 3.4.1).
- O alcance herdado vem de um ponto único (composição de alcance): só o Assessor Externo é limitado ao que é seu.
- A barra de navegação usa o mesmo decisor: página sem a habilitação não aparece.
- Registro fora do alcance responde como inexistente. Recusa e inexistência são indistinguíveis.

## 3.4 Matriz das operações

Nível mínimo. "Qualquer" significa que o perfil mais baixo alcança, e o recorte por alcance faz o resto.

| Operação | Nível mínimo | Habilitação |
| --- | --- | --- |
| Painel (abrir), equipe (ver), fluxos (consultar), avisos próprios | Assessor Externo | não exige |
| Painel: bloco de atendimento | Assessor Externo | AT |
| Painel: bloco de tarefas | Assessor Externo | não exige |
| Painel: composição e produtividade da equipe | Chefe | não exige |
| Atender demanda e pessoa; registrar e consultar | Assessor Externo | AT |
| Ficha da demanda; manter pessoa; comentar; anexar documento | Assessor Interno | AT (comentar e anexar herdam do registro) |
| Editar e mover demanda | Supervisor, ou o responsável | AT |
| Reatribuir, cancelar; inativar pessoa; remover comentário de terceiro, documento, andamento | Supervisor | AT ou herdada |
| Link, prévia, política (consultar); publicar andamento | Assessor Interno | AT |
| Revogar, regenerar, suspender link | Supervisor | AT |
| Alterar política de publicação; eliminar dados pessoais | Administrador | AT |
| Registrar consentimento de notificação | Assessor Interno | AT |
| Fila de e-mails (ver) | Supervisor | AT |
| Tarefas: trabalhar com a própria | Assessor Externo | não exige |
| Tarefas: designar a outra pessoa | Assessor Interno | não exige |
| Tarefas: supervisionar | Supervisor | não exige |
| Agenda: consultar | Assessor Externo | AG |
| Agenda: marcar compromisso | Assessor Interno | AG |
| Agenda: compromisso Restrito (criar) | Supervisor | AG |
| Eventos: acompanhar; registrar presença | Assessor Externo | AT |
| Eventos: organizar; lista nominal; corrigir presença | Assessor Interno | AT |
| Eventos: encerrar; remover presença | Supervisor | AT |
| Projetos de lei: acompanhar | Assessor Interno | LG |
| Projetos de lei: supervisionar | Supervisor | LG |
| Projetos de lei: vocabulários (tipos de proposição e assuntos) | Supervisor | LG |
| Beneficiários: consultar e manter | Assessor Interno | LG ou FI |
| Beneficiários: inativar | Supervisor | LG ou FI |
| Emendas: acompanhar | Assessor Interno | LG |
| Emendas: ver valores | Assessor Interno | LG ou FI |
| Emendas: supervisionar | Supervisor | LG |
| Emendas: reconstituir composição | Administrador | LG |
| CEAP: lançar despesa | Assessor Interno | FI |
| CEAP: supervisionar e decidir despesa | Supervisor (regra de segregação) | FI |
| CEAP: decidir despesa que o próprio lançou | Chefe | FI |
| CEAP: parâmetros (alterar) | Administrador (e o Parlamentar) | FI |
| CEAP: reconstituir saldo | Administrador (e o Parlamentar) | FI |
| Pacote de documentos financeiros | Chefe | não exige |
| Exportar relação | Supervisor | a do módulo exportado |
| Auditoria do gabinete | Chefe | não exige |
| Histórico de um registro | Assessor Interno | não exige |
| Equipe: administrar | Chefe | não exige |
| Fluxos: ajustar; estruturar | Supervisor; Administrador | não exige |
| Identidade do gabinete: consultar; editar foto | Assessor Externo; Chefe | não exige |

## 3.4.1 Parlamentar

Perfil da Deputada. Ele não ocupa um degrau da escala de 1 a 5. Cada operação declara um nível mínimo e pode listar perfis adicionais ou excluídos; o Parlamentar se expressa assim, sem distorcer a hierarquia da equipe.

**Regra geral:** nas operações de Atendimento, Agenda, Legislativo, tarefas, eventos e presença, o Parlamentar é tratado como **nível 3 (Supervisor)**. Ele pode operar e acompanhar, e tem todas as habilitações.

**Consultas que normalmente exigem Chefe ou Administrador, e que ele tem:**

| Consulta | Observação |
| --- | --- |
| Compromissos Restritos de outros | Ver, sem ser participante |
| Auditoria do gabinete e histórico de qualquer registro | Somente leitura |
| Produtividade e composição da equipe (painel) | |
| Reconstituição de valores e saldos por data (emendas e CEAP) | Leitura de composição histórica |
| Pacote de documentos financeiros e relatório de prestação de contas | Baixar |
| Equipe e fluxos | Consultar |
| Exportações | De todos os módulos, com o mesmo filtro da tela |

**CEAP: acesso total.** Consulta, lança, edita, anexa e remove comprovante, decide despesa (inclusive a que ela mesma lançou, com a coincidência registrada, como o Chefe) e altera parâmetros. Decisão do gabinete, confirmada em 2026-11-17: a Deputada pode fazer o que achar necessário na CEAP. Não há passo de ateste dela no fluxo.

**O que ele não faz (administração técnica):**

| Operação | Quem faz |
| --- | --- |
| Criar, alterar ou desativar usuários, redefinir senhas, conceder perfil e habilitação | Chefe e Administrador |
| Alterar a política de publicação | Administrador |
| Eliminar dados pessoais | Administrador |
| Estruturar fluxos | Administrador |

**Conta pessoal e intransferível.** A Deputada usa o próprio login. Ninguém deve entrar com a conta dela, porque a trilha atribuiria os atos a ela. O segundo fator é obrigatório para este perfil a partir da fase 8.

**Agenda dela.** Ver RN-AGE-08.

## 3.5 Concessão

- Só se concede perfil igual ou inferior ao próprio. O Chefe não concede Administrador.
- O perfil Parlamentar só o **Administrador** concede, existe **um único usuário ativo** com ele (garantido por gatilho no banco) e não se concede a quem já tem outro perfil.
- Quem concede perfil e habilitação: Chefe ou Administrador.
- Nunca fica sem Administrador ativo (gatilho no banco, verificado no commit).
- Mudar perfil, habilitação, situação ou senha de alguém encerra as sessões dele no ato.
- Uma permissão ausente faz a página sumir do menu, e a rota responde como se não existisse.

## 3.6 Decisão em aberto

**PV-C: confirmada em 2026-11-17.** Chefe e Administrador são pessoas diferentes; cerca de 50 usuários (a divisão por perfil entra na implantação); qualquer perfil pode atender, e a regra do Assessor Externo segue limitada ao que é dele; o Administrador é o responsável pela privacidade de dados (LGPD); compromissos Restritos só para a Parlamentar, o Chefe e o Administrador; a Parlamentar tem acesso total à CEAP; quem entra no sistema recebe todas as habilitações por padrão (o Chefe pode desmarcar ao criar ou alterar o usuário).
