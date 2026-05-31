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
from urllib.parse import urlparse

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
from starlette.responses import FileResponse, Response
from pydantic import BaseModel

from . import auth, storage
from . import copy as copy_mod
from .auth import (
    CreateUserInput,
    LoginInput,
    LoginResponse,
    UpdateUserInput,
    User,
    require_admin,
    require_user,
)
from .config import FRONTEND_URL, JOBS_DIR, ROOT_DIR, ensure_dirs
from .models import CreateJobInput, Job, OpenFolderInput
from .models import CopyChatInput
from .pipeline import run_job
from .config import OLLAMA_URL, OLLAMA_MODEL
import httpx

ensure_dirs()
(ROOT_DIR / "media").mkdir(exist_ok=True)
auth.bootstrap_admin()

# ---------- security knobs ----------
# Upload limit (bytes). 10 GiB by default; override via env if needed.
MAX_UPLOAD_BYTES = 10 * 1024 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {
    ".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi",
    ".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg",
}
# Allowed YouTube-source hosts. Validated for /jobs (kind="youtube"/"srt").
_ALLOWED_SOURCE_HOSTS = {
    "youtube.com", "www.youtube.com", "m.youtube.com",
    "youtu.be", "music.youtube.com",
}


def _validate_remote_source(source: str) -> None:
    """Reject sources that don't look like a public YouTube URL.

    yt-dlp accepts a huge variety of schemes (file://, ftp://, internal IPs,
    cloud metadata, …). Restricting to a small host allowlist prevents the
    backend from being abused as an SSRF proxy.
    """
    if not source or not isinstance(source, str):
        raise HTTPException(400, "source obrigatório")
    try:
        parsed = urlparse(source.strip())
    except Exception:
        raise HTTPException(400, "source inválido")
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(400, "source deve começar com https://")
    host = (parsed.hostname or "").lower()
    if not host or host not in _ALLOWED_SOURCE_HOSTS:
        raise HTTPException(400, "source deve ser uma URL do YouTube")
app = FastAPI(title="Clipping4me Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "https://www.clipping4.me",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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


# ---------- health detalhado (público — não vaza dados sensíveis) ----------
@app.get("/health/full")
async def health_full():
    """Verifica todas as dependências necessárias pra rodar um job.

    Retorna uma lista de componentes, cada um com status ok/warn/error e
    uma mensagem amigável. Usado pelo card de status na UI.
    """
    checks: list[dict] = []

    # 1) API (se respondemos, está ok)
    checks.append({
        "id": "api",
        "label": "API",
        "status": "ok",
        "detail": "respondendo",
    })

    # 2) ffmpeg
    ffmpeg = shutil.which("ffmpeg")
    checks.append({
        "id": "ffmpeg",
        "label": "ffmpeg",
        "status": "ok" if ffmpeg else "error",
        "detail": ffmpeg or "não instalado (brew install ffmpeg)",
    })

    # 3) yt-dlp
    ytdlp = shutil.which("yt-dlp")
    checks.append({
        "id": "ytdlp",
        "label": "yt-dlp",
        "status": "ok" if ytdlp else "error",
        "detail": ytdlp or "não instalado (pip install yt-dlp)",
    })

    # 4) Ollama up + modelo presente
    ollama_status = "error"
    ollama_detail = "Ollama offline"
    model_status = "error"
    model_detail = f"modelo {OLLAMA_MODEL} indisponível"
    try:
        async with httpx.AsyncClient(timeout=4.0) as cx:
            r = await cx.get(f"{OLLAMA_URL}/api/tags")
            if r.status_code == 200:
                ollama_status = "ok"
                ollama_detail = OLLAMA_URL
                tags = r.json().get("models", [])
                names = [m.get("name", "") for m in tags]
                # match exato ou prefixo (qwen2.5-coder:7b vs qwen2.5-coder:7b-instruct)
                if any(n == OLLAMA_MODEL or n.startswith(OLLAMA_MODEL.split(":")[0]) for n in names):
                    model_status = "ok"
                    model_detail = OLLAMA_MODEL
                else:
                    model_detail = f"baixe com: ollama pull {OLLAMA_MODEL}"
    except Exception as e:
        ollama_detail = f"sem resposta em {OLLAMA_URL}"
    checks.append({"id": "ollama", "label": "Ollama", "status": ollama_status, "detail": ollama_detail})
    checks.append({"id": "ollama_model", "label": "Modelo LLM", "status": model_status, "detail": model_detail})

    # 5) Espaço em disco
    try:
        usage = shutil.disk_usage(str(ROOT_DIR))
        free_gb = usage.free / (1024 ** 3)
        total_gb = usage.total / (1024 ** 3)
        if free_gb < 2:
            disk_status, disk_detail = "error", f"apenas {free_gb:.1f} GB livres"
        elif free_gb < 10:
            disk_status, disk_detail = "warn", f"{free_gb:.1f} GB livres de {total_gb:.0f} GB"
        else:
            disk_status, disk_detail = "ok", f"{free_gb:.0f} GB livres de {total_gb:.0f} GB"
    except Exception as e:
        disk_status, disk_detail = "warn", str(e)
    checks.append({"id": "disk", "label": "Espaço em disco", "status": disk_status, "detail": disk_detail})

    # 6) Fila de jobs (quantos em processamento agora)
    try:
        active = [j for j in storage.list_jobs(include_all=True)
                  if j.status in {"queued", "downloading", "transcribing", "analyzing", "cutting"}]
        n = len(active)
        if n == 0:
            q_status, q_detail = "ok", "fila vazia"
        elif n <= 3:
            q_status, q_detail = "ok", f"{n} job(s) em andamento"
        else:
            q_status, q_detail = "warn", f"{n} jobs em andamento — pode demorar"
    except Exception as e:
        q_status, q_detail = "warn", str(e)
    checks.append({"id": "queue", "label": "Fila", "status": q_status, "detail": q_detail})

    # rollup
    if any(c["status"] == "error" for c in checks):
        overall = "error"
    elif any(c["status"] == "warn" for c in checks):
        overall = "warn"
    else:
        overall = "ok"

    return {"overall": overall, "checks": checks}


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
async def list_jobs(user: User = Depends(require_user)):
    jobs = storage.list_jobs(user_id=user.id, include_all=user.role == "admin")
    return {"jobs": [j.model_dump() for j in jobs]}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str, user: User = Depends(require_user)):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    _require_job_owner(job, user)
    return {"job": job.model_dump()}


@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: User = Depends(require_user)):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    _require_job_owner(job, user)
    # remove arquivos de trabalho se existirem
    work = JOBS_DIR / job_id
    if work.exists():
        shutil.rmtree(work, ignore_errors=True)
    # remove arquivos de mídia servidos
    media = ROOT_DIR / "media" / job_id
    if media.exists():
        shutil.rmtree(media, ignore_errors=True)
    storage.delete_job(job_id)
    return {"ok": True}


@app.post("/jobs/{job_id}/retry")
async def retry_job(
    job_id: str,
    background: BackgroundTasks,
    user: User = Depends(require_user),
):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    _require_job_owner(job, user)
    if job.status not in {"error", "done"}:
        raise HTTPException(400, f"Não é possível retry: status atual é '{job.status}'")
    # reseta job
    job.status = "queued"
    job.progress = 0
    job.error = None
    job.clips = None
    storage.save_job(job)
    background.add_task(_run_async_safe, job)
    return {"job": job.model_dump()}


@app.post("/jobs")
async def create_job(
    input: CreateJobInput,
    background: BackgroundTasks,
    user: User = Depends(require_user),
):
    """Criação via JSON — usado para YouTube (sem upload)."""
    if input.kind in {"youtube", "srt"}:
        _validate_remote_source(input.source)
    job = _new_job(
        input.kind, input.source, input.instructions, input.podcast_title, user_id=user.id
    )
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
    user: User = Depends(require_user),
):
    """Criação com upload de arquivo (vídeo + SRT opcional)."""
    if kind != "upload":
        raise HTTPException(400, "kind deve ser 'upload' aqui")

    suffix = Path(video.filename or "input.mp4").suffix.lower() or ".mp4"
    if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            415,
            f"tipo de arquivo não suportado ({suffix}). "
            f"aceitos: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}",
        )

    job_id = f"job_{uuid.uuid4().hex[:8]}"
    work = JOBS_DIR / job_id
    work.mkdir(parents=True, exist_ok=True)

    saved_video = work / f"input{suffix}"
    # Stream-copy with a hard cap so a single upload can't fill the disk.
    written = 0
    chunk_size = 1024 * 1024
    with saved_video.open("wb") as f:
        while True:
            chunk = video.file.read(chunk_size)
            if not chunk:
                break
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                f.close()
                try:
                    saved_video.unlink(missing_ok=True)
                    shutil.rmtree(work, ignore_errors=True)
                except Exception:
                    pass
                raise HTTPException(
                    413,
                    f"arquivo excede o limite de {MAX_UPLOAD_BYTES // (1024**3)} GiB",
                )
            f.write(chunk)

    if srt is not None:
        with (work / "user.srt").open("wb") as f:
            shutil.copyfileobj(srt.file, f)

    job = _new_job(
        kind="upload",
        source=str(saved_video),
        instructions=instructions,
        podcast_title=podcast_title or Path(video.filename or "Upload").stem,
        job_id=job_id,
        user_id=user.id,
    )
    storage.save_job(job)
    background.add_task(_run_async_safe, job)
    return {"job": job.model_dump()}


@app.post("/jobs/{job_id}/open")
async def open_in_finder(
    job_id: str, input: OpenFolderInput, user: User = Depends(require_user)
):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    _require_job_owner(job, user)
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


# ---------- copy editor (Ollama) ----------
@app.get("/models")
async def list_ollama_models(_: User = Depends(require_user)):
    try:
        return {"models": await copy_mod.list_models()}
    except Exception as e:
        return {"models": [], "error": str(e)}


def _find_clip(job: Job, clip_id: str):
    for c in job.clips or []:
        if c.id == clip_id:
            return c
    return None


def _persist_clip(job: Job, updated) -> Job:
    new_clips = [updated if c.id == updated.id else c for c in (job.clips or [])]
    storage.update_job(job.id, clips=[c.model_dump() for c in new_clips])
    job.clips = new_clips
    return job


@app.post("/jobs/{job_id}/clips/{clip_id}/copy")
async def regenerate_copy_all(
    job_id: str,
    clip_id: str,
    payload: CopyChatInput,
    user: User = Depends(require_user),
):
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    _require_job_owner(job, user)
    clip = _find_clip(job, clip_id)
    if not clip:
        raise HTTPException(404, "clip not found")
    out = await copy_mod.generate_all(
        clip.model_dump(),
        job.podcast_title,
        preset=payload.preset,
        model=payload.model,
    )
    clip.caption = out.get("caption") or clip.caption
    clip.description = out.get("description") or clip.description
    clip.hashtags = out.get("hashtags") or clip.hashtags
    clip.cta = out.get("cta") or clip.cta
    job = _persist_clip(job, clip)
    return {"clip": clip.model_dump()}


@app.post("/jobs/{job_id}/clips/{clip_id}/copy/{field}")
async def regenerate_copy_field(
    job_id: str,
    clip_id: str,
    field: str,
    payload: CopyChatInput,
    user: User = Depends(require_user),
):
    if field not in {"caption", "description", "hashtags", "cta"}:
        raise HTTPException(400, "campo inválido")
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    _require_job_owner(job, user)
    clip = _find_clip(job, clip_id)
    if not clip:
        raise HTTPException(404, "clip not found")
    value = await copy_mod.generate_field(
        field,
        clip.model_dump(),
        job.podcast_title,
        instruction=payload.instruction,
        preset=payload.preset,
        model=payload.model,
    )
    setattr(clip, field, value)
    job = _persist_clip(job, clip)
    return {"clip": clip.model_dump(), "field": field, "value": value}


class CopyPatch(BaseModel):
    caption: Optional[str] = None
    description: Optional[str] = None
    hashtags: Optional[list[str]] = None
    cta: Optional[str] = None


@app.patch("/jobs/{job_id}/clips/{clip_id}/copy")
async def save_copy(
    job_id: str,
    clip_id: str,
    payload: CopyPatch,
    user: User = Depends(require_user),
):
    """Persiste edições manuais feitas pelo usuário no editor."""
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    _require_job_owner(job, user)
    clip = _find_clip(job, clip_id)
    if not clip:
        raise HTTPException(404, "clip not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(clip, k, v)
    job = _persist_clip(job, clip)
    return {"clip": clip.model_dump()}


# ---------- export / download ----------
def _safe_filename(name: str) -> str:
    import re as _re
    name = _re.sub(r"[^\w\s\-\.]", "", name, flags=_re.UNICODE).strip()
    name = _re.sub(r"\s+", "_", name)
    return (name or "clip")[:80]


@app.get("/jobs/{job_id}/clips/{clip_id}/download")
async def download_clip(job_id: str, clip_id: str, request: Request):
    """Baixa o MP4 9:16 final do corte com nome amigável.

    Aceita Authorization: Bearer OU ?token= (para uso direto em <a href>).
    """
    user = require_user(request)
    job = storage.get_job(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    _require_job_owner(job, user)
    clip = _find_clip(job, clip_id)
    if not clip:
        raise HTTPException(404, "clip not found")
    path = ROOT_DIR / "media" / job_id / clip_id / "video.mp4"
    if not path.exists():
        raise HTTPException(404, "arquivo do corte não encontrado")
    fname = f"{_safe_filename(job.podcast_title)}_{clip.index:02d}_{_safe_filename(clip.title)}.mp4"
    return FileResponse(
        path,
        media_type="video/mp4",
        filename=fname,
    )


# ---------- helpers ----------
def _new_job(kind, source, instructions, podcast_title=None, job_id=None, user_id=None) -> Job:
    return Job(
        id=job_id or f"job_{uuid.uuid4().hex[:8]}",
        kind=kind,
        source=source,
        podcast_title=podcast_title or "Sem título",
        instructions=instructions or "",
        status="queued",
        progress=0,
        user_id=user_id,
    )


def _run_async_safe(job: Job) -> None:
    asyncio.run(run_job(job))


def _require_job_owner(job: Job, user: User) -> None:
    """Raise 403 unless ``user`` owns the job (admins bypass)."""
    if user.role == "admin":
        return
    if job.user_id is None or job.user_id != user.id:
        raise HTTPException(403, "forbidden")