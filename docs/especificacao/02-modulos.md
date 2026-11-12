# 02. Módulos e funcionalidades

Estado: rascunho da fase 0. Cada módulo indica a fase do plano em que é construído e a habilitação que o protege.

Legenda de habilitação: AT Atendimento · AG Agenda · LG Legislativo · FI Financeiro · "(nível)" quando só o nível do perfil decide.

| Id | Módulo | Fase | Habilitação | O que faz |
| --- | --- | --- | --- | --- |
| M01 | Acesso e sessão | 1 | pública / nível | Login por e-mail e senha, sessão no servidor, bloqueio, troca de senha, foto de perfil |
| M02 | Equipe e habilitações | 1 | (nível: Chefe) | Usuários, perfil, situação, habilitações, redefinir senha, histórico |
| M03 | Configurações do gabinete | 1 | (nível) | Identidade da parlamentar (nome, cargo, partido, mandato, contatos, foto) |
| M04 | Fluxos de trabalho | 1 | (nível) | Etapas por tipo de processo, papel, rótulo público, visibilidade, prazo padrão |
| M05 | Auditoria | 1 | (nível: Chefe; histórico por registro: Assessor Interno) | Trilha imutável, consulta, histórico por registro |
| M06 | Documentos | 2 | herda do registro | Anexar, baixar e remover (PDF, PNG, JPEG, ZIP até 25 MB), verificação por conteúdo e antivírus |
| M07 | Pessoas | 2 | AT | Cidadãos por telefone; consentimento de notificação; alterar, inativar, eliminar dados pessoais |
| M08 | Demandas | 2 | AT | Registro com protocolo, lista e quadro por etapa, ficha, mover, reatribuir, cancelar |
| M09 | Comentários internos | 2 | herda do registro | Texto interno com menção a colegas; remoção com marca |
| M10 | Protocolo | 2 | AT | Geração e consulta do protocolo (12 caracteres) |
| M11 | Publicação ao cidadão | 3 | AT | Política versionada, link, prévia, revogar, regenerar, suspender, expiração; andamentos publicáveis |
| M12 | Área pública | 3 | pública | Início, consulta por protocolo, acompanhamento por link, erro. Sem login, sem cookie |
| M13 | Notificação ao cidadão | 3 | AT | E-mail de andamento, consentimento, descadastro, fila de envios |
| M14 | Tarefas | 4 | (nível) | Criar, alterar, mover, reatribuir, cancelar; vínculo a qualquer registro |
| M15 | Agenda | 4 | AG | Compromissos, participantes internos e externos, 3 níveis de visibilidade, resposta, bloqueios, marca "envolve a Parlamentar" e visão "minha agenda" da Deputada |
| M16 | Eventos e presença | 4 | AT | Eventos, presença por telefone em poucos toques, correção, lista nominal |
| M17 | Avisos | 4 | (nível) | Caixa pessoal (sino), 9 naturezas, marcar como lido, expiração |
| M18 | Beneficiários | 5 | LG ou FI | Municípios, órgãos e entidades por CNPJ |
| M19 | Projetos de lei | 5 | LG | Cadastro, quadro, assuntos, comissões, votações, mover, cancelar |
| M20 | Emendas | 6 | LG (valores: LG ou FI) | Emenda, tipos, destinações, execuções, quadro, consolidado, reconstituição por data |
| M21 | CEAP | 6 | FI | Parâmetros com vigência, apuração mensal, despesas com comprovante, aprovação, saldo, relatório, pacote |
| M22 | Painel | 2 e 7 | por bloco | Retrato do gabinete por blocos, contados das mesmas consultas das listagens |
| M23 | Busca global | 7 | pelo alcance do usuário | Pesquisa nos registros que o usuário alcança |
| M24 | Exportação | 7 | Supervisor + habilitação do módulo | Arquivos de demandas, tarefas, agenda, projetos, emendas, despesas e presença |

## Relações entre módulos

- Demanda, tarefa, projeto de lei, emenda, destinação e despesa **chamam** o mecanismo único de movimentação (Etapa, Movimentação, Vínculo). Nenhum tem máquina de estados própria.
- Listagem, painel, busca e exportação usam o mesmo ponto de alcance e a mesma leitura.
- A pré-visualização interna chama a mesma projeção pública do cidadão.
- Tarefa, comentário, documento e andamento se ligam ao registro por Vínculo e herdam o alcance dele.
- Avisos nascem nos módulos que praticam o ato, na mesma transação. Notificações ao cidadão nascem pelo padrão outbox.
- O serviço de demandas conhece tarefas só por uma interface que conta pendências; o de tarefas conhece projetos só por uma interface que devolve o responsável.
- Toda escrita grava a trilha na mesma transação; exportar também grava.

## Páginas da área interna

Sempre mostradas pelo decisor: página sem a habilitação não aparece, nem vazia nem bloqueada.

Painel · Demandas · Pessoas · Tarefas · Agenda · Eventos · Projetos de lei · Beneficiários · Emendas · CEAP · Equipe · Fluxos · Auditoria · Configurações · Avisos (sino) · Busca (global) · Perfil.

Páginas e rotas com prefixo `/g/` (por exemplo `/g/demandas`, `/g/emendas/:id`). Links profundos para registros (`/g/demandas?demanda=<id>`). Sem sessão, qualquer endereço mostra a tela de entrada.

## Área pública

Aplicativo separado, quatro páginas: início, consulta por protocolo, acompanhamento por link, erro. Sem login, sem cookie, somente leitura, `noindex`.
