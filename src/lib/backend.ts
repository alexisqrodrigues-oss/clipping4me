/**
 * Backend client for the local Clipping4me Python service.
 *
 * Configure with VITE_BACKEND_URL (default: http://localhost:8000).
 * When the backend is offline, the app falls back to mock data so the UI
 * is fully usable for design/demo before the Python service exists.
 */

export type JobStatus =
  | "queued"
  | "downloading"
  | "transcribing"
  | "analyzing"
  | "cutting"
  | "done"
  | "error";

export type IngestKind = "youtube" | "upload" | "srt";

export interface ClipSegment {
  role: "hook" | "dev" | "close" | string;
  start: number;
  end: number;
  text: string;
}

export interface Clip {
  id: string;
  index: number;
  title: string;
  description: string;
  observations: string;
  music_suggestion?: string;
  thumbnail_copy?: string;
  thumbnail_url?: string;
  video_url?: string;
  duration: number;
  segments: ClipSegment[];
  folder_path: string;
}

export interface Job {
  id: string;
  kind: IngestKind;
  source: string;
  podcast_title: string;
  instructions: string;
  status: JobStatus;
  progress: number;
  created_at: string;
  clips?: Clip[];
  error?: string;
}

export const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
  "http://localhost:8000";

async function tryFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ---------- mock store (used while backend offline) ---------- */

const MOCK_KEY = "clipping4me:mock-jobs";

function seedMock(): Job[] {
  return [
    {
      id: "job_demo_1",
      kind: "youtube",
      source: "https://www.youtube.com/watch?v=demo",
      podcast_title: "Flow Podcast #420 — Convidado Exemplo",
      instructions: "Foco em momentos polêmicos e frases de impacto.",
      status: "done",
      progress: 100,
      created_at: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
      clips: [
        {
          id: "c1",
          index: 1,
          title: "O erro que todo iniciante comete",
          description: "Reflexão direta sobre o ponto cego mais comum no mercado.",
          observations:
            "Sugiro trilha lo-fi com kick marcado. Thumb: rosto + texto 'NÃO FAÇA ISSO'.",
          music_suggestion: "lo-fi tense, 90 bpm",
          thumbnail_copy: "NÃO FAÇA ISSO",
          duration: 48,
          folder_path:
            "~/Clipping4me/Cortes/2026-05-30 Flow Podcast/01 - O erro que todo iniciante comete",
          segments: [
            { role: "hook", start: 1234, end: 1241, text: "Esse é o erro número um..." },
            { role: "dev", start: 1320, end: 1348, text: "Quando você começa..." },
            { role: "close", start: 1410, end: 1425, text: "Por isso é tão importante..." },
          ],
        },
        {
          id: "c2",
          index: 2,
          title: "A história que mudou minha carreira",
          description: "Storytelling pessoal com gancho emocional forte.",
          observations: "Música cinematográfica crescente. B-roll de cidade noturna.",
          music_suggestion: "cinematic build-up",
          thumbnail_copy: "ELE MUDOU TUDO",
          duration: 55,
          folder_path:
            "~/Clipping4me/Cortes/2026-05-30 Flow Podcast/02 - A história que mudou minha carreira",
          segments: [
            { role: "hook", start: 2210, end: 2218, text: "Era 2018 e eu tinha..." },
            { role: "dev", start: 2240, end: 2275, text: "Aí esse cara me chamou..." },
            { role: "close", start: 2300, end: 2312, text: "Hoje eu entendo que..." },
          ],
        },
      ],
    },
    {
      id: "job_demo_2",
      kind: "upload",
      source: "palestra-design-2024.mp4",
      podcast_title: "Palestra Design 2024",
      instructions: "",
      status: "analyzing",
      progress: 62,
      created_at: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    },
  ];
}

function readMock(): Job[] {
  if (typeof window === "undefined") return seedMock();
  const raw = window.localStorage.getItem(MOCK_KEY);
  if (!raw) {
    const seeded = seedMock();
    window.localStorage.setItem(MOCK_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw) as Job[];
  } catch {
    return seedMock();
  }
}

function writeMock(jobs: Job[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MOCK_KEY, JSON.stringify(jobs));
}

/* ---------- public API ---------- */

export async function listJobs(): Promise<{ jobs: Job[]; live: boolean }> {
  const live = await tryFetch<{ jobs: Job[] }>("/jobs");
  if (live) return { jobs: live.jobs, live: true };
  return { jobs: readMock(), live: false };
}

export async function getJob(id: string): Promise<{ job: Job | null; live: boolean }> {
  const live = await tryFetch<{ job: Job }>(`/jobs/${id}`);
  if (live) return { job: live.job, live: true };
  const job = readMock().find((j) => j.id === id) ?? null;
  return { job, live: false };
}

export interface CreateJobInput {
  kind: IngestKind;
  source: string;
  instructions: string;
  podcast_title?: string;
}

export async function createJob(
  input: CreateJobInput,
): Promise<{ job: Job; live: boolean }> {
  const live = await tryFetch<{ job: Job }>("/jobs", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (live) return { job: live.job, live: true };

  // Mock: create + simulate progression.
  const id = `job_${Math.random().toString(36).slice(2, 8)}`;
  const job: Job = {
    id,
    kind: input.kind,
    source: input.source,
    podcast_title: input.podcast_title || guessTitle(input),
    instructions: input.instructions,
    status: "queued",
    progress: 0,
    created_at: new Date().toISOString(),
  };
  const jobs = [job, ...readMock()];
  writeMock(jobs);
  simulateMockProgress(id);
  return { job, live: false };
}

export async function openFolder(jobId: string, clipId?: string): Promise<boolean> {
  const live = await tryFetch<{ ok: boolean }>(`/jobs/${jobId}/open`, {
    method: "POST",
    body: JSON.stringify({ clipId }),
  });
  return !!live?.ok;
}

function guessTitle(input: CreateJobInput): string {
  if (input.kind === "youtube") return "Vídeo do YouTube";
  return input.source.replace(/\.[^.]+$/, "");
}

function simulateMockProgress(id: string) {
  const stages: { status: JobStatus; ms: number; progress: number }[] = [
    { status: "downloading", ms: 1500, progress: 20 },
    { status: "transcribing", ms: 2500, progress: 45 },
    { status: "analyzing", ms: 2500, progress: 70 },
    { status: "cutting", ms: 2000, progress: 90 },
    { status: "done", ms: 1500, progress: 100 },
  ];
  let acc = 0;
  for (const stage of stages) {
    acc += stage.ms;
    setTimeout(() => {
      const jobs = readMock();
      const j = jobs.find((x) => x.id === id);
      if (!j) return;
      j.status = stage.status;
      j.progress = stage.progress;
      if (stage.status === "done") {
        j.clips = seedMock()[0].clips!.map((c, i) => ({
          ...c,
          id: `${id}_c${i}`,
          folder_path: c.folder_path.replace("Flow Podcast", j.podcast_title),
        }));
      }
      writeMock(jobs);
    }, acc);
  }
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "Na fila",
  downloading: "Baixando",
  transcribing: "Transcrevendo",
  analyzing: "Analisando",
  cutting: "Cortando",
  done: "Pronto",
  error: "Erro",
};

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}