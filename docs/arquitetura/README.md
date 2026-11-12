# Arquitetura

Como o sistema é construído e por quê.

| Documento | Conteúdo |
| --- | --- |
| [modelo-de-dados.md](modelo-de-dados.md) | Tabelas, restrições, gatilhos, visão pública, papéis de banco, invariantes de subida |
| [decisoes/](decisoes/) | Registros de decisão técnica (ADR), um arquivo por decisão |

A ser escrito durante a construção: `stack.md` (diagrama e versões), `seguranca.md` (modelo de ameaças) e `design-system.md` (fase 1).

## Visão geral

```
Navegador (equipe) ──> Caddy ──> api (Fastify) ──> PostgreSQL
                                   ▲  ▲               ▲
Navegador (cidadão) ──> Caddy ──> publico (Fastify)   │ (somente a visão pública)
                                                       │
                              worker (pg-boss) ────────┘  ──> e-mail (Resend)
                                                          ──> arquivos (R2)
```

Três processos de aplicação (`api`, `publico`, `worker`) e um banco, com papéis de banco distintos para cada um.
