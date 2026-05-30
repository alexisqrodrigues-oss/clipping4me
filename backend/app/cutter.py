"""Wrappers de ffmpeg + yt-dlp."""
from __future__ import annotations

import asyncio
import shlex
from pathlib import Path
from typing import Tuple


async def run(cmd: str, cwd: Path | None = None) -> Tuple[int, str]:
    proc = await asyncio.create_subprocess_shell(
        cmd,
        cwd=str(cwd) if cwd else None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    out, _ = await proc.communicate()
    return proc.returncode or 0, out.decode("utf-8", errors="ignore")


async def yt_dlp_download(url: str, out_dir: Path) -> Tuple[Path, str]:
    """Baixa o melhor MP4 + tenta SRT auto. Retorna (mp4_path, title)."""
    out_dir.mkdir(parents=True, exist_ok=True)
    template = str(out_dir / "source.%(ext)s")
    cmd = (
        f"yt-dlp -f 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b' "
        f"--merge-output-format mp4 "
        f"--write-auto-subs --sub-langs 'pt.*,en.*' --convert-subs srt "
        f"--write-info-json "
        f"-o {shlex.quote(template)} {shlex.quote(url)}"
    )
    code, out = await run(cmd)
    if code != 0:
        raise RuntimeError(f"yt-dlp falhou: {out[-500:]}")
    mp4 = out_dir / "source.mp4"
    if not mp4.exists():
        # fallback: pega qualquer .mp4
        cands = list(out_dir.glob("source.*"))
        cands = [c for c in cands if c.suffix in {".mp4", ".mkv", ".webm"}]
        if not cands:
            raise RuntimeError("yt-dlp não produziu vídeo")
        mp4 = cands[0]

    title = mp4.stem
    info_json = out_dir / "source.info.json"
    if info_json.exists():
        try:
            import json
            title = json.loads(info_json.read_text()).get("title", title)
        except Exception:
            pass
    return mp4, title


async def cut_clip(
    source: Path,
    start: float,
    end: float,
    out_path: Path,
    vertical: bool = True,
) -> None:
    """Corta trecho [start, end] e (opcional) reformata para 9:16 com blur de fundo."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.5, end - start)

    if vertical:
        # 1080x1920 com vídeo centralizado e fundo borrado
        vf = (
            "[0:v]split=2[bg][fg];"
            "[bg]scale=1080:1920:force_original_aspect_ratio=increase,"
            "crop=1080:1920,boxblur=20:5[bg];"
            "[fg]scale=1080:1920:force_original_aspect_ratio=decrease[fg];"
            "[bg][fg]overlay=(W-w)/2:(H-h)/2"
        )
        filter_arg = f'-filter_complex "{vf}"'
    else:
        filter_arg = ""

    cmd = (
        f"ffmpeg -y -ss {start:.2f} -i {shlex.quote(str(source))} -t {duration:.2f} "
        f"{filter_arg} -c:v libx264 -preset veryfast -crf 22 "
        f"-c:a aac -b:a 160k -movflags +faststart {shlex.quote(str(out_path))}"
    )
    code, out = await run(cmd)
    if code != 0:
        raise RuntimeError(f"ffmpeg falhou: {out[-500:]}")


async def make_thumbnail(source: Path, at: float, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = (
        f"ffmpeg -y -ss {at:.2f} -i {shlex.quote(str(source))} "
        f"-frames:v 1 -vf scale=720:-1 -q:v 3 {shlex.quote(str(out_path))}"
    )
    await run(cmd)


async def extract_audio(source: Path, out_path: Path) -> None:
    """Whisper roda mais rápido com WAV 16kHz mono."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = (
        f"ffmpeg -y -i {shlex.quote(str(source))} -ac 1 -ar 16000 -vn "
        f"{shlex.quote(str(out_path))}"
    )
    code, out = await run(cmd)
    if code != 0:
        raise RuntimeError(f"ffmpeg audio falhou: {out[-500:]}")