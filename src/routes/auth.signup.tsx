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
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

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
    <div className="grid min-h-dvh bg-cream lg:grid-cols-[0.96fr_1.04fr] lg:bg-white">
      <main className="order-2 flex min-h-dvh items-center justify-center bg-cream px-4 py-6 sm:px-6 md:px-10 lg:order-1 lg:bg-white">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[520px]"
        >
          <div className="mb-5 flex justify-center lg:hidden">
            <Logo />
          </div>

          <div className="gw-auth-card rounded-xl p-5 sm:p-6 md:rounded-2xl md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4 md:mb-7">
              <div>
                <div className="hidden lg:block">
                  <Logo />
                </div>
                <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-wine sm:mt-5 sm:text-4xl">
                  Criar sua conta
                </h1>
                <p className="mt-2 text-sm leading-6 text-brown-soft sm:text-base sm:leading-7">
                  Crie seu acesso e escolha se você entra como aluno ou professor na próxima etapa.
                </p>
              </div>
              <div className="hidden h-12 w-12 items-center justify-center rounded-xl bg-cream text-bronze md:flex">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={loading || googleEnabled !== true}
              className="h-11 w-full gap-2 rounded-lg border-brown/20 bg-white text-sm font-semibold text-brown shadow-soft hover:border-bronze hover:bg-white hover:text-wine sm:h-12"
            >
              <GoogleIcon /> Continuar com Google
            </Button>
            {googleEnabled === false && (
              <div className="mt-3 rounded-xl border border-bronze/25 bg-cream px-4 py-3 text-center text-xs leading-5 text-brown-soft">
                Google aguardando ativação no painel da GWLanguageFlow.
              </div>
            )}

            <div className="my-6 flex items-center gap-3 sm:my-7">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-brown-soft">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="gw-input-shell space-y-4 sm:space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-wine">
                  Nome completo
                </Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="h-11 sm:h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-wine">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 sm:h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-wine">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 sm:h-12"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg bg-wine text-white shadow-bronze hover:bg-wine-deep sm:h-12"
              >
                {loading ? "Criando..." : "Criar conta"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-6 space-y-3 text-center sm:mt-7 sm:space-y-4">
              <p className="text-sm text-brown">
                Já tem conta?{" "}
                <Link to="/auth/login" className="font-bold text-bronze hover:text-wine">
                  Entrar
                </Link>
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-xs font-semibold text-brown-soft hover:text-wine"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao início
              </Link>
            </div>
          </div>

          <div className="mt-5 flex items-start justify-center gap-2 px-2 text-xs text-brown-soft">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-bronze" />
            <span className="text-center leading-5">
              Cadastro sem e-mail de confirmação para manter o fluxo rápido e limpo.
            </span>
          </div>
        </motion.div>
      </main>

      <aside className="gw-auth-visual order-1 relative hidden overflow-hidden lg:flex">
        <div className="absolute inset-0 gw-product-grid opacity-35" aria-hidden="true" />
        <div className="relative flex min-h-screen w-full flex-col justify-between p-12">
          <Logo variant="light" />

          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-white/16 bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white/84 backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-bronze" />
              Nova conta GWLanguageFlow
            </div>
            <h2 className="font-display text-6xl font-bold leading-[1.02] text-white">
              Uma entrada simples para uma plataforma completa.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-white/76">
              Depois do cadastro, o aluno vai ao feed de professores e o professor completa sua área
              profissional.
            </p>
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-3">
            {[
              ["01", "conta"],
              ["02", "perfil"],
              ["03", "jornada"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-white/12 bg-white/9 p-4">
                <p className="font-display text-2xl font-bold text-bronze">{title}</p>
                <p className="mt-1 text-xs uppercase text-white/66">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
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
