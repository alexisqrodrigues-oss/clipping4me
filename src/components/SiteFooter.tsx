import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-surface/30">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
              <span className="font-mono text-sm font-semibold text-primary-foreground">
                C4
              </span>
            </div>
            <div className="font-display text-lg">clipping4.me</div>
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Plataforma inteligente de cortes de podcast. IA que entende o
            contexto e entrega cortes prontos para redes verticais.
          </p>
        </div>

        <FooterCol title="Produto">
          <FooterLink to="/">Home</FooterLink>
          <FooterLink to="/sobre">Sobre</FooterLink>
          <FooterLink to="/login">Entrar</FooterLink>
        </FooterCol>

        <FooterCol title="Legal">
          <FooterLink to="/termos">Termos de uso</FooterLink>
          <FooterLink to="/privacidade">Privacidade</FooterLink>
        </FooterCol>

        <FooterCol title="Suporte">
          <FooterLink to="/contato">Contato</FooterLink>
          <a
            href="mailto:contato@clipping4.me"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            contato@clipping4.me
          </a>
        </FooterCol>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>© {new Date().getFullYear()} clipping4.me</span>
          <span>feito para criadores</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="font-mono text-[11px] uppercase tracking-widest text-foreground">
        {title}
      </h4>
      <ul className="mt-4 space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        to={to}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {children}
      </Link>
    </li>
  );
}