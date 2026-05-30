#!/usr/bin/env bash
set -uo pipefail
# NOTA: não usamos -e. Queremos capturar erros e mostrar mensagem amigável,
# não fechar a janela do Terminal silenciosamente.

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

pause_and_exit() {
  local code="${1:-0}"
  echo
  read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
  echo
  exit "$code"
}

# Trap pra qualquer erro inesperado não derrubar a janela em silêncio
on_error() {
  local code=$?
  err "Algo deu errado (código $code) na linha $1."
  err "Veja os logs em /tmp/clipping4me-*.log para mais detalhes."
  pause_and_exit "$code"
}
trap 'on_error $LINENO' ERR

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
  log "Verificando Ollama..."
  if ! command -v ollama >/dev/null 2>&1; then
    err "Ollama NÃO está instalado."
    err "Para instalar: brew install ollama"
    return 1
  fi

  if curl -sf "http://localhost:11434/api/tags" >/dev/null 2>&1; then
    ok "Ollama já está rodando."
  else
    log "Subindo Ollama em background..."
    nohup ollama serve >/tmp/clipping4me-ollama.log 2>&1 &
    if wait_for "http://localhost:11434/api/tags" 20; then
      ok "Ollama no ar."
    else
      err "Ollama não respondeu em 20s."
      err "Logs: /tmp/clipping4me-ollama.log"
      tail -n 20 /tmp/clipping4me-ollama.log 2>/dev/null || true
      return 1
    fi
  fi

  if ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -q "^${OLLAMA_MODEL}$"; then
    ok "Modelo ${OLLAMA_MODEL} disponível."
  else
    log "Baixando modelo ${OLLAMA_MODEL} (primeira vez pode demorar)..."
    if ollama pull "$OLLAMA_MODEL"; then
      ok "Modelo ${OLLAMA_MODEL} pronto."
    else
      err "Falha ao baixar modelo ${OLLAMA_MODEL}."
      return 1
    fi
  fi
}

ensure_backend() {
  log "Verificando backend..."
  if [ ! -f "backend/run.sh" ]; then
    err "backend/run.sh NÃO encontrado em $SCRIPT_DIR/backend"
    err "Você está rodando o .command na pasta correta do projeto?"
    return 1
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
    err "Backend não subiu em 120s."
    err "Últimas linhas do log (/tmp/clipping4me-backend.log):"
    echo "----------------------------------------"
    tail -n 40 /tmp/clipping4me-backend.log 2>/dev/null || echo "(log vazio)"
    echo "----------------------------------------"
    return 1
  fi
}

ensure_public_backend() {
  if [ "$CLOUDFLARE_TUNNEL_ENABLED" != "1" ]; then
    printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
    return
  fi

  if [ ! -f "$HOME/.cloudflared/config.yml" ]; then
    warn "Config do Cloudflare Tunnel não encontrada em ~/.cloudflared/config.yml" >&2
    warn "Usando backend local em vez do túnel público." >&2
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
      warn "cloudflared NÃO instalado. Instale com: brew install cloudflared" >&2
      warn "Usando backend local em vez do túnel público." >&2
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
    if [ -f /tmp/clipping4me-cloudflared.log ]; then
      echo "---- últimas linhas do cloudflared ----" >&2
      tail -n 15 /tmp/clipping4me-cloudflared.log >&2 2>/dev/null || true
      echo "----------------------------------------" >&2
    fi
    printf 'http://127.0.0.1:%s' "$BACKEND_PORT"
  fi
}

open_frontend() {
  local backend_url="$1"
  local final_url="$FRONTEND_URL?backend=$(urlencode "$backend_url")"
  log "Abrindo $final_url"
  open "$final_url" >/dev/null 2>&1 || true
}

diagnose() {
  echo
  log "===== DIAGNÓSTICO ====="
  echo

  # Ollama
  if command -v ollama >/dev/null 2>&1; then
    ok "Ollama instalado ($(command -v ollama))"
    if curl -sf "http://localhost:11434/api/tags" >/dev/null 2>&1; then
      ok "Ollama rodando em http://localhost:11434"
      if ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -q "^${OLLAMA_MODEL}$"; then
        ok "Modelo ${OLLAMA_MODEL} disponível"
      else
        warn "Modelo ${OLLAMA_MODEL} NÃO baixado"
      fi
    else
      err "Ollama NÃO está rodando"
    fi
  else
    err "Ollama NÃO instalado (brew install ollama)"
  fi
  echo

  # Backend local
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
    ok "Backend local respondendo em http://127.0.0.1:${BACKEND_PORT}/health"
  else
    err "Backend local NÃO responde em http://127.0.0.1:${BACKEND_PORT}/health"
    if [ -f /tmp/clipping4me-backend.log ]; then
      warn "Últimas linhas de /tmp/clipping4me-backend.log:"
      echo "----------------------------------------"
      tail -n 20 /tmp/clipping4me-backend.log 2>/dev/null || true
      echo "----------------------------------------"
    else
      warn "Nenhum log de backend em /tmp/clipping4me-backend.log"
    fi
  fi
  echo

  # cloudflared
  if command -v cloudflared >/dev/null 2>&1; then
    ok "cloudflared instalado ($(command -v cloudflared))"
    if pgrep -x cloudflared >/dev/null 2>&1; then
      ok "Processo cloudflared rodando (PID $(pgrep -x cloudflared | tr '\n' ' '))"
    else
      err "Processo cloudflared NÃO está rodando"
    fi
    if [ -f "$HOME/.cloudflared/config.yml" ]; then
      ok "Config encontrada em ~/.cloudflared/config.yml"
    else
      err "Config NÃO encontrada em ~/.cloudflared/config.yml"
    fi
  else
    warn "cloudflared NÃO instalado (brew install cloudflared)"
  fi
  echo

  # Endpoint público
  if curl -sfm 5 "https://api.clipping4.me/health" >/dev/null 2>&1; then
    ok "https://api.clipping4.me/health respondendo"
  else
    err "https://api.clipping4.me/health NÃO responde"
    err "Sem isso, o site clipping4.me não consegue falar com seu backend."
  fi
  echo

  log "===== FIM DO DIAGNÓSTICO ====="
}

stop_all() {
  echo
  log "Parando serviços..."
  if pgrep -f "backend/run.sh" >/dev/null 2>&1; then
    pkill -f "backend/run.sh" 2>/dev/null || true
    ok "Backend parado."
  else
    warn "Backend não estava rodando."
  fi
  if pgrep -f "uvicorn.*app.main" >/dev/null 2>&1; then
    pkill -f "uvicorn.*app.main" 2>/dev/null || true
    ok "uvicorn parado."
  fi
  if pgrep -x cloudflared >/dev/null 2>&1; then
    pkill -x cloudflared 2>/dev/null || true
    ok "cloudflared parado."
  else
    warn "cloudflared não estava rodando."
  fi
  if pgrep -x ollama >/dev/null 2>&1; then
    pkill -x ollama 2>/dev/null || true
    ok "Ollama parado."
  else
    warn "Ollama não estava rodando."
  fi
  echo
}

show_menu() {
  echo
  log "Escolha uma opção:"
  echo
  echo "  1) Iniciar Clipping4Me"
  echo "  2) Atualizar projeto (git pull)"
  echo "  3) Diagnóstico (ver o que está/não está rodando)"
  echo "  4) Parar todos os serviços"
  echo "  5) Sair"
  echo
}

run_app() {
  ensure_ollama   || { err "Falhou ao subir Ollama. Abortando."; return 1; }
  ensure_backend  || { err "Falhou ao subir Backend. Abortando."; return 1; }
  PUBLIC_BACKEND_URL="$(ensure_public_backend)"
  open_frontend "$PUBLIC_BACKEND_URL"

  echo
  ok "Tudo pronto."
  log "Backend: $PUBLIC_BACKEND_URL"
  log "Logs backend: /tmp/clipping4me-backend.log"
  log "Logs Ollama: /tmp/clipping4me-ollama.log"
  log "Logs cloudflared: /tmp/clipping4me-cloudflared.log"
}

# ============= MAIN =============

while true; do
  show_menu
  read -r -p "Opção [1-5]: " choice
  case "$choice" in
    1)
      echo
      log "Iniciando Clipping4Me..."
      echo
      if run_app; then
        ok "OK."
      else
        err "Inicialização falhou. Rode a opção 3 (Diagnóstico) para ver detalhes."
      fi
      ;;
    2)
      update_project || err "Falha ao atualizar."
      ;;
    3)
      diagnose
      ;;
    4)
      stop_all
      ;;
    5)
      log "Saindo."
      exit 0
      ;;
    *)
      err "Opção inválida."
      ;;
  esac
  echo
  read -n 1 -s -r -p "Pressione qualquer tecla para voltar ao menu..."
  echo
done