import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Clipping4me" },
      {
        name: "description",
        content:
          "Conheça o Clipping4me: plataforma de IA que gera cortes de podcast alinhados ao algoritmo de TikTok, Reels e Shorts.",
      },
      { property: "og:title", content: "Sobre — Clipping4me" },
      {
        property: "og:description",
        content:
          "Plataforma de IA para cortes de podcast com análise semântica e diarização.",
      },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <>
      <main className="relative z-10 mx-auto max-w-4xl px-6 py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
          Sobre
        </div>
        <h1 className="mt-4 font-display text-6xl leading-[1.02]">
          Cortes inteligentes para quem leva podcast a sério.
        </h1>
        <div className="mt-10 space-y-6 text-base leading-relaxed text-foreground/90">
          <p>
            O Clipping4me nasceu para resolver um problema simples: ferramentas
            de corte automático tradicionais pegam o trecho mais alto e cospem
            um vídeo qualquer. Funcional, sim — relevante, raramente.
          </p>
          <p>
            A nossa IA lê a transcrição inteira do episódio, identifica
            narrativas, ganchos e quebras de ritmo, cruza com as suas
            diretrizes (polêmico, autoridade, engajamento) e entrega cortes
            que fazem sentido sozinhos.
          </p>
          <p>
            Cada corte sai no formato vertical, com hook nos primeiros 2
            segundos e duração calibrada para a plataforma que você escolher.
            Diarização de áudio permite gerar cortes só do host, só do
            convidado ou do diálogo entre eles — com legenda na identidade
            verbal certa.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {[
            { kicker: "Como funciona", title: "Análise semântica do episódio inteiro" },
            { kicker: "Para quem", title: "Criadores e equipes de podcast profissional" },
            { kicker: "Em desenvolvimento", title: "Edição avançada, legenda animada, trilha sugerida" },
          ].map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
                {b.kicker}
              </div>
              <h3 className="mt-3 font-display text-lg leading-tight">
                {b.title}
              </h3>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}