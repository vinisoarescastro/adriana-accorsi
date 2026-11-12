# Classificação da especificação do Mandatus

Resultado do passo 1 da fase 0: o que cada documento da especificação do Mandatus vira neste projeto. Fonte: `C:\Users\Vinicius Soares\Documents\Repositórios\mandatus\docs\especificacao\` (somente leitura).

**Legenda:** mantém (aproveita quase como está) · adapta (aproveita com mudanças) · descarta (não se aplica a um único gabinete).

**Transparência sobre a leitura.** Li por inteiro `20-modelos-padrao` e `11-modelo-de-dados`, e li trechos de `21-fases-e-criterios-de-aceitacao`. Os demais foram classificados a partir da análise técnica e funcional do Mandatus (`docs/referencia/`) e dos títulos. Antes de cada fase, o documento correspondente deve ser relido para conferir requisito por requisito.

| Documento do Mandatus | Decisão | Destino neste projeto | Observação |
| --- | --- | --- | --- |
| 01 visão geral | adapta | `01-visao-geral.md` | Sem multi-inquilino e sem plataforma |
| 02 modelo multi-tenant | **descarta** | nenhum | Isolamento por gabinete não se aplica |
| 03 módulos e funcionalidades | adapta | `02-modulos.md` | Sem M01 (gabinetes), M02 (plataforma) e módulos contratáveis; CEAP no lugar de verba |
| 04 integração entre módulos | mantém | `02-modulos.md` (relações) | Mecanismo único de movimentação continua |
| 05 perfis de usuários | adapta | `03-perfis-e-permissoes.md` | Sem perfil de plataforma |
| 06 regras de negócio | adapta | `04-regras-de-negocio.md` | Regras de gabinete e de plataforma separadas; só as de gabinete seguem |
| 07 requisitos funcionais | adapta | `04` e `05` | Requisitos de plataforma (RF-A) descartados |
| 08 requisitos não funcionais | adapta | `05-requisitos.md` | RNF de isolamento por gabinete trocados por RNF de proteção sem política de linha |
| 09 histórias de usuário | adapta | A reescrever por fase | Só as de gabinete |
| 10 permissões e controle de acesso | adapta | `03` | Decisor sem os passos de escopo de plataforma e de gabinete ativo |
| 11 modelo de dados | adapta | `docs/arquitetura/modelo-de-dados.md` | Sem 9 globais; CEAP e notificação novas |
| 12 fluxos principais | adapta | `06-fluxos-de-utilizacao.md` | F01 (colocar gabinete no ar) descartado; fluxos de uso mantidos |
| 13 dashboards e indicadores | adapta | Fase 7 | Só indicadores de gabinete |
| 14 integrações externas | adapta | `07` e `10` | Entram e-mail e armazenamento; saem as de plataforma |
| 15 segurança | adapta | `07-seguranca-e-lgpd.md` | Melhorias sobre as fragilidades apontadas |
| 16 estrutura funcional | adapta | `02-modulos.md` | Páginas de gabinete; plataforma sai |
| 17 premissas e restrições | adapta | `01` | Premissas de venda e contratação saem |
| 18 decisões e pendências | adapta | `docs/plano/progresso.md` e ADRs | Reabrir cada decisão que mencione multi-inquilino |
| 19 glossário | adapta | `11-glossario.md` | |
| 20 modelos padrão | adapta | `09-fluxos-de-trabalho.md` | Só o conjunto federal; provisionamento por esfera descartado |
| 21 fases e critérios de aceite | adapta | `docs/plano/plano-de-implementacao.md` | Critérios reescritos por fase deste projeto |

## O que sai por inteiro

- Gabinetes como cliente: cadastro, módulos contratados, provisionamento, ciclo de vida (Em preparo, Ativo, Suspenso, Encerrado, Eliminado), eliminação.
- Operador da plataforma e suas 6 páginas (painel, gabinetes, usuários, suporte, auditoria, configurações).
- Acesso de suporte.
- Trilha da plataforma.
- Modelos padrão por esfera, conjuntos municipal e estadual.
- Política de linha por gabinete e os invariantes 1, 2, 3, 9, 10 e 12 do Mandatus.
- Verificações de isolamento entre gabinetes (V-01 a V-18 na parte de isolamento).

## O que entra de novo

- CEAP com parâmetros por vigência e apuração mensal.
- Segregação de função com exceção auditável.
- Notificação ao cidadão por e-mail com consentimento.
- Aplicação real da expiração do link público.
- Antivírus em documentos, CSP, limite por IP, segundo fator (fase 8).
