"""Transcrição com openai-whisper (pure Python, sem whisper.cpp).

Por que openai-whisper e não whisper.cpp?
- Não precisa compilar nada.
- Roda em GPU (MPS) no Mac Apple Silicon via PyTorch.
- Devolve segments com timestamps prontos.

Se quiser trocar por whisper.cpp depois, basta substituir a função abaixo.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, TypedDict

from .config import WHISPER_MODEL

_model = None


class Segment(TypedDict):
    start: float
    end: float
    text: str


def _load():
    global _model
    if _model is None:
        import whisper  # lazy import (pesado)
        _model = whisper.load_model(WHISPER_MODEL)
    return _model


def transcribe(audio_path: Path, language: str | None = "pt") -> List[Segment]:
    model = _load()
    result = model.transcribe(
        str(audio_path),
        language=language,
        verbose=False,
        fp16=False,  # mais estável em CPU/MPS
    )
    return [
        {"start": float(s["start"]), "end": float(s["end"]), "text": s["text"].strip()}
        for s in result["segments"]
    ]


def parse_srt(srt_path: Path) -> List[Segment]:
    """Parser SRT simples (sem libs externas)."""
    raw = srt_path.read_text(encoding="utf-8", errors="ignore")
    segments: List[Segment] = []
    for block in raw.strip().split("\n\n"):
        lines = [l for l in block.splitlines() if l.strip()]
        if len(lines) < 2:
            continue
        # primeira linha = índice, segunda = "00:00:01,000 --> 00:00:04,000"
        timing_line = lines[1] if "-->" in lines[1] else lines[0]
        if "-->" not in timing_line:
            continue
        try:
            start_s, end_s = [_srt_time_to_s(t.strip()) for t in timing_line.split("-->")]
        except ValueError:
            continue
        text = " ".join(lines[2:]) if "-->" in lines[1] else " ".join(lines[1:])
        segments.append({"start": start_s, "end": end_s, "text": text.strip()})
    return segments


def _srt_time_to_s(t: str) -> float:
    # 00:00:01,000  ou  00:00:01.000
    t = t.replace(",", ".")
    h, m, s = t.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)