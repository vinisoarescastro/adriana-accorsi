#!/usr/bin/env bash
# Restaura um backup EM UM BANCO NOVO e confere o resultado. Nunca sobrescreve o banco em uso.
#
# Uso: restaurar.sh <arquivo.dump.enc> [nome-do-banco-de-destino]
#   O destino padrão é "gabinete_restaurado". Se já existir, o script recusa (apague antes de propósito).
#
# Para voltar à produção a partir de um backup, restaure aqui, confira, e só então troque a aplicação
# para o banco restaurado (ver docs/operacao/backup-e-restauracao.md). Isso evita o pior erro de
# recuperação: apagar o que ainda funciona.
#
# Variáveis: BACKUP_SENHA (obrigatória), COMPOSE_ARQUIVO, SERVICO_POSTGRES, POSTGRES_USER, POSTGRES_DB.
set -euo pipefail

arquivo="${1:?Uso: restaurar.sh <arquivo.dump.enc> [banco-de-destino]}"
destino="${2:-gabinete_restaurado}"
: "${BACKUP_SENHA:?Defina BACKUP_SENHA (a mesma usada no backup).}"
COMPOSE="${COMPOSE_ARQUIVO:-compose.producao.yaml}"
SERVICO="${SERVICO_POSTGRES:-postgres}"
USUARIO="${POSTGRES_USER:-postgres}"
BANCO_EM_USO="${POSTGRES_DB:-gabinete}"

[ -f "$arquivo" ] || { echo "Arquivo não encontrado: $arquivo" >&2; exit 1; }
[[ "$destino" =~ ^[a-z_][a-z0-9_]*$ ]] || { echo "Nome de banco inválido: $destino" >&2; exit 1; }
[ "$destino" != "$BANCO_EM_USO" ] || { echo "RECUSADO: o destino é o banco em uso ($BANCO_EM_USO)." >&2; exit 1; }

psql_admin() { docker compose -f "$COMPOSE" exec -T "$SERVICO" psql -U "$USUARIO" -v ON_ERROR_STOP=1 -At "$@"; }

if [ "$(psql_admin -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$destino'")" = "1" ]; then
  echo "RECUSADO: o banco '$destino' já existe. Apague-o de propósito antes, se for o caso." >&2
  exit 1
fi

echo "Criando o banco '$destino'..."
psql_admin -d postgres -c "CREATE DATABASE $destino" >/dev/null

echo "Descriptografando e restaurando..."
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_SENHA -in "$arquivo" \
  | docker compose -f "$COMPOSE" exec -T "$SERVICO" pg_restore -U "$USUARIO" -d "$destino" --exit-on-error; then
  echo "FALHA na restauração (senha errada ou arquivo corrompido). Removendo o banco parcial." >&2
  psql_admin -d postgres -c "DROP DATABASE IF EXISTS $destino" >/dev/null
  exit 1
fi

echo "Conferindo o banco restaurado..."
tabelas="$(psql_admin -d "$destino" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")"
migracoes="$(psql_admin -d "$destino" -c "SELECT count(*) FROM migracao_aplicada")"
usuarios="$(psql_admin -d "$destino" -c "SELECT count(*) FROM usuario")"
trilha="$(psql_admin -d "$destino" -c "SELECT count(*) FROM trilha")"
admins="$(psql_admin -d "$destino" -c "SELECT count(*) FROM usuario WHERE perfil = 'administrador' AND situacao = 'ativo'")"

echo "  tabelas: $tabelas | migrações aplicadas: $migracoes | usuários: $usuarios | administradores ativos: $admins | registros na trilha: $trilha"

if [ "$tabelas" -lt 1 ] || [ "$migracoes" -lt 1 ]; then
  echo "FALHA: o banco restaurado parece vazio." >&2
  exit 1
fi
echo "OK: restauração concluída em '$destino'."
