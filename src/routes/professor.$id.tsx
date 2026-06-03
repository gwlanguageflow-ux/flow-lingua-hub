import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ImagePlus,
  Languages,
  MapPin,
  PencilLine,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { LEVELS, WEEKDAYS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { uploadTeacherPostImage } from "@/lib/upload";
import { getProfileAvatarUrl, getProfileBannerUrl } from "@/lib/profile-media";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/professor/$id")({
  head: () => ({ meta: [{ title: "Perfil do Professor — GWLanguageFlow" }] }),
  component: TeacherProfilePage,
});

interface TeacherFull {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
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

type TeacherCustomPlan = Pick<
  Tables<"teacher_custom_plans">,
  "id" | "name" | "description" | "price" | "interval" | "sort_order"
>;

const PLATFORM_PRICES: { key: string; label: string; value: number }[] = [
  { key: "plan_essencial", label: "Plano essential (mensal)", value: 179.9 },
  { key: "plan_advanced", label: "Plano advenced (mensal)", value: 299.9 },
  { key: "plan_conversation", label: "Plano conversation (mensal)", value: 169.9 },
];

function TeacherProfilePage() {
  const { id } = useParams({ from: "/professor/$id" });
  const { user } = useAuth();
  const [teacher, setTeacher] = useState<TeacherFull | null>(null);
  const [posts, setPosts] = useState<Tables<"teacher_posts">[]>([]);
  const [reviews, setReviews] = useState<
    { rating: number; comment: string | null; created_at: string; student_name: string }[]
  >([]);
  const [availability, setAvailability] = useState<
    { day_of_week: number; start_time: string; end_time: string }[]
  >([]);
  const [customPlans, setCustomPlans] = useState<TeacherCustomPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: tp } = await supabase
        .from("teacher_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, age, email")
        .eq("id", id)
        .maybeSingle();
      if (!tp || !prof) {
        setLoading(false);
        return;
      }
      setTeacher({
        id,
        full_name: prof.full_name,
        avatar_url: prof.avatar_url,
        email: prof.email,
        age: prof.age,
        bio: tp.bio,
        experiences: tp.experiences,
        lived_abroad: !!tp.lived_abroad,
        countries_lived: tp.countries_lived,
        languages_spoken: tp.languages_spoken || [],
        languages_taught: tp.languages_taught || [],
        levels_taught: tp.levels_taught || [],
        hourly_rate: Number(tp.hourly_rate || 0),
        monthly_rate: Number(tp.monthly_rate || 0),
        package_8_rate: Number(tp.package_8_rate || 0),
        use_custom_pricing: !!tp.use_custom_pricing,
        custom_prices: (tp.custom_prices ?? {}) as Record<string, number>,
      });

      const { data: revs } = await supabase
        .from("reviews")
        .select("rating, comment, created_at, student_id")
        .eq("teacher_id", id)
        .order("created_at", { ascending: false });
      if (revs?.length) {
        const sids = revs.map((r) => r.student_id);
        const { data: sprofs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", sids);
        const m = new Map(sprofs?.map((p) => [p.id, p.full_name]) ?? []);
        setReviews(
          revs.map((r) => ({
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            student_name: m.get(r.student_id) || "Aluno",
          })),
        );
      }

      const { data: avs } = await supabase
        .from("teacher_availability")
        .select("day_of_week, start_time, end_time")
        .eq("teacher_id", id);
      setAvailability(avs || []);

      const { data: postRows } = await supabase
        .from("teacher_posts")
        .select("*")
        .eq("teacher_id", id)
        .order("created_at", { ascending: false });
      setPosts(postRows || []);

      const { data: planRows } = await supabase
        .from("teacher_custom_plans")
        .select("id, name, description, price, interval, sort_order")
        .eq("teacher_id", id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setCustomPlans(planRows || []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-bronze border-t-transparent" />
      </div>
    );
  }
  if (!teacher) {
    return (
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-3xl text-wine">Professor não encontrado</h1>
          <Link to="/feed">
            <Button className="mt-6 bg-bronze text-white hover:bg-wine">Voltar ao feed</Button>
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;
  const isOwner = user?.id === id;
  const avatarUrl = getProfileAvatarUrl(teacher);
  const bannerUrl = getProfileBannerUrl(teacher);

  return (
    <div className="gw-app-shell flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="gw-app-card overflow-hidden rounded-xl">
          <div
            className="gw-profile-banner h-44 bg-cover bg-center md:h-60"
            style={
              bannerUrl
                ? {
                    backgroundImage: `linear-gradient(120deg, rgba(34, 13, 17, 0.84), rgba(114, 47, 55, 0.58), rgba(205, 127, 50, 0.32)), url(${bannerUrl})`,
                    backgroundPosition: "center 38%",
                  }
                : undefined
            }
          />
          <div className="relative z-10 px-6 pb-8 -mt-12 md:-mt-20 md:px-10">
            <div className="flex flex-col md:flex-row md:items-end gap-5 md:gap-8">
              <div className="gw-avatar-frame flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl md:h-40 md:w-40">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={teacher.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-5xl text-wine">
                    {teacher.full_name.charAt(0)}
                  </span>
                )}
              </div>
              <div className="flex-1 pt-2">
                <h1 className="font-display text-3xl md:text-4xl text-wine font-bold">
                  {teacher.full_name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-brown">
                  {teacher.age && <span>{teacher.age} anos</span>}
                  {avgRating && (
                    <span className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-bronze text-bronze" /> {avgRating.toFixed(1)} (
                      {reviews.length})
                    </span>
                  )}
                  {teacher.lived_abroad && teacher.countries_lived && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-bronze" /> Morou em {teacher.countries_lived}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {isOwner && (
                  <Link to="/cadastro/professor">
                    <Button variant="outline" className="border-wine text-wine gap-2">
                      <PencilLine className="h-4 w-4" />
                      Editar dados
                    </Button>
                  </Link>
                )}
                {!isOwner && <BookingDialog teacher={teacher} />}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mt-10">
              <div className="md:col-span-2 space-y-6">
                {isOwner && (
                  <PostComposer
                    teacherId={id}
                    onCreated={(post) => setPosts((prev) => [post, ...prev])}
                  />
                )}
                <TeacherFeedSection
                  posts={posts}
                  isOwner={isOwner}
                  teacherId={id}
                  onUpdated={(post) =>
                    setPosts((prev) => prev.map((item) => (item.id === post.id ? post : item)))
                  }
                  onDeleted={(postId) =>
                    setPosts((prev) => prev.filter((item) => item.id !== postId))
                  }
                />
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
                        <div
                          key={i}
                          className="border-b border-border last:border-0 pb-4 last:pb-0"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-wine text-sm">
                              {r.student_name}
                            </span>
                            <span className="flex">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-bronze text-bronze" : "text-border"}`}
                                />
                              ))}
                            </span>
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
                      <p className="text-xs uppercase tracking-wider text-brown-soft mb-1">
                        Ensina
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {teacher.languages_taught.map((l) => (
                          <span
                            key={l}
                            className="px-2.5 py-1 rounded-full bg-wine text-white text-xs"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-brown-soft mb-1">Fala</p>
                      <div className="flex flex-wrap gap-1.5">
                        {teacher.languages_spoken.map((l) => (
                          <span
                            key={l}
                            className="rounded-lg border border-border bg-cream px-2.5 py-1 text-xs text-wine"
                          >
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wider text-brown-soft mb-1">
                        Níveis
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {teacher.levels_taught.map((v) => (
                          <span
                            key={v}
                            className="px-2.5 py-1 rounded-full bg-bronze/15 text-bronze text-xs"
                          >
                            {LEVELS.find((l) => l.value === v)?.label || v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
                <Card
                  title={
                    teacher.use_custom_pricing
                      ? "Valores do professor"
                      : "Valores (padrão da plataforma)"
                  }
                >
                  <ul className="space-y-2 text-sm">
                    {teacher.use_custom_pricing
                      ? customPlans.map((plan) => (
                          <li
                            key={plan.id}
                            className="rounded-xl border border-border bg-cream p-3"
                          >
                            <div className="flex justify-between gap-3">
                              <span className="font-semibold text-brown">{plan.name}</span>
                              <span className="font-semibold text-wine">
                                {formatMoney(Number(plan.price))}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-brown-soft">
                              {plan.description}
                            </p>
                          </li>
                        ))
                      : PLATFORM_PRICES.map((p) => (
                          <li key={p.key} className="flex justify-between gap-3">
                            <span className="text-brown">{p.label}</span>
                            <span className="font-semibold text-wine">
                              R$ {p.value.toFixed(2).replace(".", ",")}
                            </span>
                          </li>
                        ))}
                    {teacher.use_custom_pricing && customPlans.length === 0 && (
                      <li className="text-xs text-brown-soft">Sem valores cadastrados.</li>
                    )}
                  </ul>
                </Card>
                <Card title="Disponibilidade">
                  {availability.length === 0 ? (
                    <p className="text-xs text-brown-soft">
                      Combine direto na hora do agendamento.
                    </p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {availability.map((a, i) => (
                        <li key={i} className="flex justify-between text-brown">
                          <span>{WEEKDAYS[a.day_of_week]}</span>
                          <span className="text-wine">
                            {a.start_time.slice(0, 5)} – {a.end_time.slice(0, 5)}
                          </span>
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
    <div className="gw-surface rounded-xl p-5">
      <h3 className="font-display text-lg text-wine mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-bronze" /> {title}
      </h3>
      {children}
    </div>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function TeacherFeedSection({
  posts,
  isOwner,
  teacherId,
  onUpdated,
  onDeleted,
}: {
  posts: Tables<"teacher_posts">[];
  isOwner: boolean;
  teacherId: string;
  onUpdated: (post: Tables<"teacher_posts">) => void;
  onDeleted: (postId: string) => void;
}) {
  return (
    <Card title="Feed do professor">
      {posts.length === 0 ? (
        <p className="text-sm text-brown-soft">
          Nenhum post publicado ainda. Quando o professor publicar, o feed aparece aqui.
        </p>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <TeacherPostCard
              key={post.id}
              post={post}
              isOwner={isOwner}
              teacherId={teacherId}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function TeacherPostCard({
  post,
  isOwner,
  teacherId,
  onUpdated,
  onDeleted,
}: {
  post: Tables<"teacher_posts">;
  isOwner: boolean;
  teacherId: string;
  onUpdated: (post: Tables<"teacher_posts">) => void;
  onDeleted: (postId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(post.caption || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setCaption(post.caption || "");
  }, [post.caption]);

  const savePost = async () => {
    if (caption.trim().length < 3) {
      toast.error("Escreva uma legenda para o post.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("teacher_posts")
      .update({ caption: caption.trim() })
      .eq("id", post.id)
      .eq("teacher_id", teacherId)
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message || "Nao foi possivel salvar o post.");
      return;
    }
    onUpdated(data);
    setEditing(false);
    toast.success("Post atualizado.");
  };

  const deletePost = async () => {
    const confirmed = window.confirm("Excluir esta publicacao do feed?");
    if (!confirmed) return;
    setDeleting(true);
    const { error } = await supabase
      .from("teacher_posts")
      .delete()
      .eq("id", post.id)
      .eq("teacher_id", teacherId);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    onDeleted(post.id);
    toast.success("Post excluido.");
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-cream shadow-soft">
      {post.image_url && (
        <img src={post.image_url} alt="" className="max-h-[520px] w-full object-cover" />
      )}
      <div className="space-y-3 p-4">
        {editing ? (
          <Textarea rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} />
        ) : (
          <p className="text-sm leading-6 text-brown whitespace-pre-line">{post.caption}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-brown-soft">
            {new Date(post.created_at).toLocaleDateString("pt-BR")}
          </p>
          {isOwner && (
            <div className="flex flex-wrap gap-2">
              {editing ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    onClick={savePost}
                    disabled={saving || deleting}
                    className="bg-wine text-white hover:bg-bronze"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCaption(post.caption || "");
                      setEditing(false);
                    }}
                    disabled={saving || deleting}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                    disabled={deleting}
                    className="border-wine text-wine"
                  >
                    <PencilLine className="mr-2 h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={deletePost}
                    disabled={deleting}
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    {deleting ? "Excluindo..." : "Excluir"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function PostComposer({
  teacherId,
  onCreated,
}: {
  teacherId: string;
  onCreated: (post: Tables<"teacher_posts">) => void;
}) {
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (caption.trim().length < 3) {
      toast.error("Escreva uma legenda para o post.");
      return;
    }

    setLoading(true);
    const imageUrl = image ? await uploadTeacherPostImage(teacherId, image) : null;
    if (image && !imageUrl) {
      setLoading(false);
      toast.error("Não foi possível enviar a imagem.");
      return;
    }

    const { data, error } = await supabase
      .from("teacher_posts")
      .insert({
        teacher_id: teacherId,
        caption: caption.trim(),
        image_url: imageUrl,
      })
      .select("*")
      .single();
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Post publicado no seu perfil.");
    setCaption("");
    setImage(null);
    setPreview("");
    if (data) onCreated(data);
  };

  return (
    <form onSubmit={submit} className="gw-surface rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ImagePlus className="h-5 w-5 text-bronze" />
        <h3 className="font-display text-lg text-wine">Criar post no perfil</h3>
      </div>
      {preview && (
        <img
          src={preview}
          alt=""
          className="h-56 w-full rounded-2xl object-cover border border-border"
        />
      )}
      <Textarea
        rows={3}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Compartilhe uma dica, bastidor de aula ou conquista dos alunos..."
      />
      <Input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          setImage(file || null);
          setPreview(file ? URL.createObjectURL(file) : "");
        }}
      />
      <Button disabled={loading} className="bg-bronze text-white hover:bg-wine">
        {loading ? "Publicando..." : "Publicar post"}
      </Button>
    </form>
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
  const [hasActiveSub, setHasActiveSub] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setHasActiveSub(false);
      return;
    }
    supabase
      .from("student_subscriptions")
      .select("status, current_period_end")
      .eq("student_id", user.id)
      .eq("teacher_id", teacher.id)
      .eq("status", "ativa")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const ok =
          !!data && (!data.current_period_end || new Date(data.current_period_end) > new Date());
        setHasActiveSub(ok);
      });
  }, [teacher.id, user]);

  const handleConfirm = async () => {
    if (!user) {
      navigate({ to: "/auth/login" });
      return;
    }
    if (!roles.includes("aluno")) {
      toast.error("Apenas alunos podem agendar. Crie um perfil de aluno.");
      navigate({ to: "/cadastro/aluno" });
      return;
    }
    if (!date) {
      toast.error("Escolha uma data");
      return;
    }
    setLoading(true);
    const scheduled = new Date(`${date}T${time}:00`);
    const { error } = await supabase.from("bookings").insert({
      student_id: user.id,
      teacher_id: teacher.id,
      scheduled_at: scheduled.toISOString(),
      duration_minutes: Number(duration),
      status: "pendente",
    });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("row-level security")) {
        toast.error("Você precisa de uma assinatura ativa para agendar aulas.");
        window.location.href = `/planos?professor=${teacher.id}`;
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Aula agendada!");
    setOpen(false);
    navigate({ to: "/meus-agendamentos" });
  };

  // Aluno sem assinatura ativa: botão leva direto para /planos
  if (user && roles.includes("aluno") && hasActiveSub === false) {
    return (
      <Button
        onClick={() => {
          toast.info("Assine um plano para agendar aulas.");
          window.location.href = `/planos?professor=${teacher.id}`;
        }}
        className="bg-bronze text-white hover:bg-wine shadow-bronze gap-2"
      >
        <Calendar className="h-4 w-4" /> Assinar para agendar
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-bronze text-white hover:bg-wine shadow-bronze gap-2">
          <Calendar className="h-4 w-4" /> Agendar aula
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-wine font-display">
            Agendar com {teacher.full_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-1">
              <Label>Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Duração</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-bronze text-white hover:bg-wine shadow-bronze"
          >
            {loading ? "Processando..." : "Confirmar agendamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
