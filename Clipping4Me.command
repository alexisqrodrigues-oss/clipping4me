#!/usr/bin/env bash
# One-click launcher do Clipping4Me.
# Basta dar duplo-clique neste arquivo no Finder.
# (Se o Mac pedir, clique-direito → Abrir → Abrir, na primeira vez.)

set -u

# Garante que o Terminal abra na pasta do script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

FRONTEND_URL="${CLIPPING4ME_FRONTEND_URL:-https://clipping4me.lovable.app}"
BACKEND_PORT="${CLIPPING4ME_BACKEND_PORT:-8000}"
OLLAMA_MODEL="${CLIPPING4ME_OLLAMA_MODEL:-llama3.1}"

log()  { printf "\033[1;36m[clipping4me]\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m[ok]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[!]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[erro]\033[0m %s\n" "$*"; }

wait_for() {
  # wait_for <url> <segundos>
  local url="$1" max="$2" i=0
  while [ $i -lt "$max" ]; do
    if curl -sf "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1; i=$((i+1))
  done
  return 1
}

echo
log "Iniciando Clipping4Me..."
echo

# ---------- 1. Ollama ----------
if ! command -v ollama >/dev/null 2>&1; then
  err "Ollama não está instalado. Instale com:  brew install ollama"
  echo
  read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
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
    read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
    exit 1
  fi
fi

# Garante o modelo
if ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -q "^${OLLAMA_MODEL}"; then
  ok "Modelo ${OLLAMA_MODEL} disponível."
else
  log "Baixando modelo ${OLLAMA_MODEL} (pode demorar na primeira vez)..."
  if ! ollama pull "$OLLAMA_MODEL"; then
    err "Falha ao baixar ${OLLAMA_MODEL}."
    read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
    exit 1
  fi
fi

# ---------- 2. Backend ----------
if curl -sf "http://localhost:${BACKEND_PORT}/health" >/dev/null 2>&1; then
  ok "Backend já está rodando na porta ${BACKEND_PORT}."
else
  if [ ! -x "backend/run.sh" ]; then
    err "backend/run.sh não encontrado em $SCRIPT_DIR"
    read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
    exit 1
  fi
  log "Iniciando backend (logs em /tmp/clipping4me-backend.log)..."
  nohup bash backend/run.sh >/tmp/clipping4me-backend.log 2>&1 &
  if wait_for "http://localhost:${BACKEND_PORT}/health" 90; then
    ok "Backend no ar em http://localhost:${BACKEND_PORT}"
  else
    err "Backend não subiu em 90s. Veja /tmp/clipping4me-backend.log"
    tail -n 30 /tmp/clipping4me-backend.log || true
    read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
    exit 1
  fi
fi

# ---------- 3. Tailscale (opcional) ----------
if command -v tailscale >/dev/null 2>&1; then
  PUBLIC_URL="$(tailscale funnel status 2>/dev/null | grep -Eo 'https://[^ ]+\.ts\.net' | head -n1 || true)"
  if [ -n "${PUBLIC_URL:-}" ]; then
    ok "URL pública: $PUBLIC_URL"
  fi
fi

# ---------- 4. Abre a UI ----------
log "Abrindo $FRONTEND_URL..."
open "$FRONTEND_URL" >/dev/null 2>&1 || true

echo
ok "Tudo pronto. Pode fechar esta janela."
echo
log "Para parar tudo:  pkill -f uvicorn ; pkill -f 'ollama serve'"
echo
read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
echo