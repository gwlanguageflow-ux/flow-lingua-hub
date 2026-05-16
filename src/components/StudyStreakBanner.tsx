import { useEffect, useState } from "react";
import { Flame, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MOTIVATIONAL_PHRASES = [
  "Cada palavra nova é um passo a mais rumo à fluência. 🌍",
  "Consistência vence talento. Continue firme! 💪",
  "Seu inglês de amanhã agradece o esforço de hoje. ✨",
  "Pequenos progressos diários constroem grandes resultados. 🚀",
  "Você está mais perto da fluência do que ontem. 🎯",
  "Falar outro idioma é abrir portas para o mundo. 🌎",
  "A jornada é longa, mas cada aula importa. Parabéns! 🏆",
  "Quem persiste, conquista. Sua dedicação é inspiradora. 🌟",
];

export function StudyStreakBanner() {
  const { user } = useAuth();
  const [days, setDays] = useState<number | null>(null);
  const [phrase, setPhrase] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = `study-streak-dismissed-${user.id}-${new Date().toDateString()}`;
    if (sessionStorage.getItem(key)) {
      setDismissed(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("student_subscriptions")
        .select("current_period_start, created_at, status")
        .eq("student_id", user.id)
        .eq("status", "ativa")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!data) return;
      const start = new Date(data.current_period_start || data.created_at);
      const diff = Math.max(
        1,
        Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)),
      );
      setDays(diff);
      setPhrase(MOTIVATIONAL_PHRASES[diff % MOTIVATIONAL_PHRASES.length]);
    })();
  }, [user]);

  if (dismissed || !user || days === null) return null;

  const handleDismiss = () => {
    setDismissed(true);
    const key = `study-streak-dismissed-${user.id}-${new Date().toDateString()}`;
    sessionStorage.setItem(key, "1");
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-bronze/30 bg-gradient-to-r from-cream via-background to-cream p-5 shadow-soft">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-brown-soft hover:bg-cream"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bronze/15 text-bronze">
          <Flame className="h-6 w-6" />
        </div>
        <div className="flex-1 pr-6">
          <p className="text-xs font-bold uppercase tracking-wider text-bronze">
            Sua jornada na GW
          </p>
          <h3 className="mt-1 font-display text-xl font-bold text-wine md:text-2xl">
            {days} {days === 1 ? "dia" : "dias"} estudando inglês com a gente
          </h3>
          <p className="mt-2 flex items-center gap-2 text-sm text-brown">
            <Sparkles className="h-4 w-4 text-bronze" />
            {phrase}
          </p>
        </div>
      </div>
    </div>
  );
}
