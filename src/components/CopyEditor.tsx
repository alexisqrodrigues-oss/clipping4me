import { useEffect, useMemo, useState } from "react";
import {
  regenerateCopyAll,
  regenerateCopyField,
  saveCopy,
  type Clip,
  type CopyField,
  type CopyPreset,
} from "@/lib/backend";

type Draft = {
  caption: string;
  description: string;
  hashtags: string;
  cta: string;
};

const PRESET_OPTIONS: { value: CopyPreset; label: string }[] = [
  { value: "polemico", label: "Polêmico" },
  { value: "institucional", label: "Institucional" },
  { value: "autoridade", label: "Autoridade" },
  { value: "engajamento", label: "Engajamento" },
];

const FIELD_LABELS: Record<CopyField, string> = {
  caption: "Caption (overlay)",
  description: "Descrição do post",
  hashtags: "Hashtags",
  cta: "Call to action",
};

function hashtagsToString(tags: string[] | undefined): string {
  if (!tags || tags.length === 0) return "";
  return tags.map((t) => `#${t.replace(/^#/, "")}`).join(" ");
}

function hashtagsFromString(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((t) => t.trim().replace(/^#+/, "").toLowerCase())
        .filter(Boolean),
    ),
  );
}

function clipToDraft(clip: Clip): Draft {
  return {
    caption: clip.caption ?? "",
    description: clip.description ?? "",
    hashtags: hashtagsToString(clip.hashtags),
    cta: clip.cta ?? "",
  };
}

export function CopyEditor({
  clip,
  jobId,
  onClipUpdate,
}: {
  clip: Clip;
  jobId: string;
  onClipUpdate?: (clip: Clip) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => clipToDraft(clip));
  const [preset, setPreset] = useState<CopyPreset | "">("");
  const [generatingAll, setGeneratingAll] = useState(false);
  const [savingField, setSavingField] = useState<CopyField | null>(null);
  const [error, setError] = useState<string | null>(null);

  // resync quando o clip externo mudar (ex: gerar tudo)
  useEffect(() => {
    setDraft(clipToDraft(clip));
  }, [clip]);

  const hasAny = useMemo(
    () => Boolean(clip.caption || clip.cta || (clip.hashtags && clip.hashtags.length)),
    [clip],
  );

  async function generateAll() {
    setGeneratingAll(true);
    setError(null);
    try {
      const updated = await regenerateCopyAll(jobId, clip.id, {
        preset: preset || undefined,
      });
      if (!updated) throw new Error("Backend offline ou erro na geração");
      onClipUpdate?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setGeneratingAll(false);
    }
  }

  async function regenField(field: CopyField, instruction: string) {
    setSavingField(field);
    setError(null);
    try {
      const res = await regenerateCopyField(jobId, clip.id, field, {
        instruction,
        preset: preset || undefined,
      });
      if (!res) throw new Error("Backend offline ou erro na geração");
      onClipUpdate?.(res.clip);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingField(null);
    }
  }

  async function saveField(field: CopyField) {
    setSavingField(field);
    setError(null);
    try {
      const patch: Partial<Pick<Clip, "caption" | "description" | "hashtags" | "cta">> =
        field === "hashtags"
          ? { hashtags: hashtagsFromString(draft.hashtags) }
          : { [field]: draft[field] };
      const updated = await saveCopy(jobId, clip.id, patch);
      if (!updated) throw new Error("Backend offline");
      onClipUpdate?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSavingField(null);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-border bg-surface-2/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        <span>
          ✎ Copy do post {hasAny ? "" : "(não gerado)"}
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-3">
          {/* preset + gerar tudo */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Tom:
            </span>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as CopyPreset | "")}
              className="rounded border border-border bg-surface px-2 py-1 font-mono text-[11px]"
            >
              <option value="">neutro</option>
              {PRESET_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={generateAll}
              disabled={generatingAll}
              className="rounded bg-primary px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              {generatingAll ? "gerando…" : hasAny ? "regerar tudo" : "gerar tudo"}
            </button>
          </div>

          {error && (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 font-mono text-[10px] text-destructive">
              {error}
            </div>
          )}

          <FieldBlock
            field="caption"
            value={draft.caption}
            onChange={(v) => setDraft((d) => ({ ...d, caption: v }))}
            onSave={() => saveField("caption")}
            onChatRegen={(instr) => regenField("caption", instr)}
            busy={savingField === "caption"}
            multiline={false}
          />

          <FieldBlock
            field="description"
            value={draft.description}
            onChange={(v) => setDraft((d) => ({ ...d, description: v }))}
            onSave={() => saveField("description")}
            onChatRegen={(instr) => regenField("description", instr)}
            busy={savingField === "description"}
            multiline
            rows={6}
          />

          <FieldBlock
            field="hashtags"
            value={draft.hashtags}
            onChange={(v) => setDraft((d) => ({ ...d, hashtags: v }))}
            onSave={() => saveField("hashtags")}
            onChatRegen={(instr) => regenField("hashtags", instr)}
            busy={savingField === "hashtags"}
            multiline
            rows={2}
            placeholder="#podcast #cortes #insight"
          />

          <FieldBlock
            field="cta"
            value={draft.cta}
            onChange={(v) => setDraft((d) => ({ ...d, cta: v }))}
            onSave={() => saveField("cta")}
            onChatRegen={(instr) => regenField("cta", instr)}
            busy={savingField === "cta"}
            multiline={false}
          />
        </div>
      )}
    </div>
  );
}

function FieldBlock({
  field,
  value,
  onChange,
  onSave,
  onChatRegen,
  busy,
  multiline,
  rows = 3,
  placeholder,
}: {
  field: CopyField;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onChatRegen: (instr: string) => void;
  busy: boolean;
  multiline: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const [chat, setChat] = useState("");

  const submitChat = () => {
    const instr = chat.trim();
    if (!instr) return;
    onChatRegen(instr);
    setChat("");
  };

  return (
    <div className="rounded border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {FIELD_LABELS[field]}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChatRegen("")}
            disabled={busy}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {busy ? "…" : "↻ regerar"}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="font-mono text-[10px] uppercase tracking-widest text-primary disabled:opacity-50"
          >
            salvar
          </button>
        </div>
      </div>

      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-y rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      )}

      {/* chat de refinamento */}
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitChat();
            }
          }}
          placeholder="ex: deixa mais polêmico, adiciona CTA pro link da bio…"
          className="flex-1 rounded border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={submitChat}
          disabled={busy || !chat.trim()}
          className="rounded bg-foreground px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-background disabled:opacity-40"
        >
          enviar
        </button>
      </div>
    </div>
  );
}