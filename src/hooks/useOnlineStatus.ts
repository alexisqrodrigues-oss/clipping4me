import { useEffect, useState } from "react";
import { getBackendUrl } from "@/lib/backend";

/**
 * Online status combinando navigator.onLine + ping ao backend.
 * Retorna { online, backendReachable }.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [backendReachable, setBackendReachable] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const ping = async () => {
      if (!navigator.onLine) {
        if (!cancelled) setBackendReachable(false);
        return;
      }
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(`${getBackendUrl()}/health`, {
          signal: ctrl.signal,
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        clearTimeout(t);
        if (!cancelled) setBackendReachable(res.ok);
      } catch {
        if (!cancelled) setBackendReachable(false);
      }
    };
    ping();
    const t = setInterval(ping, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return {
    online,
    backendReachable,
    /** True quando navegador online E backend respondendo. */
    fullyOnline: online && backendReachable,
  };
}