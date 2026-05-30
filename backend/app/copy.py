"""Geração e refinamento de copy para cada clipe.

Cada clipe tem 4 blocos editáveis:
- caption    : texto curto (1-2 linhas) pra overlay/legenda no vídeo
- description: texto longo "post de criador" que COMPLEMENTA o conteúdo
               (contexto, opinião, gancho extra), não só resume
- hashtags   : lista de hashtags relevantes
- cta        : chamada pra ação curta (seguir, comentar, link na bio…)

Todos os blocos são gerados em pt-BR e podem ser regenerados individualmente
via /copy/{field} com uma instrução de chat (ex: "mais polêmico",
"adiciona CTA pro link da bio").
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

import httpx

from .config import OLLAMA_MODEL, OLLAMA_URL


PRESETS: Dict[str, str] = {
    "polemico": (
        "Tom polêmico, opinativo, gera debate. Usa frases curtas e contundentes. "
        "Pode discordar de senso comum mas sem ofender."
    ),
    "institucional": (
        "Tom profissional, sóbrio e confiável. Sem gírias. Foco em autoridade da marca."
    ),
    "autoridade": (
        "Tom de especialista que ensina. Usa dado, framework, exemplo concreto. "
        "Posiciona o convidado/host como referência no tema."
    ),
    "engajamento": (
        "Tom convidativo, faz pergunta aberta no final, incentiva comentário e share. "
        "Linguagem próxima do público."
    ),
}


def _preset_block(preset: Optional[str]) -> str:
    if not preset:
        return ""
    p = PRESETS.get(preset.lower())
    return f"\nDIRETIVA DE TOM: {p}\n" if p else ""


def _segments_text(segments: List[Dict[str, Any]]) -> str:
    return " ".join(s.get("text", "").strip() for s in (segments or [])).strip()


def _clip_context(clip: Dict[str, Any]) -> str:
    transcript = _segments_text(clip.get("segments", []))
    return (
        f"TÍTULO: {clip.get('title', '')}\n"
        f"DURAÇÃO: {int(clip.get('duration', 0))}s\n"
        f"TRANSCRIÇÃO DO CORTE:\n{transcript or '(sem transcrição disponível)'}\n"
    )


SYSTEM_BASE = (
    "Você é um copywriter sênior de redes sociais em PT-BR especializado em "
    "cortes de podcast (Reels/TikTok/Shorts). Escreve sempre em português brasileiro, "
    "natural, sem clichês de IA. NÃO usa markdown nem aspas envolvendo o texto. "
    "Responde APENAS o conteúdo pedido, sem preâmbulo."
)


_FIELD_SPEC: Dict[str, Dict[str, str]] = {
    "caption": {
        "label": "CAPTION",
        "rules": (
            "Texto curto de 1 a 2 linhas que funcione como legenda/overlay do vídeo. "
            "Pode começar com um gancho forte. Sem hashtags. Sem emojis em excesso "
            "(no máx 1). Máx 180 caracteres."
        ),
    },
    "description": {
        "label": "DESCRIÇÃO DE POST",
        "rules": (
            "Texto de 4 a 8 linhas no estilo POST DE CRIADOR. NÃO é resumo. "
            "Deve COMPLEMENTAR o conteúdo do corte: contextualizar, dar a opinião "
            "do criador, fazer um paralelo ou estender o raciocínio. "
            "Quebra de linha entre parágrafos. Linguagem direta. Sem hashtags aqui "
            "(elas vão num bloco separado). Termina com algo que provoque reação."
        ),
    },
    "hashtags": {
        "label": "HASHTAGS",
        "rules": (
            "Devolve uma LISTA JSON pura de 8 a 15 hashtags relevantes em PT-BR, "
            "sem o símbolo #, em minúsculas, sem espaço, sem acento. "
            'Formato EXATO: ["palavraum","palavradois","..."]. '
            "Nada além do array."
        ),
    },
    "cta": {
        "label": "CTA",
        "rules": (
            "Uma única frase curta (máx 90 chars) de call-to-action. "
            "Pode ser pergunta, convite pra comentar, salvar, seguir ou clicar "
            "no link da bio. Apenas a frase, sem rótulo."
        ),
    },
}


def _build_prompt(
    field: str,
    clip: Dict[str, Any],
    podcast_title: str,
    instruction: str = "",
    preset: Optional[str] = None,
) -> List[Dict[str, str]]:
    spec = _FIELD_SPEC[field]
    system = (
        f"{SYSTEM_BASE}\n\nVocê está escrevendo o BLOCO: {spec['label']}.\n"
        f"REGRAS DESTE BLOCO:\n{spec['rules']}{_preset_block(preset)}"
    )
    user_parts = [
        f"PODCAST: {podcast_title}",
        _clip_context(clip),
    ]
    if instruction.strip():
        user_parts.append(f"INSTRUÇÃO DO USUÁRIO: {instruction.strip()}")
    user_parts.append(f"Gere agora APENAS o bloco {spec['label']} em pt-BR.")
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": "\n\n".join(user_parts)},
    ]


async def _call_ollama(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    json_mode: bool = False,
) -> str:
    payload: Dict[str, Any] = {
        "model": model or OLLAMA_MODEL,
        "stream": False,
        "options": {"temperature": 0.7},
        "messages": messages,
    }
    if json_mode:
        payload["format"] = "json"
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
        r.raise_for_status()
        return (r.json().get("message", {}).get("content") or "").strip()


def _parse_hashtags(raw: str) -> List[str]:
    raw = raw.strip()
    # tenta JSON puro
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [_clean_tag(str(x)) for x in data if str(x).strip()]
        if isinstance(data, dict):
            for key in ("hashtags", "tags", "items"):
                v = data.get(key)
                if isinstance(v, list):
                    return [_clean_tag(str(x)) for x in v if str(x).strip()]
    except Exception:
        pass
    # fallback: extrai #tags ou palavras separadas por espaço/virgula
    tokens = re.findall(r"#?([A-Za-z0-9_]{2,})", raw)
    return [_clean_tag(t) for t in tokens][:15]


def _clean_tag(t: str) -> str:
    t = t.strip().lstrip("#").lower()
    t = re.sub(r"\s+", "", t)
    return re.sub(r"[^a-z0-9_]", "", t)


async def generate_field(
    field: str,
    clip: Dict[str, Any],
    podcast_title: str,
    instruction: str = "",
    preset: Optional[str] = None,
    model: Optional[str] = None,
) -> Any:
    if field not in _FIELD_SPEC:
        raise ValueError(f"campo inválido: {field}")
    messages = _build_prompt(field, clip, podcast_title, instruction, preset)
    raw = await _call_ollama(messages, model=model, json_mode=(field == "hashtags"))
    if field == "hashtags":
        return _parse_hashtags(raw)
    # remove aspas envolventes que o LLM as vezes coloca
    cleaned = raw.strip().strip('"').strip("'").strip()
    return cleaned


async def generate_all(
    clip: Dict[str, Any],
    podcast_title: str,
    preset: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Gera os 4 blocos. Roda em paralelo pra ser rápido."""
    import asyncio

    fields = ["caption", "description", "hashtags", "cta"]
    results = await asyncio.gather(
        *(generate_field(f, clip, podcast_title, "", preset, model) for f in fields),
        return_exceptions=True,
    )
    out: Dict[str, Any] = {}
    for f, r in zip(fields, results):
        if isinstance(r, Exception):
            out[f] = [] if f == "hashtags" else ""
        else:
            out[f] = r
    return out


async def list_models() -> List[str]:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f"{OLLAMA_URL}/api/tags")
        r.raise_for_status()
        data = r.json()
    return [m.get("name") for m in data.get("models", []) if m.get("name")]