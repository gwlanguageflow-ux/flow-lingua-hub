import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, FolderOpen, Calendar, Clock, BadgeCheck, Wallet } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AvailabilityManager } from "@/components/AvailabilityManager";
import { MeetingLinkEditor, MeetingLinkButton } from "@/components/MeetingLinkEditor";


export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GWLanguageFlow" }] }),
  component: () => <RequireAuth allow={["professor","dev"]}><DashboardPage /></RequireAuth>,
});

function DashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: bks } = await supabase.from("bookings").select("*").eq("teacher_id", user.id).order("scheduled_at", { ascending: true });
      setBookings(bks || []);
      if (bks?.length) {
        const sids = Array.from(new Set(bks.map(b => b.student_id)));
        const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", sids);
        setStudents(profs || []);
      }
    })();
  }, [user]);

  const upcoming = bookings.filter(b => new Date(b.scheduled_at) > new Date() && b.status !== "cancelado");

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <p className="text-bronze text-xs uppercase tracking-widest font-medium">Dashboard</p>
          <h1 className="font-display text-3xl md:text-4xl text-wine font-bold mt-2">Olá, professor</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Stat icon={Users} label="Alunos" value={students.length} />
          <Stat icon={Calendar} label="Próximas aulas" value={upcoming.length} />
          <Stat icon={BookOpen} label="Aulas dadas" value={bookings.filter(b=>b.status==="concluido").length} />
        </div>

        <Tabs defaultValue="agendamentos" className="bg-background rounded-3xl border border-border p-4 md:p-6 shadow-soft">
          <TabsList className="bg-cream w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="agendamentos" className="data-[state=active]:bg-wine data-[state=active]:text-white"><Calendar className="h-4 w-4 mr-2" />Sala de Aula</TabsTrigger>
            <TabsTrigger value="alunos" className="data-[state=active]:bg-wine data-[state=active]:text-white"><Users className="h-4 w-4 mr-2" />Meus Alunos</TabsTrigger>
            <TabsTrigger value="disponibilidade" className="data-[state=active]:bg-wine data-[state=active]:text-white"><Clock className="h-4 w-4 mr-2" />Disponibilidade</TabsTrigger>
            <TabsTrigger value="material" className="data-[state=active]:bg-wine data-[state=active]:text-white"><FolderOpen className="h-4 w-4 mr-2" />Material</TabsTrigger>
          </TabsList>

          <TabsContent value="agendamentos" className="mt-6">
            {upcoming.length === 0 ? (
              <Empty msg="Nenhuma aula agendada ainda." />
            ) : (
              <div className="space-y-3">
                {upcoming.map(b => {
                  const s = students.find(x => x.id === b.student_id);
                  return (
                    <div key={b.id} className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-border hover:border-bronze">
                      <div className="h-12 w-12 rounded-full bg-gradient-warm flex items-center justify-center text-white font-display flex-shrink-0">
                        {s?.avatar_url ? <img src={s.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : (s?.full_name?.charAt(0) || "A")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-wine">{s?.full_name || "Aluno"}</p>
                        <p className="text-sm text-brown">{format(new Date(b.scheduled_at), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}</p>
                        {b.meeting_url && (
                          <p className="text-xs text-bronze truncate mt-1">🔗 {b.meeting_url}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-3 py-1 rounded-full bg-bronze/15 text-bronze capitalize">{b.status}</span>
                        <MeetingLinkEditor
                          bookingId={b.id}
                          initialUrl={b.meeting_url}
                          onSaved={(url) => setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, meeting_url: url } : x))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="alunos" className="mt-6">
            {students.length === 0 ? <Empty msg="Você ainda não tem alunos." /> : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {students.map(s => (
                  <div key={s.id} className="p-5 rounded-2xl border border-border flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-warm flex items-center justify-center text-white font-display">
                      {s.avatar_url ? <img src={s.avatar_url} className="w-full h-full rounded-full object-cover" alt="" /> : s.full_name?.charAt(0)}
                    </div>
                    <p className="font-semibold text-wine">{s.full_name}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="disponibilidade" className="mt-6">
            <AvailabilityManager />
          </TabsContent>
          <TabsContent value="material" className="mt-6"><Empty msg="Faça upload de PDFs e materiais. Em breve." /></TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <Link to="/cadastro/professor"><Button variant="outline" className="border-wine text-wine">Editar meu perfil</Button></Link>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="bg-background rounded-2xl border border-border p-5">
      <Icon className="h-5 w-5 text-bronze mb-2" />
      <p className="text-2xl font-display font-bold text-wine">{value}</p>
      <p className="text-xs text-brown-soft mt-1">{label}</p>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-center py-12 text-brown-soft text-sm">{msg}</div>;
}
