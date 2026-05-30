import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/contato")({
  head: () => ({
    meta: [
      { title: "Contato — Clipping4me" },
      {
        name: "description",
        content:
          "Fale com a equipe do Clipping4me. Suporte, parcerias e dúvidas gerais.",
      },
    ],
  }),
  component: ContatoPage,
});

function ContatoPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const ok = name.trim() && email.trim() && message.trim();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ok) return;
    const body = `${message}\n\n—\n${name}\n${email}`;
    window.location.href = `mailto:contato@clipping4.me?subject=${encodeURIComponent(
      `Contato — ${name}`,
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <>
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
          Suporte
        </div>
        <h1 className="mt-4 font-display text-5xl leading-[1.05]">
          Fale com a gente.
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          Dúvidas, parcerias, sugestões ou suporte técnico — escolha como
          prefere falar.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-border bg-surface p-6"
          >
            <h2 className="font-display text-2xl">Mensagem rápida</h2>
            <div className="mt-4 space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu email"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Em que podemos ajudar?"
                required
                rows={5}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={!ok}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </form>

          <div className="hidden w-px bg-border md:block" />

          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-display text-2xl">Email direto</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Resposta em até 1 dia útil.
            </p>
            <a
              href="mailto:contato@clipping4.me"
              className="mt-6 inline-block font-mono text-base text-primary hover:underline"
            >
              contato@clipping4.me
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}