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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LANGUAGES, LEVELS } from "@/lib/constants";
import { uploadAvatar } from "@/lib/upload";
import { toast } from "sonner";
import { Camera } from "lucide-react";

export const Route = createFileRoute("/cadastro/professor")({
  head: () => ({ meta: [{ title: "Cadastro de Professor — GWLanguageFlow" }] }),
  component: () => <RequireAuth><Page /></RequireAuth>,
});

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  age: z.coerce.number().int().min(18).max(120),
  bio: z.string().trim().min(20, "Conte um pouco mais (mín. 20 caracteres)").max(800),
  experiences: z.string().trim().max(1000).optional().or(z.literal("")),
  livedAbroad: z.boolean(),
  countriesLived: z.string().trim().max(200).optional().or(z.literal("")),
  languagesSpoken: z.array(z.string()).min(1, "Selecione ao menos um idioma falado"),
  languagesTaught: z.array(z.string()).min(1, "Selecione ao menos um idioma ensinado"),
  levelsTaught: z.array(z.string()).min(1, "Selecione ao menos um nível"),
  hourlyRate: z.coerce.number().min(0).max(10000),
  monthlyRate: z.coerce.number().min(0).max(100000),
  package8Rate: z.coerce.number().min(0).max(100000),
});

function Page() {
  const { user, roles, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [experiences, setExperiences] = useState("");
  const [livedAbroad, setLivedAbroad] = useState(false);
  const [countriesLived, setCountriesLived] = useState("");
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([]);
  const [languagesTaught, setLanguagesTaught] = useState<string[]>([]);
  const [levelsTaught, setLevelsTaught] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlyRate, setMonthlyRate] = useState("");
  const [package8Rate, setPackage8Rate] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  // Se professor já tem perfil completo, vai direto para o dashboard
  useEffect(() => {
    if (!user) return;
    if (roles.includes("professor")) {
      supabase.from("teacher_profiles").select("id").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) navigate({ to: "/dashboard" });
        else setChecking(false);
      });
    } else {
      setChecking(false);
    }
  }, [user, roles, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url, age").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setFullName(data.full_name || ""); if (data.avatar_url) setAvatarPreview(data.avatar_url); if (data.age) setAge(String(data.age)); }
    });
  }, [user]);

  const toggle = (arr: string[], setter: (v: string[]) => void, val: string) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = schema.safeParse({
      fullName, age, bio, experiences, livedAbroad, countriesLived,
      languagesSpoken, languagesTaught, levelsTaught,
      hourlyRate, monthlyRate, package8Rate,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);

    let avatarUrl: string | null = null;
    if (avatarFile) avatarUrl = await uploadAvatar(user.id, avatarFile);

    const d = parsed.data;
    const { error: pErr } = await supabase.from("profiles").upsert({
      id: user.id, full_name: d.fullName, age: d.age, email: user.email,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    });
    if (pErr) { toast.error(pErr.message); setLoading(false); return; }

    const { error: tErr } = await supabase.from("teacher_profiles").upsert({
      id: user.id,
      bio: d.bio,
      experiences: d.experiences || null,
      lived_abroad: d.livedAbroad,
      countries_lived: d.livedAbroad ? d.countriesLived || null : null,
      languages_spoken: d.languagesSpoken,
      languages_taught: d.languagesTaught,
      levels_taught: d.levelsTaught as never,
      hourly_rate: d.hourlyRate,
      monthly_rate: d.monthlyRate,
      package_8_rate: d.package8Rate,
    });
    if (tErr) { toast.error(tErr.message); setLoading(false); return; }

    if (!roles.includes("professor")) {
      const { error: rErr } = await supabase.from("user_roles").insert({ user_id: user.id, role: "professor" });
      if (rErr && !rErr.message.toLowerCase().includes("duplicate")) {
        toast.error("Não foi possível salvar seu perfil. Tente novamente.");
        setLoading(false);
        return;
      }
    }
    await refreshRoles();

    toast.success("Perfil de professor criado!");
    navigate({ to: "/dashboard" });
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
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="mb-8">
          <p className="text-bronze text-xs uppercase tracking-widest font-medium">Cadastro de professor</p>
          <h1 className="font-display text-3xl md:text-4xl text-wine font-bold mt-2">Crie seu perfil</h1>
          <p className="text-brown mt-2">Quanto mais completo, mais alunos você atrai.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-background rounded-3xl border border-border p-6 md:p-10 space-y-7 shadow-soft">

          <Section title="Identidade">
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 rounded-2xl bg-cream border border-border overflow-hidden flex items-center justify-center">
                {avatarPreview ? <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" /> : <Camera className="h-7 w-7 text-brown-soft" />}
              </div>
              <div className="flex-1">
                <Label className="block mb-2">Foto de perfil</Label>
                <Input type="file" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f));
                }} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Idade</Label><Input type="number" min={18} max={120} value={age} onChange={(e) => setAge(e.target.value)} required /></div>
            </div>
          </Section>

          <Section title="Sobre você">
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Apresente-se aos alunos..." required />
            </div>
            <div className="space-y-2">
              <Label>Experiências (opcional)</Label>
              <Textarea rows={3} value={experiences} onChange={(e) => setExperiences(e.target.value)} placeholder="Ensino há 5 anos, certificação CELTA..." />
            </div>
            <div className="flex items-center gap-3 py-2">
              <Switch checked={livedAbroad} onCheckedChange={setLivedAbroad} id="lived" />
              <Label htmlFor="lived" className="cursor-pointer">Já morou fora do país?</Label>
            </div>
            {livedAbroad && (
              <div className="space-y-2">
                <Label>Onde morou?</Label>
                <Input value={countriesLived} onChange={(e) => setCountriesLived(e.target.value)} placeholder="Ex: Inglaterra, Espanha" />
              </div>
            )}
          </Section>

          <Section title="Idiomas">
            <MultiCheck label="Idiomas que fala" options={LANGUAGES} selected={languagesSpoken} onToggle={(v) => toggle(languagesSpoken, setLanguagesSpoken, v)} />
            <MultiCheck label="Idiomas que ensina" options={LANGUAGES} selected={languagesTaught} onToggle={(v) => toggle(languagesTaught, setLanguagesTaught, v)} />
            <MultiCheck label="Níveis que atende" options={LEVELS.map(l => l.label)} selected={levelsTaught.map(v => LEVELS.find(l=>l.value===v)?.label || v)}
              onToggle={(label) => {
                const v = LEVELS.find(l => l.label === label)?.value || label;
                toggle(levelsTaught, setLevelsTaught, v);
              }} />
          </Section>

          <Section title="Valores">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Por hora (R$)</Label><Input type="number" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Mensal (R$)</Label><Input type="number" step="0.01" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} required /></div>
              <div className="space-y-2"><Label>Pacote 8 aulas (R$)</Label><Input type="number" step="0.01" value={package8Rate} onChange={(e) => setPackage8Rate(e.target.value)} required /></div>
            </div>
          </Section>


          <Button type="submit" disabled={loading} className="w-full bg-bronze text-white hover:bg-wine shadow-bronze">
            {loading ? "Salvando..." : "Publicar meu perfil"}
          </Button>
        </form>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 pb-6 border-b border-border last:border-b-0 last:pb-0">
      <h3 className="font-display text-lg text-wine">{title}</h3>
      {children}
    </div>
  );
}

function MultiCheck({ label, options, selected, onToggle }: { label: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isOn = selected.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              onClick={() => onToggle(opt)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                isOn ? "bg-wine text-white border-wine" : "bg-background text-brown border-border hover:border-bronze"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
