import { useEffect, useState } from "react";
import { checkHealth, getBackendUrl } from "@/lib/backend";
import { getToken } from "@/lib/auth";

export function BackendStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [authOk, setAuthOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const ok = await checkHealth();
      if (!cancelled) setOnline(ok);
      // se tem token, também valida sessão
      const token = getToken();
      if (!token) {
        if (!cancelled) setAuthOk(null);
        return;
      }
      if (!ok) {
        if (!cancelled) setAuthOk(null);
        return;
      }
      try {
        const res = await fetch(`${getBackendUrl()}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "ngrok-skip-browser-warning": "true",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (!cancelled) setAuthOk(res.ok);
      } catch {
        if (!cancelled) setAuthOk(false);
      }
    };
    ping();
    const t = setInterval(ping, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  let label = "checando…";
  let dot = "bg-muted-foreground animate-pulse";
  if (online === false) {
    label = "servidor offline";
    dot = "bg-destructive";
  } else if (online === true) {
    if (authOk === false) {
      label = "sessão inválida";
      dot = "bg-yellow-500";
    } else {
      label = "online";
      dot = "bg-primary shadow-[0_0_8px_var(--color-primary)]";
    }
  }

  return (
    <div className="relative">
      <div
        className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-[10px]"
        title={getBackendUrl()}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}