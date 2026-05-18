import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { GraduationCap, BookOpen } from "lucide-react";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";

export const Route = createFileRoute("/escolher-perfil")({
  head: () => ({ meta: [{ title: "Escolha seu perfil — GWLanguageFlow" }] }),
  component: ChoosePage,
});

function ChoosePage() {
  return (
    <RequireAuth>
      <Inner />
    </RequireAuth>
  );
}

function Inner() {
  const { roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (roles.includes("dev")) navigate({ to: "/admin" });
    else if (roles.includes("professor")) navigate({ to: "/cadastro/professor" });
    else if (roles.includes("aluno")) navigate({ to: "/cadastro/aluno" });
  }, [roles, navigate]);

  return (
    <div className="gw-app-shell flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl text-center font-display text-3xl font-bold text-wine md:text-5xl"
      >
        Como você quer começar?
      </motion.h1>
      <p className="mt-4 max-w-md text-center text-brown">
        Você poderá mudar isso depois nas configurações da conta.
      </p>

      <div className="grid md:grid-cols-2 gap-6 mt-12 w-full max-w-3xl">
        <Card
          icon={<BookOpen className="h-10 w-10 text-bronze" />}
          title="Quero aprender"
          desc="Encontre professores, agende aulas e comece sua jornada."
          onClick={() => navigate({ to: "/cadastro/aluno" })}
          accent="bronze"
        />
        <Card
          icon={<GraduationCap className="h-10 w-10 text-white" />}
          title="Quero ensinar"
          desc="Crie seu perfil de professor e receba alunos do mundo todo."
          onClick={() => navigate({ to: "/cadastro/professor" })}
          accent="wine"
        />
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  desc,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  accent: "bronze" | "wine";
}) {
  const isWine = accent === "wine";
  return (
    <motion.button
      whileHover={{ y: -6 }}
      onClick={onClick}
      className={`gw-lift text-left rounded-xl p-7 border transition-all ${
        isWine
          ? "bg-wine text-white border-wine hover:shadow-warm"
          : "bg-background border-border hover:border-bronze hover:shadow-bronze"
      }`}
    >
      <div
        className={`mb-5 flex h-14 w-14 items-center justify-center rounded-lg ${isWine ? "bg-bronze" : "bg-bronze/10"}`}
      >
        {icon}
      </div>
      <h3 className={`font-display text-2xl font-bold mb-2 ${isWine ? "text-white" : "text-wine"}`}>
        {title}
      </h3>
      <p className={`text-sm ${isWine ? "text-white/80" : "text-brown"}`}>{desc}</p>
    </motion.button>
  );
}
