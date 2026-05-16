import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Nova senha - GWLanguageFlow" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
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
            <h1 className="font-display text-3xl text-wine font-bold">Recuperar senha</h1>
            <p className="text-brown text-sm">
              A recuperação agora é feita confirmando seu e-mail e CPF cadastrados.
            </p>
          </div>

          <div className="rounded-2xl border border-bronze/30 bg-cream p-4 text-sm text-brown">
            <p className="font-semibold text-wine">Use o fluxo atualizado</p>
            <p className="mt-1">
              Links antigos de e-mail podem expirar. Continue pelo processo direto da plataforma.
            </p>
          </div>

          <Button asChild className="w-full bg-bronze text-white hover:bg-wine shadow-bronze">
            <Link to="/auth/forgot-password">Confirmar e-mail e CPF</Link>
          </Button>
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
            Confirme seus dados, salve uma nova senha e entre normalmente.
          </p>
        </div>
      </div>
    </div>
  );
}
