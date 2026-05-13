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
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
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
    setConfirmationEmail("");
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/escolher-perfil`,
        data: { full_name: parsed.data.fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(
        error.message.includes("already registered") ? "E-mail já cadastrado." : error.message,
      );
      return;
    }

    if (!data.session) {
      setLoading(false);
      setConfirmationEmail(parsed.data.email);
      toast.success("Conta criada. Confirme seu e-mail para escolher seu perfil.");
      return;
    }

    setLoading(false);
    toast.success("Conta criada! Vamos configurar seu perfil.");
    navigate({ to: "/escolher-perfil" });
  };

  const handleResendConfirmation = async () => {
    if (!confirmationEmail) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: confirmationEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/escolher-perfil`,
      },
    });
    setResending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("E-mail de confirmação reenviado.");
  };

  const handleGoogle = async () => {
    if (!googleEnabled) {
      toast.error("Cadastro com Google ainda nao esta configurado neste ambiente.");
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
              {googleEnabled
                ? "Crie com e-mail ou continue com Google. Em seguida voce escolhe seu perfil."
                : "Crie sua conta com e-mail. Em seguida voce escolhe seu perfil."}
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
            {confirmationEmail && (
              <div className="rounded-2xl border border-bronze/30 bg-cream p-4 text-sm text-brown">
                <p className="font-semibold text-wine">Confirme seu e-mail para continuar</p>
                <p className="mt-1">
                  Enviamos um link para <strong>{confirmationEmail}</strong>. Depois de confirmar,
                  voce volta para escolher se quer aprender ou ensinar.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={resending}
                  onClick={handleResendConfirmation}
                  className="mt-3 border-bronze text-wine hover:bg-bronze/10"
                >
                  {resending ? "Reenviando..." : "Reenviar e-mail"}
                </Button>
              </div>
            )}

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
