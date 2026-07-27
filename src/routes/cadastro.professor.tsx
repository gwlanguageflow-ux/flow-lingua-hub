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
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { uploadAvatar } from "@/lib/upload";
import { toast } from "sonner";
import { Camera, Plus, Trash2 } from "lucide-react";
import type { Database, Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/cadastro/professor")({
  head: () => ({ meta: [{ title: "Cadastro de Professor — GWLanguageFlow" }] }),
  component: () => (
    <RequireAuth fallback="/auth/signup">
      <Page />
    </RequireAuth>
  ),
});

type PixKeyType = Database["public"]["Enums"]["pix_key_type"];
type CustomPlanDraft = {
  id: string;
  name: string;
  price: string;
  description: string;
};

const emptyCustomPlan = (): CustomPlanDraft => ({
  id: crypto.randomUUID(),
  name: "",
  price: "",
  description: "",
});

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function inferPixKeyType(value: string): PixKeyType {
  const trimmed = value.trim();
  const digits = onlyDigits(trimmed);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
  if (digits.length === 11) return "cpf";
  if (digits.length >= 10 && digits.length <= 13) return "telefone";
  return "aleatoria";
}

const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  cpf: z.string().refine(isValidCpf, "Informe um CPF válido"),
  age: z.coerce.number().int().min(18).max(120),
  bio: z.string().trim().min(20, "Conte um pouco mais (mín. 20 caracteres)").max(800),
  experiences: z.string().trim().max(1000).optional().or(z.literal("")),
  livedAbroad: z.boolean(),
  countriesLived: z.string().trim().max(200).optional().or(z.literal("")),
  languagesSpoken: z.array(z.string()).min(1, "Selecione ao menos um idioma falado"),
  languagesTaught: z.array(z.string()).min(1, "Selecione ao menos um idioma ensinado"),
  levelsTaught: z.array(z.string()).min(1, "Selecione ao menos um nível"),
  useCustomPricing: z.boolean(),
  customPrices: z.record(z.string(), z.number().min(0).max(100000)),
  withdrawalPixKey: z
    .string()
    .trim()
    .min(3, "Informe uma chave Pix para saque")
    .max(200, "Chave Pix muito longa"),
});

function Page() {
  const { user, roles, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingProfile, setExistingProfile] = useState(false);
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [experiences, setExperiences] = useState("");
  const [livedAbroad, setLivedAbroad] = useState(false);
  const [countriesLived, setCountriesLived] = useState("");
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([]);
  const [languagesTaught, setLanguagesTaught] = useState<string[]>([]);
  const [levelsTaught, setLevelsTaught] = useState<string[]>([]);
  const [useCustomPricing, setUseCustomPricing] = useState(false);
  const [customPlans, setCustomPlans] = useState<CustomPlanDraft[]>([emptyCustomPlan()]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [withdrawalPixKey, setWithdrawalPixKey] = useState("");

  // Se professor já tem perfil completo, vai direto para o dashboard
  useEffect(() => {
    if (!user) return;
    if (roles.includes("professor")) {
      Promise.all([
        supabase
          .from("profiles")
          .select("full_name, cpf, age, avatar_url")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("teacher_profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("teacher_payout_profiles")
          .select("pix_key")
          .eq("teacher_id", user.id)
          .maybeSingle(),
        supabase
          .from("teacher_custom_plans")
          .select("*")
          .eq("teacher_id", user.id)
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ]).then(
        ([
          { data: profile },
          { data: teacherProfile },
          { data: payoutProfile },
          { data: planRows },
        ]) => {
          if (profile) {
            setFullName(profile.full_name || "");
            if (profile.cpf) setCpf(formatCpf(profile.cpf));
            if (profile.age) setAge(String(profile.age));
            if (profile.avatar_url) setAvatarPreview(profile.avatar_url);
          }
          if (teacherProfile) {
            setExistingProfile(true);
            setBio(teacherProfile.bio || "");
            setExperiences(teacherProfile.experiences || "");
            setLivedAbroad(!!teacherProfile.lived_abroad);
            setCountriesLived(teacherProfile.countries_lived || "");
            setLanguagesSpoken(teacherProfile.languages_spoken || []);
            setLanguagesTaught(teacherProfile.languages_taught || []);
            setLevelsTaught(teacherProfile.levels_taught || []);
            setUseCustomPricing(!!teacherProfile.use_custom_pricing);
            const plans = (planRows ?? []) as Tables<"teacher_custom_plans">[];
            if (plans.length) {
              setCustomPlans(
                plans.map((plan) => ({
                  id: plan.id,
                  name: plan.name,
                  price: String(plan.price),
                  description: plan.description,
                })),
              );
            }
          }
          if (payoutProfile?.pix_key) setWithdrawalPixKey(payoutProfile.pix_key);
          setChecking(false);
        },
      );
    } else {
      setChecking(false);
    }
  }, [user, roles]);

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

  const toggle = (arr: string[], setter: (v: string[]) => void, val: string) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const numericPrices: Record<string, number> = {};
    let submittedCustomPlans: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
    }> = [];
    if (useCustomPricing) {
      const validPlans = customPlans
        .map((plan) => ({
          ...plan,
          name: plan.name.trim(),
          description: plan.description.trim(),
          priceNumber: Number(plan.price.replace(",", ".")),
        }))
        .filter((plan) => plan.name || plan.description || plan.price);

      if (validPlans.length === 0) {
        toast.error("Crie pelo menos um plano proprio com nome, valor e descricao.");
        return;
      }

      for (const plan of validPlans) {
        if (plan.name.length < 3) {
          toast.error("Cada plano proprio precisa ter um nome com pelo menos 3 caracteres.");
          return;
        }
        if (plan.description.length < 10) {
          toast.error("Explique rapidamente cada plano proprio em pelo menos 10 caracteres.");
          return;
        }
        if (!Number.isFinite(plan.priceNumber) || plan.priceNumber <= 0) {
          toast.error(`Informe um valor valido para o plano "${plan.name}".`);
          return;
        }
      }

      validPlans.forEach((plan, index) => {
        numericPrices[`custom_plan_${index + 1}`] = Number(plan.priceNumber.toFixed(2));
      });
      submittedCustomPlans = validPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: Number(plan.priceNumber.toFixed(2)),
      }));
    }
    const parsed = schema.safeParse({
      fullName,
      cpf,
      age,
      bio,
      experiences,
      livedAbroad,
      countriesLived,
      languagesSpoken,
      languagesTaught,
      levelsTaught,
      useCustomPricing,
      customPrices: numericPrices,
      withdrawalPixKey,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);

    let avatarUrl: string | null = null;
    if (avatarFile) avatarUrl = await uploadAvatar(user.id, avatarFile);

    const d = parsed.data;
    const { error } = await supabase.rpc("complete_teacher_profile", {
      _full_name: d.fullName,
      _cpf: normalizeCpf(d.cpf),
      _age: d.age,
      _bio: d.bio,
      _experiences: d.experiences || "",
      _lived_abroad: d.livedAbroad,
      _countries_lived: (d.livedAbroad && d.countriesLived) || "",
      _languages_spoken: d.languagesSpoken,
      _languages_taught: d.languagesTaught,
      _levels_taught: d.levelsTaught as (
        | "avancado"
        | "basico"
        | "fluente"
        | "iniciante"
        | "intermediario"
      )[],
      _use_custom_pricing: d.useCustomPricing,
      _custom_prices: d.customPrices,
      _avatar_url: avatarUrl ?? undefined,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (d.useCustomPricing) {
      const rows = submittedCustomPlans.map((plan, index) => ({
        id: plan.id,
        teacher_id: user.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        interval: "mensal" as const,
        sort_order: index + 1,
        is_active: true,
      }));

      const { error: upsertPlansError } = await supabase
        .from("teacher_custom_plans")
        .upsert(rows, { onConflict: "id" });

      if (upsertPlansError) {
        toast.error(
          `Perfil salvo, mas os planos proprios nao foram atualizados: ${upsertPlansError.message}`,
        );
        setLoading(false);
        return;
      }

      const activePlanIds = rows.map((plan) => plan.id);
      let deactivateQuery = supabase
        .from("teacher_custom_plans")
        .update({ is_active: false })
        .eq("teacher_id", user.id);

      if (activePlanIds.length > 0) {
        deactivateQuery = deactivateQuery.not("id", "in", `(${activePlanIds.join(",")})`);
      }

      const { error: deactivatePlansError } = await deactivateQuery;
      if (deactivatePlansError) {
        toast.error(
          `Perfil salvo, mas os planos removidos nao foram desativados: ${deactivatePlansError.message}`,
        );
        setLoading(false);
        return;
      }
    } else {
      const { error: deactivatePlansError } = await supabase
        .from("teacher_custom_plans")
        .update({ is_active: false })
        .eq("teacher_id", user.id);

      if (deactivatePlansError) {
        toast.error(
          `Perfil salvo, mas os planos proprios nao foram desativados: ${deactivatePlansError.message}`,
        );
        setLoading(false);
        return;
      }
    }

    const { error: payoutError } = await supabase.from("teacher_payout_profiles").upsert(
      {
        teacher_id: user.id,
        pix_key: d.withdrawalPixKey.trim(),
        pix_key_type: inferPixKeyType(d.withdrawalPixKey),
        account_holder_name: d.fullName.trim(),
        account_holder_document: normalizeCpf(d.cpf),
      },
      { onConflict: "teacher_id" },
    );

    if (payoutError) {
      toast.error(`Perfil salvo, mas a chave Pix nao foi registrada: ${payoutError.message}`);
      setLoading(false);
      return;
    }

    await refreshRoles();

    toast.success(existingProfile ? "Perfil atualizado!" : "Perfil de professor criado!");
    if (existingProfile) {
      navigate({ to: "/professor/$id", params: { id: user.id } });
    } else {
      navigate({ to: "/dashboard" });
    }
  };

  const updateCustomPlan = (
    id: string,
    field: keyof Omit<CustomPlanDraft, "id">,
    value: string,
  ) => {
    setCustomPlans((current) =>
      current.map((plan) => (plan.id === id ? { ...plan, [field]: value } : plan)),
    );
  };

  const addCustomPlan = () => {
    setCustomPlans((current) => [...current, emptyCustomPlan()]);
  };

  const removeCustomPlan = (id: string) => {
    setCustomPlans((current) =>
      current.length > 1 ? current.filter((plan) => plan.id !== id) : [emptyCustomPlan()],
    );
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
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="gw-command-hero mb-6 rounded-xl p-6 md:p-8">
          <p className="gw-section-kicker">Cadastro de professor</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-wine md:text-4xl">
            {existingProfile ? "Edite seu perfil" : "Crie seu perfil"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-brown-soft">
            Quanto mais completo, mais claro fica seu posicionamento para alunos e para a diretoria.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="gw-app-card gw-input-shell rounded-xl p-6 shadow-soft md:p-8 space-y-7"
        >
          <Section title="Identidade">
            <div className="flex items-center gap-5">
              <div className="h-24 w-24 rounded-2xl bg-cream border border-border overflow-hidden flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-7 w-7 text-brown-soft" />
                )}
              </div>
              <div className="flex-1">
                <Label className="block mb-2">Foto de perfil</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setAvatarFile(f);
                    setAvatarPreview(URL.createObjectURL(f));
                  }}
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
                  min={18}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
              </div>
            </div>
          </Section>

          <Section title="Dados de saque">
            <div className="space-y-2">
              <Label>Chave Pix para saque</Label>
              <Input
                value={withdrawalPixKey}
                onChange={(e) => setWithdrawalPixKey(e.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatoria"
                required
              />
              <p className="text-xs leading-5 text-brown-soft">
                Essa chave fica protegida e sera usada para preencher automaticamente a mensagem de
                saque enviada para a diretoria.
              </p>
            </div>
          </Section>

          <Section title="Sobre você">
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Apresente-se aos alunos..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Experiências (opcional)</Label>
              <Textarea
                rows={3}
                value={experiences}
                onChange={(e) => setExperiences(e.target.value)}
                placeholder="Ensino há 5 anos, certificação CELTA..."
              />
            </div>
            <div className="flex items-center gap-3 py-2">
              <Switch checked={livedAbroad} onCheckedChange={setLivedAbroad} id="lived" />
              <Label htmlFor="lived" className="cursor-pointer">
                Já morou fora do país?
              </Label>
            </div>
            {livedAbroad && (
              <div className="space-y-2">
                <Label>Onde morou?</Label>
                <Input
                  value={countriesLived}
                  onChange={(e) => setCountriesLived(e.target.value)}
                  placeholder="Ex: Inglaterra, Espanha"
                />
              </div>
            )}
          </Section>

          <Section title="Idiomas">
            <MultiCheck
              label="Idiomas que fala"
              options={LANGUAGES}
              selected={languagesSpoken}
              onToggle={(v) => toggle(languagesSpoken, setLanguagesSpoken, v)}
            />
            <MultiCheck
              label="Idiomas que ensina"
              options={LANGUAGES}
              selected={languagesTaught}
              onToggle={(v) => toggle(languagesTaught, setLanguagesTaught, v)}
            />
            <MultiCheck
              label="Níveis que atende"
              options={LEVELS.map((l) => l.label)}
              selected={levelsTaught.map((v) => LEVELS.find((l) => l.value === v)?.label || v)}
              onToggle={(label) => {
                const v = LEVELS.find((l) => l.label === label)?.value || label;
                toggle(levelsTaught, setLevelsTaught, v);
              }}
            />
          </Section>

          <Section title="Valores e modalidades">
            <RadioGroup
              value={useCustomPricing ? "custom" : "default"}
              onValueChange={(v) => setUseCustomPricing(v === "custom")}
              className="grid md:grid-cols-2 gap-3"
            >
              <label
                className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition ${!useCustomPricing ? "border-bronze bg-cream" : "border-border"}`}
              >
                <RadioGroupItem value="default" id="pr-default" className="mt-1" />
                <div>
                  <div className="font-semibold text-wine">Padrão da plataforma</div>
                  <p className="text-sm text-brown">
                    Use os valores oficiais da GWLanguageFlow para todos os planos e modalidades.
                  </p>
                </div>
              </label>
              <label
                className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition ${useCustomPricing ? "border-bronze bg-cream" : "border-border"}`}
              >
                <RadioGroupItem value="custom" id="pr-custom" className="mt-1" />
                <div>
                  <div className="font-semibold text-wine">Personalizado</div>
                  <p className="text-sm text-brown">
                    Crie seus planos com nome, valor e uma explicação curta para o aluno.
                  </p>
                </div>
              </label>
            </RadioGroup>

            {useCustomPricing && (
              <div className="space-y-4 rounded-2xl border border-bronze/30 bg-cream/70 p-4">
                <div>
                  <p className="font-semibold text-wine">Seus planos</p>
                  <p className="mt-1 text-sm leading-6 text-brown-soft">
                    Cadastre pelo menos um plano. O aluno verá exatamente estes nomes, valores e
                    descrições no perfil e no checkout.
                  </p>
                </div>

                {customPlans.map((plan, index) => (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-border bg-white p-4 shadow-soft"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-wine">Plano {index + 1}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomPlan(plan.id)}
                        className="h-8 text-brown-soft hover:text-wine"
                        aria-label="Remover plano"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                      <div className="space-y-2">
                        <Label>Nome do plano</Label>
                        <Input
                          value={plan.name}
                          onChange={(event) =>
                            updateCustomPlan(plan.id, "name", event.target.value)
                          }
                          placeholder="Ex: Conversação intensiva"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor mensal (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={plan.price}
                          onChange={(event) =>
                            updateCustomPlan(plan.id, "price", event.target.value)
                          }
                          placeholder="199,90"
                        />
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Label>Descrição rápida</Label>
                      <Textarea
                        rows={2}
                        value={plan.description}
                        onChange={(event) =>
                          updateCustomPlan(plan.id, "description", event.target.value)
                        }
                        placeholder="Explique em poucas palavras para quem este plano é indicado."
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addCustomPlan}
                  className="w-full border-bronze/40 text-wine hover:bg-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar plano
                </Button>
              </div>
            )}
          </Section>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-bronze text-white hover:bg-wine shadow-bronze"
          >
            {loading
              ? "Salvando..."
              : existingProfile
                ? "Salvar alterações"
                : "Publicar meu perfil"}
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

function MultiCheck({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
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
                isOn
                  ? "bg-wine text-white border-wine"
                  : "bg-background text-brown border-border hover:border-bronze"
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
