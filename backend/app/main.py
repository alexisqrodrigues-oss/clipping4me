"""FastAPI app. Endpoints batem com src/lib/backend.ts do frontend."""
from __future__ import annotations

import asyncio
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import JOBS_DIR, ROOT_DIR, ensure_dirs
from .models import CreateJobInput, Job, OpenFolderInput
from .pipeline import run_job
from . import storage

ensure_dirs()
(ROOT_DIR / "media").mkdir(exist_ok=True)

app = FastAPI(title="Clipping4me Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve thumbs e vídeos cortados: /media/<job>/<clip>/render.mp4
app.mount("/media", StaticFiles(directory=str(ROOT_DIR / "media")), name="media")


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/jobs")
async def list_jobs():
    return {"jobs": [j.model_dump() for j in storage.list_jobs()]}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return {"job": job.model_dump()}


@app.post("/jobs")
async def create_job(input: CreateJobInput, background: BackgroundTasks):
    """Criação via JSON — usado para YouTube (sem upload)."""
    job = _new_job(input.kind, input.source, input.instructions, input.podcast_title)
    storage.save_job(job)
    background.add_task(_run_async_safe, job)
    return {"job": job.model_dump()}


@app.post("/jobs/upload")
async def create_job_upload(
    background: BackgroundTasks,
    kind: str = Form(...),
    instructions: str = Form(""),
    podcast_title: Optional[str] = Form(None),
    video: UploadFile = File(...),
    srt: Optional[UploadFile] = File(None),
):
    """Criação com upload de arquivo (vídeo + SRT opcional)."""
    if kind != "upload":
        raise HTTPException(400, "kind deve ser 'upload' aqui")

    job_id = f"job_{uuid.uuid4().hex[:8]}"
    work = JOBS_DIR / job_id
    work.mkdir(parents=True, exist_ok=True)

    suffix = Path(video.filename or "input.mp4").suffix or ".mp4"
    saved_video = work / f"input{suffix}"
    with saved_video.open("wb") as f:
        shutil.copyfileobj(video.file, f)

    if srt is not None:
        with (work / "user.srt").open("wb") as f:
            shutil.copyfileobj(srt.file, f)

    job = _new_job(
        kind="upload",
        source=str(saved_video),
        instructions=instructions,
        podcast_title=podcast_title or Path(video.filename or "Upload").stem,
        job_id=job_id,
    )
    storage.save_job(job)
    background.add_task(_run_async_safe, job)
    return {"job": job.model_dump()}


@app.post("/jobs/{job_id}/open")
async def open_in_finder(job_id: str, input: OpenFolderInput):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    path = None
    if input.clipId and job.clips:
        clip = next((c for c in job.clips if c.id == input.clipId), None)
        if clip:
            path = clip.folder_path
    if not path:
        path = str(ROOT_DIR / "Cortes")
    try:
        subprocess.run(["open", path], check=False)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ---------- helpers ----------

def _new_job(kind, source, instructions, podcast_title=None, job_id=None) -> Job:
    return Job(
        id=job_id or f"job_{uuid.uuid4().hex[:8]}",
        kind=kind,
        source=source,
        podcast_title=podcast_title or "Sem título",
        instructions=instructions or "",
        status="queued",
        progress=0,
    )


def _run_async_safe(job: Job) -> None:
    asyncio.run(run_job(job))