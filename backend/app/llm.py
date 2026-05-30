"""Chamada ao Ollama local. Devolve uma lista de cortes em JSON."""
from __future__ import annotations

import json
import re
from typing import List, TypedDict

import httpx

from .config import CLIP_MAX_SEC, CLIP_MIN_SEC, MAX_CLIPS, OLLAMA_MODEL, OLLAMA_URL


class LLMClip(TypedDict):
    title: str
    description: str
    observations: str
    music_suggestion: str
    thumbnail_copy: str
    start: float
    end: float
    hook_end: float
    close_start: float


SYSTEM = """Você é um editor sênior de cortes virais para Instagram/TikTok/Shorts.
Dado o transcript com timestamps de um podcast ou palestra, escolha os MELHORES momentos para virarem cortes verticais 9:16.

Critérios duros:
- Cada corte deve ter início e fim em FRONTEIRAS DE FALA (não cortar palavra no meio).
- Duração entre {min}s e {max}s.
- Deve conter um GANCHO forte nos primeiros 3s.
- Tema autocontido: faz sentido sem contexto externo.
- Evite repetições, "ééé", longos silêncios.

Responda APENAS com JSON válido (sem markdown, sem comentários), no formato:
{{
  "clips": [
    {{
      "title": "Título chamativo de até 60 chars",
      "description": "Descrição curta com hashtags relevantes (2-3 linhas)",
      "observations": "Sugestões de edição, b-roll, ênfase, etc.",
      "music_suggestion": "Estilo de trilha sugerida",
      "thumbnail_copy": "Frase grande pra thumb (max 4 palavras, CAIXA ALTA)",
      "start": 123.4,
      "end": 178.2,
      "hook_end": 128.0,
      "close_start": 170.0
    }}
  ]
}}
"""


async def health_check() -> None:
    """Levanta RuntimeError se Ollama não estiver acessível."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            r.raise_for_status()
        except Exception as exc:
            raise RuntimeError(
                f"Ollama não está respondendo em {OLLAMA_URL}. "
                f"Verifique se está rodando com 'ollama serve'. Erro: {exc}"
            )


async def pick_clips(
    segments: list[dict],
    instructions: str,
    max_clips: int = MAX_CLIPS,
) -> List[LLMClip]:
    transcript = _format_transcript(segments)
    system = SYSTEM.format(min=CLIP_MIN_SEC, max=CLIP_MAX_SEC)
    user = (
        f"Instruções extras do usuário: {instructions or '(nenhuma)'}\n"
        f"Gere no máximo {max_clips} cortes.\n\n"
        f"TRANSCRIPT:\n{transcript}"
    )

    async with httpx.AsyncClient(timeout=600) as client:
        r = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.4},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
        )
        r.raise_for_status()
        content = r.json()["message"]["content"]

    data = _safe_json(content)
    clips = data.get("clips", []) if isinstance(data, dict) else []
    return [c for c in clips if _valid(c)]


def _format_transcript(segments: list[dict]) -> str:
    # compacto: [123.4-128.0] texto
    lines = []
    for s in segments:
        lines.append(f"[{s['start']:.1f}-{s['end']:.1f}] {s['text']}")
    return "\n".join(lines)


def _safe_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # fallback: extrai primeiro bloco {...}
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                return {}
    return {}


def _valid(c: dict) -> bool:
    try:
        return (
            "start" in c
            and "end" in c
            and float(c["end"]) - float(c["start"]) >= 10
            and bool(c.get("title"))
        )
    except Exception:
        return False
