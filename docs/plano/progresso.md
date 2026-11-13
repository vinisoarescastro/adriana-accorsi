# Progresso

Registro vivo do andamento. Atualize ao fim de cada fase (e sempre que algo for adiado).

Estados: `não iniciada` · `em andamento` · `concluída` · `bloqueada`.

| Fase | Nome | Estado | Concluída em | Observações |
| --- | --- | --- | --- | --- |
| 0 | Planejamento | **concluída** | 2026-11-12 | Aprovada. Validações externas (PV-A a PV-F) seguem abertas; as perguntas estão em [perguntas-ao-gabinete.md](perguntas-ao-gabinete.md) |
| 1 | Fundação | **implementada; falta fechar** (CI verde) | | Código, testes e infraestrutura prontos e verificados **localmente**. Faltam dois itens da definição de pronto: implantação no ambiente de apresentação (decidido: será feita ao fim de todas as fases, PV-E) e conferência manual ([roteiro](../operacao/conferencias/fase1-fundacao.md)). Ver "Fase 1" abaixo |
| 2 | Atendimento | **implementada; falta fechar** (conferência manual, implantação) | | Código e testes prontos; **CI verde no GitHub** (324 testes). Ver "Fase 2" abaixo |
| 3 | Cidadão (área pública e e-mail) | **implementada; falta fechar** (conferência manual, SPF/DKIM/DMARC reais, implantação) | | Marco de apresentação à deputada. Código e testes prontos, verificados **localmente** com Postgres, API, app público, worker e Mailpit de verdade (425 testes verdes e um fluxo completo de 25 verificações). Ver "Fase 3" abaixo |
| 4 | Trabalho da equipe | não iniciada | | |
| 5 | Legislativo | não iniciada | | Depende de PV-A |
| 6 | Financeiro (emendas e CEAP) | não iniciada | | Depende de PV-A e PV-B |
| 7 | Consolidação | não iniciada | | |
| 8 | Endurecimento | não iniciada | | |
| 9 | Opcional (verba de gabinete, WhatsApp) | não iniciada | | Só se o gabinete pedir |

## Fase 3: blocos

| Bloco | Conteúdo | Estado |
| --- | --- | --- |
| 3.A | Banco: política de publicação versionada, andamentos, consentimento, fila de envio, três visões públicas e funções nominais (migração 0008) | feito |
| 3.B | Política de publicação, link (obter, prévia, revogar, regenerar, suspender, retomar) e andamentos na API | feito |
| 3.C | App público (`apps/publico`): link, protocolo e telefone, descadastro, limite de tentativas | feito |
| 3.D | Consentimento LGPD: registro, histórico, cancelamento | feito |
| 3.E | Outbox e worker (`apps/worker`): canal plugável, Resend e SMTP, recuo, limite por hora, reconferência | feito |
| 3.F | Front: bloco do cidadão na ficha, consentimento, política em Configurações, página E-mails | feito |
| 3.G | Infra: serviços `publico` e `worker` no compose de produção, bloco do Caddy, imagens na CI | feito e construído localmente; **não executado numa VPS** |

### Verificação da fase 3 (2026-11-13)

- **425 testes verdes** em 45 arquivos (unidade, interface e integração com Postgres real). Formatação, lint, tipos e build do front limpos. As imagens `api`, `publico` e `worker` constroem.
- **Fluxo completo contra processos reais** (API, app público e worker rodando, Postgres 17 e Mailpit): registrar com e-mail e consentimento, publicar andamento, **e-mail recebido no Mailpit** (assunto, protocolo, links, sem título nem prioridade, cabeçalhos `List-Unsubscribe`), página do cidadão pelo link e por protocolo e telefone, descadastro em dois passos, nenhum e-mail depois do descadastro, fila do Supervisor, revogar o link (404 na área pública, protocolo e telefone seguem valendo) e mudar a política (reflete na página). **25 de 25**.
- A migração 0008 foi aplicada sobre um banco que já tinha dados da fase 2, e os invariantes de subida passaram.
- **Não verificado ainda:** conferência manual com navegador e em tela pequena ([roteiro](../operacao/conferencias/fase3-cidadao.md)); envio com o provedor real (Resend) e SPF, DKIM e DMARC (dependem do domínio, PV-E); CI desta fase; implantação.

### Critérios de aceite da fase 3 (plano)

| # | Critério | Estado |
| --- | --- | --- |
| 1 | A resposta pública contém exclusivamente o conjunto publicável, conferido campo a campo | verificado (teste lista as colunas das visões) |
| 2 | Nenhum campo interno aparece, nem oculto na apresentação (inspeção do HTML) | verificado |
| 3 | Link inválido, revogado, expirado, inexistente e suspenso: mesmo 404 e mesmo corpo | verificado |
| 4 | Nenhuma rota pública aceita escrita, exceto a consulta por protocolo (e o descadastro, ver desvios) | verificado |
| 5 | Prioridade, comentários, tarefas, documentos e dado financeiro ou legislativo nunca chegam ao cidadão | verificado |
| 6 | 5 falhas na consulta bloqueiam a origem por 5 minutos | verificado |
| 7 | A prévia mostra exatamente o que o cidadão verá | verificado (mesma função, teste de igualdade) |
| 8 | Ao publicar um andamento, quem consentiu recebe o e-mail; quem não consentiu não | verificado |
| 9 | O descadastro funciona em um clique e vale na hora | verificado |
| 10 | Falha do provedor não impede o andamento, e o envio é repetido | verificado |
| 11 | O link expira conforme a política | verificado |

### Decisões e desvios durante a fase 3

- **Visões com os direitos do dono**, não `security_invoker` (o item 7 do modelo de dados): com `security_invoker` o papel público precisaria de acesso às tabelas internas. A garantia vem de o `app_publico` não ter direito algum nelas, o que um teste confere tabela a tabela.
- **Expiração do link derivada**, sem coluna: vale desfecho mais os dias da política vigente, calculada na visão.
- **Segunda escrita nominal na área pública:** o descadastro de e-mail (o plano só previa a consulta por protocolo). Ele é um POST por trás de uma página com botão, porque programas de e-mail abrem links para gerar prévia.
- **Sem pg-boss nesta fase:** o worker consulta a fila periodicamente (`FOR UPDATE SKIP LOCKED`). Basta para o volume de um gabinete; o pg-boss volta a ser avaliado na fase 4 (avisos agendados). Ver [ADR 0009](../arquitetura/decisoes/0009-area-publica-e-envio-de-email.md).
- **Um e-mail por desfecho:** mover para a etapa de conclusão gera só o aviso de conclusão, não também o de "etapa visível".
- **Consentimento é histórico**, não colunas na pessoa: o vigente é o mais recente. A versão 1 do texto é minuta (PV-F).
- **E-mail inválido:** um erro permanente do provedor marca o e-mail da pessoa até a equipe corrigi-lo; corrigir o e-mail desfaz a marca.
- **Política de publicação usa o relógio do banco**: o relógio injetável da aplicação, em teste, produzia vigência invertida (a versão inicial nasce com `now()` do banco). Defeito real achado pelos testes.
- **Protocolo formatado em todas as saídas** (prévia, fila, página pública): as funções puras foram para o pacote compartilhado, porque o app público também as usa. Defeito achado pelos testes (saía sem hífens).
- **Recusa de variáveis alheias só em produção:** a API, o público e o worker recusavam subir com o `.env` único de desenvolvimento (que tem a conexão administrativa). Defeito achado ao rodar o sistema de verdade; agora a recusa vale em produção, onde os arquivos são separados.
- `PessoaDto` ganhou `emailInvalido` e `consentimento`; a lista de pessoas mostra os avisos em texto.
- A prévia e o app público leem pela **mesma função** (`@gabinete/banco/publico`).

## Fase 2: blocos

| Bloco | Conteúdo | Estado |
| --- | --- | --- |
| 2.A | Banco: pessoa, protocolo, demanda, comentário, documento, gatilhos e permissões (migração 0007) | feito |
| 2.B | Pessoas (cadastro por telefone, inativar, eliminar dados) | feito |
| 2.C | Demandas: registro atômico, movimentação, reatribuir, cancelar, lista, quadro, ficha | feito |
| 2.D | Comentários internos com menção | feito (os avisos de menção nascem na fase 4) |
| 2.E | Documentos com antivírus (ClamAV) | feito |
| 2.F | Painel de atendimento e histórico por registro | feito |
| 2.G | Front: demandas, ficha em gaveta, pessoas, painel | feito |

### Verificação da fase 2 (2026-11-12)

- **324 testes verdes** em 36 arquivos (unidade, interface e integração com Postgres e S3 reais). Formatação, lint e tipos limpos.
- **Antivírus testado contra o ClamAV real** (contêiner, versão 1.5.4): o cliente detectou o arquivo de teste EICAR (`Eicar-Test-Signature`) e aceitou conteúdo limpo, inclusive de 5 MB. O contêiner de teste foi removido. Os testes automáticos usam um servidor clamd falso que confere o enquadramento do protocolo.
- **CI verde no GitHub** (confirmado em 2026-11-12). **Não verificado ainda:** conferência manual em tela pequena ([roteiro](../operacao/conferencias/fase2-atendimento.md)) e implantação (adiada para o fim, PV-E).

### Critérios de aceite da fase 2 (plano)

| # | Critério | Estado |
| --- | --- | --- |
| 1 | Roteiro "Maria liga pedindo a poda" de ponta a ponta | verificado (API e interface) |
| 2 | Falha em protocolo, link ou trilha impede a criação | verificado |
| 3 | Não há duas pessoas ativas com o mesmo telefone | verificado (índice único parcial) |
| 4 | O protocolo nunca muda, nem após cancelamento | verificado direto no banco |
| 5 | Status não é coluna; muda com a etapa | verificado |
| 6 | O Assessor Externo não vê demanda alheia (busca, link, quadro, painel) | verificado |
| 7 | Comentário interno não tem rota que o publique | verificado (teste de contrato) |
| 8 | Documento de tipo falso é recusado | verificado |
| 9 | Eliminar dados preserva protocolo e histórico, despersonalizados | verificado |
| 10 | Nenhuma listagem carrega o conjunto completo | verificado (paginação e limite de 30 por coluna no quadro) |

### Decisões e desvios durante a fase 2

- **Comentário, documento e movimentação** referenciam o registro por `registro_tipo` e `registro_id`, sem a tabela `vinculo` (mesma razão da movimentação na fase 1).
- **Segredo do link:** hash SHA-256 **mais** cópia cifrada (AES-256-GCM), para poder reenviar o link ao cidadão na fase 3. Ver [ADR 0008](../arquitetura/decisoes/0008-documentos-link-e-antivirus.md).
- **Menções** são gravadas, mas só geram aviso na fase 4.
- **ClamAV** entra no `compose.yaml` e é **obrigatório em produção** (falha fechada). Aumenta a memória da VPS em cerca de 1 GB.
- **Trilha de pessoa** guarda só os nomes dos campos alterados, nunca dados pessoais (LGPD).
- **Relógio injetável:** horários de criação e de movimentação vêm do relógio da aplicação, não do `now()` do banco. Defeito real achado pelos testes (misturava as duas fontes).
- **Histórico por registro** liberou `demanda` e `pessoa` (Assessor Interno em diante); `tarefa` continua fechada até a fase 4.
- **Limite de "parado"** da demanda vem do parâmetro `limite_parado.demanda` (padrão 14 dias), a validar em PV-A.
- Nos testes de API, o `any` dos corpos JSON é liberado por arquivo (comentário no topo); o arquivo de demandas foi dividido por responsabilidade.

## Fase 1: blocos

| Bloco | Conteúdo | Estado |
| --- | --- | --- |
| 1.A | Repositório e ambiente | feito |
| 1.B | Banco (esquema, migrações, papéis, gatilhos, comandos) | feito |
| 1.C | Acesso e sessão | feito (a foto de perfil foi feita no 1.E) |
| 1.D | Perfis, habilitações e decisor | feito |
| 1.E | Equipe, identidade do gabinete e fotos | feito |
| 1.F | Auditoria | feito |
| 1.G | Fluxos de trabalho e movimentação | feito |
| 1.H | Front (React) | feito, sem o sino de avisos (entra na fase 4, com os avisos) |
| 1.I | Infra e implantação | feito e testado localmente; **não executado numa VPS** |

### Verificação (2026-11-12)

- **188 testes verdes** em 23 arquivos: unidade, interface (jsdom) e integração contra **Postgres 17 e servidor S3 reais** em contêiner.
- **CI verde no GitHub.** Formatação, lint, tipos e build do front limpos. `npm audit` das dependências de produção: 0 vulnerabilidades.
- **Teste de fumaça real:** Postgres do `compose.yaml`, comandos do banco, API como processo, e o fluxo de entrada por HTTP (login errado e certo, cookie `HttpOnly`, troca de senha obrigatória, equipe, fluxos, `no-store`, log sem cookie nem senha).
- **Imagens construídas e executadas:** a API em contêiner (modo produção, usuário não administrador, `healthy`, recusa ter a conexão administrativa) e o Caddy (configuração válida, SPA, CSP, HSTS, `X-Frame-Options`, cache longo nos arquivos com hash, fallback do React Router, proxy da API).
- **Backup e restauração testados:** arquivo criptografado, restauração em banco novo, conferência de números, dono correto das tabelas, 8 invariantes de segurança passando no banco restaurado, recusa de senha errada, banco existente e banco em uso.

### Critérios de aceite da fase 1 (plano)

| # | Critério | Estado |
| --- | --- | --- |
| 1 | Administrador criado por comando entra, troca a senha e cria um usuário de cada perfil | verificado (testes e fumaça) |
| 2 | Cada perfil vê na barra só o que alcança; rota não alcançada responde como inexistente | verificado |
| 3 | 5 falhas bloqueiam por 15 min; e-mail inexistente e senha errada são indistinguíveis | verificado |
| 4 | Alterar perfil derruba as sessões no ato | verificado |
| 5 | O Chefe não concede Administrador | verificado |
| 6 | Alterar ou apagar a trilha é recusado, inclusive por SQL direto | verificado |
| 7 | Falha ao gravar a trilha desfaz a operação | verificado |
| 8 | Não é possível desativar o último administrador | verificado no banco (gatilho); a API ainda impede a autoalteração |
| 9 | A aplicação sobe em `dominio.nucleodedados.com` com HTTPS; trocar o hostname é só configuração | **pendente**: configuração testada localmente; falta a VPS (PV-E) |
| 10 | Backup feito e restaurado em ambiente limpo | verificado localmente; **pendente na VPS** |
| 11 | CI verde | **verificado**: a CI rodou no GitHub em 2026-11-12 (formatação, lint, tipos, build do front, 188 testes com Postgres e S3 reais, auditoria de dependências e publicação das imagens) e passou |

### O que ficou fora, de propósito

- **Sino de avisos** no cabeçalho: os avisos nascem na fase 4.
- **Playwright (ponta a ponta no navegador):** não foi feito. A cobertura é por testes de API com Postgres real e testes de interface com a API simulada. A conferência no navegador é o roteiro manual.
- **App público e worker:** fases 3 e 4. O compose de produção só tem Caddy, API e Postgres.
- **Segundo fator, antivírus, monitoramento contínuo:** fases 2 e 8.

### Decisões e desvios durante a fase 1

- **S3 de desenvolvimento:** o MinIO deixou de ser publicado no Docker Hub. Usamos o **S3Mock (Adobe)** no `compose.yaml` e nos testes; a implementação do S3 foi testada contra ele. Em produção continua o Cloudflare R2.
- **TypeScript 6.0**, não 7: o `typescript-eslint` ainda não aceita a versão 7.
- **React Router 7.18**, não 8 (a versão mais recente), para seguir a stack decidida.
- **Movimentação referencia o registro direto** (`registro_tipo`, `registro_id`), sem passar por `vinculo`, para evitar referência circular. Atualizado no modelo de dados.
- **Ticket de sessão** guardado como HMAC com o segredo da aplicação (não só um hash simples).
- **Cookie `__Host-sessao`** em produção.
- **Parlamentar** fora de "ajustar fluxos" (conservador: administração técnica).
- **Datas e ids do SQL cru** voltam como texto quando o cliente é usado pelo Drizzle (anotado no README do pacote `banco`).
- **Erros de COMMIT** (regras diferidas) não vêm embrulhados pelo Drizzle: a tradução de mensagens lê os dois formatos. Isso foi um defeito real achado pelos testes.
- **A verificação "sem coluna de saldo"** passou a ler o catálogo (`pg_attribute`) porque o `information_schema` esconde tabelas de outros donos. Defeito real achado pelos testes.
- **Caddyfile:** a diretiva `email` com variável vazia é inválida; foi removida.
- **Restauração sem `--no-owner`:** com ele, o banco restaurado ficaria com o dono errado e as migrações futuras falhariam.

## Fase 0: tarefas

| Id | Tarefa | Estado | Onde |
| --- | --- | --- | --- |
| 0.1 | Estrutura de `docs/` e análise do Mandatus em `docs/referencia/` | feita | |
| 0.2 | Classificar requisitos do Mandatus | feita | [classificacao-do-mandatus.md](classificacao-do-mandatus.md) |
| 0.3 | Especificação enxuta | feita | `docs/especificacao/01` a `11` |
| 0.4 | Modelo de dados | feita | `docs/arquitetura/modelo-de-dados.md` |
| 0.5 | Fluxos federais como proposta | feita (depende de PV-A) | `docs/especificacao/09-fluxos-de-trabalho.md` |
| 0.6 | Parâmetros da CEAP com vigência | feita (depende de PV-B) | `docs/especificacao/08-ceap.md` |
| 0.7 | Texto de consentimento LGPD e modelo de e-mail | feita (depende de revisão jurídica) | `docs/especificacao/10-notificacoes-e-consentimento.md` |
| 0.8 | ADRs | feita | `docs/arquitetura/decisoes/0001` a `0007` |
| 0.9 | `CLAUDE.md` e `README.md` | feita | raiz |

## Pendências externas

| Id | Descrição | Responsável | Estado |
| --- | --- | --- | --- |
| PV-A | Validar fluxos federais (projeto de lei e emenda), tipos de emenda e de proposição, limites de "parado" | | aberta |
| PV-B | Obter a norma vigente da CEAP e o anexo de limites por UF; confirmar categorias, competência, prazos e os nomes das etapas pós-aprovação | | aberta |
| PV-C | Confirmar Chefe de Gabinete, Administrador e tamanho da equipe; validar a matriz de permissões | | aberta |
| PV-D | Identidade visual e dados da deputada (foto, cores, partido, mandato) | | aberta |
| PV-E | Acesso ao DNS de `nucleodedados.com` e à VPS; nome real do subdomínio; titularidade da conta do R2 | | aberta (**bloqueia fechar a fase 1**) |
| PV-F | Retenção de dados, política de privacidade, encarregado (DPO) e revisão jurídica dos textos de consentimento e e-mail | | aberta |

## Decisões tomadas

| Data | Decisão |
| --- | --- |
| 2026-11-10 | Perfil **Parlamentar**: à parte da escala, um único usuário ativo, conta pessoal; opera e acompanha como Supervisor; na CEAP só consulta, sem ateste; não administra o sistema; a agenda do gabinete é a agenda dela |
| 2026-11-12 | **Drizzle** confirmado como acesso a dados (P3) |
| 2026-11-12 | Fluxo da despesa da CEAP **com** etapas pós-aprovação (Apresentada à Câmara, Ressarcida, Glosada) |
| 2026-11-12 | Chave primária **`bigint` com identidade** (ADR 0007). Nenhum identificador sequencial exposto ao cidadão |
| 2026-11-12 | Fase 0 aprovada; fase 1 implementada por inteiro |
| 2026-11-13 | Fase 3 implementada por inteiro (ver "Fase 3" acima) |
| 2026-11-13 | Demanda cancelada é **só de leitura**: sem comentário nem documento novo, e sem remover os existentes (ler e baixar seguem). Fase 3 aprovada para começar |

## Decisões abertas

Nenhuma decisão técnica aberta.

## Decisões adiadas

Nenhuma até o momento.
