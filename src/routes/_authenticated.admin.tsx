import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getBackendUrl } from "@/lib/backend";
import {
  authFetch,
  getUser,
  type AuthUser,
  type Role,
} from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Clipping4me" }] }),
  component: AdminPage,
});

type AdminUser = AuthUser;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${getBackendUrl()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Erro ${res.status}`);
  }
  return (await res.json()) as T;
}

type GateStatus =
  | { kind: "checking" }
  | { kind: "ok"; me: AuthUser }
  | {
      kind: "blocked";
      reason: "offline" | "unauthenticated" | "not_admin" | "unknown";
      detail: string;
      me?: AuthUser | null;
    };

function AdminGate({ children }: { children: (me: AuthUser) => React.ReactNode }) {
  const [status, setStatus] = useState<GateStatus>({ kind: "checking" });

  async function check() {
    setStatus({ kind: "checking" });
    const backend = getBackendUrl();
    try {
      const res = await authFetch(`${backend}/auth/me`);
      if (res.status === 401 || res.status === 403) {
        setStatus({
          kind: "blocked",
          reason: "unauthenticated",
          detail: `O backend respondeu ${res.status}. Sua sessão expirou ou o token é inválido. Faça login novamente.`,
          me: getUser(),
        });
        return;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        setStatus({
          kind: "blocked",
          reason: "unknown",
          detail: `O backend respondeu ${res.status} ao verificar sua identidade. ${body || ""}`.trim(),
          me: getUser(),
        });
        return;
      }
      const me = (await res.json()) as AuthUser;
      if (me.role !== "admin") {
        setStatus({
          kind: "blocked",
          reason: "not_admin",
          detail: `Você está logado como "${me.username}" com o papel "${me.role}". Apenas usuários com papel "admin" podem acessar esta tela.`,
          me,
        });
        return;
      }
      setStatus({ kind: "ok", me });
    } catch (e) {
      // Tipicamente "Load failed" / TypeError: backend fora do ar
      const msg = e instanceof Error ? e.message : String(e);
      setStatus({
        kind: "blocked",
        reason: "offline",
        detail: `Não consegui falar com o backend em ${backend}. Verifique se o servidor está rodando (rode o Clipping4Me.command no Mac) e tente novamente. Detalhe técnico: ${msg}`,
        me: getUser(),
      });
    }
  }

  useEffect(() => {
    void check();
  }, []);

  if (status.kind === "checking") {
    return (
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Admin
        </div>
        <div className="mt-4 h-24 animate-pulse rounded-lg border border-border bg-surface" />
        <p className="mt-3 font-mono text-[11px] text-muted-foreground">
          Verificando permissões com o backend…
        </p>
      </main>
    );
  }

  if (status.kind === "blocked") {
    const titles: Record<typeof status.reason, string> = {
      offline: "Backend offline",
      unauthenticated: "Sessão inválida",
      not_admin: "Sem permissão de admin",
      unknown: "Erro inesperado",
    };
    return (
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Admin · acesso negado
        </div>
        <h1 className="mt-2 font-display text-4xl leading-[1.05]">
          {titles[status.reason]}.
        </h1>

        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-5">
          <p className="font-mono text-sm leading-relaxed text-foreground">
            {status.detail}
          </p>
          {status.me && (
            <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              sessão local: {status.me.username} · {status.me.role} · {status.me.id}
            </p>
          )}
          <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            backend: {getBackendUrl()}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => void check()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Tentar de novo
          </button>
          {status.reason === "unauthenticated" ? (
            <Link
              to="/login"
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-2"
            >
              Ir para login
            </Link>
          ) : (
            <Link
              to="/app"
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-2"
            >
              Voltar para o app
            </Link>
          )}
        </div>
      </main>
    );
  }

  return <>{children(status.me)}</>;
}

function AdminPage() {
  return <AdminGate>{(me) => <AdminPanel me={me} />}</AdminGate>;
}

function AdminPanel({ me }: { me: AuthUser }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // form de criação
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("user");
  const [creating, setCreating] = useState(false);

  async function refresh() {
    try {
      const data = await api<{ users: AdminUser[] }>("/admin/users");
      setUsers(data.users);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
        }),
      });
      setNewUsername("");
      setNewPassword("");
      setNewRole("user");
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setCreating(false);
    }
  }

  async function onResetPassword(u: AdminUser) {
    const pwd = window.prompt(`Nova senha para "${u.username}":`);
    if (!pwd) return;
    try {
      await api(`/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: pwd }),
      });
      alert("Senha trocada.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    }
  }

  async function onToggleRole(u: AdminUser) {
    const next: Role = u.role === "admin" ? "user" : "admin";
    if (!window.confirm(`Mudar "${u.username}" para ${next}?`)) return;
    try {
      await api(`/admin/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: next }),
      });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    }
  }

  async function onDelete(u: AdminUser) {
    if (!window.confirm(`Deletar "${u.username}"? Esta ação é definitiva.`)) return;
    try {
      await api(`/admin/users/${u.id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-6 py-12">
      <div className="mb-10">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Admin
        </div>
        <h1 className="mt-2 font-display text-5xl leading-[1.05]">
          Usuários.
        </h1>
      </div>

      {/* form de criação */}
      <section className="mb-10 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Criar novo usuário
        </h2>
        <form
          onSubmit={onCreate}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_140px_auto]"
        >
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="usuário"
            required
            minLength={2}
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="senha (mín. 6)"
            required
            minLength={6}
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as Role)}
            className="rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {creating ? "criando…" : "criar"}
          </button>
        </form>
      </section>

      {/* tabela */}
      <section>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {users.length} usuário{users.length === 1 ? "" : "s"}
        </h2>

        {loading ? (
          <div className="h-24 animate-pulse rounded-lg border border-border bg-surface" />
        ) : error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 font-mono text-xs text-destructive">
            {error}
          </div>
        ) : (
          <ul className="space-y-2">
            {users.map((u) => {
              const isMe = me?.id === u.id;
              return (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4"
                >
                  <div className="min-w-0">
                    <div className="font-display text-xl">
                      {u.username}{" "}
                      {isMe && (
                        <span className="ml-1 rounded bg-primary/20 px-1.5 py-0.5 align-middle font-mono text-[9px] uppercase tracking-widest text-primary">
                          você
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {u.role} · {u.id}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onResetPassword(u)}
                      className="rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                    >
                      trocar senha
                    </button>
                    {!isMe && (
                      <>
                        <button
                          onClick={() => onToggleRole(u)}
                          className="rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                        >
                          → {u.role === "admin" ? "user" : "admin"}
                        </button>
                        <button
                          onClick={() => onDelete(u)}
                          className="rounded border border-destructive/30 bg-destructive/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-destructive hover:bg-destructive/20"
                        >
                          deletar
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}