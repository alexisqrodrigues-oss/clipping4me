import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  formatDuration,
  formatRelative,
  getJob,
  openFolder,
  STATUS_LABEL,
  type Clip,
  type Job,
} from "@/lib/backend";

export const Route = createFileRoute("/jobs/$jobId")({
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

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { job } = await getJob(jobId);
      if (cancelled) return;
      setJob(job);
      setLoading(false);
    };
    refresh();
    const t = setInterval(refresh, 1500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId]);

  if (loading) {
    return (
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
      </main>
    );
  }

  if (!job) {
    return (
      <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-lg border border-border bg-surface p-12 text-center">
          <h1 className="font-display text-3xl">Job não encontrado</h1>
          <Link
            to="/"
            className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-primary"
          >
            ← voltar
          </Link>
        </div>
      </main>
    );
  }

  const isActive = job.status !== "done" && job.status !== "error";

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
      <Link
        to="/"
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
        <h1 className="mt-2 font-display text-5xl leading-tight">
          {job.podcast_title}
        </h1>
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
              <ClipCard key={clip.id} clip={clip} jobId={job.id} />
            ))}
          </div>
        </section>
      )}
    </main>
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

function ClipCard({ clip, jobId }: { clip: Clip; jobId: string }) {
  return (
    <article className="group flex flex-col rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          #{clip.index.toString().padStart(2, "0")} · {formatDuration(clip.duration)}
        </div>
        <button
          onClick={() => openFolder(jobId, clip.id)}
          className="font-mono text-[10px] uppercase tracking-widest text-primary opacity-0 transition-opacity group-hover:opacity-100"
          title="Abrir pasta no Finder"
        >
          abrir ↗
        </button>
      </div>
      <h3 className="mt-2 font-display text-2xl leading-tight">{clip.title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{clip.description}</p>

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
    </article>
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