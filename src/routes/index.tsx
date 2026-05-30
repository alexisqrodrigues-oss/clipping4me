import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  formatRelative,
  listJobs,
  STATUS_LABEL,
  type Job,
  BACKEND_URL,
} from "@/lib/backend";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clipping4me — seus jobs" },
      {
        name: "description",
        content:
          "Painel local de jobs de cortes automáticos de podcasts e palestras.",
      },
      { property: "og:title", content: "Clipping4me — seus jobs" },
      {
        property: "og:description",
        content: "Painel local de jobs de cortes automáticos.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const res = await listJobs();
      if (cancelled) return;
      setJobs(res.jobs);
      setLive(res.live);
      setLoading(false);
    };
    refresh();
    const t = setInterval(refresh, 2000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10 flex items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-5xl leading-none">
            Estúdio de cortes.
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Cole um link, faça upload de vídeo ou SRT — o agente identifica os
            momentos com maior potencial e entrega cortes prontos para edição.
          </p>
        </div>
        <BackendStatus live={live} />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Jobs recentes
          </h2>
          <Link
            to="/new"
            className="font-mono text-xs uppercase tracking-widest text-primary hover:underline"
          >
            + novo
          </Link>
        </div>

        {loading ? (
          <SkeletonList />
        ) : jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function BackendStatus({ live }: { live: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 font-mono text-[11px]">
      <span
        className={`h-2 w-2 rounded-full ${live ? "bg-primary" : "bg-muted-foreground"}`}
      />
      <span className="text-muted-foreground">
        {live ? "backend conectado" : "modo demo · backend offline"}
      </span>
      <span className="text-muted-foreground/60">·</span>
      <span className="text-muted-foreground/80">{BACKEND_URL}</span>
    </div>
  );
}

function JobRow({ job }: { job: Job }) {
  const isActive = job.status !== "done" && job.status !== "error";
  return (
    <li>
      <Link
        to="/jobs/$jobId"
        params={{ jobId: job.id }}
        className="group block rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary/50 hover:bg-surface-2"
      >
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span>{job.kind}</span>
              <span>·</span>
              <span>{formatRelative(job.created_at)}</span>
            </div>
            <h3 className="mt-2 truncate font-display text-2xl">
              {job.podcast_title}
            </h3>
            <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
              {job.source}
            </div>
          </div>
          <div className="text-right">
            <StatusPill status={job.status} />
            <div className="mt-2 font-mono text-xs text-muted-foreground">
              {job.clips?.length ? `${job.clips.length} cortes` : "—"}
            </div>
          </div>
        </div>
        {isActive && (
          <div className="mt-4">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {STATUS_LABEL[job.status]} · {job.progress}%
            </div>
          </div>
        )}
      </Link>
    </li>
  );
}

function StatusPill({ status }: { status: Job["status"] }) {
  const tone =
    status === "done"
      ? "bg-primary text-primary-foreground"
      : status === "error"
        ? "bg-destructive text-destructive-foreground"
        : "bg-secondary text-secondary-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${tone}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-28 animate-pulse rounded-lg border border-border bg-surface"
        />
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface/50 p-16 text-center">
      <div className="font-display text-3xl text-muted-foreground">
        Nenhum job ainda.
      </div>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Comece colando um link do YouTube ou subindo um arquivo de vídeo.
      </p>
      <Link
        to="/new"
        className="mt-6 inline-flex rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Criar primeiro corte
      </Link>
    </div>
  );
}
