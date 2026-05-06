import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, GraduationCap, Calendar, DollarSign } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Painel ADM — GWLanguageFlow" }] }),
  component: () => <RequireAuth allow={["dev"]}><AdminPage /></RequireAuth>,
});

function AdminPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: t }, { data: s }, { data: b }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("teacher_profiles").select("*"),
        supabase.from("student_profiles").select("*"),
        supabase.from("bookings").select("*").order("scheduled_at", { ascending: false }),
      ]);
      setProfiles(p || []); setTeachers(t || []); setStudents(s || []); setBookings(b || []);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <p className="text-bronze text-xs uppercase tracking-widest font-medium">Administração</p>
          <h1 className="font-display text-3xl md:text-4xl text-wine font-bold mt-2">Painel DEV</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Stat icon={Users} label="Usuários" value={profiles.length} />
          <Stat icon={GraduationCap} label="Professores" value={teachers.length} />
          <Stat icon={Users} label="Alunos" value={students.length} />
          <Stat icon={DollarSign} label="Aulas agendadas" value={bookings.length} />
        </div>

        <Tabs defaultValue="users" className="bg-background rounded-3xl border border-border p-4 md:p-6 shadow-soft">
          <TabsList className="bg-cream">
            <TabsTrigger value="users" className="data-[state=active]:bg-wine data-[state=active]:text-white">Usuários</TabsTrigger>
            <TabsTrigger value="teachers" className="data-[state=active]:bg-wine data-[state=active]:text-white">Professores</TabsTrigger>
            <TabsTrigger value="bookings" className="data-[state=active]:bg-wine data-[state=active]:text-white">Agendamentos</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-6 overflow-x-auto">
            <Table headers={["Nome","E-mail","Idade","Criado"]} rows={profiles.map(p => [p.full_name, p.email, p.age || "—", new Date(p.created_at).toLocaleDateString("pt-BR")])} />
          </TabsContent>
          <TabsContent value="teachers" className="mt-6 overflow-x-auto">
            <Table headers={["ID","Hora","Idiomas"]} rows={teachers.map(t => [t.id.slice(0,8), `R$ ${t.hourly_rate}`, (t.languages_taught || []).join(", ")])} />
          </TabsContent>
          <TabsContent value="bookings" className="mt-6 overflow-x-auto">
            <Table headers={["Data","Aluno","Professor","Duração","Status"]} rows={bookings.map(b => [
              new Date(b.scheduled_at).toLocaleString("pt-BR"),
              b.student_id.slice(0,8), b.teacher_id.slice(0,8),
              `${b.duration_minutes} min`,
              b.status,
            ])} />
          </TabsContent>
        </Tabs>
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

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="text-center text-brown-soft py-8 text-sm">Sem registros.</p>;
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left border-b border-border">{headers.map(h => <th key={h} className="py-2 px-3 text-wine font-semibold">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border/50"><>{r.map((c, j) => <td key={j} className="py-2 px-3 text-brown">{c}</td>)}</></tr>)}</tbody>
    </table>
  );
}
