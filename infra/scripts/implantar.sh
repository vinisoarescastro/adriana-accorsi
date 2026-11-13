#!/usr/bin/env bash
# Implanta (ou atualiza) a aplicação na VPS. Rode na raiz do repositório, no servidor.
#
# Antes da primeira vez: crie .env.producao e .env.administrativo (modelos: *.exemplo) com
# permissão 600. Depois: bash infra/scripts/implantar.sh
#
# Passos: constrói as imagens, sobe o banco, cria os papéis e aplica as migrações (com a conexão
# administrativa, que nenhum serviço recebe), sobe os serviços e confere a saúde.
set -euo pipefail
cd "$(dirname "$0")/../.."

COMPOSE="compose.producao.yaml"
# A interpolação das variáveis do compose vem de .env.producao.
dc() { docker compose --env-file .env.producao -f "$COMPOSE" "$@"; }
[ -f .env.producao ] || { echo "Falta .env.producao (modelo: .env.producao.exemplo)." >&2; exit 1; }
[ -f .env.administrativo ] || { echo "Falta .env.administrativo (modelo: .env.administrativo.exemplo)." >&2; exit 1; }
if grep -q "TROQUE" .env.producao .env.administrativo; then
  echo "Ainda há valores TROQUE-... nos arquivos de ambiente. Preencha-os." >&2
  exit 1
fi

echo "1/5 Construindo as imagens..."
dc build

echo "2/5 Subindo o banco..."
dc up -d postgres
for _ in $(seq 1 60); do
  [ "$(dc ps --format '{{.Health}}' postgres | head -1)" = "healthy" ] && break
  sleep 2
done

echo "3/5 Criando os papéis e aplicando as migrações..."
# A conexão administrativa é passada só a este contêiner de uso único.
dc run --rm --no-deps --env-file .env.administrativo \
  -e DATABASE_URL_ADMIN -e DATABASE_URL_MIGRACAO -e DATABASE_URL_API -e DATABASE_URL_WORKER -e DATABASE_URL_PUBLICO \
  api npm run banco:preparar

echo "4/5 Subindo os serviços..."
dc up -d

echo "5/5 Conferindo..."
sleep 5
set -a; . ./.env.producao; set +a
bash infra/scripts/verificar.sh || echo "ATENÇÃO: a verificação apontou problemas (veja acima). Pode ser só o primeiro backup ainda não feito."
