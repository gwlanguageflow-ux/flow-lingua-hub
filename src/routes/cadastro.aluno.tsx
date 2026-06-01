import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEVELS, sortLanguagesByCatalog } from "@/lib/constants";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { uploadAvatar } from "@/lib/upload";
import { toast } from "sonner";
import { Camera } from "lucide-react";

export const Route = createFileRoute("/cadastro/aluno")({
  head: () => ({ meta: [{ title: "Cadastro de Aluno — GWLanguageFlow" }] }),
  component: () => (
    <RequireAuth fallback="/auth/signup">
      <Page />
    </RequireAuth>
  ),
});

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  cpf: z.string().refine(isValidCpf, "Informe um CPF válido"),
  age: z.coerce.number().int().min(5).max(120),
  desiredLanguage: z.string().min(1, "Escolha um idioma"),
  level: z.enum(["iniciante", "basico", "intermediario", "avancado", "fluente"]),
});

function Page() {
  const { user, roles, refreshRoles } = useAuth();
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [age, setAge] = useState<string>("");
  const [desiredLanguage, setDesiredLanguage] = useState("");
  const [level, setLevel] = useState<string>("iniciante");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [languagesLoading, setLanguagesLoading] = useState(true);

  // Se aluno já tem perfil completo, vai direto para o feed
  useEffect(() => {
    if (!user) return;
    if (roles.includes("aluno")) {
      supabase
        .from("student_profiles")
        .select("id, desired_language")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const query = data.desired_language
              ? `?idioma=${encodeURIComponent(data.desired_language)}`
              : "";
            window.location.assign(`/feed${query}`);
          } else {
            setChecking(false);
          }
        });
    } else {
      setChecking(false);
    }
  }, [user, roles]);

  useEffect(() => {
    let active = true;

    supabase
      .from("teacher_profiles")
      .select("languages_taught")
      .eq("is_active", true)
      .then(({ data }) => {
        if (!active) return;

        const languages = sortLanguagesByCatalog(
          (data ?? []).flatMap((teacher) => teacher.languages_taught ?? []),
        );
        setAvailableLanguages(languages);
        setLanguagesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("get_own_onboarding_profile")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFullName(data.full_name || "");
          if (data.cpf) setCpf(formatCpf(data.cpf));
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
    if (languagesLoading) {
      toast.error("Aguarde carregar os idiomas disponíveis.");
      return;
    }
    if (!availableLanguages.length) {
      toast.error("Ainda não há professores ativos para cadastro de alunos.");
      return;
    }
    if (desiredLanguage && !availableLanguages.includes(desiredLanguage)) {
      toast.error("Escolha um idioma com professor ativo na plataforma.");
      return;
    }
    const parsed = schema.safeParse({ fullName, cpf, age, desiredLanguage, level });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);

    let avatarUrl: string | null = null;
    if (avatarFile) avatarUrl = await uploadAvatar(user.id, avatarFile);

    const { error } = await supabase.rpc("complete_student_profile", {
      _full_name: parsed.data.fullName,
      _cpf: normalizeCpf(parsed.data.cpf),
      _age: parsed.data.age,
      _desired_language: parsed.data.desiredLanguage,
      _comprehension_level: parsed.data.level,
      _avatar_url: avatarUrl ?? undefined,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    await refreshRoles();

    toast.success("Perfil criado! Conheça nossos professores.");
    window.location.assign(`/feed?idioma=${encodeURIComponent(parsed.data.desiredLanguage)}`);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-bronze border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="gw-app-shell min-h-screen">
      <SiteHeader />
      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="gw-command-hero mb-6 rounded-xl p-6 md:p-8">
          <p className="gw-section-kicker">Cadastro de aluno</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-wine md:text-4xl">
            Vamos conhecer você
          </h1>
          <p className="mt-2 text-sm leading-6 text-brown-soft">
            Essas informações ajudam a direcionar você para professores, materiais e planos mais
            adequados.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="gw-app-card gw-input-shell rounded-xl p-6 shadow-soft md:p-8 space-y-6"
        >
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="h-24 w-24 rounded-2xl bg-cream border border-border overflow-hidden flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-7 w-7 text-brown-soft" />
                )}
              </div>
            </div>
            <div className="flex-1">
              <Label className="block mb-2">Foto de perfil</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                maxLength={14}
                required
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Idade</Label>
              <Input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                required
                min={5}
                max={120}
              />
            </div>
            <div className="space-y-2">
              <Label>Idioma que deseja aprender</Label>
              <Select
                value={desiredLanguage}
                onValueChange={setDesiredLanguage}
                disabled={languagesLoading || availableLanguages.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-brown-soft">
                {languagesLoading
                  ? "Carregando idiomas com professores ativos..."
                  : availableLanguages.length
                    ? "Mostramos apenas idiomas com professor ativo disponível."
                    : "No momento não há professores ativos para novos alunos."}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Nível de compreensão</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-bronze text-white hover:bg-wine shadow-bronze"
          >
            {loading ? "Salvando..." : "Concluir cadastro"}
          </Button>
        </form>
      </main>
    </div>
  );
}
