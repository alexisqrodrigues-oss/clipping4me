"""Caminhos e settings — tudo local no Mac."""
from __future__ import annotations

import os
from pathlib import Path

HOME = Path.home()
DEFAULT_ROOT = HOME / "Clipping4me"
ROOT_DIR = Path(os.environ.get("CLIPPING4ME_ROOT", DEFAULT_ROOT))
CORTES_DIR = ROOT_DIR / "Cortes"
JOBS_DIR = ROOT_DIR / "Jobs"          # work files por job (download, srt, mp4 originais)
CACHE_DIR = ROOT_DIR / "Cache"
STATE_FILE = ROOT_DIR / "jobs.json"

# Ollama
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5-coder:7b")

# Frontend autorizado por padrão
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://clipping4.me")

# Whisper
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")  # tiny | base | small | medium | large
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "auto")  # auto | cpu | mps | cuda
WHISPER_LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "pt")

# Diarização (WhisperX + pyannote). Opt-in: requer HF_TOKEN e install extra.
USE_WHISPERX = os.environ.get("USE_WHISPERX", "false").lower() in ("1", "true", "yes")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
DIARIZE_MIN_SPEAKERS = int(os.environ.get("DIARIZE_MIN_SPEAKERS", "1"))
DIARIZE_MAX_SPEAKERS = int(os.environ.get("DIARIZE_MAX_SPEAKERS", "6"))

# Quantos cortes pedir ao LLM por padrão
MAX_CLIPS = int(os.environ.get("MAX_CLIPS", "8"))
CLIP_MIN_SEC = int(os.environ.get("CLIP_MIN_SEC", "30"))
CLIP_MAX_SEC = int(os.environ.get("CLIP_MAX_SEC", "90"))


def ensure_dirs() -> None:
    for d in (ROOT_DIR, CORTES_DIR, JOBS_DIR, CACHE_DIR):
        d.mkdir(parents=True, exist_ok=True)