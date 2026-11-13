#!/usr/bin/env bash
# Verificação de saúde da instalação. Sai com código 1 se algo estiver errado, para servir a um
# monitor (cron + e-mail, ou um serviço de monitoramento externo). Não altera nada.
#
# Variáveis: COMPOSE_ARQUIVO, HOSTNAME_APP (para checar HTTPS e o certificado), BACKUP_PASTA,
#            ALERTA_DISCO_PERCENTUAL (padrão 85), ALERTA_BACKUP_HORAS (padrão 30),
#            ALERTA_CERTIFICADO_DIAS (padrão 14).
set -uo pipefail

COMPOSE="${COMPOSE_ARQUIVO:-compose.producao.yaml}"
PASTA="${BACKUP_PASTA:-./backups}"
LIMITE_DISCO="${ALERTA_DISCO_PERCENTUAL:-85}"
LIMITE_BACKUP_H="${ALERTA_BACKUP_HORAS:-30}"
LIMITE_CERT_DIAS="${ALERTA_CERTIFICADO_DIAS:-14}"
falhas=0

ok() { echo "ok     $1"; }
falha() { echo "FALHOU $1"; falhas=$((falhas + 1)); }

# 1. Serviços de pé
ENV_COMPOSE=()
[ -f .env.producao ] && ENV_COMPOSE=(--env-file .env.producao)
for servico in postgres api publico worker caddy; do
  estado="$(docker compose "${ENV_COMPOSE[@]}" -f "$COMPOSE" ps --format '{{.State}}' "$servico" 2>/dev/null | head -1)"
  if [ "$estado" = "running" ]; then ok "serviço $servico em execução"; else falha "serviço $servico não está em execução (estado: ${estado:-desconhecido})"; fi
done

# 2. A API responde
if [ -n "${HOSTNAME_APP:-}" ]; then
  if [ "$(curl -s -o /dev/null -m 10 -w '%{http_code}' "https://$HOSTNAME_APP/api/saude")" = "200" ]; then
    ok "https://$HOSTNAME_APP/api/saude responde 200"
  else
    falha "https://$HOSTNAME_APP/api/saude não respondeu 200"
  fi

  # 3. Certificado
  fim="$(echo | openssl s_client -servername "$HOSTNAME_APP" -connect "$HOSTNAME_APP:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if [ -n "$fim" ]; then
    dias=$(( ( $(date -d "$fim" +%s) - $(date +%s) ) / 86400 ))
    if [ "$dias" -ge "$LIMITE_CERT_DIAS" ]; then ok "certificado vale mais $dias dias"; else falha "certificado vence em $dias dias"; fi
  else
    falha "não foi possível ler o certificado de $HOSTNAME_APP"
  fi
else
  echo "aviso  HOSTNAME_APP não definido: pulando a checagem de HTTPS e certificado"
fi

# 4. Disco
uso="$(df -P . | awk 'NR==2 {gsub("%",""); print $5}')"
if [ "${uso:-100}" -lt "$LIMITE_DISCO" ]; then ok "disco com ${uso}% de uso"; else falha "disco com ${uso}% de uso (limite ${LIMITE_DISCO}%)"; fi

# 5. Backup recente
ultimo="$(ls -t "$PASTA"/gabinete-*.dump.enc 2>/dev/null | head -1)"
if [ -n "$ultimo" ]; then
  idade_h=$(( ( $(date +%s) - $(date -r "$ultimo" +%s) ) / 3600 ))
  if [ "$idade_h" -le "$LIMITE_BACKUP_H" ]; then ok "último backup há ${idade_h} h"; else falha "último backup há ${idade_h} h (limite ${LIMITE_BACKUP_H} h)"; fi
else
  falha "nenhum backup encontrado em $PASTA"
fi

[ "$falhas" -eq 0 ] && echo "TUDO CERTO" || echo "$falhas problema(s) encontrado(s)"
exit $([ "$falhas" -eq 0 ] && echo 0 || echo 1)
