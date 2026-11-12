# Plano de implementação: gabinete da Deputada Federal Adriana Accorsi

Versão 1 (rascunho para avaliação) · 10/11/2026

Este documento descreve tudo o que precisa ser feito, fase por fase, para construir um sistema de gestão de gabinete parlamentar para **um único gabinete** (Dep. Federal Adriana Accorsi), a partir do Mandatus, que é multi-inquilino. Nada aqui foi implementado: é o plano para aprovação.

**Fontes.** `docs/referencia/mandatus-documentacao-tecnica-e-funcional.md` (a análise já feita do Mandatus) e o código e a especificação do Mandatus em `C:\Users\Vinicius Soares\Documents\Repositórios\mandatus`, lido sem alteração. A pasta do Mandatus nunca é modificada; quando algo for aproveitado, é copiado e adaptado para este repositório.

---

## 1. Decisões já tomadas

| # | Decisão | Valor |
| --- | --- | --- |
| D1 | Escopo | Um único gabinete (Dep. Federal Adriana Accorsi). Sem multi-inquilino e sem camada de plataforma |
| D2 | Esfera | Federal, fixa. Um único conjunto de fluxos |
| D3 | Stack | React (SPA) + API Node/TypeScript + PostgreSQL |
| D4 | Hospedagem | VPS própria |
| D5 | Verba indenizatória | CEAP (Cota para o Exercício da Atividade Parlamentar), com regras **configuráveis** |
| D6 | Segregação de função | Quem lança despesa não aprova, **exceto** Chefe de Gabinete e Administrador, com a coincidência sempre registrada |
| D7 | Notificação ao cidadão | Entra no escopo. Primeiro canal: **e-mail** |
| D8 | Verba de gabinete (pessoal) | Fora do escopo. Fase 9 opcional |
| D9 | Domínio | `dominio.nucleodedados.com` para a aplicação, provisório, para apresentação à deputada. Será trocado se ela aprovar |
| D10 | Entrega | Tudo, em fases |
| D11 | Perfil Parlamentar | Perfil à parte para a Deputada, um único usuário ativo, conta pessoal. Vê tudo, opera e acompanha como Supervisor, na CEAP só consulta (sem ateste) e não administra o sistema. A agenda do gabinete é a agenda dela (ver `docs/especificacao/03`, item 3.4.1) |

### 1.1 Decisões que assumi como padrão (corrija se discordar)

| # | Padrão assumido | Alternativa | Motivo |
| --- | --- | --- | --- |
| P1 | API em **Fastify** (com Zod), decidida pelo usuário | NestJS | Leve e direto. O decisor de autorização entra como gancho `preHandler`, com cada rota declarando a operação. A estrutura por módulos (pasta com rotas, serviço e schemas) é convenção, imposta por lint e registrada no `CLAUDE.md` |
| P2 | Área pública em **Fastify com templates JSX** (por exemplo `@kitajs/html`), app separado, decidida pelo usuário | Astro; rotas na própria API | Mesma tecnologia da API. Mantém a separação do Mandatus: processo próprio, papel de banco só de leitura da visão pública, sem rota de escrita e sem credencial do armazenamento de arquivos. JSX escapa o conteúdo por padrão |
| P3 | Acesso a dados com **Drizzle** e migrações em SQL | Prisma | Gatilhos, visões e restrições precisam de SQL de qualquer forma; Drizzle deixa isso natural |
| P4 | Gerenciador de pacotes **npm** com workspaces, decidida pelo usuário | pnpm | Já vem com o Node, sem ferramenta extra. Workspaces do npm cobrem o monorepo. Versão do Node fixada em `.nvmrc` e `engines`, e `package-lock.json` versionado |
| P5 | Fila de tarefas **pg-boss** | Redis + BullMQ | Usa o próprio Postgres, uma peça a menos |
| P6 | Testes: **Vitest** (unidade e componentes), **Testcontainers** (integração com Postgres real), **Playwright** (ponta a ponta) | | Cobre as três camadas do Mandatus |
| P7 | E-mail por **provedor transacional**, mantida pelo usuário. Começar com Resend; Amazon SES e Brevo seguem como alternativas, e trocar é barato porque o código usa a interface `CanalDeNotificacao` | SMTP próprio | Entregabilidade. SMTP próprio em VPS cai em spam |
| P8 | Arquivos em **S3 compatível**, mantida pelo usuário. Cloudflare R2 em produção e S3Mock no ambiente local (o MinIO deixou de ser publicado no Docker Hub) | Disco da VPS | Mesma solução do Mandatus. Os comprovantes da CEAP ficam fora da VPS. A titularidade da conta do R2 precisa ser definida (ver seção 8) |

### 1.2 Domínios

- Aplicação interna: `dominio.nucleodedados.com`
- Área pública do cidadão: `acompanhe.dominio.nucleodedados.com` (origem separada, para que cookie e política de segurança não se misturem)
- É necessário acesso ao DNS de `nucleodedados.com` para: registros A, certificados (Caddy, automático) e **SPF, DKIM e DMARC** do e-mail.
- Quando a deputada aprovar e o domínio definitivo existir, a troca deve ser só configuração (variáveis de ambiente e Caddyfile), sem alteração de código. Isso vira critério da fase 1.

---

## 2. Princípios do projeto

Herdados do Mandatus, porque foram o que deu certo:

1. **Autorização em um único lugar.** Um decisor, que toda rota e a barra de navegação consultam. Nada de `if (perfil === ...)` espalhado.
2. **Auditoria na mesma transação.** Se gravar a trilha falha, a operação é desfeita. A trilha é imutável (gatilho no banco).
3. **Status derivado, nunca armazenado.** O status de uma demanda vem do papel da etapa. O saldo de verba e de emenda é calculado, sem coluna de saldo.
4. **Mecanismo único de movimentação.** Demanda, tarefa, projeto, emenda e despesa percorrem etapas pelo mesmo mecanismo (Etapa, Movimentação, Vínculo).
5. **Nada é público por padrão.** O que o cidadão vê é uma projeção explícita, nunca o registro interno filtrado.
6. **Nenhuma automação decide.** Processos de fundo só geram avisos e envios. Não concluem nem cancelam nada.
7. **Dinheiro é exato.** `numeric` no banco, texto na API, nunca float, nunca negativo.

Diferenças deliberadas em relação ao Mandatus:

- **Sem política de linha por gabinete.** Com um só gabinete não há o que isolar. A proteção vem do decisor único, de uma camada única de acesso a dados e de testes que tentam acessar o que não podem.
- **Sem camada de plataforma.** Quem administra o sistema é o Administrador do próprio gabinete. Operações de infraestrutura (criar o primeiro administrador, semear dados fictícios) ficam em comandos de linha, não em rotas.
- **Documentação viva.** O Mandatus deixou README, `stack.md` e comentários defasados em relação ao código. Aqui, cada fase só fecha com a documentação atualizada (ver seção 4).

---

## 3. Estrutura do repositório

Monorepo. Uma pasta por responsabilidade, nomes em português para o domínio e em inglês só onde a ferramenta exige.

```
adriana-accorsi/
├── README.md                     Visão geral, como rodar, links para docs
├── CLAUDE.md                     Orientação para agentes de IA (regras do projeto)
├── package.json                  Raiz do monorepo (scripts globais e "workspaces")
├── package-lock.json
├── .nvmrc                        Versão do Node fixada
├── tsconfig.base.json            Configurações comuns ficam na raiz (não há packages/config)
├── eslint.config.js
├── vitest.config.ts
├── .prettierrc.json
├── .editorconfig
├── .gitignore
├── .env.exemplo                  Variáveis necessárias, sem segredos
├── compose.yaml                  Ambiente local (Postgres, S3Mock, Mailpit)
├── compose.producao.yaml         VPS (Caddy, api, publico, worker, Postgres)
│
├── apps/
│   ├── web/                      SPA React: área interna da equipe
│   ├── api/                      API Fastify: regras, rotas, sessão, auditoria
│   ├── publico/                  Fastify + JSX: página do cidadão (somente leitura)
│   └── worker/                   Avisos de prazo, envio de e-mail, tarefas de fundo
│
├── packages/
│   ├── compartilhado/            Schemas Zod, enums, tipos usados por web, api e publico
│   ├── banco/                    Schema Drizzle, migrações SQL, gatilhos, visões, seed
│   └── autorizacao/              Decisor, perfis, habilitações, alcance
│
├── infra/
│   ├── caddy/                    Caddyfile
│   └── scripts/                  implantar, backup, restaurar, verificar
│
├── docs/
│   ├── README.md                 Índice da documentação
│   ├── plano/                    Este plano, progresso e histórico
│   ├── especificacao/            Especificação do sistema (derivada do Mandatus)
│   ├── arquitetura/              Stack, modelo de dados, decisões técnicas (ADR)
│   ├── operacao/                 Como rodar, implantar, backup, roteiros de conferência
│   └── referencia/               Material do Mandatus (somente leitura, não editar)
│
├── tests/
│   └── e2e/                      Playwright, fluxos de ponta a ponta
│
└── .github/
    └── workflows/                CI: lint, tipos, testes, build, imagens
```

**Regras de organização:**

- `packages/banco` é o único lugar que conhece SQL e o esquema. `apps/api` e `apps/worker` o consomem.
- `apps/publico` **não importa** o pacote `banco` por inteiro: só acessa uma visão pública de leitura (ver fase 3). Isso reproduz o invariante 8 do Mandatus (público sem rota de escrita).
- `docs/referencia/` guarda o material do Mandatus, incluindo a análise atual (hoje na raiz, a mover). Fica marcado como somente leitura.
- Decisões técnicas em `docs/arquitetura/decisoes/NNN-titulo.md`, uma por arquivo (formato ADR), numeradas.
- Cada app tem seu próprio `README.md` curto: o que faz, como rodar, como testar.
- Commits em português, no padrão `tipo: assunto` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
- Ramo `main` protegido; trabalho em ramos curtos por tarefa.

---

## 4. Definição de pronto (vale para todas as fases)

Uma fase só é considerada concluída quando:

1. Todos os critérios de aceitação da fase passam, com teste automatizado quando possível.
2. As verificações de segurança das fases anteriores **continuam passando** (uma fase que quebra a anterior não é aceita).
3. A CI está verde: lint, tipos, testes de unidade, integração e ponta a ponta.
4. `docs/` está atualizada: especificação, modelo de dados, decisões, `README` e `como-rodar`.
5. Há roteiro de conferência manual em `docs/operacao/conferencias/` e ele foi executado, inclusive em tela pequena para as telas da fase.
6. Está implantada no ambiente de apresentação, funcionando.
7. O registro de progresso (`docs/plano/progresso.md`) está atualizado, com o que ficou adiado e por quê.

---

## 5. Visão geral das fases

| Fase | Nome | Resultado | Usável? | Tamanho |
| --- | --- | --- | --- | --- |
| 0 | Planejamento | Especificação enxuta, modelo de dados, decisões fechadas | Não | P |
| 1 | Fundação | Login, equipe, perfis, auditoria, infraestrutura no ar | Não | G |
| 2 | Atendimento | Pessoas, demandas, protocolo, documentos, comentários | Internamente | G |
| 3 | Cidadão | Área pública, consentimento LGPD, e-mail de andamento | **Sim, apresentável** | G |
| 4 | Trabalho da equipe | Tarefas, agenda, eventos, presença, avisos | Sim | G |
| 5 | Legislativo | Projetos de lei, beneficiários | Sim | M |
| 6 | Financeiro | Emendas e CEAP | Sim | G |
| 7 | Consolidação | Painel completo, busca, exportação | Sim | M |
| 8 | Endurecimento | Segurança, 2FA, backup testado, monitoramento | Sim | M |
| 9 | Opcional | Verba de gabinete e WhatsApp | | a definir |

Tamanho é relativo (P pequeno, M médio, G grande); não é prazo.

**Marco de apresentação.** O fim da **fase 3** é o ponto natural para mostrar à deputada: já há atendimento completo, protocolo, página do cidadão e e-mail de andamento. As fases 4 a 7 constroem sobre isso.

---

## Fase 0: Planejamento

**Objetivo.** Ter a especificação do novo sistema escrita e aprovada antes de qualquer código, para não herdar complexidade do Mandatus que aqui não faz sentido.

### Tarefas

| Id | Tarefa |
| --- | --- |
| 0.1 | Criar a estrutura de `docs/` e mover a análise do Mandatus para `docs/referencia/` |
| 0.2 | Ler os 21 documentos de `docs/especificacao/` do Mandatus e classificar cada requisito: mantém, adapta, descarta (multi-inquilino e plataforma) |
| 0.3 | Escrever a especificação enxuta em `docs/especificacao/`: visão, módulos, perfis, regras, requisitos, permissões, fluxos, segurança, glossário |
| 0.4 | Escrever o modelo de dados (sem `gabinete_id`, com singleton de configuração do gabinete) |
| 0.5 | Redigir os fluxos federais (demanda, tarefa, projeto de lei, emenda, despesa de CEAP) como proposta, a validar com o gabinete |
| 0.6 | Levantar a norma vigente da CEAP e desenhar as tabelas de parâmetros (ver fase 6) |
| 0.7 | Definir o texto de consentimento LGPD e o modelo de e-mail de andamento |
| 0.8 | Registrar as decisões técnicas (ADR 001 em diante): stack, autenticação, estratégia de teste, estratégia de fila |
| 0.9 | Escrever o `CLAUDE.md` e o `README.md` iniciais |

### Entregáveis
Especificação aprovada, modelo de dados, lista de pendências externas (item 0.5 e 0.6), estrutura de pastas criada.

### Critério de aceite
Você revisou e aprovou. As pendências externas estão listadas com responsável.

### Pendências externas desta fase
- **PV-A:** validar os fluxos federais com o gabinete (etapas de um projeto de lei na Câmara, etapas de uma emenda).
- **PV-B:** obter a norma vigente da CEAP e as categorias que o gabinete realmente usa.
- **PV-C:** confirmar quem é o Chefe de Gabinete e o Administrador, e quantos usuários terá a equipe.
- **PV-D:** confirmar com a deputada o nome e a identidade visual (cargo, partido, mandato, foto, cores).
- **PV-E:** acesso ao DNS de `nucleodedados.com` e à VPS.
- **PV-F:** retenção de dados, política de privacidade, encarregado (DPO) e revisão jurídica dos textos de consentimento e de e-mail.

Estado da fase 0: os documentos foram escritos e aguardam sua aprovação. Detalhes em `docs/plano/progresso.md`.

---

## Fase 1: Fundação

**Objetivo.** Infraestrutura no ar, login funcionando, equipe com perfis e permissões, e auditoria imutável. É a base de tudo, então os pontos que são caros de retrofitar entram aqui: decisor de autorização e auditoria na transação.

### 1.A Repositório e ambiente

| Id | Tarefa |
| --- | --- |
| 1.1 | Inicializar o monorepo (npm workspaces, TypeScript, ESLint, Prettier, Vitest) |
| 1.2 | Criar `compose.yaml` local: Postgres 17, S3Mock, Mailpit (caixa de e-mail de desenvolvimento) |
| 1.3 | Configuração por variáveis de ambiente validadas por Zod na subida; processo recusa subir com configuração inválida |
| 1.4 | CI no GitHub Actions: lint, tipos, testes, build; imagens publicadas no GHCR em push para `main` |
| 1.5 | `.env.exemplo`, `README.md` de cada app, `como-rodar.md` |

### 1.B Banco

| Id | Tarefa |
| --- | --- |
| 1.6 | Pacote `banco`: esquema Drizzle, migrações SQL versionadas, comando de migrar |
| 1.7 | Papéis de banco: `app_migracao` (dono do esquema), `app_api` (sem propriedade), `app_worker` (escrita restrita), `app_publico` (somente leitura de visão) |
| 1.8 | Tabelas: usuário, conta de acesso, sessão, habilitação, configuração do gabinete (singleton), trilha de auditoria |
| 1.9 | Gatilhos: trilha imutável (recusa UPDATE, DELETE, TRUNCATE); sempre ao menos um administrador ativo |
| 1.10 | Comando de linha: criar o primeiro administrador; semear dados fictícios (recusa banco não local) |

### 1.C Acesso e sessão

| Id | Tarefa |
| --- | --- |
| 1.11 | Login por e-mail e senha. Senha com Argon2id |
| 1.12 | Sessão com ticket no servidor (tabela `sessao`), cookie `HttpOnly`, `SameSite=Strict`, `Secure` em produção |
| 1.13 | Expiração: 5 h de inatividade, 12 h absoluta. Encerrar sessões do usuário ao mudar perfil, habilitação, situação ou senha |
| 1.14 | Bloqueio: 5 tentativas erradas bloqueiam 15 min. Mensagem e tempo iguais para e-mail inexistente e senha errada. Atraso crescente por tentativa |
| 1.15 | Senha: mínimo 10 caracteres, lista de senhas óbvias recusadas, senha igual ao e-mail recusada |
| 1.16 | Primeiro acesso: senha inicial de uso único e troca obrigatória antes de qualquer tela |
| 1.17 | Trocar a própria senha (exige a atual, encerra as outras sessões). Foto de perfil (PNG ou JPEG até 2 MB, verificada pelo conteúdo) |
| 1.18 | **Limite de requisições por IP** no login (corrige fragilidade apontada no Mandatus) |

### 1.D Perfis, habilitações e decisor

| Id | Tarefa |
| --- | --- |
| 1.19 | Cinco perfis da escala: Administrador (5), Chefe de Gabinete (4), Supervisor (3), Assessor Interno (2), Assessor Externo (1), mais o perfil **Parlamentar** fora da escala (um único usuário ativo, índice parcial; só o Administrador o concede). As operações declaram nível mínimo e podem declarar perfis adicionais ou excluídos |
| 1.20 | Habilitações por módulo: AT (Atendimento), AG (Agenda), LG (Legislativo), FI (Financeiro). Administrador tem todas, não removíveis |
| 1.21 | Pacote `autorizacao`: decisor único em passos (operação pública? sessão válida? nível do perfil? habilitação? registro-pai alcançado?). Primeira falha encerra |
| 1.22 | Autoridade efetiva é a interseção de nível e habilitação. Alcance herdado num ponto único; só o Assessor Externo é limitado ao que é seu |
| 1.23 | Regras de concessão: só se concede perfil igual ou inferior ao próprio; o Chefe não concede Administrador |
| 1.24 | Resposta da sessão traz as páginas alcançáveis; a barra de navegação mostra só o que o decisor autoriza. Recusa e inexistência respondem igual |

### 1.E Equipe

| Id | Tarefa |
| --- | --- |
| 1.25 | Cadastrar usuário, perfil, situação, habilitações, redefinir senha, histórico |
| 1.26 | Configurações do gabinete: identidade da deputada (nome, cargo, partido, mandato, contato, foto) |

### 1.F Auditoria

| Id | Tarefa |
| --- | --- |
| 1.27 | Serviço de unidade de trabalho: operação e trilha na mesma transação; falha na trilha desfaz a operação |
| 1.28 | Registro com autor, momento, origem, valor anterior e novo, justificativa. Senhas e segredos nunca entram |
| 1.29 | Consulta: Chefe ou superior vê a trilha do gabinete; Assessor Interno vê o histórico de um registro |

### 1.G Fluxos de trabalho (estrutura)

| Id | Tarefa |
| --- | --- |
| 1.30 | Tipos de processo e etapas com papéis (Entrada, Andamento, Conclusão, Arquivamento). Cada tipo tem uma Entrada, uma Arquivamento e ao menos uma Conclusão |
| 1.31 | Mecanismo único de movimentação (Etapa, Movimentação, Vínculo), tabelas e serviço genérico. Fluxos federais carregados por seed |
| 1.32 | Tela de fluxos: consultar (todos), ajustar (Supervisor), estruturar (Administrador) |

### 1.H Front

| Id | Tarefa |
| --- | --- |
| 1.33 | SPA React 19 + Vite + React Router + TanStack Query. Rotas com prefixo `/g/` |
| 1.34 | Sistema de design: tokens (cores, tipografia, espaçamento), componentes base, página de catálogo `/sistema`. Estilos em CSS próprio, sem framework utilitário |
| 1.35 | Layout: barra lateral (fixa em tela larga, gaveta em estreita), cabeçalho com a deputada, sino de avisos (vazio) |
| 1.36 | Datas sempre no fuso `America/Sao_Paulo` |

### 1.I Infra e implantação

| Id | Tarefa |
| --- | --- |
| 1.37 | `compose.producao.yaml`: Caddy, api, publico, worker, Postgres; só o Caddy publica portas |
| 1.38 | Caddyfile: HTTPS automático, HSTS, `nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, **Content-Security-Policy** (já aqui, sem custo) |
| 1.39 | Scripts: implantar, backup diário para fora da VPS, restaurar. **Restauração testada** nesta fase |
| 1.40 | Domínio e hostnames configuráveis por ambiente (preparar a troca futura de domínio) |

### Critérios de aceite

1. O administrador criado por linha de comando entra, troca a senha e cria um usuário de cada perfil. Só é possível criar um Parlamentar ativo, e só o Administrador o cria.
1a. O Parlamentar vê as consultas que o Chefe vê (auditoria, produtividade), mas é recusado em qualquer operação de administração e em qualquer escrita da CEAP (teste da matriz perfil × operação).
2. Cada perfil vê na barra só o que alcança; a rota de uma página não alcançada responde como inexistente.
3. Cinco falhas bloqueiam a conta por 15 minutos; e-mail inexistente e senha errada são indistinguíveis.
4. Alterar perfil de um usuário derruba as sessões dele no ato.
5. O Chefe não consegue conceder Administrador.
6. Tentativa de alterar ou apagar a trilha (inclusive por SQL direto com o papel da aplicação) é recusada.
7. Falhar a gravação da trilha desfaz a operação (teste forçando a falha).
8. Não é possível desativar o último administrador.
9. A aplicação sobe em `dominio.nucleodedados.com` com HTTPS, e trocar o hostname é só configuração.
10. Backup foi feito e **restaurado com sucesso** em ambiente limpo.
11. CI verde.

### Riscos
Autorização mal modelada é cara de corrigir depois. Mitigação: testes de matriz de permissão desde o início (perfil × operação), gerados da definição única.

---

## Fase 2: Atendimento

**Objetivo.** A equipe atende cidadãos e conduz demandas de ponta a ponta, internamente. Base: módulos M06, M09, M10, M11, M12 e blocos de atendimento do painel no Mandatus.

**Estado:** implementada (ver [progresso](progresso.md)). Antivírus: ClamAV em contêiner, obrigatório em produção ([ADR 0008](../arquitetura/decisoes/0008-documentos-link-e-antivirus.md)).

### Tarefas

| Id | Tarefa |
| --- | --- |
| 2.1 | **Pessoas**: cadastro por telefone normalizado, sem duplicata ativa; alterar; inativar (Supervisor); eliminar dados pessoais (Administrador: nome, telefone e contatos viram nulos, situação "Dados eliminados", linha mantida) |
| 2.2 | **Protocolo**: 12 caracteres aleatórios em três grupos de quatro, alfabeto de 31 símbolos sem `0 O 1 I L`, único, imutável (gatilho), nunca reutilizado. Aceito com ou sem hífens e em qualquer caixa |
| 2.3 | **Demanda**: registro em uma única tela, incluindo cadastrar a pessoa se não existe. Título obrigatório; responsável padrão é quem registrou; prioridade padrão Média (Baixa, Média, Alta, Urgente) |
| 2.4 | Criação atômica: protocolo, link, demanda, movimentação de entrada, vínculo e trilha na mesma transação |
| 2.5 | **Movimentação**: mover entre etapas; status derivado do papel da etapa; reatribuir; cancelar com justificativa de 10 caracteres ou mais; demanda cancelada não se altera |
| 2.6 | **Listagem e quadro por etapa**, com filtro e paginação no servidor (25 por página, máximo 100) |
| 2.7 | **Ficha da demanda** (gaveta e página, com link profundo `/g/demandas?demanda=<id>`) |
| 2.8 | **Comentários internos** com menção a colegas (`@`); remover deixa marca com autor e data; cada um remove o próprio, o de terceiro exige Supervisor. Nenhuma operação publica comentário |
| 2.9 | **Documentos**: PDF, PNG, JPEG e ZIP até 25 MB, tipo verificado pelos primeiros bytes, armazenados em S3 privado sem URL direta, download como anexo, alcance herdado do registro. Gravar bytes antes do registro e apagar se o registro falhar; remover marca como removido |
| 2.10 | **Alcance**: Assessor Externo vê só as demandas de que é responsável; ficha completa a partir de Assessor Interno |
| 2.11 | **Painel básico** de atendimento: contagens vindas das mesmas consultas das listagens |
| 2.12 | **Histórico por registro** (movimentações e trilha) |
| 2.13 | Verificação de antivírus em documentos (ClamAV em contêiner) para fechar a fragilidade "ZIP aceito" do Mandatus |

### Permissões desta fase (do Mandatus, mantidas)

| Operação | Nível mínimo |
| --- | --- |
| Registrar e consultar demanda ou pessoa | Assessor Externo, habilitação AT |
| Ficha completa, manter pessoa, comentar, anexar | Assessor Interno |
| Editar e mover demanda | Supervisor, ou o responsável |
| Reatribuir, cancelar, inativar pessoa, remover documento ou comentário de terceiro | Supervisor |
| Eliminar dados pessoais | Administrador |

### Critérios de aceite

1. O roteiro "Maria liga pedindo a poda de uma árvore" funciona de ponta a ponta: buscar a pessoa pelo telefone, cadastrar, registrar a demanda, receber o protocolo.
2. Falha em protocolo, link ou trilha impede a criação da demanda.
3. Não existem duas pessoas ativas com o mesmo telefone.
4. O protocolo nunca muda, nem após cancelamento (teste direto no banco).
5. O status não existe como coluna; muda quando muda a etapa.
6. O Assessor Externo não enxerga demanda alheia, nem pela busca, nem por link direto.
7. Comentário interno não tem rota que o publique (teste de contrato).
8. Documento de tipo falso (extensão `.pdf` com conteúdo executável) é recusado.
9. Eliminar dados de uma pessoa preserva protocolo e histórico, despersonalizados.
10. Nenhuma listagem carrega o conjunto completo.

### Riscos
Escopo de uma ficha de demanda tende a crescer. Mitigação: dividir a tela por responsabilidade desde o começo (o Mandatus acabou com telas de mais de mil linhas).

---

## Fase 3: Cidadão (área pública e e-mail)

**Objetivo.** O cidadão acompanha a própria solicitação sem criar conta, e é avisado por e-mail. **É o marco de apresentação à deputada.**

### 3.A Área pública

| Id | Tarefa |
| --- | --- |
| 3.1 | App `publico` (Fastify com templates JSX, renderizado no servidor): início, consulta por protocolo, acompanhamento por link, erro. Sem login, sem cookie, somente leitura, `noindex` e `robots.txt` com `Disallow: /` |
| 3.2 | **Visão pública no banco**: o app público só lê uma visão que expõe exclusivamente o conjunto publicável. Papel `app_publico` sem acesso às tabelas internas |
| 3.3 | **Política de publicação versionada**: exibir título (padrão não), nome (completo, primeiro nome ou não exibir), telefone (completo, mascarado ou não exibir), expiração do link (7 a 1.825 dias). Só o Administrador altera; cada alteração fecha a versão vigente e abre a seguinte |
| 3.4 | **Link de acompanhamento**: obter, pré-visualizar (mesma projeção do cidadão), revogar, regenerar, suspender e retomar. Segredo do link nunca na trilha |
| 3.5 | **Andamentos publicáveis**: texto curto escrito para o cidadão, sem autor na página; remover some da página, mas a linha e o texto ficam na trilha |
| 3.6 | **Etapas visíveis**: rótulo público por etapa; etapas não visíveis omitidas sem lacuna; previstas aparecem sem data; nome interno da etapa nunca aparece |
| 3.7 | **Consulta por protocolo**: exige o telefone do atendimento, por POST. Limite por origem: 5 falhas bloqueiam 5 minutos, com atraso crescente. Hash da origem, nunca o IP. Respostas idênticas em qualquer falha |
| 3.8 | **Expiração do link aplicada de verdade** (no Mandatus o prazo era gravado e nada o aplicava). Link expirado responde igual a inválido |
| 3.9 | Vocabulário de cidadão ("solicitação" em vez de "demanda"); aviso de que quem tem o endereço acessa |
| 3.10 | Cada acesso válido vira ocorrência na trilha, sem dados do visitante |

### 3.B Consentimento LGPD

| Id | Tarefa |
| --- | --- |
| 3.11 | Campos na pessoa: e-mail, consentimento para receber notificação (sim ou não), data e origem do consentimento, texto da versão aceita |
| 3.12 | Captura do consentimento no atendimento (checkbox claro, desmarcado por padrão); histórico de mudanças na trilha |
| 3.13 | Cancelamento a qualquer momento: link de descadastro em todo e-mail, e a equipe pode registrar o pedido por outro canal |
| 3.14 | Notificação só para quem consentiu e tem e-mail; só para andamento da própria solicitação (sem divulgação de mandato, ver risco eleitoral) |

### 3.C Notificação por e-mail

| Id | Tarefa |
| --- | --- |
| 3.15 | **Padrão outbox**: o evento (andamento publicado, mudança de etapa visível, conclusão) grava uma linha de envio na mesma transação; o worker envia depois. Falha de envio nunca desfaz o ato |
| 3.16 | Interface de canal plugável (`CanalDeNotificacao`), com a implementação de e-mail. WhatsApp entraria como outra implementação, sem mudar o restante |
| 3.17 | Integração com provedor transacional (P7), com repetição com recuo, controle de duplicidade e registro do resultado |
| 3.18 | Modelos de e-mail em texto e HTML simples, em vocabulário de cidadão, com link de acompanhamento e de descadastro |
| 3.19 | Configuração de **SPF, DKIM e DMARC** no domínio remetente; verificação de entregabilidade |
| 3.20 | Fila de e-mails visível para o Supervisor (enviado, falhou, cancelado) |
| 3.21 | Limite de envio por hora, para proteger a reputação do domínio |

### Critérios de aceite

1. A resposta pública contém **exclusivamente** o conjunto publicável, conferido campo a campo.
2. Nenhum campo interno aparece, nem oculto na apresentação (teste inspecionando o HTML).
3. Link inválido, revogado, expirado, inexistente e de sistema suspenso respondem com o mesmo 404 e o mesmo corpo.
4. Nenhuma rota pública aceita escrita, com exceção nominal da consulta por protocolo.
5. A prioridade da demanda, comentários, tarefas, documentos e qualquer dado financeiro ou legislativo nunca chegam ao cidadão.
6. 5 falhas na consulta por protocolo bloqueiam a origem por 5 minutos.
7. A pré-visualização mostra exatamente o que o cidadão verá.
8. Ao publicar um andamento, o cidadão que consentiu recebe o e-mail; quem não consentiu não recebe.
9. O descadastro funciona em um clique e é respeitado imediatamente.
10. Falha do provedor de e-mail não impede a publicação do andamento, e o envio é repetido.
11. O link expira conforme a política.

### Riscos
- **Entregabilidade:** e-mail novo de um domínio novo cai em spam. Mitigação: SPF, DKIM, DMARC, volume baixo no começo, remetente claro.
- **Caráter eleitoral:** comunicação de um mandato tem limites legais em períodos eleitorais. Manter o canal estritamente para andamento de solicitação, e validar a redação dos modelos com a assessoria jurídica do gabinete.
- **Link como credencial:** quem tem o link acessa. Manter aviso, revogação, regeneração e expiração.

---

## Fase 4: Trabalho da equipe

**Objetivo.** Distribuir e acompanhar tarefas, controlar a agenda da deputada, registrar eventos com presença e avisar a equipe.

### Tarefas

| Id | Tarefa |
| --- | --- |
| 4.1 | **Tarefas**: título obrigatório; responsável; prazo (não anterior a hoje na criação); vínculo a qualquer registro, herdando o alcance dele; mover, reatribuir, cancelar com justificativa, reabrir (Supervisor). Assessor Externo cria só para si |
| 4.2 | **Agenda**: consultar por período (parâmetros `de` e `ate` obrigatórios), próximos, compromissos com participantes internos e externos |
| 4.3 | **Visibilidade de compromisso** em 3 níveis: Aberto (visível), Participantes (esconde o conteúdo, pode mostrar o horário como ocupado), Restrito (não aparece nem como ocupado). Criar Restrito: Supervisor. Ver Restrito sem ser participante: só Chefe, Administrador e Parlamentar |
| 4.3a | **Agenda da Parlamentar**: marca "envolve a Parlamentar" em todo compromisso, ligada por padrão, que o faz aparecer na agenda dela sem gerar aviso; visão "minha agenda" com os compromissos que a envolvem e, a pedido, toda a agenda. Só a indicação explícita como participante interno gera aviso |
| 4.4 | Resposta do participante interno (sem resposta, confirmado, recusado); a resposta é só informativa |
| 4.5 | **Bloqueios de indisponibilidade**: criar, cancelar, entram na agenda |
| 4.6 | **Eventos**: cadastrar, alterar, encerrar (decisão de Supervisor, nunca derivada da data), evento mais próximo |
| 4.7 | **Presença**: por telefone, em poucos toques no celular; pessoa não cadastrada é criada no ato com o nome; correção por quem registrou em até 30 minutos, depois por Assessor Interno ou superior; remover exige justificativa. Não se registra presença em evento encerrado |
| 4.8 | **Avisos internos** (sino): 9 naturezas, das quais 7 nascem do ato (designação e reatribuição de tarefa, indicação, remarcação e cancelamento de compromisso, despesa aguardando análise, saldo abaixo do limite) e 2 por tempo (prazo próximo e prazo vencido). Quem não alcança o registro de origem não recebe o aviso |
| 4.9 | **Menções** em comentários e textos geram aviso ao colega, se ele alcançar o registro |
| 4.10 | **Worker de prazos**: de hora em hora, gera aviso de prazo próximo e vencido, uma vez por dia por prazo. Só consegue inserir em `aviso` |
| 4.11 | **Antecedência do aviso de prazo configurável** (RF-V16, adiada no Mandatus) e **expurgo de avisos expirados** (RF-V18) |
| 4.12 | Exportação de tarefas e agenda fica para a fase 7 |

### Critérios de aceite

1. Compromisso Restrito não aparece, nem como horário ocupado, para quem não pode vê-lo (teste por perfil).
2. Recusar um compromisso não o cancela nem remove o participante.
3. O aviso de prazo é gerado uma vez por dia por prazo, e a falha de uma passagem do worker não derruba o processo.
4. O worker, com credenciais próprias, só consegue inserir em `aviso` (teste tentando outra escrita).
5. Concluir a última tarefa não conclui a demanda.
6. Evento passado não se encerra sozinho.
7. Presença no celular: registrar em até 3 toques, conferido em tela pequena.
8. Quem não alcança o registro de origem não recebe o aviso dele.

---

## Fase 5: Legislativo

**Objetivo.** Acompanhar projetos de lei da deputada e cadastrar os beneficiários que também serão usados pelas emendas.

### Tarefas

| Id | Tarefa |
| --- | --- |
| 5.1 | **Beneficiários**: municípios, órgãos e entidades. Nome fantasia, razão social, CNPJ, endereço completo (CEP, logradouro, número, bairro, cidade, estado; só o complemento opcional). Sem dois ativos com o mesmo CNPJ. Validação do dígito verificador do CNPJ. Inativar (Supervisor) |
| 5.2 | **Projetos de lei**: título, ementa e autoria obrigatórios; número único entre ativos; prazo não anterior a hoje na criação; nasce na Entrada do fluxo federal |
| 5.3 | Mover (Supervisor, ou Assessor Interno responsável), cancelar com justificativa, etapa de destino do fluxo de Projeto de Lei e ativa |
| 5.4 | **Comissões**: tramitação por comissão; **votações** registradas no projeto; assuntos do projeto |
| 5.5 | **Quadro, consolidado e atrasados** (atraso derivado na leitura, nunca gravado) |
| 5.6 | Habilitação LG: sem ela o módulo não aparece; beneficiários aceitam LG ou FI |
| 5.7 | Ajustar o fluxo federal conforme a validação do gabinete (PV-A) |
| 5.8 | **Avaliar integração com a API de dados abertos da Câmara** para trazer a tramitação oficial. É uma oportunidade que o Mandatus não tinha. Só avaliar e decidir; implementação em fase futura se valer |

### Critérios de aceite

1. Título, ementa e autoria são obrigatórios; número duplicado entre projetos ativos é recusado.
2. CNPJ inválido ou duplicado é recusado.
3. O projeto percorre as etapas do fluxo federal; etapa de outro tipo de processo é recusada.
4. Comissões e votações são registradas e aparecem na ficha.
5. O quadro mostra os atrasados, calculados na leitura.
6. Sem a habilitação LG, o módulo não aparece (nem vazio).

### Dependência externa
PV-A (fluxo federal validado). É o maior risco de prazo desta fase.

---

## Fase 6: Financeiro (emendas e CEAP)

**Objetivo.** Administrar emendas parlamentares e prestar contas da CEAP, com saldo derivado e trilha de quem lançou e quem decidiu.

### 6.A Emendas

| Id | Tarefa |
| --- | --- |
| 6.1 | **Emenda**: identificação e finalidade obrigatórias; exercício entre 2000 e 2100; prazos de destinação, empenho e execução não anteriores a hoje na criação; tipos de emenda (individual, bancada, comissão), configuráveis |
| 6.2 | **Destinações a beneficiários**: não podem exceder o disponível nem ficar abaixo do já executado; cancelar exige justificativa; destinação com execução registrada não se cancela |
| 6.3 | **Execuções**: não excedem a destinação, sem data futura |
| 6.4 | **Valores derivados**: disponibilizado, comprometido (soma das destinações ativas), utilizado (execuções), disponível e a executar. Sem coluna de saldo. Valor da emenda não pode ficar abaixo do comprometido. Nenhum lançamento negativo ou zero |
| 6.5 | Quadro e consolidado; **reconstituição da composição dos valores em uma data passada** (Administrador) |
| 6.6 | Fluxo de emenda (9 etapas no Mandatus) adaptado ao federal e validado (PV-A) |

### 6.B CEAP (regra configurável)

Princípio: nada da norma da CEAP fica fixo no código. O que a Câmara pode mudar é dado, com vigência.

| Id | Tarefa |
| --- | --- |
| 6.7 | **Parâmetros da CEAP com vigência**: cota mensal (por estado), categorias de despesa, tetos por categoria quando existirem, exigência de comprovante por categoria, prazo de prestação de contas, limite de alerta de saldo. Cada alteração fecha a vigência anterior e abre a nova, para reconstituir o que valia em cada data |
| 6.8 | **Verba (período de apuração)** com vigência (fim não anterior ao início), valor disponibilizado e limite de alerta. Não recebe despesa nova depois de encerrada e não se encerra com despesa aguardando análise |
| 6.9 | **Categorias de despesa**: criar, renomear, desativar; a última ativa não se desativa |
| 6.10 | **Despesa**: descrição, valor maior que zero, responsável, data não futura, categoria. Precisa de comprovante anexado antes da análise. Não pode exceder o saldo |
| 6.11 | **Saldo derivado**: despesa em análise já reduz o saldo; cancelar devolve o valor. Reconstituição do saldo em uma data (Administrador) |
| 6.12 | **Decisão**: aprovar ou reprovar é terminal; reprovar exige motivo; despesa decidida não se edita nem se move |
| 6.13 | **Segregação de função**: quem lança não aprova, **exceto Chefe de Gabinete e Administrador**. Implementada no serviço e com restrição no banco. Quando quem lançou e quem decidiu coincidem, o registro marca a coincidência, a trilha destaca e o relatório de prestação de contas lista essas despesas |
| 6.14 | Quando a regra impede todos os aprovadores (um único Supervisor financeiro que lançou), a decisão sobe ao Chefe ou ao Administrador, com aviso a eles. Sem isso, a despesa fica parada, que foi o motivo da revogação no Mandatus |
| 6.15 | **Avisos**: despesa aguardando análise (aos que podem decidir) e saldo abaixo do limite |
| 6.16 | **Relatório de prestação de contas** por período e **pacote de documentos** (comprovantes) para download (Chefe ou superior), pela data de envio do documento |
| 6.17 | Painel financeiro: saldo, comprometido por categoria, despesas por status |

### 6.C Observação importante sobre a CEAP

O sistema é **controle interno e prestação de contas do gabinete**. A apresentação oficial dos documentos à Câmara continua pelos canais dela. O sistema organiza e confere; não os substitui. A norma vigente (PV-B) precisa ser levantada antes de modelar as tabelas de parâmetros, e eu não afirmo valores nem categorias de memória.

### Permissões

| Operação | Nível mínimo | Habilitação |
| --- | --- | --- |
| Lançar despesa | Assessor Interno | FI |
| Supervisionar verba e decidir despesa | Supervisor, com a regra de segregação | FI |
| Decidir despesa própria | Chefe ou Administrador | FI |
| Acompanhar emenda | Assessor Interno | LG |
| Ver valores de emenda | Assessor Interno | LG ou FI |
| Reconstituir valores e saldos | Administrador | LG ou FI |
| Pacote financeiro | Chefe | não exige |

### Critérios de aceite

1. Despesa sem comprovante não segue para análise.
2. Despesa em análise já reduz o saldo; cancelada devolve.
3. Um Assessor Interno que lança não consegue aprovar a própria despesa; um Supervisor que lança também não.
4. Chefe e Administrador aprovam a própria despesa, e a coincidência aparece na trilha e no relatório.
5. Destinação não excede o disponível; execução não excede a destinação.
6. Destinação com execução não se cancela.
7. Não existe coluna de saldo (teste de invariante); nenhum valor negativo.
8. Alterar um parâmetro da CEAP não muda o saldo e as decisões de períodos anteriores (vigência).
9. O saldo e a composição de uma data passada são reconstituídos corretamente.
10. Nada de emenda ou verba alcança a área pública (teste de contrato).

### Riscos
- **Maior risco do projeto:** envolve dinheiro público e prestação de contas. Priorizar testes de propriedades (somas sempre fecham) e revisão com quem presta contas.
- **Norma da CEAP desatualizada ou mal interpretada.** Mitigação: parâmetros configuráveis e validação com a assessoria financeira do gabinete.

---

## Fase 7: Consolidação

**Objetivo.** Visão completa do gabinete, busca e exportação.

### Tarefas

| Id | Tarefa |
| --- | --- |
| 7.1 | **Painel completo** por blocos (atendimento, tarefas, agenda, legislativo, emendas, CEAP, equipe, pendências), contados das mesmas consultas das listagens; cada bloco respeita habilitação e alcance |
| 7.2 | Painel de **produtividade da equipe** (Chefe): demandas por responsável, prazos, tempo por etapa |
| 7.3 | Gráficos com **equivalente tabular** e sem depender só de cor |
| 7.4 | **Busca global** nos registros que o usuário alcança |
| 7.5 | **Exportação** (Supervisor ou superior, com a habilitação do módulo): demandas, tarefas, agenda, projetos, emendas, despesas, presença. Usa a mesma leitura da tela, com o mesmo filtro; exportar grava na trilha |
| 7.6 | Auditoria do gabinete: filtros, busca, visão por registro |

### Critérios de aceite

1. Os números do painel batem com a contagem das listagens (mesma consulta).
2. A busca nunca devolve registro que o usuário não alcança.
3. O arquivo exportado traz exatamente o que a tela mostraria ao usuário, e a exportação fica na trilha.
4. Sem a habilitação, a exportação não acontece, nem vazia.
5. Toda informação de gráfico tem tabela equivalente.

---

## Fase 8: Endurecimento

**Objetivo.** Fechar as fragilidades que a análise do Mandatus apontou e preparar a operação contínua.

### Tarefas

| Id | Tarefa |
| --- | --- |
| 8.1 | **Segundo fator** (TOTP) para Administrador e Chefe, com códigos de recuperação |
| 8.2 | **Canal controlado da senha inicial** (por e-mail, link de uso único com prazo), em vez de exibir ao criador |
| 8.3 | Revisar **CSP** em modo restritivo, com relatório de violações |
| 8.4 | **Limite de requisições** em todas as rotas sensíveis, não só no login |
| 8.5 | **Teste de segurança**: revisão de autorização rota a rota, testes de IDOR, upload malicioso, injeção, fixação de sessão. Preferencialmente por alguém de fora do projeto |
| 8.6 | **Backup**: diário, externo, criptografado, com restauração testada periodicamente e plano de recuperação de desastre escrito |
| 8.7 | **Monitoramento**: saúde da aplicação, espaço em disco, certificado, fila de e-mail, falhas do worker; alerta quando algo cai |
| 8.8 | **Logs** estruturados, sem dados pessoais |
| 8.9 | **Atualização de dependências** automatizada (Dependabot ou Renovate) e rotina de atualização do Postgres |
| 8.10 | **LGPD**: política de privacidade, registro de operações de tratamento, rotina de eliminação por solicitação, prazo de retenção |
| 8.11 | **Conferência em tela pequena** de todas as telas, com script de regressão |
| 8.12 | **Acessibilidade**: contraste medido por teste, navegação por teclado, rótulos |
| 8.13 | Revisar a vedação ao suporte: como não há suporte externo, remover o conceito ou documentar quem acessa a VPS |

### Critérios de aceite

1. Administrador e Chefe não entram sem o segundo fator.
2. A restauração do backup foi executada em ambiente limpo, com tempo medido.
3. A revisão de segurança não tem achado alto em aberto.
4. A suíte de regressão de tela pequena passa.
5. Alertas de monitoramento chegam a alguém.

---

## Fase 9 (opcional): Verba de gabinete e WhatsApp

Só entram se o gabinete pedir, depois de uso real.

- **Verba de gabinete (pessoal):** módulo de RH, com lotação, cargos e remuneração dos secretários parlamentares, dados salariais sensíveis, e integração com os sistemas oficiais da Câmara. Preparação feita desde a fase 1: cadastro de equipe modelado para depois se ligar a lotação.
- **WhatsApp:** API oficial da Meta (direta ou por provedor), conta Business verificada, modelos de mensagem aprovados, consentimento específico por canal. Entra como nova implementação da interface `CanalDeNotificacao` criada na fase 3.

---

## 6. Do Mandatus para este projeto: o que aproveitar

| Item do Mandatus | Destino |
| --- | --- |
| Especificação (21 documentos) | Adaptar na fase 0; descartar `02-modelo-multi-tenant` e a parte de plataforma de `01`, `05`, `10`, `11` |
| Regras de negócio (documentos `06` e `12`) | Mantidas, adaptadas ao federal |
| Migrações SQL (gatilhos, restrições, visões) | Reescritas em SQL para o novo esquema, usando as do Mandatus como referência (por exemplo a 024, da segregação) |
| Front React (`web/src`) | Reaproveitar telas e fluxos como referência visual e de comportamento; reescrever contra a nova API |
| Sistema de design e tokens | Copiar e adaptar para a identidade visual da deputada |
| Contrato OpenAPI | Substituído por schemas Zod compartilhados |
| Código C# | Não reaproveitado. Serve de especificação executável |
| Políticas de linha por gabinete e invariantes 1, 2, 3, 9, 10, 12 | Descartados |
| Invariantes 4, 5, 6, 7, 8, 11, 13 | Reescritos como testes e verificações de subida |
| Scripts de implantação e backup | Adaptar |

---

## 7. Resumo de riscos do projeto

| Risco | Fase | Mitigação |
| --- | --- | --- |
| Fluxos federais sem validação do gabinete | 0, 5, 6 | Propor na fase 0; validar cedo |
| Norma da CEAP mal interpretada | 6 | Parâmetros configuráveis com vigência; validação financeira |
| Autorização com furos | 1 em diante | Decisor único e testes de matriz perfil × operação |
| E-mail caindo em spam | 3 | SPF, DKIM, DMARC; volume baixo; domínio próprio |
| Uso eleitoral das notificações | 3 | Canal só para andamento; validação jurídica dos modelos |
| LGPD: dados de cidadãos | 3, 8 | Consentimento, descadastro, eliminação, retenção |
| Servidor único | 1, 8 | Backup externo com restauração testada; monitoramento |
| Domínio provisório (`nucleodedados.com`) | 1 | Hostnames em configuração; troca sem código |
| Telas grandes demais | 2 em diante | Dividir por responsabilidade; limite de tamanho no lint |
| Documentação defasada | todas | Definição de pronto exige docs atualizadas |

---

## 8. Pendências para você decidir antes da fase 0

1. Confirmar o Drizzle (P3), o único padrão da seção 1.1 ainda sem resposta.
2. `dominio` em `dominio.nucleodedados.com` é o nome real do subdomínio? Confirmar também o do público (`acompanhe.dominio...`).
3. Quem controla o DNS de `nucleodedados.com`, e de quem será a conta do Cloudflare R2 (deputada, gabinete ou você), para não repetir a pendência de titularidade do Mandatus.
4. Quem valida os fluxos federais e a norma da CEAP (nome e contato), e quem é o Chefe de Gabinete e o Administrador.
5. Autorizar mover a análise atual para `docs/referencia/` na fase 0.
6. Dados da deputada para a identidade visual (foto, cores, partido, mandato).
