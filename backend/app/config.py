"""Caminhos e settings — tudo local no Mac."""
from __future__ import annotations

import os
from pathlib import Path

HOME = Path.home()
DEFAULT_ROOT = Path("/Users/axis/Dev/clipping4melocal/Documents")
ROOT_DIR = Path(os.environ.get("CLIPPING4ME_ROOT", DEFAULT_ROOT))
CORTES_DIR = ROOT_DIR / "Cortes"
JOBS_DIR = ROOT_DIR / "Jobs"          # work files por job (download, srt, mp4 originais)
CACHE_DIR = ROOT_DIR / "Cache"
STATE_FILE = ROOT_DIR / "jobs.json"

# Ollama
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")

# Whisper
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")  # tiny | base | small | medium | large

# Quantos cortes pedir ao LLM por padrão
MAX_CLIPS = int(os.environ.get("MAX_CLIPS", "8"))
CLIP_MIN_SEC = int(os.environ.get("CLIP_MIN_SEC", "30"))
CLIP_MAX_SEC = int(os.environ.get("CLIP_MAX_SEC", "90"))


def ensure_dirs() -> None:
    for d in (ROOT_DIR, CORTES_DIR, JOBS_DIR, CACHE_DIR):
        d.mkdir(parents=True, exist_ok=True)