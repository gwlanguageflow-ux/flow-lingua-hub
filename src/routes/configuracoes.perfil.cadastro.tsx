import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { KeyRound, Mail, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(6, "Informe sua senha atual."),
    newPassword: z.string().min(6, "A nova senha precisa ter ao menos 6 caracteres.").max(128),
    confirmPassword: z.string().min(6, "Confirme sua nova senha.").max(128),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export const Route = createFileRoute("/configuracoes/perfil/cadastro")({
  head: () => ({ meta: [{ title: "Cadastro da conta - GWLanguageFlow" }] }),
  component: () => (
    <RequireAuth>
      <AccountSettingsPage />
    </RequireAuth>
  ),
});

function AccountSettingsPage() {
  const { user, roles } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!user?.id) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (mounted) {
        setProfile(data ?? null);
        setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const roleLabel = useMemo(() => {
    if (roles.includes("dev")) return "Diretoria";
    if (roles.includes("professor")) return "Professor";
    if (roles.includes("aluno")) return "Aluno";
    return "Perfil em configuracao";
  }, [roles]);

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = passwordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    const email = user?.email ?? profile?.email;
    if (!email) {
      toast.error("Nao foi possivel localizar o e-mail da conta.");
      return;
    }

    setSaving(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password: parsed.data.currentPassword,
    });

    if (loginError) {
      setSaving(false);
      toast.error("Senha atual incorreta.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Senha atualizada com seguranca.");
  };

  return (
    <div className="gw-app-shell flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 gw-paper py-8 md:py-12">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-bronze">
              Configuracoes
            </p>
            <h1 className="mt-2 font-display text-4xl font-bold text-wine">Perfil e cadastro</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brown-soft">
              Consulte os dados principais da sua conta e altere sua senha quando precisar.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <section className="gw-app-card rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-bronze/15 text-bronze">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-wine">Dados da conta</h2>
                  <p className="text-sm text-brown-soft">
                    {loading ? "Carregando..." : profile?.full_name || user?.email}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <AccountInfo icon={Mail} label="Login / e-mail" value={user?.email ?? "-"} />
                <AccountInfo icon={ShieldCheck} label="Perfil de acesso" value={roleLabel} />
                <AccountInfo
                  icon={KeyRound}
                  label="Senha"
                  value="Protegida. Por seguranca, a senha atual nao fica visivel."
                />
              </div>

              <div className="mt-5 rounded-xl border border-border bg-cream p-4 text-sm text-brown">
                Para alterar nome, CPF, idioma, foto ou dados pedagogicos, use o cadastro do seu
                perfil.
              </div>

              <ProfileEditLink roles={roles} />
            </section>

            <form onSubmit={handlePasswordUpdate} className="gw-app-card rounded-xl p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-wine text-white">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-bold text-wine">Alterar senha</h2>
                  <p className="text-sm text-brown-soft">
                    Digite a senha atual antes de definir a nova.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Senha atual</Label>
                  <PasswordInput
                    id="currentPassword"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova senha</Label>
                  <PasswordInput
                    id="newPassword"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                  <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={saving}
                  className="h-11 rounded-lg bg-wine text-white hover:bg-bronze"
                >
                  {saving ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function AccountInfo({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 text-bronze" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-brown-soft">{label}</p>
          <p className="mt-1 break-words text-sm font-semibold text-wine">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ProfileEditLink({ roles }: { roles: string[] }) {
  const button = (
    <Button variant="outline" className="w-full rounded-lg">
      Editar cadastro do perfil
    </Button>
  );

  if (roles.includes("professor")) {
    return (
      <Link to="/cadastro/professor" className="mt-4 block">
        {button}
      </Link>
    );
  }

  if (roles.includes("aluno")) {
    return (
      <Link to="/cadastro/aluno" className="mt-4 block">
        {button}
      </Link>
    );
  }

  return (
    <Link to="/escolher-perfil" className="mt-4 block">
      {button}
    </Link>
  );
}
