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
          "Cole um link do YouTube ou faça upload de um vídeo e gere cortes automáticos.",
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

type Tab = Exclude<IngestKind, "srt">;
const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: "youtube", label: "Link do YouTube", hint: "yt-dlp baixa o vídeo automaticamente" },
  { key: "upload", label: "Upload de vídeo", hint: "Whisper transcreve localmente (ou anexe um .srt)" },
];

const INSTRUCTION_PRESETS = [
  { label: "Polêmico", text: "Priorize trechos polêmicos, frases de impacto e opiniões fortes que gerem discussão." },
  { label: "Técnico", text: "Foque em explicações técnicas claras, conceitos densos e insights práticos." },
  { label: "Autoridade", text: "Selecione momentos em que o convidado demonstra autoridade, expertise e cases reais." },
  { label: "Storytelling", text: "Priorize histórias pessoais com começo, meio e fim, ganchos emocionais e reviravoltas." },
  { label: "Engraçado", text: "Foque em momentos engraçados, tiradas espontâneas e reações." },
  { label: "Motivacional", text: "Selecione trechos inspiradores, frases de superação e ensinamentos de vida." },
];

function NewJob() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Tab>("youtube");
  const [url, setUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState("");
  const [activePresets, setActivePresets] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    (kind === "youtube" && url.trim().length > 5) ||
    (kind === "upload" && videoFile !== null);

  function togglePreset(label: string, text: string) {
    const isActive = activePresets.includes(label);
    if (isActive) {
      setActivePresets((p) => p.filter((x) => x !== label));
      setInstructions((i) => i.replace(text, "").replace(/\n{3,}/g, "\n\n").trim());
    } else {
      setActivePresets((p) => [...p, label]);
      setInstructions((i) => (i.trim() ? `${i.trim()}\n\n${text}` : text));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    const source =
      kind === "youtube"
        ? url.trim()
        : srtFile
          ? `${videoFile!.name} + ${srtFile.name}`
          : videoFile!.name;
    const { job } = await createJob({ kind, source, instructions });
    navigate({ to: "/jobs/$jobId", params: { jobId: job.id } });
  }

  return (
    <main className="relative z-10 mx-auto max-w-3xl px-6 py-12">
      <div className="mb-10">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Nova ingestão
        </div>
        <h1 className="mt-2 font-display text-5xl leading-[1.05]">
          De onde vem o vídeo?
        </h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface p-1">
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

        <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
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
            <>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Vídeo ou áudio
                </span>
                <div className="mt-2">
                  <DropZone
                    label="Solte o vídeo aqui"
                    file={videoFile}
                    onFile={setVideoFile}
                    accept="video/*,audio/*"
                  />
                </div>
              </div>
              <div>
                <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Legenda (.srt) <span className="opacity-50">— opcional, pula transcrição</span>
                </span>
                <div className="mt-2">
                  <DropZone
                    label="Solte o .srt do mesmo vídeo (opcional)"
                    file={srtFile}
                    onFile={setSrtFile}
                    accept=".srt,application/x-subrip"
                    compact
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Instruções para o agente <span className="opacity-50">(opcional)</span>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {INSTRUCTION_PRESETS.map((p) => {
              const active = activePresets.includes(p.label);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => togglePreset(p.label, p.text)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {active ? "✓ " : "+ "}
                  {p.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            placeholder="Ou escreva instruções customizadas: evite temas religiosos, priorize convidado X, etc."
            className="mt-3 w-full resize-none rounded-md border border-input bg-surface px-4 py-3 text-sm outline-none focus:border-primary"
          />
        </div>

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
  label,
  file,
  onFile,
  accept,
  compact,
}: {
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
  accept: string;
  compact?: boolean;
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
      className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed text-center transition-colors ${
        compact ? "px-4 py-6" : "px-6 py-12"
      } ${
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
          <div className={`font-display text-muted-foreground ${compact ? "text-base" : "text-2xl"}`}>
            {label}
          </div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            ou clique para selecionar
          </div>
        </>
      )}
    </label>
  );
}