import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/auth-redirect";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({ meta: [{ title: "Recuperar senha - GWLanguageFlow" }] }),
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().trim().email("E-mail invalido").max(255),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: getAuthRedirectUrl("/auth/reset-password"),
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setSentTo(parsed.data.email);
    toast.success("Enviamos o link para criar uma nova senha.");
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
            Sua conta continua protegida.
          </h2>
          <p className="text-white/85">
            O link de recuperacao leva direto para a criacao de uma nova senha.
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
            <h1 className="font-display text-3xl text-wine font-bold">Recuperar senha</h1>
            <p className="text-brown text-sm">
              Informe seu e-mail para receber o link de criacao de uma nova senha.
            </p>
          </div>

          {sentTo && (
            <div className="rounded-2xl border border-bronze/30 bg-cream p-4 text-sm text-brown">
              <p className="font-semibold text-wine">Verifique seu e-mail</p>
              <p className="mt-1">
                Enviamos o link para <strong>{sentTo}</strong>. Abra o e-mail da GWLanguage e siga
                para definir sua nova senha.
              </p>
            </div>
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
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-bronze text-white hover:bg-wine shadow-bronze"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </Button>
          </form>

          <p className="text-sm text-center text-brown">
            Lembrou sua senha?{" "}
            <Link to="/auth/login" className="text-bronze hover:text-wine font-semibold">
              Entrar
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
