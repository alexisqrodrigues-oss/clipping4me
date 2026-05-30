"""Modelos espelham src/lib/backend.ts do frontend."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

JobStatus = Literal[
    "queued", "downloading", "transcribing", "analyzing", "cutting", "done", "error"
]
IngestKind = Literal["youtube", "upload", "srt"]


class ClipSegment(BaseModel):
    role: str  # hook | dev | close
    start: float
    end: float
    text: str


class Clip(BaseModel):
    id: str
    index: int
    title: str
    description: str
    observations: str = ""
    music_suggestion: Optional[str] = None
    thumbnail_copy: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    duration: float
    segments: List[ClipSegment] = []
    folder_path: str


class Job(BaseModel):
    id: str
    kind: IngestKind
    source: str
    podcast_title: str
    instructions: str = ""
    status: JobStatus = "queued"
    progress: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    clips: Optional[List[Clip]] = None
    error: Optional[str] = None


class CreateJobInput(BaseModel):
    kind: IngestKind
    source: str
    instructions: str = ""
    podcast_title: Optional[str] = None


class OpenFolderInput(BaseModel):
    clipId: Optional[str] = None