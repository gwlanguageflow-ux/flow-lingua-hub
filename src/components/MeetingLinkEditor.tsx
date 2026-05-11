import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Video, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function MeetingLinkEditor({
  bookingId,
  initialUrl,
  onSaved,
}: {
  bookingId: string;
  initialUrl: string | null;
  onSaved?: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(initialUrl || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const trimmed = url.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast.error("Link deve começar com http:// ou https://");
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from("bookings")
      .update({ meeting_url: trimmed || null })
      .eq("id", bookingId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link salvo");
    onSaved?.(trimmed);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-bronze text-bronze hover:bg-bronze hover:text-white gap-2"
        >
          <Video className="h-3.5 w-3.5" />
          {initialUrl ? "Editar link" : "Adicionar link"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-wine font-display">Sala de aula virtual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-brown">
            Cole o link da videochamada (Google Meet, Zoom, etc.). O aluno verá esse link na página
            dele.
          </p>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
          />
          <Button
            onClick={save}
            disabled={saving}
            className="w-full bg-bronze text-white hover:bg-wine"
          >
            {saving ? "Salvando..." : "Salvar link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MeetingLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <div className="flex items-center gap-2">
      <a href={url} target="_blank" rel="noreferrer">
        <Button size="sm" className="bg-bronze text-white hover:bg-wine gap-2">
          <Video className="h-3.5 w-3.5" /> Entrar na aula
        </Button>
      </a>
      <button
        onClick={copy}
        className="text-brown-soft hover:text-wine transition-colors p-1.5"
        aria-label="Copiar link"
        title="Copiar link"
      >
        {copied ? <Check className="h-4 w-4 text-bronze" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
