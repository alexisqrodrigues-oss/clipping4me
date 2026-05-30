import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getBackendUrl } from "@/lib/backend";
import {
  authFetch,
  getUser,
  type AuthUser,
  type Role,
} from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const u = getUser();
    if (!u || u.role !== "admin") {
      throw redirect({ to: "/" });
    }
  },
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

function AdminPage() {
  const me = getUser();
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