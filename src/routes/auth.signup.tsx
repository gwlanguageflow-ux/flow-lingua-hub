import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { isGoogleAuthEnabled } from "@/lib/auth-providers";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
import { createConfirmedAccount } from "@/functions/auth.functions";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({ meta: [{ title: "Criar conta — GWLanguageFlow" }] }),
  component: SignupPage,
});

const schema = z.object({
  fullName: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres").max(128),
});

function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
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
      if (roles.length === 0) navigate({ to: "/escolher-perfil" });
      else if (roles.includes("dev")) navigate({ to: "/admin" });
      else if (roles.includes("professor")) navigate({ to: "/dashboard" });
      else navigate({ to: "/feed" });
    }
  }, [user, roles, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ fullName, email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      await createConfirmedAccount({
        data: {
          fullName: parsed.data.fullName,
          email: parsed.data.email,
          password: parsed.data.password,
        },
      });
    } catch (error) {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conta.");
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (loginError) {
      setLoading(false);
      toast.error("Conta criada, mas não foi possível entrar automaticamente. Faça login.");
      navigate({ to: "/auth/login" });
      return;
    }

    setLoading(false);
    toast.success("Conta criada! Vamos configurar seu perfil.");
    navigate({ to: "/escolher-perfil" });
  };

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirectUrl("/escolher-perfil"),
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error) {
      toast.error("Falha no Google.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="flex items-center justify-center p-6 md:p-12 bg-background order-2 md:order-1">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-6"
        >
          <div className="space-y-3">
            <Logo />
            <h1 className="font-display text-3xl text-wine font-bold">Criar sua conta</h1>
            <p className="text-brown text-sm">
              Crie com e-mail ou continue com Google. Em seguida você escolhe seu perfil.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={loading || googleEnabled !== true}
            className="w-full border-brown/30 hover:bg-cream gap-2"
          >
            <GoogleIcon /> Continuar com Google
          </Button>
          {googleEnabled === false && (
            <p className="text-xs text-center text-brown-soft">
              Google aguardando ativação no painel da GWLanguage.
            </p>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-3 text-brown-soft">ou</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
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
                autoComplete="new-password"
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
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          </form>
          <p className="text-sm text-center text-brown">
            Já tem conta?{" "}
            <Link to="/auth/login" className="text-bronze hover:text-wine font-semibold">
              Entrar
            </Link>
          </p>
        </motion.div>
      </div>
      <div className="hidden md:flex bg-wine items-center justify-center p-12 order-1 md:order-2 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-bronze/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-bronze/20 blur-3xl" />
        <div className="relative text-white max-w-md">
          <h2 className="font-display text-4xl font-bold mb-4">
            Onde fluência encontra <span className="text-bronze italic">conexão</span>.
          </h2>
          <p className="text-white/80 text-lg">
            Entre para uma comunidade global de pessoas apaixonadas por idiomas.
          </p>
        </div>
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
