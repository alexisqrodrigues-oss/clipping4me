import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Banner fixo no topo quando o app está em modo offline.
 * Avisa que arquivos, downloads e renderizações em nuvem estão bloqueados.
 */
export function OfflineBanner() {
  const { fullyOnline, online } = useOnlineStatus();
  if (fullyOnline) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="sticky top-0 z-40 border-b border-destructive/40 bg-destructive/15 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-2.5 text-sm">
          <WifiOff className="h-4 w-4 text-destructive" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-destructive">
            modo offline
          </span>
          <span className="text-muted-foreground">
            {online
              ? "Sem conexão com o servidor de cortes. "
              : "Sem conexão com a internet. "}
            Downloads, exportações e novos jobs estão temporariamente bloqueados.
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Wrapper visual que cinza/desabilita filhos quando offline.
 * Use em botões de download/export/render.
 */
export function OfflineGate({
  children,
  label = "Disponível quando voltar online",
}: {
  children: (props: { disabled: boolean; reason: string }) => React.ReactNode;
  label?: string;
}) {
  const { fullyOnline } = useOnlineStatus();
  return <>{children({ disabled: !fullyOnline, reason: fullyOnline ? "" : label })}</>;
}