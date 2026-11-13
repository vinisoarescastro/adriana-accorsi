# Implantação na VPS

Estado: scripts e imagens **testados localmente** (construção das imagens, API em contêiner em modo produção, Caddy com a SPA, backup e restauração). **Ainda não foram executados numa VPS real**: isso depende de PV-E (acesso à VPS e ao DNS).

## O que roda

| Serviço | Imagem | Portas publicadas |
| --- | --- | --- |
| `caddy` | construída de `infra/docker/Dockerfile.caddy` (Caddy + a SPA já construída) | 80 e 443 |
| `api` | construída de `infra/docker/Dockerfile.api` | nenhuma |
| `postgres` | `postgres:17` | nenhuma |
| `publico` | construída de `infra/docker/Dockerfile.publico` | nenhuma (o Caddy fala com ele; `HOSTNAME_PUBLICO`) |
| `worker` | construída de `infra/docker/Dockerfile.worker` | nenhuma (só fala com o banco e com o provedor de e-mail) |
| `clamav` | `clamav/clamav` | nenhuma (a API fala com ele pela rede interna; `CLAMAV_HOST=clamav`) |

Só o Caddy aparece na internet. A API e o banco ficam na rede interna do compose. O app público e o worker não usam o mesmo arquivo de ambiente da API: recebem só o que precisam. Por isso o compose é chamado com `--env-file .env.producao` (os scripts já fazem isso).

## Antes da primeira vez

1. **DNS:** crie o registro `A` de `HOSTNAME_APP` apontando para o IP da VPS (ver [dominio-e-dns.md](dominio-e-dns.md)).
2. **Servidor:** Docker e Docker Compose instalados, portas 80 e 443 liberadas no firewall, mais nada além do SSH.
3. **Código:** clone o repositório no servidor.
4. **Segredos:** crie dois arquivos, com permissão 600, a partir dos modelos:
   - `.env.producao` (modelo `.env.producao.exemplo`): o que os serviços recebem.
   - `.env.administrativo` (modelo `.env.administrativo.exemplo`): a conexão administrativa, lida **só** pelo script de implantação. A API se recusa a subir se receber `DATABASE_URL_ADMIN` ou `DATABASE_URL_MIGRACAO`.
   Gere senhas longas e aleatórias (`openssl rand -base64 36`). As senhas dos papéis nos dois arquivos devem ser iguais.
5. **Armazenamento:** bucket privado no Cloudflare R2 e chaves de acesso (a titularidade da conta é a PV-E).

## Implantar ou atualizar

```
bash infra/scripts/implantar.sh
```

O script: constrói as imagens, sobe o banco, cria os papéis e aplica as migrações (com a conexão administrativa, que nenhum serviço recebe), sobe tudo e roda a verificação de saúde.

## Criar o primeiro administrador

```
docker compose -f compose.producao.yaml run --rm --no-deps \
  -e DATABASE_URL_API api \
  npm run banco:criar-administrador -- --email fulano@exemplo.com --nome "Nome Completo"
```

A senha inicial aparece **uma única vez** e vale 72 horas. A troca é obrigatória no primeiro acesso. O comando recusa rodar se já existir um administrador.

## Verificar a saúde

```
bash infra/scripts/verificar.sh
```

Confere: serviços de pé, `/api/saude`, validade do certificado, espaço em disco e idade do último backup. Sai com código 1 se algo estiver errado, então serve para o cron mandar e-mail ou para um monitor externo.

## Trocar o domínio

É só configuração: mude `HOSTNAME_APP` (e `HOSTNAME_PUBLICO`) em `.env.producao`, crie o DNS novo e rode `implantar.sh`. O Caddy obtém o certificado sozinho.

**Cuidado:** links de acompanhamento enviados ao cidadão com o domínio antigo deixam de funcionar. Faça a troca **antes** de usar o sistema com cidadãos reais (ver ADR 0006).

## Imagens publicadas pela CI

Em push para `main`, depois que os testes passam, a CI publica `api`, `publico`, `worker` e `caddy` no GHCR (`ghcr.io/<dono>/<repositório>/api:main` e `...:<hash do commit>`). Para usá-las em vez de construir no servidor, defina `IMAGEM_API`, `IMAGEM_PUBLICO`, `IMAGEM_WORKER` e `IMAGEM_CADDY` e use `docker compose pull`. A CI **ainda não rodou** (o diretório não é um repositório git).

## Área do cidadão e e-mail (fase 3)

1. **DNS:** crie o registro `A` de `HOSTNAME_PUBLICO` (por exemplo `acompanhe.dominio.nucleodedados.com`) para o IP da VPS. O Caddy emite o certificado sozinho.
2. **E-mail:** preencha `EMAIL_API_KEY` (Resend) e `EMAIL_REMETENTE` em `.env.producao` e configure **SPF, DKIM e DMARC** do domínio remetente **antes do primeiro envio real** (ver [dominio-e-dns.md](dominio-e-dns.md)). Comece com volume baixo (`LIMITE_EMAILS_POR_HORA`).
3. O Caddy **não registra log de acesso** do domínio público: o segredo do link vai no caminho da URL.
4. `verificar.sh` confere também `publico` e `worker`. Acompanhe a fila na tela **E-mails** (Supervisor em diante).

## Antivírus (fase 2)

A API **não sobe em produção sem `CLAMAV_HOST`**. O compose de produção já define o serviço `clamav`; reserve cerca de 1 GB de memória e espere alguns minutos na primeira subida (assinaturas). Sem o antivírus saudável, os envios de documentos são recusados (falha fechada).

## Limites conhecidos

- Servidor único: banco, API e proxy dividem a VPS. A proteção é o backup externo com restauração testada, não redundância.
- O Postgres está na etiqueta `17`: atualizações de segurança exigem recriar o contêiner de propósito.
- O monitoramento contínuo (alertas) é da fase 8. Hoje há o `verificar.sh`.
