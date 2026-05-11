import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Star, Video, FolderOpen, FileText, Headphones, BookOpen, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeetingLinkButton } from "@/components/MeetingLinkEditor";
import { SubscriptionStatusBanner } from "@/components/SubscriptionStatusBanner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/meus-agendamentos")({
  head: () => ({ meta: [{ title: "Meus agendamentos — GWLanguageFlow" }] }),
  component: () => <RequireAuth allow={["aluno","dev"]}><Page /></RequireAuth>,
});

function Page() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Map<string, any>>(new Map());
  const [reviews, setReviews] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("bookings").select("*").eq("student_id", user.id).order("scheduled_at", { ascending: false });
    setItems(data || []);
    if (data?.length) {
      const ids = Array.from(new Set(data.map(b => b.teacher_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids);
      setTeachers(new Map(profs?.map(p => [p.id, p]) ?? []));
      const { data: revs } = await supabase.from("reviews").select("booking_id").in("booking_id", data.map(b=>b.id));
      setReviews(new Set(revs?.map(r => r.booking_id) ?? []));
    }
  };

  useEffect(() => { load(); }, [user]);

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="font-display text-3xl md:text-4xl text-wine font-bold mb-6">Meus agendamentos</h1>
        <SubscriptionStatusBanner />
        {items.length === 0 ? (
          <div className="text-center py-16 bg-background rounded-2xl border border-border">
            <p className="text-brown-soft">Você ainda não agendou aulas.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(b => {
              const t = teachers.get(b.teacher_id);
              const past = new Date(b.scheduled_at) < new Date();
              const canReview = past && b.status !== "cancelado" && !reviews.has(b.id);
              return (
                <div key={b.id} className="bg-background rounded-2xl border border-border p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-warm flex items-center justify-center text-white font-display flex-shrink-0">
                    {t?.avatar_url ? <img src={t.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : (t?.full_name?.charAt(0) || "P")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-wine">{t?.full_name || "Professor"}</p>
                    <p className="text-sm text-brown">{format(new Date(b.scheduled_at), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
                    <p className="text-xs text-brown-soft mt-1">{b.duration_minutes} min</p>
                    {!past && !b.meeting_url && (
                      <p className="text-xs text-brown-soft mt-2 italic flex items-center gap-1">
                        <Video className="h-3 w-3" /> Aguardando link da videochamada do professor
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-stretch md:items-end gap-2">
                    <span className="text-xs px-3 py-1 rounded-full bg-bronze/15 text-bronze capitalize text-center">{b.status}</span>
                    {b.meeting_url && !past && <MeetingLinkButton url={b.meeting_url} />}
                    {canReview && <ReviewDialog booking={b} onDone={load} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function ReviewDialog({ booking, onDone }: { booking: any; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    const { error } = await supabase.from("reviews").insert({
      booking_id: booking.id, student_id: booking.student_id, teacher_id: booking.teacher_id,
      rating, comment: comment.trim() || null,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Avaliação enviada!");
    setOpen(false); onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" className="bg-bronze text-white hover:bg-wine">Avaliar</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-wine font-display">Avalie sua aula</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center gap-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setRating(n)} type="button">
                <Star className={`h-8 w-8 ${n <= rating ? "fill-bronze text-bronze" : "text-border"}`} />
              </button>
            ))}
          </div>
          <Textarea rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Conte como foi sua experiência (opcional)" />
          <Button onClick={submit} disabled={loading} className="w-full bg-bronze text-white hover:bg-wine">{loading ? "Enviando..." : "Enviar avaliação"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
