import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WEEKDAYS } from "@/lib/constants";
import { toast } from "sonner";
import { Plus, Trash2, Clock } from "lucide-react";

interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export function AvailabilityManager() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("teacher_availability")
      .select("id, day_of_week, start_time, end_time")
      .eq("teacher_id", user.id)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    setSlots(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const addSlot = async () => {
    if (!user) return;
    if (start >= end) { toast.error("Horário final deve ser depois do inicial"); return; }
    setAdding(true);
    const { error } = await supabase.from("teacher_availability").insert({
      teacher_id: user.id,
      day_of_week: Number(day),
      start_time: start,
      end_time: end,
    });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Horário adicionado");
    load();
  };

  const removeSlot = async (id: string) => {
    const { error } = await supabase.from("teacher_availability").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Horário removido");
    setSlots((s) => s.filter((x) => x.id !== id));
  };

  const grouped = WEEKDAYS.map((name, idx) => ({
    idx,
    name,
    items: slots.filter((s) => s.day_of_week === idx),
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border p-5 bg-cream/50">
        <h4 className="font-display text-wine flex items-center gap-2 mb-4">
          <Plus className="h-4 w-4 text-bronze" /> Adicionar horário disponível
        </h4>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Dia da semana</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((w, i) => <SelectItem key={i} value={String(i)}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Início</Label>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fim</Label>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={addSlot} disabled={adding} className="w-full bg-bronze text-white hover:bg-wine">
              {adding ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-brown-soft text-sm py-6">Carregando...</p>
      ) : slots.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-2xl">
          <Clock className="h-8 w-8 text-bronze mx-auto mb-2" />
          <p className="text-sm text-brown-soft">Nenhum horário cadastrado ainda.</p>
          <p className="text-xs text-brown-soft mt-1">Adicione faixas de horário para que alunos possam te encontrar.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.filter(g => g.items.length > 0).map((g) => (
            <div key={g.idx} className="rounded-2xl border border-border p-4">
              <p className="font-display text-wine text-sm font-semibold mb-3">{g.name}</p>
              <ul className="space-y-2">
                {g.items.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 bg-cream/50 rounded-xl px-3 py-2">
                    <span className="text-sm text-brown">
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                    </span>
                    <button
                      onClick={() => removeSlot(s.id)}
                      className="text-brown-soft hover:text-wine transition-colors"
                      aria-label="Remover horário"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
