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

from .config import (
    DIARIZE_MAX_SPEAKERS,
    DIARIZE_MIN_SPEAKERS,
    HF_TOKEN,
    USE_WHISPERX,
    WHISPER_DEVICE,
    WHISPER_LANGUAGE,
    WHISPER_MODEL,
)

_model = None
_whisperx_model = None
_align_model = None
_diarize_model = None


class Segment(TypedDict):
    start: float
    end: float
    text: str
    speaker: str | None


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
        {"start": float(s["start"]), "end": float(s["end"]), "text": s["text"].strip(), "speaker": None}
        for s in result["segments"]
    ]


def _pick_device() -> str:
    if WHISPER_DEVICE != "auto":
        return WHISPER_DEVICE
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def transcribe_diarized(audio_path: Path, language: str | None = None) -> List[Segment]:
    """Transcrição com diarização via WhisperX (opt-in).

    Requer: `pip install -r requirements.txt` (inclui whisperx/pyannote) +
    HF_TOKEN no .env + aceitar termos em
    huggingface.co/pyannote/speaker-diarization-3.1.

    Se USE_WHISPERX=false ou HF_TOKEN vazio, cai pro whisper normal (sem speakers).
    """
    if not USE_WHISPERX:
        return transcribe(audio_path, language=language or WHISPER_LANGUAGE)
    if not HF_TOKEN:
        # sem token não dá pra rodar pyannote; faz só transcrição
        return transcribe(audio_path, language=language or WHISPER_LANGUAGE)

    global _whisperx_model, _align_model, _diarize_model
    try:
        import whisperx  # type: ignore
    except ImportError as e:
        raise RuntimeError(
            "WhisperX não instalado. Rode: pip install -r backend/requirements.txt"
        ) from e

    device = _pick_device()
    # whisperx usa float16 em GPU, float32 em CPU/MPS
    compute_type = "float16" if device == "cuda" else "int8"
    lang = language or WHISPER_LANGUAGE

    if _whisperx_model is None:
        _whisperx_model = whisperx.load_model(
            WHISPER_MODEL, device, compute_type=compute_type, language=lang
        )
    audio = whisperx.load_audio(str(audio_path))
    result = _whisperx_model.transcribe(audio, batch_size=8, language=lang)

    # alinhamento (timestamps por palavra)
    if _align_model is None:
        _align_model = whisperx.load_align_model(language_code=lang, device=device)
    aligned = whisperx.align(
        result["segments"], _align_model[0], _align_model[1], audio, device,
        return_char_alignments=False,
    )

    # diarização
    if _diarize_model is None:
        _diarize_model = whisperx.DiarizationPipeline(
            use_auth_token=HF_TOKEN, device=device,
        )
    diarize_segments = _diarize_model(
        audio,
        min_speakers=DIARIZE_MIN_SPEAKERS,
        max_speakers=DIARIZE_MAX_SPEAKERS,
    )
    final = whisperx.assign_word_speakers(diarize_segments, aligned)

    out: List[Segment] = []
    for s in final.get("segments", []):
        out.append({
            "start": float(s["start"]),
            "end": float(s["end"]),
            "text": (s.get("text") or "").strip(),
            "speaker": s.get("speaker"),
        })
    return out


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
        segments.append({"start": start_s, "end": end_s, "text": text.strip(), "speaker": None})
    return segments


def _srt_time_to_s(t: str) -> float:
    # 00:00:01,000  ou  00:00:01.000
    t = t.replace(",", ".")
    h, m, s = t.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)