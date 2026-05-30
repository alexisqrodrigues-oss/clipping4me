import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 60 * 24, // 24h — necessário para persistir
      },
    },
  });

  // Persiste cache no localStorage para suportar modo offline (visualizar jobs antigos).
  if (typeof window !== "undefined") {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "clipping4me:rq-cache",
      throttleTime: 1000,
    });
    persistQueryClient({
      queryClient,
      persister,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    });
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
