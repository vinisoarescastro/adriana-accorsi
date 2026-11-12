#!/usr/bin/env bash
# Backup do banco: dump comprimido, CRIPTOGRAFADO, com rodízio local e envio opcional para fora da VPS.
#
# Variáveis:
#   BACKUP_SENHA          (obrigatória) senha de criptografia do arquivo. Guarde-a FORA da VPS.
#   BACKUP_PASTA          pasta dos backups (padrão: ./backups)
#   BACKUP_RETENCAO_DIAS  quantos dias manter localmente (padrão: 14)
#   BACKUP_DESTINO_RCLONE destino externo, por exemplo "r2:gabinete-backups" (opcional; usa rclone)
#   COMPOSE_ARQUIVO       arquivo do compose (padrão: compose.producao.yaml)
#   SERVICO_POSTGRES      serviço do Postgres no compose (padrão: postgres)
#   POSTGRES_USER, POSTGRES_DB  usuário administrativo e banco (padrão: postgres, gabinete)
#
# Para rodar todo dia, use o cron do servidor (ver docs/operacao/backup-e-restauracao.md).
set -euo pipefail

: "${BACKUP_SENHA:?Defina BACKUP_SENHA (senha de criptografia do backup).}"
PASTA="${BACKUP_PASTA:-./backups}"
RETENCAO="${BACKUP_RETENCAO_DIAS:-14}"
COMPOSE="${COMPOSE_ARQUIVO:-compose.producao.yaml}"
SERVICO="${SERVICO_POSTGRES:-postgres}"
USUARIO="${POSTGRES_USER:-postgres}"
BANCO="${POSTGRES_DB:-gabinete}"

mkdir -p "$PASTA"
carimbo="$(date +%Y%m%d-%H%M%S)"
arquivo="$PASTA/gabinete-$carimbo.dump.enc"
temporario="$arquivo.parcial"
trap 'rm -f "$temporario"' EXIT

echo "Gerando backup de '$BANCO'..."
# pg_dump em formato custom (já comprimido) -> criptografia AES-256 com derivação PBKDF2.
docker compose -f "$COMPOSE" exec -T "$SERVICO" pg_dump -U "$USUARIO" -d "$BANCO" -Fc \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_SENHA -out "$temporario"

# Um backup vazio não é backup.
if [ ! -s "$temporario" ] || [ "$(wc -c <"$temporario")" -lt 1024 ]; then
  echo "FALHA: o backup gerado está vazio ou pequeno demais." >&2
  exit 1
fi
mv "$temporario" "$arquivo"
trap - EXIT
echo "Backup gravado: $arquivo ($(wc -c <"$arquivo") bytes)"

if [ -n "${BACKUP_DESTINO_RCLONE:-}" ]; then
  echo "Enviando para fora da VPS: $BACKUP_DESTINO_RCLONE"
  rclone copy "$arquivo" "$BACKUP_DESTINO_RCLONE" --immutable
fi

# Rodízio local.
find "$PASTA" -maxdepth 1 -name 'gabinete-*.dump.enc' -mtime +"$RETENCAO" -print -delete | sed 's/^/Removido (antigo): /'
echo "$arquivo"
