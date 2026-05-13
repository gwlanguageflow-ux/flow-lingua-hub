import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { isGoogleAuthEnabled } from "@/lib/auth-providers";

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Entrar — GWLanguageFlow" }] }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres").max(128),
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const navigate = useNavigate();
  const { user, roles, loading: authLoading } = useAuth();

  useEffect(() => {
    let mounted = true;
    isGoogleAuthEnabled().then((enabled) => {
      if (mounted) setGoogleEnabled(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      const dest = roles.includes("dev")
        ? "/admin"
        : roles.includes("professor")
          ? "/dashboard"
          : roles.includes("aluno")
            ? "/feed"
            : "/escolher-perfil";
      navigate({ to: dest });
    }
  }, [user, roles, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message,
      );
      return;
    }
    toast.success("Bem-vindo de volta!");
  };

  const handleGoogle = async () => {
    if (!googleEnabled) {
      toast.error("Login com Google ainda nao esta configurado neste ambiente.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/escolher-perfil`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      toast.error("Falha no login com Google.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex bg-gradient-warm items-center justify-center p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 30% 20%, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative text-white max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight mb-4">
            Continue sua jornada com idiomas.
          </h2>
          <p className="text-white/85">
            Acesse seus agendamentos, professores favoritos e materiais de aula.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6"
        >
          <div className="space-y-3">
            <Logo />
            <h1 className="font-display text-3xl text-wine font-bold">Bem-vindo de volta</h1>
            <p className="text-brown text-sm">
              {googleEnabled
                ? "Entre com seu e-mail ou continue com Google."
                : "Entre com seu e-mail."}
            </p>
          </div>

          {googleEnabled && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleGoogle}
                disabled={loading}
                className="w-full border-brown/30 hover:bg-cream gap-2"
              >
                <GoogleIcon /> Continuar com Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-3 text-brown-soft">ou</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-bronze text-white hover:bg-wine shadow-bronze"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p className="text-sm text-center text-brown">
            Ainda não tem conta?{" "}
            <Link to="/auth/signup" className="text-bronze hover:text-wine font-semibold">
              Criar conta
            </Link>
          </p>
          <p className="text-xs text-center text-brown-soft">
            <Link to="/" className="hover:text-wine">
              ← Voltar ao início
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 11v3.2h5.7c-.2 1.5-1.7 4.4-5.7 4.4-3.4 0-6.2-2.8-6.2-6.3S8.6 6 12 6c2 0 3.3.8 4 1.5l2.7-2.6C17 3.3 14.7 2.4 12 2.4 6.7 2.4 2.5 6.7 2.5 12s4.2 9.6 9.5 9.6c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1-.1-1.4H12z"
      />
    </svg>
  );
}
