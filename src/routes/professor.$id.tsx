import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Languages, Sparkles, Calendar } from "lucide-react";
import { LEVELS, WEEKDAYS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/professor/$id")({
  head: () => ({ meta: [{ title: "Perfil do Professor — GWLanguageFlow" }] }),
  component: TeacherProfilePage,
});

interface TeacherFull {
  id: string;
  full_name: string;
  avatar_url: string | null;
  age: number | null;
  bio: string | null;
  experiences: string | null;
  lived_abroad: boolean;
  countries_lived: string | null;
  languages_spoken: string[];
  languages_taught: string[];
  levels_taught: string[];
  hourly_rate: number;
  monthly_rate: number;
  package_8_rate: number;
  use_custom_pricing: boolean;
  custom_prices: Record<string, number>;
}

const PLATFORM_PRICES: { key: string; label: string; value: number }[] = [
  { key: "plan_essencial", label: "Plano Essencial (mensal)", value: 179.90 },
  { key: "plan_advanced", label: "Plano Advanced (mensal)", value: 299.90 },
  { key: "plan_conversation", label: "Plano Conversation (mensal)", value: 169.90 },
  { key: "plan_anual", label: "Plano Anual Advanced (12x R$ 269,90)", value: 3238.80 },
];

const PRICE_LABELS: Record<string, string> = {
  hourly: "Aula avulsa (1h)",
  monthly: "Mensal",
  package_8: "Pacote 8 aulas",
  plan_essencial: "Plano Essencial",
  plan_advanced: "Plano Advanced",
  plan_conversation: "Plano Conversation",
  plan_anual: "Plano Anual Advanced",
};

function TeacherProfilePage() {
  const { id } = useParams({ from: "/professor/$id" });
  const [teacher, setTeacher] = useState<TeacherFull | null>(null);
  const [reviews, setReviews] = useState<{ rating: number; comment: string | null; created_at: string; student_name: string }[]>([]);
  const [availability, setAvailability] = useState<{ day_of_week: number; start_time: string; end_time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: tp } = await supabase.from("teacher_profiles").select("*").eq("id", id).maybeSingle();
      const { data: prof } = await supabase.from("profiles").select("full_name, avatar_url, age").eq("id", id).maybeSingle();
      if (!tp || !prof) { setLoading(false); return; }
      setTeacher({
        id, full_name: prof.full_name, avatar_url: prof.avatar_url, age: prof.age,
        bio: tp.bio, experiences: tp.experiences, lived_abroad: !!tp.lived_abroad, countries_lived: tp.countries_lived,
        languages_spoken: tp.languages_spoken || [], languages_taught: tp.languages_taught || [], levels_taught: tp.levels_taught || [],
        hourly_rate: Number(tp.hourly_rate || 0), monthly_rate: Number(tp.monthly_rate || 0), package_8_rate: Number(tp.package_8_rate || 0),
        use_custom_pricing: !!(tp as any).use_custom_pricing,
        custom_prices: ((tp as any).custom_prices ?? {}) as Record<string, number>,
      });

      const { data: revs } = await supabase.from("reviews").select("rating, comment, created_at, student_id").eq("teacher_id", id).order("created_at", { ascending: false });
      if (revs?.length) {
        const sids = revs.map(r => r.student_id);
        const { data: sprofs } = await supabase.from("profiles").select("id, full_name").in("id", sids);
        const m = new Map(sprofs?.map(p => [p.id, p.full_name]) ?? []);
        setReviews(revs.map(r => ({ rating: r.rating, comment: r.comment, created_at: r.created_at, student_name: m.get(r.student_id) || "Aluno" })));
      }

      const { data: avs } = await supabase.from("teacher_availability").select("day_of_week, start_time, end_time").eq("teacher_id", id);
      setAvailability(avs || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-bronze border-t-transparent" /></div>;
  }
  if (!teacher) {
    return (
      <div className="min-h-screen flex flex-col"><SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl text-wine">Professor não encontrado</h1>
          <Link to="/feed"><Button className="mt-6 bg-bronze text-white hover:bg-wine">Voltar ao feed</Button></Link>
        </main><SiteFooter />
      </div>
    );
  }

  const avgRating = reviews.length ? reviews.reduce((s,r)=>s+r.rating,0)/reviews.length : null;

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="bg-background rounded-3xl overflow-hidden shadow-soft border border-border">
          <div className="h-40 md:h-52 bg-gradient-warm" />
          <div className="px-6 md:px-10 pb-8 -mt-16 md:-mt-20">
            <div className="flex flex-col md:flex-row md:items-end gap-5 md:gap-8">
              <div className="h-32 w-32 md:h-40 md:w-40 rounded-3xl overflow-hidden border-4 border-background bg-cream shadow-warm flex items-center justify-center">
                {teacher.avatar_url ? <img src={teacher.avatar_url} alt={teacher.full_name} className="w-full h-full object-cover" /> : <span className="font-display text-5xl text-wine">{teacher.full_name.charAt(0)}</span>}
              </div>
              <div className="flex-1 pt-2">
                <h1 className="font-display text-3xl md:text-4xl text-wine font-bold">{teacher.full_name}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-brown">
                  {teacher.age && <span>{teacher.age} anos</span>}
                  {avgRating && (
                    <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-bronze text-bronze" /> {avgRating.toFixed(1)} ({reviews.length})</span>
                  )}
                  {teacher.lived_abroad && teacher.countries_lived && (
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4 text-bronze" /> Morou em {teacher.countries_lived}</span>
                  )}
                </div>
              </div>
              <BookingDialog teacher={teacher} />
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-10">
              <div className="md:col-span-2 space-y-6">
                <Card title="Sobre">
                  <p className="text-brown whitespace-pre-line">{teacher.bio || "—"}</p>
                </Card>
                {teacher.experiences && (
                  <Card title="Experiências">
                    <p className="text-brown whitespace-pre-line">{teacher.experiences}</p>
                  </Card>
                )}
                <Card title="Avaliações">
                  {reviews.length === 0 ? (
                    <p className="text-sm text-brown-soft">Ainda sem avaliações.</p>
                  ) : (
                    <div className="space-y-4">
                      {reviews.slice(0, 5).map((r, i) => (
                        <div key={i} className="border-b border-border last:border-0 pb-4 last:pb-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-wine text-sm">{r.student_name}</span>
                            <span className="flex">{[1,2,3,4,5].map(n => <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-bronze text-bronze" : "text-border"}`} />)}</span>
                          </div>
                          {r.comment && <p className="text-sm text-brown">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
              <div className="space-y-4">
                <Card title="Idiomas">
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-brown-soft mb-1">Ensina</p>
                      <div className="flex flex-wrap gap-1.5">{teacher.languages_taught.map(l => <span key={l} className="px-2.5 py-1 rounded-full bg-wine text-white text-xs">{l}</span>)}</div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-brown-soft mb-1">Fala</p>
                      <div className="flex flex-wrap gap-1.5">{teacher.languages_spoken.map(l => <span key={l} className="px-2.5 py-1 rounded-full bg-cream text-wine text-xs border border-border">{l}</span>)}</div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-brown-soft mb-1">Níveis</p>
                      <div className="flex flex-wrap gap-1.5">{teacher.levels_taught.map(v => <span key={v} className="px-2.5 py-1 rounded-full bg-bronze/15 text-bronze text-xs">{LEVELS.find(l=>l.value===v)?.label || v}</span>)}</div>
                    </div>
                  </div>
                </Card>
                <Card title={teacher.use_custom_pricing ? "Valores do professor" : "Valores (padrão da plataforma)"}>
                  <ul className="space-y-2 text-sm">
                    {teacher.use_custom_pricing
                      ? Object.entries(teacher.custom_prices).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
                          <li key={k} className="flex justify-between gap-3">
                            <span className="text-brown">{PRICE_LABELS[k] ?? k}</span>
                            <span className="font-semibold text-wine">R$ {Number(v).toFixed(2).replace(".", ",")}</span>
                          </li>
                        ))
                      : PLATFORM_PRICES.map((p) => (
                          <li key={p.key} className="flex justify-between gap-3">
                            <span className="text-brown">{p.label}</span>
                            <span className="font-semibold text-wine">R$ {p.value.toFixed(2).replace(".", ",")}</span>
                          </li>
                        ))}
                    {teacher.use_custom_pricing && Object.values(teacher.custom_prices).every((v) => !Number(v)) && (
                      <li className="text-xs text-brown-soft">Sem valores cadastrados.</li>
                    )}
                  </ul>
                </Card>
                <Card title="Disponibilidade">
                  {availability.length === 0 ? (
                    <p className="text-xs text-brown-soft">Combine direto na hora do agendamento.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {availability.map((a, i) => (
                        <li key={i} className="flex justify-between text-brown">
                          <span>{WEEKDAYS[a.day_of_week]}</span>
                          <span className="text-wine">{a.start_time.slice(0,5)} – {a.end_time.slice(0,5)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-background rounded-2xl border border-border p-5">
      <h3 className="font-display text-lg text-wine mb-3 flex items-center gap-2"><Sparkles className="h-4 w-4 text-bronze" /> {title}</h3>
      {children}
    </div>
  );
}

function BookingDialog({ teacher }: { teacher: TeacherFull }) {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");
  const [duration, setDuration] = useState("60");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!user) { navigate({ to: "/auth/login" }); return; }
    if (!roles.includes("aluno")) {
      toast.error("Apenas alunos podem agendar. Crie um perfil de aluno.");
      navigate({ to: "/cadastro/aluno" });
      return;
    }
    if (!date) { toast.error("Escolha uma data"); return; }
    setLoading(true);
    const scheduled = new Date(`${date}T${time}:00`);
    const { error } = await supabase.from("bookings").insert({
      student_id: user.id, teacher_id: teacher.id,
      scheduled_at: scheduled.toISOString(),
      duration_minutes: Number(duration),
      status: "pendente",
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("row-level security")) {
        toast.error("Você precisa de uma assinatura ativa para agendar aulas.");
        navigate({ to: "/planos" });
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Aula agendada!");
    setOpen(false);
    navigate({ to: "/meus-agendamentos" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-bronze text-white hover:bg-wine shadow-bronze gap-2"><Calendar className="h-4 w-4" /> Agendar aula</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-wine font-display">Agendar com {teacher.full_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Data</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split("T")[0]} /></div>
            <div className="space-y-1"><Label>Hora</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Duração</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="60">1 hora</SelectItem>
                <SelectItem value="90">1h30</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-xl bg-cream p-4 text-sm">
            <p className="text-brown-soft text-xs">Aulas incluídas na sua assinatura ativa.</p>
          </div>
          <Button onClick={handleConfirm} disabled={loading} className="w-full bg-bronze text-white hover:bg-wine shadow-bronze">
            {loading ? "Processando..." : "Confirmar agendamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
