#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

FRONTEND_URL="${CLIPPING4ME_FRONTEND_URL:-https://clipping4.me}"
BACKEND_PORT="${CLIPPING4ME_BACKEND_PORT:-8000}"
OLLAMA_MODEL="${CLIPPING4ME_OLLAMA_MODEL:-qwen2.5-coder:7b}"
CLOUDFLARE_TUNNEL_ENABLED="${CLIPPING4ME_ENABLE_CLOUDFLARE_TUNNEL:-1}"

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

update_project() {
  echo
  log "Atualizando projeto via git..."
  echo

  # Atualiza o projeto principal
  if [ -d "$SCRIPT_DIR/.git" ]; then
    cd "$SCRIPT_DIR"
    log "Buscando mudanças no projeto principal..."
    git fetch origin
    local local_branch
    local_branch=$(git rev-parse --abbrev-ref HEAD)
    git pull origin "$local_branch" || {
      err "Falha ao atualizar projeto principal."
      return 1
    }
    ok "Projeto principal atualizado."
  else
    warn "Repositório git não encontrado no projeto principal."
  fi

  # Atualiza o backend, se tiver repo próprio
  if [ -d "$SCRIPT_DIR/backend/.git" ]; then
    cd "$SCRIPT_DIR/backend"
    log "Buscando mudanças no backend..."
    git fetch origin
    local backend_branch
    backend_branch=$(git rev-parse --abbrev-ref HEAD)
    git pull origin "$backend_branch" || {
      err "Falha ao atualizar backend."
      return 1
    }
    ok "Backend atualizado."
  fi

  echo
  ok "Atualização concluída."
  echo
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
  if [ "$CLOUDFLARE_TUNNEL_ENABLED" != "1" ]; then
    printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
    return
  fi

  if [ ! -f "$HOME/.cloudflared/config.yml" ]; then
    warn "Config do Cloudflare Tunnel não encontrada em ~/.cloudflared/config.yml" >&2
    printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
    return
  fi

  # Garante que o cloudflared está rodando (daemon do sistema OU processo do usuário)
  if ! pgrep -x cloudflared >/dev/null 2>&1; then
    if command -v cloudflared >/dev/null 2>&1; then
      log "cloudflared não está rodando — subindo em background..." >&2
      nohup cloudflared --config "$HOME/.cloudflared/config.yml" tunnel run clipping4me-api \
        >/tmp/clipping4me-cloudflared.log 2>&1 &
      sleep 2
    else
      warn "cloudflared não instalado (brew install cloudflared)" >&2
      printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
      return
    fi
  fi

  # Confirma que o endpoint público responde antes de usá-lo
  if wait_for "https://api.clipping4.me/health" 15; then
    ok "Usando backend público em https://api.clipping4.me" >&2
    printf '%s' 'https://api.clipping4.me'
  else
    warn "https://api.clipping4.me/health não respondeu — caindo para local" >&2
    warn "Logs: /tmp/clipping4me-cloudflared.log" >&2
    printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
  fi
}

open_frontend() {
  local backend_url="$1"
  local final_url="$FRONTEND_URL?backend=$(urlencode "$backend_url")"
  log "Abrindo $final_url"
  open "$final_url" >/dev/null 2>&1 || true
}

show_menu() {
  echo
  log "Escolha uma opção:"
  echo
  echo "  1) Iniciar Clipping4Me"
  echo "  2) Atualizar projeto (git pull)"
  echo "  3) Sair"
  echo
}

run_app() {
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
}

# ============= MAIN =============

show_menu
read -r -p "Opção [1-3]: " choice

case "$choice" in
  1)
    echo
    log "Iniciando Clipping4Me..."
    echo
    run_app
    ;;
  2)
    update_project
    echo
    read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
    echo
    ;;
  3)
    log "Saindo."
    exit 0
    ;;
  *)
    err "Opção inválida."
    exit 1
    ;;
esac