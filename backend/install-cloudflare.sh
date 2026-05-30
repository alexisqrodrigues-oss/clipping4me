#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${CLIPPING4ME_DOMAIN:-clipping4.me}"
API_HOSTNAME="${CLIPPING4ME_API_HOSTNAME:-api.${DOMAIN}}"
TUNNEL_NAME="${CLIPPING4ME_CLOUDFLARE_TUNNEL_NAME:-clipping4me-api}"
LOCAL_PORT="${CLIPPING4ME_BACKEND_PORT:-8000}"
CF_DIR="$HOME/.cloudflared"

log() { printf "\033[1;36m[cloudflare]\033[0m %s\n" "$*"; }
err() { printf "\033[1;31m[erro]\033[0m %s\n" "$*" >&2; }

if ! command -v cloudflared >/dev/null 2>&1; then
  err "cloudflared não encontrado. Instale com: brew install cloudflared"
  exit 1
fi

mkdir -p "$CF_DIR"

if [ ! -f "$CF_DIR/cert.pem" ]; then
  log "Abrindo login do Cloudflare no navegador..."
  cloudflared tunnel login
fi

if ! cloudflared tunnel list 2>/dev/null | awk 'NR>1 {print $2}' | grep -qx "$TUNNEL_NAME"; then
  log "Criando tunnel $TUNNEL_NAME..."
  cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID="$(cloudflared tunnel list 2>/dev/null | awk -v name="$TUNNEL_NAME" 'NR>1 && $2==name {print $1; exit}')"

if [ -z "$TUNNEL_ID" ]; then
  err "Não consegui localizar o tunnel $TUNNEL_NAME"
  exit 1
fi

CREDENTIALS_FILE="$CF_DIR/${TUNNEL_ID}.json"
if [ ! -f "$CREDENTIALS_FILE" ]; then
  err "Credencial do tunnel não encontrada em $CREDENTIALS_FILE"
  exit 1
fi

log "Apontando DNS ${API_HOSTNAME} para o tunnel..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$API_HOSTNAME"

cat > "$CF_DIR/config.yml" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CREDENTIALS_FILE}

ingress:
  - hostname: ${API_HOSTNAME}
    service: http://127.0.0.1:${LOCAL_PORT}
  - service: http_status:404
EOF

log "Instalando serviço do Cloudflare Tunnel..."
sudo cloudflared service install

printf '\nPronto. Backend público esperado: https://%s\n' "$API_HOSTNAME"
printf 'Agora rode: bash run.sh\n\n'