import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Nova senha - GWLanguageFlow" }] }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres").max(128),
    confirmPassword: z.string().min(6, "Confirme sua nova senha").max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas precisam ser iguais",
    path: ["confirmPassword"],
  });

function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasRecoverySession(Boolean(data.session));
      setCheckingSession(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Senha atualizada. Entre novamente para continuar.");
    await supabase.auth.signOut();
    navigate({ to: "/auth/login" });
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
            <h1 className="font-display text-3xl text-wine font-bold">Criar nova senha</h1>
            <p className="text-brown text-sm">
              Defina uma senha nova para acessar sua conta GWLanguage.
            </p>
          </div>

          {!checkingSession && !hasRecoverySession && (
            <div className="rounded-2xl border border-bronze/30 bg-cream p-4 text-sm text-brown">
              <p className="font-semibold text-wine">Link expirado ou invalido</p>
              <p className="mt-1">Solicite um novo link de recuperacao para continuar.</p>
              <Button
                asChild
                variant="outline"
                className="mt-3 border-bronze text-wine hover:bg-bronze/10"
              >
                <Link to="/auth/forgot-password">Enviar novo link</Link>
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              autoComplete="username"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              readOnly
            />
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={checkingSession || !hasRecoverySession}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={checkingSession || !hasRecoverySession}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={loading || checkingSession || !hasRecoverySession}
              className="w-full bg-bronze text-white hover:bg-wine shadow-bronze"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </motion.div>
      </div>

      <div className="hidden md:flex bg-gradient-warm items-center justify-center p-12 order-1 md:order-2 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 30% 20%, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative text-white max-w-md">
          <h2 className="font-display text-4xl font-bold mb-4">Acesso renovado com seguranca.</h2>
          <p className="text-white/80 text-lg">
            Depois de salvar sua senha, voce volta ao login para entrar normalmente.
          </p>
        </div>
      </div>
    </div>
  );
}
