import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de uso — Clipping4me" },
      {
        name: "description",
        content:
          "Termos e condições de uso da plataforma Clipping4me.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <>
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-20">
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-primary">
          Legal
        </div>
        <h1 className="mt-4 font-display text-5xl leading-[1.05]">
          Termos de uso.
        </h1>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Última atualização: 30/05/2026
        </p>

        <div className="prose prose-invert mt-10 max-w-none space-y-6 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-xl text-foreground">1. Aceitação</h2>
            <p>
              Ao acessar e usar o Clipping4me você concorda com estes Termos.
              Se você não concorda, não utilize o serviço.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">2. Conta</h2>
            <p>
              O acesso é restrito a usuários cadastrados pelo administrador.
              Você é responsável pela confidencialidade das suas credenciais
              e por todas as atividades realizadas na sua conta.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">3. Conteúdo</h2>
            <p>
              Você declara possuir os direitos sobre o conteúdo que submete
              ao serviço. O Clipping4me processa esse material apenas para
              gerar os cortes solicitados. Não reivindicamos titularidade
              sobre o seu conteúdo.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">4. Uso aceitável</h2>
            <p>
              É proibido usar a plataforma para processar conteúdo ilegal,
              que viole direitos autorais de terceiros, ou que constitua
              assédio, discurso de ódio ou desinformação.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">5. Disponibilidade</h2>
            <p>
              O serviço é fornecido &quot;como está&quot;. Não garantimos
              disponibilidade ininterrupta nem ausência de erros, embora
              trabalhemos para minimizar interrupções.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">6. Limitação de responsabilidade</h2>
            <p>
              Em nenhuma hipótese o Clipping4me será responsável por danos
              indiretos, incidentais ou consequenciais decorrentes do uso da
              plataforma.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">7. Mudanças</h2>
            <p>
              Podemos atualizar estes Termos a qualquer momento. Alterações
              relevantes serão comunicadas pelos canais oficiais.
            </p>
          </section>
          <section>
            <h2 className="font-display text-xl text-foreground">8. Contato</h2>
            <p>
              Dúvidas? Escreva para{" "}
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