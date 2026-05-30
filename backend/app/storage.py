"""Persistência simples em JSON. Suficiente pra rodar local."""
from __future__ import annotations

import json
import threading
from typing import Dict, List

from .config import STATE_FILE, ensure_dirs
from .models import Job

_lock = threading.Lock()


def _read_raw() -> Dict[str, dict]:
    ensure_dirs()
    if not STATE_FILE.exists():
        return {}
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {}


def _write_raw(data: Dict[str, dict]) -> None:
    ensure_dirs()
    STATE_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def list_jobs() -> List[Job]:
    with _lock:
        raw = _read_raw()
    jobs = [Job(**v) for v in raw.values()]
    jobs.sort(key=lambda j: j.created_at, reverse=True)
    return jobs


def get_job(job_id: str) -> Job | None:
    with _lock:
        raw = _read_raw()
    data = raw.get(job_id)
    return Job(**data) if data else None


def save_job(job: Job) -> None:
    with _lock:
        raw = _read_raw()
        raw[job.id] = json.loads(job.model_dump_json())
        _write_raw(raw)


def update_job(job_id: str, **fields) -> Job | None:
    with _lock:
        raw = _read_raw()
        if job_id not in raw:
            return None
        raw[job_id].update(fields)
        _write_raw(raw)
        return Job(**raw[job_id])