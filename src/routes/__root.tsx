import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BackendStatus } from "../components/BackendStatus";
import { OfflineBanner } from "../components/OfflineBanner";
import { getUser, logout, subscribeAuth, type AuthUser } from "../lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Clipping4me — cortes automáticos de podcasts" },
      {
        name: "description",
        content:
          "Estúdio local para gerar cortes virais de podcasts e palestras com IA.",
      },
      { name: "author", content: "Clipping4me" },
      { property: "og:title", content: "Clipping4me — cortes automáticos de podcasts" },
      {
        property: "og:description",
        content: "Cortes automáticos inteligentes para podcasts e palestras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Clipping4me — cortes automáticos de podcasts" },
      { name: "twitter:description", content: "Cortes automáticos inteligentes para podcasts e palestras." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a5804d1d-995f-4599-90c9-1a5b43488d82/id-preview-e15c99a8--94bcbc1b-cafe-4093-ae2c-b0475ca0b511.lovable.app-1780159704299.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a5804d1d-995f-4599-90c9-1a5b43488d82/id-preview-e15c99a8--94bcbc1b-cafe-4093-ae2c-b0475ca0b511.lovable.app-1780159704299.png" },
      { name: "google-site-verification", content: "eZ7t8XxCojUQFaaGARNtiqGl5cumhUyNN_Q3hvKkkeU" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="grain relative min-h-screen">
        <OfflineBanner />
        <SiteHeader />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </div>
    </QueryClientProvider>
  );
}

function SiteHeader() {
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginPage = pathname.startsWith("/login");

  useEffect(() => {
    const unsub = subscribeAuth(() => setUser(getUser()));
    return unsub;
  }, []);

  async function onLogout() {
    await logout();
    router.navigate({ to: "/login" });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
            <span className="font-mono text-sm font-semibold text-primary-foreground">
              C4
            </span>
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl">clipping4.me</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              local studio
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <BackendStatus />
          {user && !isLoginPage ? (
            <>
              <Link
                to="/app"
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                Jobs
              </Link>
              {user.role === "admin" && (
                <Link
                  to="/admin"
                  className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  activeProps={{ className: "bg-secondary text-foreground" }}
                >
                  Admin
                </Link>
              )}
              <Link
                to="/new"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Novo corte
              </Link>
              <div className="ml-2 flex items-center gap-2 border-l border-border pl-3">
                <div className="text-right leading-tight">
                  <div className="font-mono text-xs text-foreground">
                    {user.username}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="rounded border border-border bg-surface px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  title="Sair"
                >
                  sair
                </button>
              </div>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
