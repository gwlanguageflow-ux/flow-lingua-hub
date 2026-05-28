import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, LogOut, Menu, Settings, UserRound, X } from "lucide-react";
import { DirectorNotifications } from "./DirectorNotifications";
import { Logo } from "./Logo";

const navItems = [
  { to: "/planos", label: "Planos" },
  { to: "/sobre", label: "Sobre" },
  { to: "/seja-professor", label: "Seja professor" },
] as const;

export function SiteHeader() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isDev = roles.includes("dev");
  const isTeacher = roles.includes("professor");
  const isStudent = roles.includes("aluno");
  const dashboardLink = isDev ? "/admin" : isTeacher ? "/dashboard" : "/meus-agendamentos";
  const accountSettingsLink = "/configuracoes/perfil/cadastro";

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-white/90 shadow-[0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 md:h-[76px] md:px-6">
        <Logo />

        <nav className="hidden items-center rounded-xl border border-border/80 bg-white/68 p-1 text-sm font-semibold text-brown shadow-soft md:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-lg px-4 py-2 transition hover:bg-cream/80 hover:text-wine"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <DirectorNotifications />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 gap-2 rounded-xl border-brown/20 bg-white/86 px-5"
                  >
                    <UserRound className="h-4 w-4 text-bronze" />
                    Minha conta
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => navigate({ to: dashboardLink })}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    {isDev ? "Painel ADM" : isTeacher ? "Dashboard" : "Feed"}
                  </DropdownMenuItem>
                  {isStudent && (
                    <>
                      <DropdownMenuItem onClick={() => navigate({ to: "/meus-agendamentos" })}>
                        Meus agendamentos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate({ to: "/minha-assinatura" })}>
                        Minha assinatura
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => navigate({ to: accountSettingsLink })}>
                    <Settings className="mr-2 h-4 w-4" />
                    Perfil e cadastro
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/auth/login">
                <Button variant="ghost" className="rounded-lg px-5 text-wine hover:bg-cream">
                  Entrar
                </Button>
              </Link>
              <Link to="/auth/signup">
                <Button className="h-11 rounded-lg bg-wine px-5 text-white shadow-bronze hover:bg-bronze">
                  Criar conta
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-lg border border-border bg-white p-2 text-wine shadow-soft md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Abrir menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-white/98 px-4 py-4 shadow-soft backdrop-blur md:hidden">
          <div className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-3 text-sm font-semibold text-brown hover:bg-cream hover:text-wine"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {user ? (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <DirectorNotifications mobile />
              <Link
                to={dashboardLink}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-semibold text-wine hover:bg-cream"
              >
                {isDev ? "Painel ADM" : isTeacher ? "Dashboard" : "Feed"}
              </Link>
              <Link
                to={accountSettingsLink}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 text-sm font-semibold text-wine hover:bg-cream"
              >
                Perfil e cadastro
              </Link>
              <button
                onClick={handleSignOut}
                className="block w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-wine hover:bg-cream"
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
              <Link to="/auth/login" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full rounded-lg">
                  Entrar
                </Button>
              </Link>
              <Link to="/auth/signup" onClick={() => setOpen(false)}>
                <Button className="w-full rounded-lg bg-wine text-white hover:bg-bronze">
                  Criar conta
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
