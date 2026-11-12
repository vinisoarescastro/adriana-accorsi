# 0006. Monorepo e domínios

- Estado: proposta
- Data: 2026-11-10

## Contexto

O sistema tem quatro aplicações (web, api, publico, worker) e código compartilhado. O domínio da aplicação é provisório (`dominio.nucleodedados.com`, para apresentar à deputada) e pode mudar.

## Decisão

- **Monorepo** com npm workspaces: `apps/` (web, api, publico, worker) e `packages/` (compartilhado, banco, autorizacao, config). A estrutura detalhada está no plano (seção 3). Pastas só existem quando têm arquivo.
- `apps/publico` **não importa** o pacote `banco` inteiro: só a camada de leitura da visão pública.
- **Domínios:** aplicação em `dominio.nucleodedados.com`; área pública em `acompanhe.dominio.nucleodedados.com`, em origem separada. O nome real do subdomínio é pendência (PV-E).
- Hostnames, URLs absolutas e domínio do cookie vêm **só de configuração** (`HOSTNAME_APP`, `HOSTNAME_PUBLICO`). Trocar o domínio é mudar variáveis de ambiente e o Caddyfile.
- Links de acompanhamento e e-mails usam o hostname configurado. Links já enviados com o domínio provisório deixam de funcionar se ele for abandonado: a troca definitiva deve ser feita **antes** de o sistema ser usado com cidadãos reais, ou manter o domínio antigo redirecionando por um período.

## Alternativas consideradas

- **Repositórios separados:** mais atrito para compartilhar schemas e tipos.
- **Mesmo hostname para app e público:** mistura cookie e política de segurança; descartado.
- **Caminhos `/app` e `/acompanhe` no mesmo domínio:** mesma objeção.

## Consequências

- O domínio provisório serve para **apresentar**; dados reais de cidadãos só entram depois do domínio definitivo.
- Certificados por host via Caddy (HTTP-01), sem necessidade de curinga.
