import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LANGUAGES, LEVELS } from "@/lib/constants";
import { Star, Search, Filter, Globe2 } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Encontre seu professor — GWLanguageFlow" }] }),
  component: FeedPage,
});

interface TeacherCard {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  hourly_rate: number;
  languages_taught: string[];
  levels_taught: string[];
  is_active: boolean;
  rating?: number;
}

function FeedPage() {
  const [teachers, setTeachers] = useState<TeacherCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [maxPrice, setMaxPrice] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: teachersData } = await supabase
        .from("teacher_profiles")
        .select("id, bio, hourly_rate, languages_taught, levels_taught, is_active")
        .eq("is_active", true);

      if (!teachersData?.length) {
        setTeachers([]);
        setLoading(false);
        return;
      }

      const ids = teachersData.map((t) => t.id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      const profMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

      const { data: reviews } = await supabase
        .from("reviews")
        .select("teacher_id, rating")
        .in("teacher_id", ids);
      const ratingMap = new Map<string, number>();
      reviews?.forEach((r) => {
        const cur = ratingMap.get(r.teacher_id) || 0;
        const c = (ratingMap.get(`${r.teacher_id}__c`) as never as number) || 0;
        ratingMap.set(r.teacher_id, cur + r.rating);
        ratingMap.set(`${r.teacher_id}__c` as never, (c + 1) as never);
      });

      const cards: TeacherCard[] = teachersData.map((t) => {
        const p = profMap.get(t.id);
        const sum = ratingMap.get(t.id) || 0;
        const count = (ratingMap.get(`${t.id}__c` as never) as never as number) || 0;
        return {
          id: t.id,
          full_name: p?.full_name || "Professor",
          avatar_url: p?.avatar_url ?? null,
          bio: t.bio,
          hourly_rate: Number(t.hourly_rate || 0),
          languages_taught: t.languages_taught || [],
          levels_taught: t.levels_taught || [],
          is_active: t.is_active,
          rating: count > 0 ? sum / count : undefined,
        };
      });
      setTeachers(cards);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return teachers.filter((t) => {
      if (
        search &&
        !t.full_name.toLowerCase().includes(search.toLowerCase()) &&
        !(t.bio || "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (language !== "all" && !t.languages_taught.includes(language)) return false;
      if (level !== "all" && !t.levels_taught.includes(level)) return false;
      if (maxPrice && t.hourly_rate > Number(maxPrice)) return false;
      return true;
    });
  }, [teachers, search, language, level, maxPrice]);

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-wine">Professores</h1>
          <p className="text-brown mt-2">Encontre o seu próximo professor de idiomas.</p>
        </div>

        <div className="bg-background rounded-2xl border border-border p-4 md:p-5 mb-8 shadow-soft">
          <div className="flex items-center gap-2 mb-3 text-wine">
            <Filter className="h-4 w-4" /> <span className="text-sm font-medium">Filtros</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brown-soft" />
              <Input
                className="pl-9"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Idioma" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os idiomas</SelectItem>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os níveis</SelectItem>
                {LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Preço máx (R$/h)"
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 rounded-2xl bg-background border border-border animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-background rounded-2xl border border-border">
            <Globe2 className="h-12 w-12 text-bronze mx-auto mb-4" />
            <h3 className="font-display text-xl text-wine mb-2">Nenhum professor encontrado</h3>
            <p className="text-brown text-sm">Ajuste os filtros para ver mais resultados.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t, i) => (
              <TeacherCardEl key={t.id} teacher={t} index={i} />
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function TeacherCardEl({ teacher, index }: { teacher: TeacherCard; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="bg-background rounded-2xl border border-border overflow-hidden hover:shadow-warm transition-shadow group"
    >
      <div className="relative h-48 bg-gradient-warm">
        {teacher.avatar_url ? (
          <img
            src={teacher.avatar_url}
            alt={teacher.full_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white font-display text-5xl">
            {teacher.full_name.charAt(0)}
          </div>
        )}
        {teacher.rating && (
          <div className="absolute top-3 right-3 bg-background/95 backdrop-blur rounded-full px-2.5 py-1 flex items-center gap-1 shadow-soft">
            <Star className="h-3.5 w-3.5 fill-bronze text-bronze" />
            <span className="text-xs font-semibold text-wine">{teacher.rating.toFixed(1)}</span>
          </div>
        )}
      </div>
      <div className="p-5 space-y-3">
        <div>
          <h3 className="font-display text-lg font-bold text-wine truncate">{teacher.full_name}</h3>
          <p className="text-xs text-brown-soft">
            {teacher.languages_taught.slice(0, 3).join(" · ")}
          </p>
        </div>
        <p className="text-sm text-brown line-clamp-2 min-h-[2.5rem]">
          {teacher.bio || "Professor apaixonado por idiomas."}
        </p>
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <span className="text-xl font-display font-bold text-bronze">
              R$ {teacher.hourly_rate.toFixed(0)}
            </span>
            <span className="text-xs text-brown-soft">/hora</span>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Link to="/professor/$id" params={{ id: teacher.id }} className="flex-1">
            <Button variant="outline" className="w-full border-wine/30 text-wine hover:bg-cream">
              Ver perfil
            </Button>
          </Link>
          <Link to="/professor/$id" params={{ id: teacher.id }} className="flex-1">
            <Button className="w-full bg-bronze text-white hover:bg-wine">Agendar</Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
