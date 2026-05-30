/**
 * Backend client for the Clipping4me Python service.
 *
 * Configure with VITE_BACKEND_URL (default: https://api.clipping4.me).
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
  speaker?: string | null;
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
  caption?: string;
  hashtags?: string[];
  cta?: string;
  speakers?: string[];
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

const BACKEND_URL_KEY = "clipping4me:backend-url";
const DEFAULT_BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
  "https://api.clipping4.me";

function normalizeBackendUrl(url: string | null | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "");
}

/**
 * Backend URL is fixed via build-time env (VITE_BACKEND_URL). We no longer
 * accept a `?backend=` query-param override — that allowed an attacker to send
 * a crafted link that redirected all authenticated requests (including the
 * Bearer token) to a malicious server.
 *
 * If a legacy override is still in localStorage from a previous build, ignore
 * it and clear it on first read.
 */
export function getBackendUrl(): string {
  if (typeof window !== "undefined") {
    // One-time cleanup of any previously-stored override.
    try {
      if (window.localStorage.getItem(BACKEND_URL_KEY)) {
        window.localStorage.removeItem(BACKEND_URL_KEY);
      }
      // Strip any stale ?backend= from the URL without persisting it.
      const params = new URLSearchParams(window.location.search);
      if (params.has("backend")) {
        params.delete("backend");
        const next = `${window.location.pathname}${
          params.toString() ? `?${params.toString()}` : ""
        }${window.location.hash}`;
        window.history.replaceState({}, "", next);
      }
    } catch {
      /* ignore storage errors */
    }
  }
  return DEFAULT_BACKEND_URL;
}

/** @deprecated backend URL is now fixed at build time. This is a no-op. */
export function setBackendUrl(_url: string): void {
  /* intentionally no-op — see getBackendUrl above */
}

/** @deprecated use getBackendUrl() */
export const BACKEND_URL = DEFAULT_BACKEND_URL;

async function tryFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const { authFetch } = await import("./auth");
    const res = await authFetch(`${getBackendUrl()}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(init?.headers ?? {}),
      },
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
  if (live) return { jobs: live.jobs.map(withAbsoluteUrls), live: true };
  return { jobs: readMock(), live: false };
}

export async function getJob(id: string): Promise<{ job: Job | null; live: boolean }> {
  const live = await tryFetch<{ job: Job }>(`/jobs/${id}`);
  if (live) return { job: withAbsoluteUrls(live.job), live: true };
  const job = readMock().find((j) => j.id === id) ?? null;
  return { job, live: false };
}

export interface CreateJobInput {
  kind: IngestKind;
  source: string;
  instructions: string;
  podcast_title?: string;
  videoFile?: File | null;
  srtFile?: File | null;
}

export async function createJob(
  input: CreateJobInput,
): Promise<{ job: Job; live: boolean }> {
  if (input.kind === "upload" && input.videoFile) {
    try {
      const fd = new FormData();
      fd.append("kind", "upload");
      fd.append("instructions", input.instructions);
      if (input.podcast_title) fd.append("podcast_title", input.podcast_title);
      fd.append("video", input.videoFile);
      if (input.srtFile) fd.append("srt", input.srtFile);
      const { authFetch } = await import("./auth");
      const res = await authFetch(`${getBackendUrl()}/jobs/upload`, {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        const data = (await res.json()) as { job: Job };
        return { job: withAbsoluteUrls(data.job), live: true };
      }
    } catch {
      /* falls through to mock */
    }
  } else {
    const live = await tryFetch<{ job: Job }>("/jobs", {
      method: "POST",
      body: JSON.stringify({
        kind: input.kind,
        source: input.source,
        instructions: input.instructions,
        podcast_title: input.podcast_title,
      }),
    });
    if (live) return { job: withAbsoluteUrls(live.job), live: true };
  }

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

function withAbsoluteUrls(job: Job): Job {
  if (!job.clips) return job;
  return {
    ...job,
    clips: job.clips.map((c) => ({
      ...c,
      thumbnail_url: absolutize(c.thumbnail_url),
      video_url: absolutize(c.video_url),
    })),
  };
}

function absolutize(path?: string): string | undefined {
  if (!path) return path;
  const full = path.startsWith("http") ? path : `${getBackendUrl()}${path}`;
  // anexa ?token=… porque <video src> / <img src> não passam por authFetch
  const token =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("clipping4me:token");
  if (!token) return full;
  const sep = full.includes("?") ? "&" : "?";
  return `${full}${sep}token=${encodeURIComponent(token)}`;
}

export async function openFolder(jobId: string, clipId?: string): Promise<boolean> {
  const live = await tryFetch<{ ok: boolean }>(`/jobs/${jobId}/open`, {
    method: "POST",
    body: JSON.stringify({ clipId }),
  });
  return !!live?.ok;
}

/* ---------- copy editor (Ollama) ---------- */

export type CopyField = "caption" | "description" | "hashtags" | "cta";
export type CopyPreset = "polemico" | "institucional" | "autoridade" | "engajamento";

export interface CopyChatPayload {
  instruction?: string;
  preset?: CopyPreset;
  model?: string;
}

export async function listModels(): Promise<string[]> {
  const res = await tryFetch<{ models: string[] }>("/models");
  return res?.models ?? [];
}

export async function regenerateCopyAll(
  jobId: string,
  clipId: string,
  payload: CopyChatPayload = {},
): Promise<Clip | null> {
  const res = await tryFetch<{ clip: Clip }>(
    `/jobs/${jobId}/clips/${clipId}/copy`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res?.clip ?? null;
}

export async function regenerateCopyField(
  jobId: string,
  clipId: string,
  field: CopyField,
  payload: CopyChatPayload,
): Promise<{ clip: Clip; value: unknown } | null> {
  const res = await tryFetch<{ clip: Clip; value: unknown; field: string }>(
    `/jobs/${jobId}/clips/${clipId}/copy/${field}`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res ? { clip: res.clip, value: res.value } : null;
}

export async function saveCopy(
  jobId: string,
  clipId: string,
  patch: Partial<Pick<Clip, "caption" | "description" | "hashtags" | "cta">>,
): Promise<Clip | null> {
  const res = await tryFetch<{ clip: Clip }>(
    `/jobs/${jobId}/clips/${clipId}/copy`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return res?.clip ?? null;
}

/** URL absoluta autenticada (com ?token=) pra download direto via <a href>. */
export function downloadClipUrl(jobId: string, clipId: string): string {
  const base = `${getBackendUrl()}/jobs/${jobId}/clips/${clipId}/download`;
  const token =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("clipping4me:token");
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
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

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getBackendUrl()}/health`, {
      method: "GET",
      headers: { "ngrok-skip-browser-warning": "true" },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}