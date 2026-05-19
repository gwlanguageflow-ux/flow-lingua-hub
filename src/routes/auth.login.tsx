import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
import { isGoogleAuthEnabled } from "@/lib/auth-providers";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Entrar — GWLanguageFlow" }] }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres").max(128),
});

function emailDomain(value: string) {
  return value.split("@")[1]?.toLowerCase() ?? "desconhecido";
}

async function logSecurityEvent(payload: Record<string, unknown>) {
  await fetch("/api/public/security-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}

function LoginPage() {
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
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      await logSecurityEvent({
        eventType: "auth.login_failure",
        severity: "medium",
        route: "/auth/login",
        metadata: { reason: error.message, emailDomain: emailDomain(parsed.data.email) },
      });
      toast.error(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message,
      );
      return;
    }
    await logSecurityEvent({
      eventType: "auth.login_success",
      severity: "info",
      route: "/auth/login",
      userId: data.user?.id,
      sessionId: data.session?.access_token?.slice(0, 24),
      metadata: { provider: "password", emailDomain: emailDomain(parsed.data.email) },
    });
    toast.success("Bem-vindo de volta!");
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
      await logSecurityEvent({
        eventType: "auth.google_login_failure",
        severity: "medium",
        route: "/auth/login",
        metadata: { reason: error.message },
      });
      toast.error("Falha no login com Google.");
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh bg-cream lg:grid-cols-[1.05fr_0.95fr] lg:bg-white">
      <aside className="gw-auth-visual relative hidden overflow-hidden lg:flex">
        <div className="absolute inset-0 gw-product-grid opacity-35" aria-hidden="true" />
        <div className="relative flex min-h-screen w-full flex-col justify-between p-12">
          <Logo variant="light" />

          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-white/16 bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white/84 backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-bronze" />
              Acesso seguro GWLanguageFlow
            </div>
            <h2 className="font-display text-6xl font-bold leading-[1.02] text-white">
              Entre na sua central de aprendizagem.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-8 text-white/76">
              Agenda, salas, professores, materiais, atividades e mensagens em um ambiente único.
            </p>
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-3">
            {[
              ["Aulas", "agenda e link"],
              ["Materiais", "arquivos e trilhas"],
              ["Mensagens", "contato direto"],
            ].map(([title, text]) => (
              <div key={title} className="rounded-xl border border-white/12 bg-white/9 p-4">
                <p className="font-display text-xl font-bold text-bronze">{title}</p>
                <p className="mt-1 text-xs text-white/66">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-6 sm:px-6 md:px-10 lg:bg-white">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[520px]"
        >
          <div className="mb-5 flex justify-center lg:hidden">
            <Logo />
          </div>

          <div className="gw-auth-card rounded-xl p-5 sm:p-6 md:rounded-2xl md:p-8">
            <div className="mb-6 flex items-start justify-between gap-4 md:mb-7 md:gap-5">
              <div>
                <div className="hidden lg:block">
                  <Logo />
                </div>
                <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-wine sm:mt-5 sm:text-4xl">
                  Bem-vindo de volta
                </h1>
                <p className="mt-2 text-sm leading-6 text-brown-soft sm:text-base sm:leading-7">
                  Acesse sua conta com e-mail e senha ou continue com Google.
                </p>
              </div>
              <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-cream text-bronze md:flex">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogle}
              disabled={loading || googleEnabled !== true}
              className="h-11 w-full rounded-lg border-brown/20 bg-white text-sm font-semibold text-brown shadow-soft hover:border-bronze hover:bg-white hover:text-wine sm:h-12"
            >
              <GoogleIcon /> Continuar com Google
            </Button>

            {googleEnabled === false && (
              <div className="mt-3 rounded-2xl border border-bronze/25 bg-cream px-4 py-3 text-xs leading-5 text-brown-soft">
                Login com Google em configuração pela equipe GWLanguageFlow. Use e-mail e senha por
                enquanto.
              </div>
            )}

            <div className="my-6 flex items-center gap-3 sm:my-7">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-semibold text-brown-soft">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="gw-input-shell space-y-4 sm:space-y-5">
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
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password" className="text-wine">
                    Senha
                  </Label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-xs font-bold text-bronze transition hover:text-wine"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
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
                {loading ? "Entrando..." : "Entrar"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>

            <div className="mt-6 space-y-3 text-center sm:mt-7 sm:space-y-4">
              <p className="text-sm text-brown">
                Ainda não tem conta?{" "}
                <Link to="/auth/signup" className="font-bold text-bronze hover:text-wine">
                  Criar conta
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
              Ambiente protegido para alunos, professores e diretoria.
            </span>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.52Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.41 13.88A6 6 0 0 1 6.1 12c0-.65.11-1.29.31-1.88v-2.6H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.48l3.34-2.6Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.99c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.96 3 14.7 2 12 2a10 10 0 0 0-8.93 5.52l3.34 2.6C7.2 7.75 9.4 5.99 12 5.99Z"
      />
    </svg>
  );
}
