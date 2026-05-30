import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect } from "react";
import {
  ArrowRight,
  Brain,
  Captions,
  ImageIcon,
  Music,
  Scissors,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import { getToken } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Clipping4me — cortes de podcast com IA que entende contexto" },
      {
        name: "description",
        content:
          "Estúdio de IA que analisa o contexto semântico do podcast e gera cortes alinhados ao algoritmo de TikTok, Reels e Shorts.",
      },
      { property: "og:title", content: "Clipping4me — IA para cortes de podcast" },
      {
        property: "og:description",
        content:
          "Não é corte aleatório. A IA cruza contexto semântico com regras de retenção das redes para entregar os melhores momentos.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    // Já logado? Vai direto pro estúdio.
    if (typeof window !== "undefined" && getToken()) {
      navigate({ to: "/app" });
    }
  }, [navigate]);

  return (
    <main className="relative z-10">
      <Hero />
      <SmartCut />
      <AlgorithmAlignment />
      <Roadmap />
      <CTASection />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mx-auto max-w-5xl text-center"
      >
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
          clipping4.me · estúdio de IA
        </div>
        <h1 className="mt-6 font-display text-6xl leading-[1.02] tracking-tight md:text-7xl lg:text-[5.5rem]">
          Cortes que <span className="italic text-primary">entendem</span>
          <br />
          o que vale virar conteúdo.
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Não é edição automática burra. A IA lê o contexto semântico do
          podcast inteiro, cruza com suas diretrizes e entrega os cortes
          já no formato e no tempo que TikTok, Reels e Shorts amam.
        </p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Entrar no estúdio
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#smart-cut"
            className="rounded-full border border-border bg-surface px-7 py-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2"
          >
            Como funciona
          </a>
        </div>
      </motion.div>

      {/* Glow decorativo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, oklch(0.86 0.20 155 / 0.6), transparent 60%)",
        }}
      />
    </section>
  );
}

function SmartCut() {
  const features = [
    {
      icon: Brain,
      title: "Análise semântica de verdade",
      desc: "O modelo lê a transcrição inteira do episódio, identifica narrativas, ganchos e quebras de ritmo. Não pega o pedaço mais alto — pega o que faz sentido sozinho.",
    },
    {
      icon: Wand2,
      title: "Diretrizes do criador respeitadas",
      desc: "Você define o que quer (polêmica, autoridade, engajamento). A IA cruza com o contexto e seleciona apenas os trechos que conversam com a sua intenção.",
    },
    {
      icon: Users,
      title: "Diarização e seletor de vozes",
      desc: "O sistema diferencia host e convidado. Corte só as falas que importam — convidado, apresentador ou o diálogo entre eles.",
    },
  ];
  return (
    <section id="smart-cut" className="border-t border-border px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          kicker="O Corte Inteligente"
          title="Cada corte sai pronto porque a IA entende o que está dizendo."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl border border-border bg-surface p-7 transition-colors hover:border-primary/40"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-xl leading-tight">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AlgorithmAlignment() {
  return (
    <section className="border-t border-border px-6 py-24">
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2 md:items-center">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
            Alinhado ao algoritmo
          </div>
          <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">
            Treinado nas regras<br />
            de quem viraliza.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            A IA conhece as janelas de retenção do TikTok, os tempos ideais
            de Reels e a curva de Shorts. Cada corte sai no formato vertical
            certo, com o hook nos primeiros 2 segundos e duração otimizada
            para o feed em que vai morar.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "Hook nos primeiros 2 segundos",
              "Duração calibrada por plataforma",
              "Frame 9:16 com framing facial",
              "Legenda com identidade verbal do criador",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "TikTok", icon: TrendingUp, time: "21–34s" },
            { label: "Reels", icon: Sparkles, time: "15–30s" },
            { label: "Shorts", icon: Scissors, time: "30–60s" },
          ].map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="flex aspect-[9/16] flex-col items-center justify-between rounded-2xl border border-border bg-gradient-to-b from-surface-2 to-surface p-4 text-center"
            >
              <p.icon className="h-5 w-5 text-primary" />
              <div>
                <div className="font-display text-lg">{p.label}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {p.time}
                </div>
              </div>
              <div className="h-1 w-8 rounded-full bg-primary/60" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Roadmap() {
  const items = [
    {
      icon: Wand2,
      title: "Edição de vídeo avançada",
      desc: "Transições, efeitos e cuts dinâmicos aplicados diretamente nos cortes gerados.",
    },
    {
      icon: Captions,
      title: "Legendas dinâmicas automatizadas",
      desc: "Karaokê word-by-word com tipografia animada e estilo do canal.",
    },
    {
      icon: ImageIcon,
      title: "Banco de mídia integrado",
      desc: "Imagens e áudios livres de direitos prontos para enriquecer cada corte.",
    },
    {
      icon: Music,
      title: "Trilha sonora sugerida",
      desc: "A IA escolhe a trilha que combina com o tom e o ritmo do corte.",
    },
  ];
  return (
    <section className="border-t border-border px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          kicker="Roadmap"
          title="O que vem por aí."
          subtitle="Próximos módulos em desenvolvimento. Quem entra agora ajuda a moldar."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-surface/40 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted-foreground">
                  <it.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg leading-tight">{it.title}</h3>
                    <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                      em breve
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{it.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="border-t border-border px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-3xl rounded-3xl border border-border bg-gradient-to-br from-surface-2 to-surface px-10 py-16 text-center"
      >
        <h2 className="font-display text-4xl leading-tight md:text-5xl">
          Pronto pra gerar cortes que rendem?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
          Acesso restrito a usuários cadastrados. Peça uma conta ao
          administrador para começar.
        </p>
        <Link
          to="/login"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02]"
        >
          Entrar
          <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </section>
  );
}

function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
        {kicker}
      </div>
      <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">{title}</h2>
      {subtitle && (
        <p className="mt-4 text-base text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}