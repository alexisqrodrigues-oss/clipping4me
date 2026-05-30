import { useEffect, useRef, useState } from "react";
import { checkHealth, getBackendUrl, setBackendUrl } from "@/lib/backend";

export function BackendStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(getBackendUrl());
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const ok = await checkHealth();
      if (!cancelled) setOnline(ok);
    };
    ping();
    const t = setInterval(ping, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const label =
    online === null ? "checando…" : online ? "online" : "offline · modo demo";
  const dot =
    online === null
      ? "bg-muted-foreground animate-pulse"
      : online
        ? "bg-primary shadow-[0_0_8px_var(--color-primary)]"
        : "bg-destructive";

  function save() {
    setBackendUrl(url);
    setUrl(getBackendUrl());
    setOpen(false);
    // força um re-ping imediato
    checkHealth().then(setOnline);
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        onClick={() => {
          setUrl(getBackendUrl());
          setOpen((o) => !o);
        }}
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[10px] transition-colors hover:border-primary/50"
        title={getBackendUrl()}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-popover p-4 shadow-2xl">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            URL do backend
          </div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="http://localhost:8000"
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary"
            autoFocus
          />
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setBackendUrl("");
                setUrl(getBackendUrl());
                checkHealth().then(setOnline);
              }}
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              ↺ resetar
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              salvar
            </button>
          </div>
          <p className="mt-3 font-mono text-[9px] leading-relaxed text-muted-foreground">
            Use <span className="text-foreground">http://localhost:8000</span> pra
            uso só no seu Mac. Pra LAN/internet, use uma URL HTTPS (Cloudflare
            Tunnel, ngrok, Tailscale Funnel).
          </p>
        </div>
      )}
    </div>
  );
}