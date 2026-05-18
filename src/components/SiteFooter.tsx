import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Mail, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/10 bg-ink text-white">
      <div className="container mx-auto px-4 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.8fr_0.8fr_1fr]">
          <div className="max-w-sm space-y-5">
            <Logo variant="light" />
            <p className="text-sm leading-relaxed text-white/68">
              Plataforma profissional de idiomas com método, gestão pedagógica, materiais semanais e
              acompanhamento próximo para alunos e professores.
            </p>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/7 px-3 py-2 text-xs text-white/72">
              <ShieldCheck className="h-4 w-4 text-bronze" />
              Pagamentos, aulas e materiais em ambiente controlado.
            </div>
          </div>

          <FooterColumn
            title="Plataforma"
            links={[
              { to: "/planos", label: "Planos" },
              { to: "/sobre", label: "Sobre" },
              { to: "/seja-professor", label: "Seja professor" },
            ]}
          />

          <FooterColumn
            title="Conta"
            links={[
              { to: "/auth/login", label: "Entrar" },
              { to: "/auth/signup", label: "Criar conta" },
              { to: "/auth/forgot-password", label: "Recuperar senha" },
            ]}
          />

          <div>
            <h4 className="mb-4 font-display text-base text-white">Contato</h4>
            <a
              href="mailto:contato@gwlanguageflow.com.br"
              className="inline-flex items-center gap-2 text-sm text-white/68 transition hover:text-bronze"
            >
              <Mail className="h-4 w-4" />
              contato@gwlanguageflow.com.br
            </a>
            <div className="mt-7 h-px w-full bg-white/10" />
            <p className="mt-5 text-xs leading-relaxed text-white/45">
              GWLanguageFlow opera com padrão pedagógico próprio, professores selecionados e jornada
              digital para aulas, materiais e atividades.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-5">
        <div className="container mx-auto flex flex-col gap-3 px-4 text-xs text-white/45 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} GWLanguageFlow. Todos os direitos reservados.</span>
          <span>Plataforma de idiomas com direção pedagógica.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ to: string; label: string }>;
}) {
  return (
    <div>
      <h4 className="mb-4 font-display text-base text-white">{title}</h4>
      <ul className="space-y-3 text-sm text-white/68">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="inline-flex items-center gap-1.5 transition hover:text-bronze"
            >
              {link.label}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
