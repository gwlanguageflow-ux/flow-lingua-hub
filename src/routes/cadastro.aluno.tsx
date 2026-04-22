import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, LEVELS } from "@/lib/constants";
import { uploadAvatar } from "@/lib/upload";
import { toast } from "sonner";
import { Camera } from "lucide-react";

export const Route = createFileRoute("/cadastro/aluno")({
  head: () => ({ meta: [{ title: "Cadastro de Aluno — GWLanguageFlow" }] }),
  component: () => <RequireAuth><Page /></RequireAuth>,
});

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  age: z.coerce.number().int().min(5).max(120),
  desiredLanguage: z.string().min(1, "Escolha um idioma"),
  level: z.enum(["iniciante","basico","intermediario","avancado","fluente"]),
});

function Page() {
  const { user, roles, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState<string>("");
  const [desiredLanguage, setDesiredLanguage] = useState("");
  const [level, setLevel] = useState<string>("iniciante");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Se aluno já tem perfil completo, vai direto para o feed
  useEffect(() => {
    if (!user) return;
    if (roles.includes("aluno")) {
      supabase.from("student_profiles").select("id").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          navigate({ to: "/feed" });
        } else {
          setChecking(false);
        }
      });
    } else {
      setChecking(false);
    }
  }, [user, roles, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url, age").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setFullName(data.full_name || "");
        if (data.avatar_url) setAvatarPreview(data.avatar_url);
        if (data.age) setAge(String(data.age));
      }
    });
  }, [user]);

  const handleFile = (f: File) => {
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({ fullName, age, desiredLanguage, level });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);

    let avatarUrl: string | null = null;
    if (avatarFile) avatarUrl = await uploadAvatar(user.id, avatarFile);

    const { error: pErr } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: parsed.data.fullName,
      age: parsed.data.age,
      email: user.email,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    });
    if (pErr) { toast.error(pErr.message); setLoading(false); return; }

    const { error: sErr } = await supabase.from("student_profiles").upsert({
      id: user.id,
      desired_language: parsed.data.desiredLanguage,
      comprehension_level: parsed.data.level as never,
    });
    if (sErr) { toast.error(sErr.message); setLoading(false); return; }

    // Atribui role "aluno" — ignora erro de duplicidade (já existe)
    if (!roles.includes("aluno")) {
      const { error: rErr } = await supabase.from("user_roles").insert({ user_id: user.id, role: "aluno" });
      if (rErr && !rErr.message.toLowerCase().includes("duplicate")) {
        toast.error("Não foi possível salvar seu perfil. Tente novamente.");
        setLoading(false);
        return;
      }
    }
    await refreshRoles();

    toast.success("Perfil criado! Conheça nossos professores.");
    navigate({ to: "/feed" });
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-bronze border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="mb-8">
          <p className="text-bronze text-xs uppercase tracking-widest font-medium">Cadastro de aluno</p>
          <h1 className="font-display text-3xl md:text-4xl text-wine font-bold mt-2">Vamos conhecer você</h1>
        </div>
        <form onSubmit={handleSubmit} className="bg-background rounded-3xl border border-border p-6 md:p-10 space-y-6 shadow-soft">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="h-24 w-24 rounded-2xl bg-cream border border-border overflow-hidden flex items-center justify-center">
                {avatarPreview ? <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" /> : <Camera className="h-7 w-7 text-brown-soft" />}
              </div>
            </div>
            <div className="flex-1">
              <Label className="block mb-2">Foto de perfil</Label>
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Idade</Label>
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} required min={5} max={120} />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Idioma que deseja aprender</Label>
              <Select value={desiredLanguage} onValueChange={setDesiredLanguage}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nível de compreensão</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-bronze text-white hover:bg-wine shadow-bronze">
            {loading ? "Salvando..." : "Concluir cadastro"}
          </Button>
        </form>
      </main>
    </div>
  );
}
