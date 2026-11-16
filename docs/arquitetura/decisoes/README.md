# Decisões técnicas (ADR)

Cada decisão relevante vira um arquivo `NNNN-titulo-curto.md`, numerado em sequência. Uma decisão não é apagada: se mudar, cria-se outra que a substitui e a antiga fica marcada como substituída.

## Índice

| Nº | Decisão | Estado |
| --- | --- | --- |
| [0001](0001-stack.md) | Stack do projeto | aceita |
| [0002](0002-autenticacao-e-sessao.md) | Autenticação e sessão | proposta |
| [0003](0003-autorizacao.md) | Autorização | proposta |
| [0004](0004-fila-e-outbox.md) | Fila de tarefas e padrão outbox | proposta |
| [0005](0005-estrategia-de-testes.md) | Estratégia de testes | proposta |
| [0006](0006-monorepo-e-dominios.md) | Monorepo e domínios | proposta |
| [0007](0007-chave-primaria.md) | Chave primária das tabelas | aceita |
| [0008](0008-documentos-link-e-antivirus.md) | Documentos, segredo do link e antivírus | aceita |
| [0009](0009-area-publica-e-envio-de-email.md) | Área pública, projeção em visões e envio de e-mail | aceita |
| [0010](0010-trabalho-da-equipe-avisos-e-agenda.md) | Trabalho da equipe: avisos, worker de prazos e visibilidade da agenda | aceita |
| [0011](0011-design-system-da-interface.md) | Design system da interface | aceita |

## Modelo

```markdown
# NNNN. Título

- Estado: proposta | aceita | substituída por NNNN
- Data: AAAA-MM-DD

## Contexto
Qual problema ou necessidade motivou a decisão.

## Decisão
O que foi decidido.

## Alternativas consideradas
O que mais se avaliou e por que não foi escolhido.

## Consequências
O que isso facilita, o que custa, o que passa a ser obrigatório.
```
