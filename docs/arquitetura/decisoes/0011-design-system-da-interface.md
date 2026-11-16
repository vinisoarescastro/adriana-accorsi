# 0011. Design system da interface

- Estado: aceita
- Data: 2026-11-16

## Contexto

A interface nasceu com uma paleta provisória e componentes simples. O usuário pediu que a aplicação adote a linguagem visual de um design system de referência (projeto externo, só leitura): paleta azul com barra lateral em degradê, tipografia Poppins, escala de espaços, raios, sombras suaves, ícones e tema escuro.

## Decisão

- **Tokens como única fonte** (`apps/web/src/estilos/tokens.css`): cor, tipografia, espaço, raio, sombra, movimento e camadas, nos temas claro e escuro. Os nomes antigos (`--cor-*`, `--espaco-*`) continuam como apelidos dos novos, para nenhum estilo se perder.
- **Componentes mantêm os nomes de classe e a API** (`Botao`, `Campo`, `Aviso`, `Selo`...): a mudança é visual. Nenhuma tela, regra de negócio ou integração mudou.
- **Estrutura**: barra lateral em degradê com grupos (Principal, Sistema, Conta) e ícones (`lucide-react`), topo fixo com tema, sino de avisos e usuário, área de conteúdo com fundo discreto, gaveta abaixo do topo.
- **Tema escuro** com botão no topo, guardado no navegador (com `try/catch`: sem armazenamento, vale o do sistema).
- **Fonte própria, sem CDN.** A política de conteúdo do Caddy só aceita `self`. A Poppins vem do pacote `@fontsource/poppins`, empacotada pelo Vite no front e servida pelo próprio app público em `/fonte/<peso>.woff2` (a política dele ganhou `font-src 'self'`). Sem a fonte, vale a do sistema.
- **Contraste por teste, nos dois temas.** O teste de contraste agora lê os dois blocos do arquivo de tokens. Ele achou que o botão primário do tema escuro do design system (texto branco sobre `#3b82f6`) dá 3,7:1, abaixo dos 4,5:1 do AA; por isso os botões usam um azul próprio (`--btn-primary`, `#2563eb`) nos dois temas.
- **Avisos continuam sem depender de cor**: ganharam ícone, mas a palavra ("Erro:", "Pronto:", "Atenção:") segue na frente.

## Consequências

- Trocar a identidade (PV-D) é mexer nos tokens.
- Duas dependências novas no front: `lucide-react` e `@fontsource/poppins` (esta também no app público).
- O e-mail ao cidadão não foi alterado (HTML de e-mail tem as suas limitações); alinhar a ele fica para quando a identidade da Deputada chegar.
