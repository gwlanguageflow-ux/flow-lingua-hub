import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BookOpenCheck,
  CalendarCheck,
  Image as ImageIcon,
  Languages,
  Search,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";
import { motion } from "framer-motion";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getProfileAvatarUrl } from "@/lib/profile-media";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Feed dos professores - GWLanguageFlow" }] }),
  component: FeedPage,
});

type TeacherPost = Tables<"teacher_posts">;
type PublicProfile = Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url" | "email">;
type TeacherProfile = Pick<
  Tables<"teacher_profiles">,
  "id" | "bio" | "languages_taught" | "levels_taught" | "is_active"
>;

type FeedPost = TeacherPost & {
  profile?: PublicProfile;
  teacher?: TeacherProfile;
  rating?: number;
  reviewCount?: number;
};

type TeacherSuggestion = TeacherProfile & {
  profile?: PublicProfile;
  rating?: number;
  reviewCount?: number;
  postCount: number;
};

function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [teachers, setTeachers] = useState<TeacherSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadFeed = async () => {
      setLoading(true);
      setErrorMessage(null);

      const [{ data: postRows, error: postsError }, { data: teacherRows }] = await Promise.all([
        supabase
          .from("teacher_posts")
          .select("*")
          .eq("visibility", "public")
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("teacher_profiles")
          .select("id, bio, languages_taught, levels_taught, is_active")
          .eq("is_active", true),
      ]);

      if (!active) return;

      if (postsError) {
        setErrorMessage(postsError.message);
        setPosts([]);
        setTeachers([]);
        setLoading(false);
        return;
      }

      const teacherIds = Array.from(
        new Set([
          ...(postRows ?? []).map((post) => post.teacher_id),
          ...(teacherRows ?? []).map((teacher) => teacher.id),
        ]),
      );

      const [{ data: profiles }, { data: reviews }] = teacherIds.length
        ? await Promise.all([
            supabase
              .from("profiles")
              .select("id, full_name, avatar_url, email")
              .in("id", teacherIds),
            supabase.from("reviews").select("teacher_id, rating").in("teacher_id", teacherIds),
          ])
        : [{ data: [] }, { data: [] }];

      if (!active) return;

      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const teacherMap = new Map((teacherRows ?? []).map((teacher) => [teacher.id, teacher]));
      const ratingMap = buildRatingMap(reviews ?? []);
      const postCountMap = new Map<string, number>();
      (postRows ?? []).forEach((post) => {
        postCountMap.set(post.teacher_id, (postCountMap.get(post.teacher_id) ?? 0) + 1);
      });

      setPosts(
        (postRows ?? []).map((post) => {
          const rating = ratingMap.get(post.teacher_id);
          return {
            ...post,
            profile: profileMap.get(post.teacher_id),
            teacher: teacherMap.get(post.teacher_id),
            rating: rating?.average,
            reviewCount: rating?.count,
          };
        }),
      );

      setTeachers(
        (teacherRows ?? []).map((teacher) => {
          const rating = ratingMap.get(teacher.id);
          return {
            ...teacher,
            profile: profileMap.get(teacher.id),
            rating: rating?.average,
            reviewCount: rating?.count,
            postCount: postCountMap.get(teacher.id) ?? 0,
          };
        }),
      );

      setLoading(false);
    };

    loadFeed();

    return () => {
      active = false;
    };
  }, []);

  const filteredPosts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return posts;
    return posts.filter((post) => {
      const name = post.profile?.full_name ?? "Professor";
      const languages = post.teacher?.languages_taught?.join(" ") ?? "";
      return [post.caption, name, languages].some((value) =>
        value.toLocaleLowerCase("pt-BR").includes(term),
      );
    });
  }, [posts, search]);

  const highlightedTeachers = useMemo(() => {
    return [...teachers]
      .sort((a, b) => b.postCount - a.postCount || (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 5);
  }, [teachers]);

  return (
    <div className="gw-app-shell flex min-h-screen flex-col">
      <SiteHeader />
      <main className="container mx-auto max-w-7xl flex-1 px-4 py-8 md:py-10">
        <section className="gw-command-hero mb-6 overflow-hidden rounded-xl">
          <div className="grid gap-px bg-border/70 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-white/92 p-6 md:p-9">
              <p className="gw-section-kicker">Feed GWLanguageFlow</p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-wine md:text-5xl">
                Posts, bastidores e método dos professores.
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-brown-soft">
                Acompanhe publicações dos professores, veja a personalidade de cada profissional e
                abra o perfil para ver o feed completo antes de escolher sua jornada.
              </p>
              <div className="mt-6 max-w-xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-soft" />
                  <Input
                    className="h-12 rounded-xl pl-10"
                    placeholder="Buscar por professor, idioma ou legenda..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <aside className="gw-ink-panel p-6 md:p-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <FeedStat icon={ImageIcon} label="Posts publicados" value={posts.length} />
                <FeedStat icon={UserRound} label="Professores ativos" value={teachers.length} />
                <FeedStat icon={CalendarCheck} label="Agenda integrada" value="Aluno confirma" />
                <FeedStat icon={BookOpenCheck} label="Perfil completo" value="Feed individual" />
              </div>
            </aside>
          </div>
        </section>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            {loading ? (
              <FeedSkeleton />
            ) : filteredPosts.length === 0 ? (
              <EmptyFeed hasSearch={!!search.trim()} teachers={highlightedTeachers} />
            ) : (
              filteredPosts.map((post, index) => (
                <PostCard key={post.id} post={post} index={index} />
              ))
            )}
          </section>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
            <div className="gw-app-card rounded-xl p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-bronze" />
                <h2 className="font-display text-xl font-bold text-wine">
                  Professores em destaque
                </h2>
              </div>
              <div className="mt-4 space-y-3">
                {loading ? (
                  [1, 2, 3].map((item) => (
                    <div key={item} className="h-16 animate-pulse rounded-xl bg-cream" />
                  ))
                ) : highlightedTeachers.length === 0 ? (
                  <p className="text-sm text-brown-soft">Nenhum professor ativo encontrado.</p>
                ) : (
                  highlightedTeachers.map((teacher) => (
                    <TeacherMiniCard key={teacher.id} teacher={teacher} />
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function PostCard({ post, index }: { post: FeedPost; index: number }) {
  const teacherName = post.profile?.full_name || "Professor GW";
  const avatarUrl = getProfileAvatarUrl(post.profile ?? {});
  const languages = post.teacher?.languages_taught ?? [];
  const createdAt = new Date(post.created_at);

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035 }}
      className="gw-app-card overflow-hidden rounded-xl"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/80 p-4 md:p-5">
        <Link
          to="/professor/$id"
          params={{ id: post.teacher_id }}
          className="group flex min-w-0 items-center gap-3"
        >
          <AvatarBlock name={teacherName} url={avatarUrl} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-wine group-hover:text-bronze">
              {teacherName}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-brown-soft">
              <Languages className="h-3.5 w-3.5 text-bronze" />
              {languages.slice(0, 3).join(", ") || "Idioma a confirmar"}
            </p>
          </div>
        </Link>
        {post.rating && (
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-bronze/15 px-3 py-1 text-xs font-semibold text-bronze">
            <Star className="h-3.5 w-3.5 fill-bronze" />
            {post.rating.toFixed(1)}
          </div>
        )}
      </header>

      {post.image_url ? (
        <Link to="/professor/$id" params={{ id: post.teacher_id }} className="block bg-ink">
          <img
            src={post.image_url}
            alt={`Post de ${teacherName}`}
            className="max-h-[720px] w-full object-cover"
            loading="lazy"
          />
        </Link>
      ) : (
        <Link
          to="/professor/$id"
          params={{ id: post.teacher_id }}
          className="block bg-gradient-warm px-6 py-14 text-white md:px-10"
        >
          <p className="font-display text-3xl font-bold leading-tight md:text-5xl">
            {post.caption}
          </p>
        </Link>
      )}

      <div className="space-y-4 p-4 md:p-5">
        {post.image_url && (
          <p className="leading-7 text-brown">
            <Link
              to="/professor/$id"
              params={{ id: post.teacher_id }}
              className="font-semibold text-wine hover:text-bronze"
            >
              {teacherName}
            </Link>{" "}
            {post.caption}
          </p>
        )}
        <div className="flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs uppercase tracking-[0.18em] text-brown-soft">
            {format(createdAt, "dd/MM/yyyy")} -{" "}
            {formatDistanceToNow(createdAt, { addSuffix: true, locale: ptBR })}
          </p>
          <div className="flex gap-2">
            <Link to="/professor/$id" params={{ id: post.teacher_id }}>
              <Button variant="outline" className="border-wine/30 text-wine hover:bg-cream">
                Ver perfil
              </Button>
            </Link>
            <Link to="/professor/$id" params={{ id: post.teacher_id }}>
              <Button className="bg-wine text-white hover:bg-bronze">Ver feed completo</Button>
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function TeacherMiniCard({ teacher }: { teacher: TeacherSuggestion }) {
  const name = teacher.profile?.full_name || "Professor GW";
  const avatarUrl = getProfileAvatarUrl(teacher.profile ?? {});

  return (
    <Link
      to="/professor/$id"
      params={{ id: teacher.id }}
      className="flex items-center gap-3 rounded-xl border border-border bg-white/80 p-3 transition hover:-translate-y-0.5 hover:border-bronze/50 hover:shadow-soft"
    >
      <AvatarBlock name={name} url={avatarUrl} compact />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-wine">{name}</p>
        <p className="truncate text-xs text-brown-soft">
          {(teacher.languages_taught ?? []).slice(0, 2).join(", ") || "Idioma a confirmar"}
        </p>
      </div>
      <span className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-semibold text-bronze">
        {teacher.postCount} posts
      </span>
    </Link>
  );
}

function EmptyFeed({ hasSearch, teachers }: { hasSearch: boolean; teachers: TeacherSuggestion[] }) {
  return (
    <div className="gw-empty-state rounded-xl px-5 py-14 text-center">
      <ImageIcon className="mx-auto mb-4 h-12 w-12 text-bronze" />
      <h2 className="font-display text-2xl font-bold text-wine">
        {hasSearch ? "Nenhum post encontrado" : "Nenhum post publicado ainda"}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-brown-soft">
        {hasSearch
          ? "Tente buscar por outro professor, idioma ou palavra da legenda."
          : "Quando os professores publicarem no perfil, as postagens aparecem aqui em ordem recente."}
      </p>
      {teachers.length > 0 && (
        <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
          {teachers.slice(0, 4).map((teacher) => (
            <TeacherMiniCard key={teacher.id} teacher={teacher} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <>
      {[1, 2, 3].map((item) => (
        <div key={item} className="gw-app-card overflow-hidden rounded-xl">
          <div className="flex items-center gap-3 border-b border-border/80 p-5">
            <div className="h-12 w-12 animate-pulse rounded-2xl bg-cream" />
            <div className="space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-cream" />
              <div className="h-3 w-32 animate-pulse rounded bg-cream" />
            </div>
          </div>
          <div className="h-[420px] animate-pulse bg-cream" />
          <div className="space-y-2 p-5">
            <div className="h-4 w-full animate-pulse rounded bg-cream" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-cream" />
          </div>
        </div>
      ))}
    </>
  );
}

function FeedStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ImageIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/8 p-5">
      <Icon className="mb-3 h-5 w-5 text-bronze" />
      <p className="font-display text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-sm text-white/66">{label}</p>
    </div>
  );
}

function AvatarBlock({
  name,
  url,
  compact = false,
}: {
  name: string;
  url?: string | null;
  compact?: boolean;
}) {
  const size = compact ? "h-11 w-11 rounded-xl" : "h-12 w-12 rounded-2xl";
  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center overflow-hidden bg-gradient-warm font-display font-bold text-white shadow-soft`}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </div>
  );
}

function buildRatingMap(reviews: Array<{ teacher_id: string; rating: number }>) {
  const ratingMap = new Map<string, { average: number; count: number }>();
  const totals = new Map<string, { sum: number; count: number }>();

  reviews.forEach((review) => {
    const current = totals.get(review.teacher_id) ?? { sum: 0, count: 0 };
    current.sum += Number(review.rating || 0);
    current.count += 1;
    totals.set(review.teacher_id, current);
  });

  totals.forEach((value, teacherId) => {
    ratingMap.set(teacherId, {
      average: value.count ? value.sum / value.count : 0,
      count: value.count,
    });
  });

  return ratingMap;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase("pt-BR");
}
