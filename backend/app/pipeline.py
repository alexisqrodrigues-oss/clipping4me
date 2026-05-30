"""Orquestra o job inteiro de forma assíncrona."""
from __future__ import annotations

import asyncio
import re
import shutil
import traceback
from datetime import date
from pathlib import Path

from .config import CORTES_DIR, JOBS_DIR
from . import cutter, llm, transcribe
from .models import Clip, ClipSegment, Job
from .storage import save_job, update_job


def _slug(s: str, max_len: int = 60) -> str:
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE).strip()
    s = re.sub(r"\s+", " ", s)
    return s[:max_len].rstrip(" -_")


async def run_job(job: Job) -> None:
    """Executa o pipeline inteiro. Atualiza job no disco em cada etapa."""
    try:
        work = JOBS_DIR / job.id
        work.mkdir(parents=True, exist_ok=True)

        # 1) Obter o vídeo + SRT base
        update_job(job.id, status="downloading", progress=10)
        source_video, title, srt_segments = await _ingest(job, work)
        if title:
            job.podcast_title = title
            update_job(job.id, podcast_title=title)

        # 2) Transcrever se necessário
        if not srt_segments:
            update_job(job.id, status="transcribing", progress=30)
            audio = work / "audio.wav"
            await cutter.extract_audio(source_video, audio)
            srt_segments = await asyncio.to_thread(transcribe.transcribe_diarized, audio)

        # 3) Verifica Ollama antes de chamar
        update_job(job.id, status="analyzing", progress=50)
        await llm.health_check()

        # 4) LLM escolhe os cortes
        update_job(job.id, status="analyzing", progress=55)
        picks = await llm.pick_clips(srt_segments, job.instructions)
        if not picks:
            raise RuntimeError("LLM não retornou cortes. Verifique se o modelo está disponível.")

        # 5) Cortar com ffmpeg + gerar thumb e sub-cortes
        update_job(job.id, status="cutting", progress=75)
        date_str = date.today().isoformat()
        podcast_folder = CORTES_DIR / f"{date_str} {_slug(job.podcast_title)}"
        podcast_folder.mkdir(parents=True, exist_ok=True)

        clips: list[Clip] = []
        for i, pick in enumerate(picks, start=1):
            clip_name = f"{i:02d} {_slug(pick['title'])}"
            clip_dir = podcast_folder / clip_name

            render_dir = clip_dir / "01 Render"
            seq_dir = clip_dir / "02 Sequencia de cortes"
            mat_dir = clip_dir / "03 Materiais arquivos de texto, audio, b-rolls, etc"
            img_dir = mat_dir / "Imagens de apoio"
            mus_dir = mat_dir / "Musica"

            for d in (render_dir, seq_dir, mat_dir, img_dir, mus_dir):
                d.mkdir(parents=True, exist_ok=True)

            start, end = float(pick["start"]), float(pick["end"])

            # Render final
            out_video = render_dir / "video.mp4"
            await cutter.cut_clip(source_video, start, end, out_video, vertical=True)

            # Thumb
            out_thumb = img_dir / "thumb.jpg"
            await cutter.make_thumbnail(source_video, start + 1.0, out_thumb)

            # Sequencia de sub-cortes (hook, dev, close) + full
            segments_out = _slice_segments(srt_segments, start, end, pick)
            seq_idx = 1
            for seg in segments_out:
                sub_out = seq_dir / f"{seq_idx:02d}_{seg.role}.mp4"
                await cutter.cut_clip(source_video, seg.start, seg.end, sub_out, vertical=True)
                seq_idx += 1

            # Full também na sequencia
            full_out = seq_dir / f"{seq_idx:02d}_full.mp4"
            await cutter.cut_clip(source_video, start, end, full_out, vertical=True)

            # Materiais textuais
            (mat_dir / "descricao.txt").write_text(pick.get("description", ""), encoding="utf-8")
            (mat_dir / "observacoes.txt").write_text(pick.get("observations", ""), encoding="utf-8")

            # SRT com nome do vídeo
            safe_title = _slug(pick["title"])
            srt_path = mat_dir / f"{safe_title}.srt"
            _write_srt(srt_path, srt_segments, start, end)

            clip_id = f"{job.id}_c{i:02d}"
            inside_segs = [s for s in srt_segments if s["end"] > start and s["start"] < end]
            speakers_in_clip = sorted({s["speaker"] for s in inside_segs if s.get("speaker")})
            clips.append(
                Clip(
                    id=clip_id,
                    index=i,
                    title=pick["title"],
                    description=pick.get("description", ""),
                    observations=pick.get("observations", ""),
                    music_suggestion=pick.get("music_suggestion"),
                    thumbnail_copy=pick.get("thumbnail_copy"),
                    thumbnail_url=f"/media/{job.id}/{clip_id}/thumb.jpg",
                    video_url=f"/media/{job.id}/{clip_id}/video.mp4",
                    duration=end - start,
                    segments=segments_out,
                    folder_path=str(clip_dir),
                    speakers=speakers_in_clip,
                )
            )

            # symlinks pro /media servir os arquivos
            _link_media(job.id, clip_id, out_video, out_thumb)

        update_job(job.id, status="done", progress=100,
                   clips=[c.model_dump() for c in clips])
    except Exception as e:
        traceback.print_exc()
        update_job(job.id, status="error", progress=0, error=str(e))


async def _ingest(job: Job, work: Path):
    """Retorna (path do vídeo, título, segments se SRT já existir)."""
    if job.kind == "youtube":
        mp4, title = await cutter.yt_dlp_download(job.source, work)
        # tenta usar SRT auto baixado
        srt_candidates = list(work.glob("source*.srt"))
        if srt_candidates:
            try:
                return mp4, title, transcribe.parse_srt(srt_candidates[0])
            except Exception:
                pass
        return mp4, title, []

    if job.kind == "upload":
        # source é o caminho do arquivo já salvo em work/
        mp4 = Path(job.source)
        srt = work / "user.srt"
        srt_segs = transcribe.parse_srt(srt) if srt.exists() else []
        return mp4, mp4.stem, srt_segs

    if job.kind == "srt":
        # caso raro: só SRT (sem vídeo) — não dá pra cortar; aborta
        raise RuntimeError("Modo 'srt only' requer vídeo associado.")

    raise RuntimeError(f"kind desconhecido: {job.kind}")


def _slice_segments(all_segs: list[dict], start: float, end: float, pick: dict) -> list[ClipSegment]:
    """Devolve até 3 segments rotulados (hook/dev/close) baseados nos timestamps do pick."""
    inside = [s for s in all_segs if s["end"] > start and s["start"] < end]
    if not inside:
        return []
    hook_end = float(pick.get("hook_end", start + 4))
    close_start = float(pick.get("close_start", end - 6))

    hook = [s for s in inside if s["start"] < hook_end]
    close = [s for s in inside if s["end"] > close_start]
    dev = [s for s in inside if s not in hook and s not in close]

    out: list[ClipSegment] = []
    if hook:
        out.append(ClipSegment(
            role="hook", start=hook[0]["start"], end=hook[-1]["end"],
            text=" ".join(s["text"] for s in hook)))
    if dev:
        out.append(ClipSegment(
            role="dev", start=dev[0]["start"], end=dev[-1]["end"],
            text=" ".join(s["text"] for s in dev)[:200]))
    if close:
        out.append(ClipSegment(
            role="close", start=close[0]["start"], end=close[-1]["end"],
            text=" ".join(s["text"] for s in close)))
    return out


def _write_srt(path: Path, all_segs: list[dict], start: float, end: float) -> None:
    """Escreve um SRT com timestamps relativos ao corte."""
    def fmt(t: float) -> str:
        h = int(t // 3600); m = int((t % 3600) // 60)
        s = t - h * 3600 - m * 60
        return f"{h:02d}:{m:02d}:{int(s):02d},{int((s % 1) * 1000):03d}"

    lines, idx = [], 1
    for seg in all_segs:
        if seg["end"] <= start or seg["start"] >= end:
            continue
        s0 = max(0.0, seg["start"] - start)
        s1 = min(end - start, seg["end"] - start)
        lines.append(f"{idx}\n{fmt(s0)} --> {fmt(s1)}\n{seg['text']}\n")
        idx += 1
    path.write_text("\n".join(lines), encoding="utf-8")


def _link_media(job_id: str, clip_id: str, video: Path, thumb: Path) -> None:
    """Copia (ou linka) os arquivos para serem servidos via /media."""
    from .config import ROOT_DIR
    media_dir = ROOT_DIR / "media" / job_id / clip_id
    media_dir.mkdir(parents=True, exist_ok=True)
    for src, name in [(video, "video.mp4"), (thumb, "thumb.jpg")]:
        dst = media_dir / name
        if dst.exists():
            dst.unlink()
        try:
            dst.symlink_to(src)
        except OSError:
            shutil.copy2(src, dst)
