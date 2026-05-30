#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PYTHON_BIN=""
for candidate in \
  "/opt/homebrew/opt/python@3.11/bin/python3.11" \
  "/usr/local/opt/python@3.11/bin/python3.11" \
  "python3.11" \
  "python3"
do
  if [ -x "$candidate" ]; then
    PYTHON_BIN="$candidate"
    break
  fi
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v "$candidate")"
    break
  fi
done

if [ -z "$PYTHON_BIN" ]; then
  echo "Python 3.11 não encontrado. Instale com: brew install python@3.11" >&2
  exit 1
fi

PYTHON_VERSION="$($PYTHON_BIN -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
case "$PYTHON_VERSION" in
  3.10|3.11|3.12) ;;
  *)
    echo "Python $PYTHON_VERSION detectado. Use Python 3.11 para evitar falha ao instalar o Whisper." >&2
    exit 1
    ;;
esac

if [ ! -d ".venv" ]; then
  "$PYTHON_BIN" -m venv .venv
fi
source .venv/bin/activate

python -m pip install -q --upgrade pip "setuptools<81" wheel
python -m pip install -q --no-build-isolation -r requirements.txt

exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload