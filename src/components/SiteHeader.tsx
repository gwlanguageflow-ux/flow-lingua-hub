import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, LayoutDashboard, Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isDev = roles.includes("dev");
  const isTeacher = roles.includes("professor");
  const isStudent = roles.includes("aluno");

  const dashboardLink = isDev ? "/admin" : isTeacher ? "/dashboard" : "/feed";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/planos" className="text-brown hover:text-wine transition-colors">
            Planos
          </Link>
          <Link to="/sobre" className="text-brown hover:text-wine transition-colors">
            Sobre
          </Link>
          <Link to="/seja-professor" className="text-brown hover:text-wine transition-colors">
            Seja professor
          </Link>
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 border-brown/30">
                  <Sparkles className="h-4 w-4 text-bronze" />
                  Minha conta
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/auth/login">
                <Button variant="ghost" className="text-wine hover:bg-cream">
                  Entrar
                </Button>
              </Link>
              <Link to="/auth/signup">
                <Button className="bg-bronze text-white hover:bg-wine shadow-bronze">
                  Criar conta
                </Button>
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden text-wine"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-3">
          <Link to="/feed" onClick={() => setOpen(false)} className="block py-2 text-brown">Professores</Link>
          <Link to="/planos" onClick={() => setOpen(false)} className="block py-2 text-brown">Planos</Link>
          <Link to="/sobre" onClick={() => setOpen(false)} className="block py-2 text-brown">Sobre</Link>
          <Link to="/seja-professor" onClick={() => setOpen(false)} className="block py-2 text-brown">Seja professor</Link>
          {user ? (
            <>
              <Link to={dashboardLink} onClick={() => setOpen(false)} className="block py-2 text-wine font-semibold">
                {isDev ? "Painel ADM" : isTeacher ? "Dashboard" : "Feed"}
              </Link>
              <button onClick={handleSignOut} className="block py-2 text-wine">Sair</button>
            </>
          ) : (
            <div className="flex gap-2 pt-2">
              <Link to="/auth/login" onClick={() => setOpen(false)} className="flex-1">
                <Button variant="outline" className="w-full">Entrar</Button>
              </Link>
              <Link to="/auth/signup" onClick={() => setOpen(false)} className="flex-1">
                <Button className="w-full bg-bronze text-white hover:bg-wine">Criar conta</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
