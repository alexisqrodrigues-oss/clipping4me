/**
 * Cliente de autenticação. Mantém token + usuário em localStorage,
 * com listeners para a UI reagir a login/logout.
 */
import { getBackendUrl } from "./backend";

const TOKEN_KEY = "clipping4me:token";
const USER_KEY = "clipping4me:user";

export type Role = "admin" | "user";

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  created_at: string;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

export function subscribeAuth(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function setSession(token: string, user: AuthUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  emit();
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  emit();
}

export async function login(
  username: string,
  password: string,
): Promise<AuthUser> {
  const res = await fetch(`${getBackendUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const msg =
      res.status === 401
        ? "Usuário ou senha inválidos"
        : `Erro ${res.status}`;
    throw new Error(msg);
  }
  const data = (await res.json()) as { token: string; user: AuthUser };
  setSession(data.token, data.user);
  return data.user;
}

export async function logout(): Promise<void> {
  const token = getToken();
  clearSession();
  if (!token) return;
  // best-effort: avisa o backend pra invalidar o token
  try {
    await fetch(`${getBackendUrl()}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });
  } catch {
    /* ignora */
  }
}

/**
 * Anexa o token e trata 401 (faz logout + redirect pra /login).
 * Usado pelo backend.ts em todo fetch que precisar de auth.
 */
export async function authFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("ngrok-skip-browser-warning", "true");
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    clearSession();
    // só redireciona se não estiver já no login
    if (!window.location.pathname.startsWith("/login")) {
      window.location.assign(
        `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
      );
    }
  }
  return res;
}

/** Acrescenta ?token=... a uma URL de mídia para uso em <video src>/<img src>. */
export function withTokenParam(url?: string): string | undefined {
  if (!url) return url;
  const token = getToken();
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}