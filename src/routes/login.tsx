import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getToken, login } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/",
  }),
  head: () => ({
    meta: [{ title: "Entrar — Clipping4me" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Já logado? Manda direto pro destino.
  useEffect(() => {
    if (getToken()) navigate({ to: redirect || "/" });
  }, [navigate, redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate({ to: redirect || "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative z-10 mx-auto flex min-h-[80vh] max-w-md items-center px-6">
      <div className="w-full">
        <div className="mb-8">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            clipping4.me · local studio
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[1.05]">Entrar.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Acesso restrito. Peça um login ao administrador.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Usuário
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
              className="mt-2 w-full rounded-md border border-input bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Senha
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-2 w-full rounded-md border border-input bg-surface px-4 py-3 font-mono text-sm outline-none focus:border-primary"
            />
          </label>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="w-full rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}