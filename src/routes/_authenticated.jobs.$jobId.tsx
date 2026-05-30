import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  formatDuration,
  formatRelative,
  getJob,
  openFolder,
  downloadClipUrl,
  deleteJob,
  retryJob,
  STATUS_LABEL,
  type ApiError,
  type Clip,
  type Job,
} from "@/lib/backend";
import { CopyEditor } from "@/components/CopyEditor";
import { BackendError } from "@/components/BackendError";

export const Route = createFileRoute("/_authenticated/jobs/$jobId")({
  head: ({ params }) => ({
    meta: [
      { title: `Job ${params.jobId} — Clipping4me` },
      { name: "description", content: "Detalhe do job e cortes gerados." },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { jobId } = Route.useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const res = await getJob(jobId);
      if (cancelled) return;
      if (res.ok) {
        setJob(res.data.job);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    };
    refresh();
    const t = setInterval(refresh, 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId, reloadKey]);

  if (loading && !job) {
    return (
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
      </main>
    );
  }

  if (error && !job) {
    return (
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <Link
          to="/app"
          className="mb-6 inline-block font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          ← jobs
        </Link>
        <BackendError
          error={error}
          context={`Job ${jobId}`}
          onRetry={() => {
            setLoading(true);
            setError(null);
            setReloadKey((k) => k + 1);
          }}
        />
      </main>
    );
  }

  if (!job) {
    return (
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <h1 className="font-display text-3xl">Job não encontrado</h1>
          <Link
            to="/app"
            className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-primary"
          >
            ← voltar
          </Link>
        </div>
      </main>
    );
  }

  const isActive = job.status !== "done" && job.status !== "error";
  const isError = job.status === "error";

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
      <Link
        to="/app"
        className="mb-6 inline-block font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        ← jobs
      </Link>

      <header className="mb-10">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>{job.kind}</span>
          <span>·</span>
          <span>{formatRelative(job.created_at)}</span>
          <span>·</span>
          <span>{job.id}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-display text-5xl leading-tight">
            {job.podcast_title}
          </h1>
          <JobActions
            job={job}
            onChange={() => setReloadKey((k) => k + 1)}
          />
        </div>
        <div className="mt-2 font-mono text-xs text-muted-foreground">
          {job.source}
        </div>

        {isActive ? (
          <div className="mt-6 rounded-lg border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="font-mono text-xs uppercase tracking-widest text-foreground">
                {STATUS_LABEL[job.status]}
              </div>
              <div className="font-mono text-xs text-muted-foreground">
                {job.progress}%
              </div>
            </div>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <PipelineSteps current={job.status} />
          </div>
        ) : isError ? (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-destructive">
              Falhou
            </div>
            <p className="mt-2 text-sm text-foreground">
              {job.error ?? "Erro desconhecido no pipeline."}
            </p>
          </div>
        ) : (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary-foreground">
            ● {STATUS_LABEL[job.status]} · {job.clips?.length ?? 0} cortes
          </div>
        )}

        {job.instructions && (
          <details className="mt-6 rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Instruções enviadas ao agente
            </summary>
            <p className="mt-3 text-sm text-foreground">{job.instructions}</p>
          </details>
        )}
      </header>

      {job.clips && job.clips.length > 0 && (
        <section>
          <h2 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Cortes gerados
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {job.clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                jobId={job.id}
                onClipUpdate={(updated) =>
                  setJob((prev) =>
                    prev && prev.clips
                      ? {
                          ...prev,
                          clips: prev.clips.map((c) =>
                            c.id === updated.id ? { ...c, ...updated } : c,
                          ),
                        }
                      : prev,
                  )
                }
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function JobActions({
  job,
  onChange,
}: {
  job: Job;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onRetry() {
    if (busy) return;
    setBusy(true);
    const res = await retryJob(job.id);
    setBusy(false);
    if (!res.ok) {
      alert(`Não foi possível reenviar: ${res.error.message}`);
      return;
    }
    onChange();
  }

  async function onDelete() {
    if (busy) return;
    if (!window.confirm(`Excluir "${job.podcast_title}"? Esta ação é definitiva.`))
      return;
    setBusy(true);
    const res = await deleteJob(job.id);
    setBusy(false);
    if (!res.ok) {
      alert(`Não foi possível excluir: ${res.error.message}`);
      return;
    }
    window.location.assign("/app");
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {job.status === "error" && (
        <button
          onClick={onRetry}
          disabled={busy}
          className="rounded-md bg-primary px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "…" : "Tentar de novo"}
        </button>
      )}
      <button
        onClick={onDelete}
        disabled={busy}
        className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-destructive hover:bg-destructive/20 disabled:opacity-40"
      >
        excluir
      </button>
    </div>
  );
}

function PipelineSteps({ current }: { current: Job["status"] }) {
  const steps: Job["status"][] = [
    "downloading",
    "transcribing",
    "analyzing",
    "cutting",
    "done",
  ];
  const currentIdx = steps.indexOf(current);
  return (
    <ol className="mt-5 grid grid-cols-5 gap-2">
      {steps.map((s, i) => {
        const reached = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <li
            key={s}
            className={`rounded border px-2 py-2 text-center font-mono text-[9px] uppercase tracking-widest transition-colors ${
              active
                ? "border-primary bg-primary/10 text-primary"
                : reached
                  ? "border-border bg-surface-2 text-foreground"
                  : "border-border bg-surface text-muted-foreground/50"
            }`}
          >
            {STATUS_LABEL[s]}
          </li>
        );
      })}
    </ol>
  );
}

function ClipCard({
  clip,
  jobId,
  onClipUpdate,
}: {
  clip: Clip;
  jobId: string;
  onClipUpdate: (clip: Clip) => void;
}) {
  const hue = (clip.index * 67) % 360;
  return (
    <article className="group flex flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary/50">
      <ClipPlayer clip={clip} hue={hue} />
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          #{clip.index.toString().padStart(2, "0")} · {formatDuration(clip.duration)}
        </div>
        <div className="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
          <a
            href={downloadClipUrl(jobId, clip.id)}
            download
            className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline"
            title="Baixar MP4 9:16"
          >
            ↓ mp4
          </a>
          <button
            onClick={() => openFolder(jobId, clip.id)}
            className="font-mono text-[10px] uppercase tracking-widest text-primary"
            title="Abrir pasta no Finder"
          >
            abrir ↗
          </button>
        </div>
      </div>
      <h3 className="mt-2 font-display text-2xl leading-tight">{clip.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{clip.description}</p>

      {clip.speakers && clip.speakers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {clip.speakers.map((sp) => (
            <span
              key={sp}
              className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
              title="Voz detectada (WhisperX)"
            >
              🎙 {sp.replace("SPEAKER_", "voz ")}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {clip.segments.map((s, i) => (
          <span
            key={i}
            className="rounded bg-surface-2 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
            title={s.text}
          >
            {s.role} · {formatDuration(s.end - s.start)}
          </span>
        ))}
      </div>

      {(clip.music_suggestion || clip.thumbnail_copy) && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
          {clip.music_suggestion && (
            <Meta label="trilha" value={clip.music_suggestion} />
          )}
          {clip.thumbnail_copy && (
            <Meta label="thumb copy" value={clip.thumbnail_copy} />
          )}
        </div>
      )}

      <div className="mt-4 truncate font-mono text-[10px] text-muted-foreground/70">
        {clip.folder_path}
      </div>
      <CopyEditor clip={clip} jobId={jobId} onClipUpdate={onClipUpdate} />
    </article>
  );
}

function ClipPlayer({ clip, hue }: { clip: Clip; hue: number }) {
  const [playing, setPlaying] = useState(false);

  if (clip.video_url) {
    return (
      <div className="mb-4 overflow-hidden rounded-md border border-border bg-black">
        <video
          src={clip.video_url}
          poster={clip.thumbnail_url}
          controls
          className="aspect-[9/16] w-full object-cover"
          preload="metadata"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying((p) => !p)}
      className="group/player relative mb-4 flex aspect-[9/16] w-full max-h-72 items-end justify-start overflow-hidden rounded-md border border-border"
      style={{
        background: clip.thumbnail_url
          ? `url(${clip.thumbnail_url}) center/cover`
          : `linear-gradient(135deg, oklch(0.35 0.18 ${hue}) 0%, oklch(0.20 0.10 ${(hue + 60) % 360}) 60%, oklch(0.15 0.05 ${(hue + 120) % 360}) 100%)`,
      }}
      aria-label={`Pré-visualizar ${clip.title}`}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform group-hover/player:scale-110">
        {playing ? (
          <span className="font-mono text-xs">●●●</span>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </div>

      <div className="relative z-10 flex w-full items-end justify-between gap-2 p-3">
        <div className="max-w-[70%] text-left">
          <div className="font-mono text-[9px] uppercase tracking-widest text-white/60">
            #{clip.index.toString().padStart(2, "0")}
          </div>
          <div className="font-display text-base leading-tight text-white drop-shadow">
            {clip.title}
          </div>
        </div>
        <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">
          {formatDuration(clip.duration)}
        </span>
      </div>

      {playing && (
        <div className="absolute inset-x-0 bottom-0 z-20 h-1 overflow-hidden bg-white/20">
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
      )}
    </button>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  );
}