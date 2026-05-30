#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

FRONTEND_URL="${CLIPPING4ME_FRONTEND_URL:-https://clipping4me.lovable.app}"
BACKEND_PORT="${CLIPPING4ME_BACKEND_PORT:-8000}"
OLLAMA_MODEL="${CLIPPING4ME_OLLAMA_MODEL:-qwen2.5-coder:7b}"
TAILSCALE_ENABLED="${CLIPPING4ME_ENABLE_TAILSCALE:-1}"

log()  { printf "\033[1;36m[clipping4me]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ok]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[!]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[erro]\033[0m %s\n" "$*"; }

wait_for() {
  local url="$1" max="$2" i=0
  while [ "$i" -lt "$max" ]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

urlencode() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import quote

print(quote(sys.argv[1], safe=''))
PY
}

ensure_ollama() {
  if ! command -v ollama >/dev/null 2>&1; then
    err "Ollama não está instalado. Instale com: brew install ollama"
    exit 1
  fi

  if curl -sf "http://localhost:11434/api/tags" >/dev/null 2>&1; then
    ok "Ollama já está rodando."
  else
    log "Subindo Ollama em background..."
    nohup ollama serve >/tmp/clipping4me-ollama.log 2>&1 &
    if wait_for "http://localhost:11434/api/tags" 20; then
      ok "Ollama no ar."
    else
      err "Ollama não respondeu em 20s. Veja /tmp/clipping4me-ollama.log"
      exit 1
    fi
  fi

  if ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -q "^${OLLAMA_MODEL}$"; then
    ok "Modelo ${OLLAMA_MODEL} disponível."
  else
    log "Baixando modelo ${OLLAMA_MODEL} (primeira vez pode demorar)..."
    ollama pull "$OLLAMA_MODEL"
    ok "Modelo ${OLLAMA_MODEL} pronto."
  fi
}

ensure_backend() {
  if [ ! -f "backend/run.sh" ]; then
    err "backend/run.sh não encontrado em $SCRIPT_DIR"
    exit 1
  fi

  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    ok "Backend já está rodando na porta ${BACKEND_PORT}."
    return
  fi

  log "Iniciando backend (logs em /tmp/clipping4me-backend.log)..."
  nohup env CLIPPING4ME_RELOAD=0 CLIPPING4ME_BACKEND_PORT="$BACKEND_PORT" bash "$SCRIPT_DIR/backend/run.sh" >/tmp/clipping4me-backend.log 2>&1 &

  if wait_for "http://127.0.0.1:${BACKEND_PORT}/health" 120; then
    ok "Backend no ar em http://127.0.0.1:${BACKEND_PORT}"
  else
    err "Backend não subiu em 120s. Veja /tmp/clipping4me-backend.log"
    tail -n 40 /tmp/clipping4me-backend.log || true
    exit 1
  fi
}

ensure_public_backend() {
  if [ "$TAILSCALE_ENABLED" != "1" ]; then
    printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
    return
  fi

  if ! command -v tailscale >/dev/null 2>&1; then
    warn "Tailscale não está instalado; abrindo sem URL pública configurada."
    printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
    return
  fi

  if ! tailscale status >/dev/null 2>&1; then
    warn "Tailscale não está conectado; use 'tailscale login' e rode novamente se quiser acesso HTTPS público."
    printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
    return
  fi

  log "Configurando Tailscale Serve + Funnel para o backend..."
  sudo tailscale serve --bg --https=443 "http://127.0.0.1:${BACKEND_PORT}" >/tmp/clipping4me-tailscale.log 2>&1 || true
  sudo tailscale funnel --bg 443 >>/tmp/clipping4me-tailscale.log 2>&1 || true

  local public_url
  public_url="$(tailscale funnel status 2>/dev/null | grep -Eo 'https://[^ ]+\.ts\.net' | head -n1 || true)"
  if [ -n "$public_url" ]; then
    ok "URL pública do backend: $public_url"
    printf '%s' "$public_url"
    return
  fi

  warn "Não consegui detectar a URL pública do Tailscale. Veja /tmp/clipping4me-tailscale.log"
  printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
}

open_frontend() {
  local backend_url="$1"
  local final_url="$FRONTEND_URL?backend=$(urlencode "$backend_url")"
  log "Abrindo $final_url"
  open "$final_url" >/dev/null 2>&1 || true
}

echo
log "Iniciando Clipping4Me..."
echo

ensure_ollama
ensure_backend
PUBLIC_BACKEND_URL="$(ensure_public_backend)"
open_frontend "$PUBLIC_BACKEND_URL"

echo
ok "Tudo pronto."
log "Backend: $PUBLIC_BACKEND_URL"
log "Logs backend: /tmp/clipping4me-backend.log"
log "Logs Ollama: /tmp/clipping4me-ollama.log"
echo
read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
echo