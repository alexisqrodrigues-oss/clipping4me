import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  checkHealthFull,
  getBackendUrl,
  type HealthFull,
  type HealthStatus,
} from "@/lib/backend";

const OVERALL_LABEL: Record<HealthStatus, string> = {
  ok: "operacional",
  warn: "parcial",
  error: "indisponível",
};

const DOT_CLASS: Record<HealthStatus, string> = {
  ok: "bg-primary shadow-[0_0_8px_var(--color-primary)]",
  warn: "bg-yellow-500 shadow-[0_0_8px_rgb(234_179_8_/_0.6)]",
  error: "bg-destructive shadow-[0_0_8px_rgb(239_68_68_/_0.6)]",
};

const ROW_DOT: Record<HealthStatus, string> = {
  ok: "bg-primary",
  warn: "bg-yellow-500",
  error: "bg-destructive",
};

export function BackendStatus() {
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<HealthFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const h = await checkHealthFull();
      if (!cancelled) {
        setHealth(h);
        setLastChecked(new Date());
        setLoading(false);
      }
    };
    run();
    const t = setInterval(run, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [mounted]);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[10px]">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="uppercase tracking-widest text-muted-foreground">
          ···
        </span>
      </div>
    );
  }

  const overall: HealthStatus = health?.overall ?? "error";
  const label = health ? OVERALL_LABEL[overall] : "checando…";
  const dot = health ? DOT_CLASS[overall] : "bg-muted-foreground animate-pulse";

  const okCount = health?.checks.filter((c) => c.status === "ok").length ?? 0;
  const total = health?.checks.length ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[10px] transition-colors hover:bg-secondary"
          title="Ver detalhes do servidor"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          <span className="uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          {health && (
            <span className="font-mono text-[9px] text-muted-foreground">
              {okCount}/{total}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border-border bg-background p-0 font-mono text-xs"
      >
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Status do servidor
            </span>
            <span className={`flex items-center gap-1.5`}>
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              <span className="text-[10px] uppercase tracking-widest text-foreground">
                {label}
              </span>
            </span>
          </div>
          <div className="mt-1 truncate text-[10px] text-muted-foreground">
            {getBackendUrl()}
          </div>
        </div>

        <ul className="divide-y divide-border">
          {health?.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
              <span
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${ROW_DOT[c.status]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-foreground">{c.label}</span>
                  <span
                    className={`text-[9px] uppercase tracking-widest ${
                      c.status === "ok"
                        ? "text-primary"
                        : c.status === "warn"
                          ? "text-yellow-500"
                          : "text-destructive"
                    }`}
                  >
                    {c.status === "ok" ? "ok" : c.status === "warn" ? "atenção" : "falha"}
                  </span>
                </div>
                <div className="mt-0.5 break-words text-[10px] text-muted-foreground">
                  {c.detail}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>
            {lastChecked
              ? `atualizado ${lastChecked.toLocaleTimeString()}`
              : loading
                ? "verificando…"
                : ""}
          </span>
          <button
            onClick={async () => {
              setLoading(true);
              const h = await checkHealthFull();
              setHealth(h);
              setLastChecked(new Date());
              setLoading(false);
            }}
            disabled={loading}
            className="rounded border border-border px-2 py-0.5 uppercase tracking-widest hover:text-foreground disabled:opacity-50"
          >
            {loading ? "···" : "recheck"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}