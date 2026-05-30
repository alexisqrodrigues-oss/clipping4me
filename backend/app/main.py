"""FastAPI app. Endpoints batem com src/lib/backend.ts do frontend.

Toda rota (exceto /health e /auth/login) exige Authorization: Bearer <token>.
"""
from __future__ import annotations

import asyncio
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Optional

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from . import auth, storage
from .auth import (
    CreateUserInput,
    LoginInput,
    LoginResponse,
    UpdateUserInput,
    User,
    require_admin,
    require_user,
)
from .config import JOBS_DIR, ROOT_DIR, ensure_dirs
from .models import CreateJobInput, Job, OpenFolderInput
from .pipeline import run_job

ensure_dirs()
(ROOT_DIR / "media").mkdir(exist_ok=True)
auth.bootstrap_admin()

app = FastAPI(title="Clipping4me Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# ---------- /media com auth (aceita ?token= pra <video src=>) ----------
_static_media = StaticFiles(directory=str(ROOT_DIR / "media"))


@app.api_route("/media/{path:path}", methods=["GET", "HEAD"])
async def serve_media(path: str, request: Request):
    require_user(request)
    return await _static_media.get_response(path, request.scope)


# ---------- health (público) ----------
@app.get("/health")
async def health():
    return {"ok": True}


# ---------- auth ----------
@app.post("/auth/login", response_model=LoginResponse)
async def login(payload: LoginInput):
    u = auth.get_user_by_username(payload.username)
    if not u or not auth.verify_password(payload.password, u.password_hash):
        raise HTTPException(401, "Usuário ou senha inválidos")
    token = auth.create_session(u.id)
    return LoginResponse(token=token, user=User(**u.model_dump(exclude={"password_hash"})))


@app.post("/auth/logout")
async def logout(request: Request, _: User = Depends(require_user)):
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        auth.revoke_session(auth_header[7:].strip())
    return {"ok": True}


@app.get("/auth/me", response_model=User)
async def me(user: User = Depends(require_user)):
    return user


# ---------- admin ----------
@app.get("/admin/users")
async def admin_list_users(_: User = Depends(require_admin)):
    return {"users": [u.model_dump() for u in auth.list_users()]}


@app.post("/admin/users")
async def admin_create_user(payload: CreateUserInput, _: User = Depends(require_admin)):
    user = auth.create_user(payload.username, payload.password, payload.role)
    return {"user": user.model_dump()}


@app.patch("/admin/users/{user_id}")
async def admin_update_user(
    user_id: str,
    payload: UpdateUserInput,
    _: User = Depends(require_admin),
):
    user = auth.update_user(user_id, payload.password, payload.role)
    return {"user": user.model_dump()}


@app.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, current: User = Depends(require_admin)):
    if user_id == current.id:
        raise HTTPException(400, "Não pode deletar a si mesmo")
    auth.delete_user(user_id)
    return {"ok": True}


# ---------- jobs (protegidas) ----------
@app.get("/jobs")
async def list_jobs(_: User = Depends(require_user)):
    return {"jobs": [j.model_dump() for j in storage.list_jobs()]}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str, _: User = Depends(require_user)):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return {"job": job.model_dump()}


@app.post("/jobs")
async def create_job(
    input: CreateJobInput,
    background: BackgroundTasks,
    _: User = Depends(require_user),
):
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
    _: User = Depends(require_user),
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
async def open_in_finder(
    job_id: str, input: OpenFolderInput, _: User = Depends(require_user)
):
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