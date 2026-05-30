import { useEffect, useState } from "react";
import { BACKEND_URL, checkHealth } from "@/lib/backend";

export function BackendStatus() {
  const [online, setOnline] = useState<boolean | null>(null);

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

  const label =
    online === null ? "checando…" : online ? "online" : "offline · modo demo";
  const dot =
    online === null
      ? "bg-muted-foreground animate-pulse"
      : online
        ? "bg-primary shadow-[0_0_8px_var(--color-primary)]"
        : "bg-destructive";

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[10px]"
      title={BACKEND_URL}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}