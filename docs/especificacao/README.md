# Especificação

O que o sistema faz: visão, módulos, perfis, regras de negócio, requisitos, fluxos, segurança, CEAP e glossário.

**Estado:** rascunho da fase 0, para aprovação. Derivada da especificação do Mandatus, sem a parte multi-inquilino e de plataforma. A classificação documento a documento está em [../plano/classificacao-do-mandatus.md](../plano/classificacao-do-mandatus.md).

| Arquivo | Conteúdo | Validação pendente |
| --- | --- | --- |
| [01-visao-geral.md](01-visao-geral.md) | Finalidade, público, diferenças em relação ao Mandatus, fora de escopo | |
| [02-modulos.md](02-modulos.md) | 24 módulos, fase de cada um, relações, páginas | |
| [03-perfis-e-permissoes.md](03-perfis-e-permissoes.md) | Cinco perfis, decisor, matriz de operações | PV-C |
| [04-regras-de-negocio.md](04-regras-de-negocio.md) | Regras com identificador estável | |
| [05-requisitos.md](05-requisitos.md) | Requisitos não funcionais e suítes de verificação | |
| [06-fluxos-de-utilizacao.md](06-fluxos-de-utilizacao.md) | Dez fluxos, candidatos a roteiro de conferência | |
| [07-seguranca-e-lgpd.md](07-seguranca-e-lgpd.md) | Controles, melhorias sobre o Mandatus, LGPD | PV-F |
| [08-ceap.md](08-ceap.md) | CEAP configurável, segregação de função, fluxo da despesa | **PV-B** |
| [09-fluxos-de-trabalho.md](09-fluxos-de-trabalho.md) | Etapas federais de demanda, tarefa, projeto, emenda, despesa; vocabulários; parâmetros | **PV-A** |
| [10-notificacoes-e-consentimento.md](10-notificacoes-e-consentimento.md) | Notificação por e-mail, texto de consentimento, modelo de e-mail | Revisão jurídica |
| [11-glossario.md](11-glossario.md) | Termos | |

O modelo de dados está em [../arquitetura/modelo-de-dados.md](../arquitetura/modelo-de-dados.md).

## Convenções

- Cada regra tem um identificador estável (`RN-...`) para ser citado em testes, no progresso e nas decisões.
- Itens marcados **[novo]** não existiam no Mandatus ou mudaram.
- Valores da CEAP **não** estão fixados em nenhum documento: são parâmetros com vigência, conferidos na norma vigente.
