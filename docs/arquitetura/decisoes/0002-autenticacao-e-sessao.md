# 0002. Autenticação e sessão

- Estado: proposta
- Data: 2026-11-10

## Contexto

O Mandatus usa sessão com ticket no servidor, cookie `SameSite=Strict` e Argon2id, e a análise dele valorizou poder derrubar a sessão de um usuário no ato (mudança de perfil, habilitação, situação ou senha).

## Decisão

- Login por e-mail e senha. Senha com Argon2id.
- Sessão com **ticket opaco** guardado na tabela `sessao`; o cookie só carrega o identificador do ticket.
- Cookie `HttpOnly`, `SameSite=Strict`, `Secure` fora de desenvolvimento, sem expiração deslizante além das regras: 5 horas de inatividade e 12 horas absolutas.
- Perfil e habilitações ficam **fixados** na sessão e são revalidados quando mudam: mudar perfil, habilitação, situação ou senha encerra as sessões do usuário.
- Bloqueio de 5 falhas por 15 minutos e atraso crescente; limite de requisições por IP no login.
- Mesma mensagem e mesmo tempo para e-mail inexistente e senha errada.
- O front e a API ficam na **mesma origem**; a área pública em outra origem, sem cookie.
- Segundo fator (TOTP) para Administrador e Chefe na fase 8.

## Alternativas consideradas

- **JWT sem estado:** não permite derrubar sessão no ato sem lista de revogação; descartado.
- **Cookie assinado com dados da sessão:** mesma limitação.
- **Provedor de identidade externo (OIDC):** peso desnecessário para um gabinete; reavaliar se houver necessidade de login único.

## Consequências

- Uma consulta de sessão por requisição (aceitável no volume); pode usar cache curto com invalidação.
- Sem CSRF por token: a defesa é `SameSite=Strict` mais verificação de origem. Rotas de envio de arquivo seguem a mesma regra e devem ser testadas.
- Trocar de domínio exige apenas configuração do hostname do cookie.
