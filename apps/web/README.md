# @gabinete/web

SPA React da equipe do gabinete (React 19, Vite, React Router, TanStack Query). CSS escrito à mão, sem framework de estilos.

## Organização

| Pasta                                                                                                   | O que tem                                                                        |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/api/`                                                                                              | Cliente da API e consultas (TanStack Query)                                      |
| `src/acesso/`                                                                                           | Entrada, troca de senha, guardas de rota                                         |
| `src/layout/`                                                                                           | Estrutura da área interna: barra lateral (gaveta no celular) e cabeçalho         |
| `src/equipe/`, `fluxos/`, `auditoria/`, `configuracoes/`, `perfil/`, `painel/`, `demandas/`, `pessoas/` | Uma pasta por página (a ficha da demanda abre em gaveta, com link `?demanda=ID`) |
| `src/componentes/`                                                                                      | Botão, campo, aviso, selo, envio de foto                                         |
| `src/estilos/`                                                                                          | `tokens.css` (paleta e medidas), `base.css`, `componentes.css`, `paginas.css`    |
| `src/sistema/`                                                                                          | Catálogo do sistema de design, em `/sistema`                                     |

## Regras

- A **navegação vem do servidor**: a barra mostra só as `paginasAlcancaveis` da sessão, calculadas pelo mesmo decisor das rotas. O front nunca decide permissão por conta própria (os botões usam o mesmo pacote `@gabinete/autorizacao` só como dica de interface).
- Nenhuma informação depende só de cor; todo aviso começa com uma palavra ("Erro:", "Pronto:", "Atenção:").
- Datas sempre no fuso `America/Sao_Paulo` (`src/formatos.ts`).
- O contraste da paleta é medido por teste (`contraste.test.ts`).
- Em produção, a CSP do Caddy não permite scripts nem estilos em linha: nada de `<script>` ou `<style>` embutidos.

## Rodar

`npm run dev -w @gabinete/web` (o Vite encaminha `/api` para a API em `127.0.0.1:3000`). Build: `npm run build -w @gabinete/web`.
