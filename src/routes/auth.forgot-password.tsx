import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import {
  resetPasswordWithCpf,
  verifyPasswordResetIdentity,
} from "@/functions/password-reset.functions";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({ meta: [{ title: "Recuperar senha - GWLanguageFlow" }] }),
  component: ForgotPasswordPage,
});

const identitySchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  cpf: z.string().refine(isValidCpf, "Informe um CPF válido"),
});

const passwordSchema = z
  .object({
    password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres").max(128),
    confirmPassword: z.string().min(6, "Confirme sua nova senha").max(128),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas precisam ser iguais",
    path: ["confirmPassword"],
  });

function ForgotPasswordPage() {
  const [step, setStep] = useState<"identity" | "password">("identity");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const navigateAfterLogin = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate({ to: "/auth/login" });
      return;
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roleList = roles?.map((item) => item.role) ?? [];

    if (roleList.includes("dev")) navigate({ to: "/admin" });
    else if (roleList.includes("professor")) navigate({ to: "/dashboard" });
    else if (roleList.includes("aluno")) navigate({ to: "/feed" });
    else navigate({ to: "/escolher-perfil" });
  };

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = identitySchema.safeParse({ email, cpf });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      await verifyPasswordResetIdentity({
        data: {
          email: parsed.data.email,
          cpf: normalizeCpf(parsed.data.cpf),
        },
      });
      setStep("password");
      toast.success("Dados confirmados. Crie sua nova senha.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "E-mail e CPF não conferem.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const identity = identitySchema.safeParse({ email, cpf });
    const parsed = passwordSchema.safeParse({ password, confirmPassword });
    if (!identity.success) {
      setStep("identity");
      toast.error(identity.error.issues[0].message);
      return;
    }
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordWithCpf({
        data: {
          email: identity.data.email,
          cpf: normalizeCpf(identity.data.cpf),
          password: parsed.data.password,
        },
      });

      const { error } = await supabase.auth.signInWithPassword({
        email: result.email,
        password: parsed.data.password,
      });

      if (error) {
        toast.success("Senha atualizada. Entre com sua nova senha.");
        navigate({ to: "/auth/login" });
        return;
      }

      toast.success("Senha atualizada. Bem-vindo de volta!");
      await navigateAfterLogin();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh bg-cream md:grid-cols-2">
      <div className="gw-auth-visual gw-product-grid relative hidden items-center justify-center overflow-hidden p-12 md:flex">
        <div className="relative text-white max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight mb-4">
            Recuperação direta e segura.
          </h2>
          <p className="text-white/85">
            Confirme seus dados e defina uma nova senha sem depender de link por e-mail.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-white p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="gw-auth-card w-full max-w-md space-y-6 rounded-xl p-6 md:p-8"
        >
          <div className="space-y-3">
            <Logo />
            <h1 className="font-display text-3xl text-wine font-bold">Recuperar senha</h1>
            <p className="text-brown text-sm">
              {step === "identity"
                ? "Confirme o e-mail e o CPF cadastrados na sua conta."
                : "Agora crie sua nova senha para acessar a plataforma."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div
              className={`h-1.5 rounded-full ${step === "identity" ? "bg-bronze" : "bg-bronze/40"}`}
            />
            <div
              className={`h-1.5 rounded-full ${step === "password" ? "bg-bronze" : "bg-border"}`}
            />
          </div>

          {step === "identity" ? (
            <form onSubmit={handleIdentitySubmit} className="space-y-4">
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
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  maxLength={14}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-bronze text-white shadow-bronze hover:bg-wine"
              >
                {loading ? "Confirmando..." : "Confirmar dados"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <input
                type="text"
                autoComplete="username"
                value={email}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                readOnly
              />
              <div className="rounded-xl border border-bronze/30 bg-cream p-4 text-sm text-brown">
                <p className="font-semibold text-wine">Dados confirmados</p>
                <p className="mt-1">{email}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  required
                />
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("identity")}
                  disabled={loading}
                  className="rounded-lg border-bronze text-wine hover:bg-bronze/10"
                >
                  Voltar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-bronze text-white shadow-bronze hover:bg-wine"
                >
                  {loading ? "Salvando..." : "Salvar e entrar"}
                </Button>
              </div>
            </form>
          )}

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
