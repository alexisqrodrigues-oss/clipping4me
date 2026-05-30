import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getToken, login } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : "/app",
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
  const [showRequest, setShowRequest] = useState(false);

  // Já logado? Manda direto pro destino.
  useEffect(() => {
    if (getToken()) navigate({ to: redirect || "/app" });
  }, [navigate, redirect]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate({ to: redirect || "/app" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative z-10 mx-auto grid min-h-[80vh] max-w-5xl gap-12 px-6 py-12 md:grid-cols-2 md:items-center">
      <section className="order-2 md:order-1">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
          clipping4.me
        </div>
        <h2 className="mt-4 font-display text-4xl leading-[1.05] md:text-5xl">
          Plataforma inteligente de cortes de podcast.
        </h2>
        <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
          IA que lê o contexto semântico do episódio inteiro, identifica os
          melhores ganchos e entrega cortes 9:16 já no tempo certo de TikTok,
          Reels e Shorts.
        </p>
        <ul className="mt-8 space-y-3 text-sm">
          {[
            "Análise semântica do podcast inteiro, não recortes aleatórios",
            "Diarização de áudio: corte só do host, do convidado ou do diálogo",
            "Legenda com identidade verbal do falante selecionado",
            "Presets prontos: polêmico, autoridade, engajamento, institucional",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-foreground/90">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="order-1 w-full md:order-2">
        <div className="mb-8">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            entrar
          </div>
          <h1 className="mt-2 font-display text-5xl leading-[1.05]">Entrar.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Acesso restrito a usuários cadastrados.
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

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            Ainda não tem acesso?
          </p>
          <button
            type="button"
            onClick={() => setShowRequest((s) => !s)}
            className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-2"
          >
            Solicitar acesso
          </button>
          {showRequest && <RequestAccessForm />}
        </div>
      </div>
    </main>
  );
}

function RequestAccessForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [channel, setChannel] = useState("");

  const ok = name.trim() && email.trim();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const body = [
      `Nome: ${name}`,
      `Email: ${email}`,
      `WhatsApp: ${whatsapp || "—"}`,
      `Canal/Podcast: ${channel || "—"}`,
    ].join("\n");
    const url = `mailto:contato@clipping4.me?subject=${encodeURIComponent(
      "Solicitação de acesso — Clipping4me",
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-md border border-border bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          required
          className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
        />
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="WhatsApp (opcional)"
          className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
        />
        <input
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="Canal / Podcast"
          className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
        />
      </div>
      <button
        type="submit"
        disabled={!ok}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
      >
        Enviar solicitação
      </button>
      <p className="text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Vamos abrir seu cliente de email com os dados pré-preenchidos.
      </p>
    </form>
  );
}