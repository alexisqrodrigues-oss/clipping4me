import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Clipping4me" },
      {
        name: "description",
        content:
          "Como o Clipping4me coleta, usa e protege seus dados pessoais.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <>
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
          Legal
        </div>
        <h1 className="mt-4 font-display text-5xl leading-[1.05]">
          Política de privacidade.
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Última atualização: 30/05/2026
        </p>

        <div className="prose prose-invert mt-10 max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-xl text-foreground">Dados que coletamos</h2>
            <p>
              Coletamos apenas os dados necessários para operar a plataforma:
              nome de usuário, senha (armazenada com hash), e os arquivos /
              links de vídeo que você submete para processamento.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">Como usamos</h2>
            <p>
              Seus dados são usados exclusivamente para autenticar seu acesso
              e gerar os cortes solicitados. Não compartilhamos com terceiros
              para fins de marketing.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">Cookies e armazenamento local</h2>
            <p>
              Usamos o localStorage do navegador para manter sua sessão
              autenticada. Não usamos cookies de rastreamento publicitário.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">Retenção</h2>
            <p>
              Vídeos e cortes gerados ficam armazenados no servidor enquanto
              sua conta estiver ativa. Você pode solicitar exclusão a
              qualquer momento.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">Seus direitos</h2>
            <p>
              Você pode solicitar acesso, correção ou exclusão dos seus dados
              pessoais a qualquer momento, conforme a LGPD.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">Contato</h2>
            <p>
              Para questões relativas a dados pessoais, escreva para{" "}
              <a className="text-primary hover:underline" href="mailto:contato@clipping4.me">
                contato@clipping4.me
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}