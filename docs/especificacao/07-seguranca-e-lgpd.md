# 07. Segurança e LGPD

Estado: rascunho da fase 0. Parte dos controles vem do Mandatus; as **melhorias** respondem às fragilidades que a análise dele apontou.

## 7.1 Controles herdados

| Controle | Como |
| --- | --- |
| Autorização | Decisor único; recusa e inexistência respondem igual |
| Autenticação | Argon2id; mensagem e tempo iguais para e-mail inexistente e senha errada; bloqueio após 5 falhas; troca de senha encerra outras sessões |
| Sessão | Ticket no servidor, invalidável; sem expiração deslizante além das regras; cookie `HttpOnly`, `SameSite=Strict`, `Secure` |
| Dinheiro | `numeric`; texto na API; nenhum valor negativo; nenhum saldo armazenado; decisão de despesa terminal |
| Auditoria | Trilha imutável por gatilho, na mesma transação |
| Área pública | Sem rota de escrita (exceto a consulta por protocolo); projeção por contrato; respostas idênticas; `noindex`; limite por origem sem guardar o endereço; escape de saída |
| Arquivos | Tipo pelo conteúdo; armazenamento privado sem URL direta; download como anexo; foto só PNG ou JPEG até 2 MB |
| Segredos | Fora do repositório; consulta pública por POST para não pôr o telefone na URL |

## 7.2 Melhorias sobre o Mandatus

| Fragilidade no Mandatus | Resposta aqui | Fase |
| --- | --- | --- |
| Sem Content-Security-Policy | CSP no Caddy desde o início, depois endurecida | 1 e 8 |
| Bloqueio de conta sem limite por IP | Limite de requisições por IP no login | 1 |
| Limite da consulta por protocolo em memória | Aceito (instância única do público); documentar. Opção: tabela no Postgres | 3 |
| ZIP aceito, sem antivírus | ClamAV na entrada de documentos | 2 |
| Expiração do link não aplicada | Aplicada | 3 |
| Sem segundo fator | TOTP para Administrador e Chefe | 8 |
| Senha inicial exibida ao criador | Link de uso único com prazo, por e-mail | 8 |
| Segregação de função revogada | Mantida, com exceção auditável | 6 |
| Vedação ao suporte pouco usada | Sem suporte externo; conceito removido | 1 |

## 7.3 Proteção de dados sem política de linha

Com um único gabinete, a política de linha por gabinete deixa de existir. A proteção vem de:

1. O decisor único de autorização, usado por todas as rotas.
2. Uma camada única de acesso a dados, no pacote `banco`; nenhuma rota escreve SQL por conta própria.
3. Papéis de banco separados: `app_migracao` (dono do esquema), `app_api`, `app_worker` (só INSERT em avisos e em envios) e `app_publico` (só leitura da visão pública).
4. Testes que **tentam** acessar o que não podem (perfil sem habilitação, Assessor Externo em registro alheio, papel público em tabela interna).
5. Verificações de subida: o processo não sobe se um invariante falhar (sem coluna de saldo, valores monetários declarados e não negativos, gatilhos da trilha presentes, papéis sem propriedade).

## 7.4 LGPD

Dados pessoais tratados: nome e telefone do cidadão, e-mail (quando consentido), endereço e contatos (internos), conteúdo das solicitações (podendo conter dados sensíveis, por exemplo de saúde), dados da equipe.

| Aspecto | Proposta |
| --- | --- |
| Base legal | A definir com a assessoria jurídica (execução de atribuição pública e consentimento para o e-mail). Registrar em documento de tratamento |
| Consentimento | Só para notificação por e-mail: explícito, registrado, revogável (ver `10`) |
| Minimização | Telefone mascarado por padrão na área pública; e-mail sem título nem descrição |
| Acesso | Só pela equipe, por perfil e alcance; toda consulta relevante deixa trilha |
| Direitos do titular | Eliminação de dados pessoais por solicitação, preservando protocolo e histórico despersonalizados; registro do atendimento ao pedido |
| Retenção | Prazo a definir (PV-F); por padrão, manter enquanto o mandato exigir, com revisão |
| Incidentes | Procedimento de resposta a escrito na fase 8 |
| Operador de e-mail | O provedor transacional é operador; contrato e local de tratamento a verificar |
| Armazenamento de arquivos | Conta do R2 com titularidade definida (PV-E) |

## 7.5 Pontos em aberto

1. **PV-F:** prazo de retenção e política de privacidade (com o jurídico do gabinete).
2. Encarregado (DPO) do gabinete: quem é.
3. Revisão de segurança por alguém de fora do projeto, na fase 8.
4. Plano de resposta a incidentes.
