import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createJob, type IngestKind } from "@/lib/backend";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "Novo corte — Clipping4me" },
      {
        name: "description",
        content:
          "Cole um link, faça upload de vídeo ou SRT e gere cortes automáticos.",
      },
      { property: "og:title", content: "Novo corte — Clipping4me" },
      {
        property: "og:description",
        content: "Inicie uma ingestão local de podcast ou palestra.",
      },
    ],
  }),
  component: NewJob,
});

const TABS: { key: IngestKind; label: string; hint: string }[] = [
  { key: "youtube", label: "Link YouTube", hint: "yt-dlp baixa o vídeo + SRT" },
  { key: "upload", label: "Upload vídeo", hint: "Whisper transcreve localmente" },
  { key: "srt", label: "Upload SRT", hint: "Pula transcrição" },
];

function NewJob() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<IngestKind>("youtube");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    (kind === "youtube" && url.trim().length > 5) ||
    ((kind === "upload" || kind === "srt") && file !== null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const source = kind === "youtube" ? url.trim() : file!.name;
    const { job } = await createJob({ kind, source, instructions });
    navigate({ to: "/jobs/$jobId", params: { jobId: job.id } });
  }

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-12">
      <div className="mb-10">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Nova ingestão
        </div>
        <h1 className="mt-2 font-display text-5xl leading-none">
          De onde vem o vídeo?
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setKind(t.key)}
              className={`rounded-md px-4 py-3 text-left transition-colors ${
                kind === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <div className="text-sm font-medium">{t.label}</div>
              <div
                className={`mt-1 font-mono text-[10px] uppercase tracking-widest ${
                  kind === t.key
                    ? "text-primary-foreground/70"
                    : "text-muted-foreground/70"
                }`}
              >
                {t.hint}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          {kind === "youtube" ? (
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                URL do vídeo
              </span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="mt-2 w-full rounded-md border border-input bg-background px-4 py-3 font-mono text-sm outline-none focus:border-primary"
                autoFocus
              />
            </label>
          ) : (
            <DropZone
              kind={kind}
              file={file}
              onFile={setFile}
              accept={
                kind === "upload" ? "video/*,audio/*" : ".srt,application/x-subrip"
              }
            />
          )}
        </div>

        <label className="block">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Instruções para o agente <span className="opacity-50">(opcional)</span>
          </span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            placeholder="Ex.: foco em frases polêmicas, prioridade para storytelling pessoal, evitar temas técnicos."
            className="mt-2 w-full resize-none rounded-md border border-input bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] text-muted-foreground">
            Tudo processado localmente no seu Mac.
          </p>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Criando job…" : "Iniciar processamento"}
          </button>
        </div>
      </form>
    </main>
  );
}

function DropZone({
  kind,
  file,
  onFile,
  accept,
}: {
  kind: IngestKind;
  file: File | null;
  onFile: (f: File | null) => void;
  accept: string;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 py-12 text-center transition-colors ${
        drag
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary/50"
      }`}
    >
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <>
          <div className="font-mono text-sm text-foreground">{file.name}</div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">
            {(file.size / 1024 / 1024).toFixed(1)} MB · clique para trocar
          </div>
        </>
      ) : (
        <>
          <div className="font-display text-2xl text-muted-foreground">
            {kind === "upload" ? "Solte o vídeo aqui" : "Solte o arquivo .srt aqui"}
          </div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            ou clique para selecionar
          </div>
        </>
      )}
    </label>
  );
}