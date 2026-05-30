import { Link } from "@tanstack/react-router";
import { AlertTriangle, WifiOff, ShieldAlert, ServerCrash } from "lucide-react";
import type { ApiError } from "@/lib/backend";
import { getErrorMessage } from "@/lib/backend";

export function BackendError({
  error,
  onRetry,
  context,
}: {
  error: ApiError;
  onRetry?: () => void;
  context?: string;
}) {
  const Icon =
    error.kind === "offline"
      ? WifiOff
      : error.kind === "unauthorized" || error.kind === "forbidden"
        ? ShieldAlert
        : error.kind === "server"
          ? ServerCrash
          : AlertTriangle;

  const title =
    error.kind === "offline"
      ? "Servidor de cortes fora do ar"
      : error.kind === "unauthorized"
        ? "Sessão expirada"
        : error.kind === "forbidden"
          ? "Acesso negado"
          : error.kind === "not_found"
            ? "Não encontrado"
            : error.kind === "server"
              ? "Erro no servidor"
              : "Algo deu errado";

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl text-foreground">{title}</h3>
          {context && (
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {context}
            </div>
          )}
          <p className="mt-2 text-sm text-foreground/90">
            {getErrorMessage(error)}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              detalhes técnicos
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-background/60 p-3 font-mono text-[11px] text-muted-foreground">
              {`status: ${error.status}\nurl:    ${error.url}\nkind:   ${error.kind}\n\n${error.message}`}
            </pre>
          </details>
          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Tentar de novo
              </button>
            )}
            {error.kind === "unauthorized" && (
              <Link
                to="/login"
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-2"
              >
                Ir para login
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}