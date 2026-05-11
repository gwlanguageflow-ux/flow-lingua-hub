import { Logo } from "./Logo";
import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="bg-wine text-white/90 mt-24">
      <div className="container mx-auto px-4 py-14 grid gap-10 md:grid-cols-4">
        <div className="space-y-3">
          <Logo variant="light" />
          <p className="text-sm text-white/70 max-w-xs">
            Plataforma profissional de ensino de idiomas com método, propósito e acompanhamento.
          </p>
        </div>
        <div>
          <h4 className="text-white font-display text-base mb-3">Plataforma</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <Link to="/planos" className="hover:text-bronze">
                Planos
              </Link>
            </li>
            <li>
              <Link to="/seja-professor" className="hover:text-bronze">
                Seja professor
              </Link>
            </li>
            <li>
              <Link to="/sobre" className="hover:text-bronze">
                Sobre nós
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-display text-base mb-3">Conta</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <Link to="/auth/login" className="hover:text-bronze">
                Entrar
              </Link>
            </li>
            <li>
              <Link to="/auth/signup" className="hover:text-bronze">
                Criar conta
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-display text-base mb-3">Contato</h4>
          <p className="text-sm text-white/70">contato@gwlanguageflow.com</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} GWLanguageFlow. Todos os direitos reservados.
      </div>
    </footer>
  );
}
