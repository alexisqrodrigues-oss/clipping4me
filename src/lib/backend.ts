/**
 * Cliente HTTP do backend.
 *
 * Sem mocks. Se o servidor não responde, retornamos um erro tipado e a UI
 * mostra a causa real (offline, 401, 5xx, etc) — nunca dados falsos.
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

export type ApiErrorKind =
  | "offline"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "server"
  | "unknown";

export interface ApiError {
  kind: ApiErrorKind;
  status: number; // 0 quando não houve resposta HTTP
  message: string;
  url: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

const BACKEND_URL_KEY = "clipping4me:backend-url";

function isProductionHost(): boolean {
  if (typeof window === "undefined") return true; // SSR = assume produção
  const host = window.location.hostname;
  return host === "clipping4.me" || host === "www.clipping4.me";
}

function getDefaultBackendUrl(): string {
  // Build-time override (CI/CD / env)
  const envUrl = (import.meta.env.VITE_BACKEND_URL as string | undefined);
  if (envUrl) return envUrl;

  // Em localhost/preview aponta pro backend local automaticamente
  if (!isProductionHost()) {
    return "http://127.0.0.1:8000";
  }

  // Produção: domínio público via Cloudflare Tunnel
  return "https://api.clipping4.me";
}

function normalizeBackendUrl(url: string | null | undefined): string {
  return (url ?? "").trim().replace(/\/+$/, "");
}

/**
 * Retorna a URL do backend.
 *
 * - Em produção (clipping4.me): sempre https://api.clipping4.me (ignora override)
 * - Em localhost/preview: usa http://127.0.0.1:8000 por padrão, mas permite
 *   override via query param ?backend= (útil pro .command local)
 */
export function getBackendUrl(): string {
  const defaultUrl = getDefaultBackendUrl();

  // Produção: nunca aceita override (segurança)
  if (isProductionHost()) {
    return defaultUrl;
  }

  // Local/preview: permite ?backend= override (limpa da URL depois)
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const override = normalizeBackendUrl(params.get("backend"));
    if (override) {
      // Limpa o param da URL pra não ficar na history
      params.delete("backend");
      const next = `${window.location.pathname}${
        params.toString() ? `?${params.toString()}` : ""
      }${window.location.hash}`;
      window.history.replaceState({}, "", next);
      return override;
    }
  }

  return defaultUrl;
}

/** @deprecated backend URL é dinâmico agora. Use getBackendUrl(). */
export function setBackendUrl(_url: string): void {
  /* intentionally no-op */
}

/** @deprecated use getBackendUrl() */
export const BACKEND_URL = getDefaultBackendUrl();

function classifyStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status >= 500) return "server";
  return "unknown";
}

function describeError(error: ApiError): string {
  switch (error.kind) {
    case "offline":
      return `Não foi possível falar com o servidor (${getBackendUrl()}). Verifique se o serviço está no ar.`;
    case "unauthorized":
      return "Sua sessão expirou. Faça login novamente.";
    case "forbidden":
      return "Você não tem permissão para essa ação.";
    case "not_found":
      return "Recurso não encontrado.";
    case "server":
      return `O servidor retornou erro ${error.status}. Tente novamente em alguns segundos.`;
    default:
      return error.message || `Erro ${error.status}`;
  }
}

export function getErrorMessage(error: ApiError): string {
  return describeError(error);
}

const DEFAULT_TIMEOUT_MS = 15_000;

async function apiCall<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<ApiResult<T>> {
  const url = `${getBackendUrl()}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const { authFetch } = await import("./auth");
    const isFormData =
      typeof FormData !== "undefined" && init?.body instanceof FormData;
    const baseHeaders: Record<string, string> = {
      "ngrok-skip-browser-warning": "true",
    };
    if (!isFormData) baseHeaders["Content-Type"] = "application/json";
    const res = await authFetch(url, {
      ...init,
      signal: controller.signal,
      headers: { ...baseHeaders, ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const kind = classifyStatus(res.status);
      let message = `${res.status} ${res.statusText}`;
      try {
        const text = await res.text();
        if (text) message = text.slice(0, 500);
      } catch {
        /* ignore */
      }
      return { ok: false, error: { kind, status: res.status, message, url } };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: { kind: "offline", status: 0, message, url },
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* ---------- public API ---------- */

export async function listJobs(): Promise<ApiResult<{ jobs: Job[] }>> {
  const res = await apiCall<{ jobs: Job[] }>("/jobs");
  if (!res.ok) return res;
  return { ok: true, data: { jobs: res.data.jobs.map(withAbsoluteUrls) } };
}

export async function getJob(id: string): Promise<ApiResult<{ job: Job }>> {
  const res = await apiCall<{ job: Job }>(`/jobs/${id}`);
  if (!res.ok) return res;
  return { ok: true, data: { job: withAbsoluteUrls(res.data.job) } };
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
): Promise<ApiResult<{ job: Job }>> {
  if (input.kind === "upload" && input.videoFile) {
    const fd = new FormData();
    fd.append("kind", "upload");
    fd.append("instructions", input.instructions);
    if (input.podcast_title) fd.append("podcast_title", input.podcast_title);
    fd.append("video", input.videoFile);
    if (input.srtFile) fd.append("srt", input.srtFile);
    const res = await apiCall<{ job: Job }>("/jobs/upload", {
      method: "POST",
      body: fd,
      timeoutMs: 10 * 60_000, // uploads grandes
    });
    if (!res.ok) return res;
    return { ok: true, data: { job: withAbsoluteUrls(res.data.job) } };
  }

  const res = await apiCall<{ job: Job }>("/jobs", {
    method: "POST",
    body: JSON.stringify({
      kind: input.kind,
      source: input.source,
      instructions: input.instructions,
      podcast_title: input.podcast_title,
    }),
  });
  if (!res.ok) return res;
  return { ok: true, data: { job: withAbsoluteUrls(res.data.job) } };
}

export async function deleteJob(id: string): Promise<ApiResult<{ ok: true }>> {
  return apiCall<{ ok: true }>(`/jobs/${id}`, { method: "DELETE" });
}

export async function retryJob(id: string): Promise<ApiResult<{ job: Job }>> {
  return apiCall<{ job: Job }>(`/jobs/${id}/retry`, { method: "POST" });
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
  const res = await apiCall<{ ok: boolean }>(`/jobs/${jobId}/open`, {
    method: "POST",
    body: JSON.stringify({ clipId }),
  });
  return res.ok && !!res.data.ok;
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
  const res = await apiCall<{ models: string[] }>("/models");
  return res.ok ? res.data.models : [];
}

export async function regenerateCopyAll(
  jobId: string,
  clipId: string,
  payload: CopyChatPayload = {},
): Promise<Clip | null> {
  const res = await apiCall<{ clip: Clip }>(
    `/jobs/${jobId}/clips/${clipId}/copy`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.ok ? res.data.clip : null;
}

export async function regenerateCopyField(
  jobId: string,
  clipId: string,
  field: CopyField,
  payload: CopyChatPayload,
): Promise<{ clip: Clip; value: unknown } | null> {
  const res = await apiCall<{ clip: Clip; value: unknown; field: string }>(
    `/jobs/${jobId}/clips/${clipId}/copy/${field}`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.ok ? { clip: res.data.clip, value: res.data.value } : null;
}

export async function saveCopy(
  jobId: string,
  clipId: string,
  patch: Partial<Pick<Clip, "caption" | "description" | "hashtags" | "cta">>,
): Promise<Clip | null> {
  const res = await apiCall<{ clip: Clip }>(
    `/jobs/${jobId}/clips/${clipId}/copy`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return res.ok ? res.data.clip : null;
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

/* ---------- health detalhado ---------- */

export type HealthStatus = "ok" | "warn" | "error";

export interface HealthCheck {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface HealthFull {
  overall: HealthStatus;
  checks: HealthCheck[];
  reachable: boolean;
}

export async function checkHealthFull(): Promise<HealthFull> {
  try {
    const res = await fetch(`${getBackendUrl()}/health/full`, {
      method: "GET",
      headers: { "ngrok-skip-browser-warning": "true" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        overall: "error",
        reachable: false,
        checks: [
          {
            id: "api",
            label: "API",
            status: "error",
            detail: `respondeu ${res.status}`,
          },
        ],
      };
    }
    const data = (await res.json()) as { overall: HealthStatus; checks: HealthCheck[] };
    return { ...data, reachable: true };
  } catch (e) {
    return {
      overall: "error",
      reachable: false,
      checks: [
        {
          id: "api",
          label: "API",
          status: "error",
          detail: e instanceof Error ? e.message : "sem resposta",
        },
      ],
    };
  }
}