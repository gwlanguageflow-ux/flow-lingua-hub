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
    <div className="grid min-h-dvh bg-cream md:grid-cols-2">
      <div className="order-2 flex items-center justify-center bg-white p-6 md:order-1 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="gw-auth-card w-full max-w-md space-y-6 rounded-xl p-6 md:p-8"
        >
          <div className="space-y-3">
            <Logo />
            <h1 className="font-display text-3xl text-wine font-bold">Recuperar senha</h1>
            <p className="text-brown text-sm">
              A recuperação agora é feita confirmando seu e-mail e CPF cadastrados.
            </p>
          </div>

          <div className="rounded-xl border border-bronze/30 bg-cream p-4 text-sm text-brown">
            <p className="font-semibold text-wine">Use o fluxo atualizado</p>
            <p className="mt-1">
              Links antigos de e-mail podem expirar. Continue pelo processo direto da plataforma.
            </p>
          </div>

          <Button
            asChild
            className="w-full rounded-lg bg-bronze text-white shadow-bronze hover:bg-wine"
          >
            <Link to="/auth/forgot-password">Confirmar e-mail e CPF</Link>
          </Button>
        </motion.div>
      </div>

      <div className="gw-auth-visual gw-product-grid relative order-1 hidden items-center justify-center overflow-hidden p-12 md:order-2 md:flex">
        <div className="relative text-white max-w-md">
          <h2 className="mb-4 font-display text-4xl font-bold">Acesso renovado com segurança.</h2>
          <p className="text-white/80 text-lg">
            Confirme seus dados, salve uma nova senha e entre normalmente.
          </p>
        </div>
      </div>
    </div>
  );
}
