import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, CheckCheck, MessageCircle, Send, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  createAnonymousReport,
  getDirectorInbox,
  markDirectorMessageRead,
  replyToDirector,
} from "@/functions/admin.functions";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type InboxMessage = Tables<"director_messages"> & { read: boolean };
type InboxState = {
  messages: InboxMessage[];
  alerts: Tables<"director_alerts">[];
  directMessages: Tables<"director_user_messages">[];
  unreadCount: number;
};

const emptyInbox: InboxState = {
  messages: [],
  alerts: [],
  directMessages: [],
  unreadCount: 0,
};

export function DirectorNotifications({ mobile = false }: { mobile?: boolean }) {
  const { user, roles } = useAuth();
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<InboxState>(emptyInbox);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [report, setReport] = useState({ category: "geral", title: "", body: "" });

  const shouldRender = Boolean(user) && !roles.includes("dev");
  const signalCount = inbox.unreadCount + inbox.alerts.length;
  const hasSignal = signalCount > 0;

  const loadInbox = useCallback(async () => {
    if (!shouldRender) return;
    setLoading(true);
    try {
      const data = await getDirectorInbox();
      setInbox(data as InboxState);
    } catch {
      setInbox(emptyInbox);
    } finally {
      setLoading(false);
    }
  }, [shouldRender]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    if (!shouldRender) return;
    const interval = window.setInterval(loadInbox, 60000);
    return () => window.clearInterval(interval);
  }, [loadInbox, shouldRender]);

  const directMessages = useMemo(() => inbox.directMessages.slice(-12), [inbox.directMessages]);

  if (!shouldRender) return null;

  const handleMarkRead = async (messageId: string) => {
    try {
      await markDirectorMessageRead({ data: { messageId } });
      setInbox((current) => ({
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1),
        messages: current.messages.map((message) =>
          message.id === messageId ? { ...message, read: true } : message,
        ),
      }));
    } catch {
      toast.error("Não foi possível marcar como lido.");
    }
  };

  const handleReply = async () => {
    if (!reply.trim()) return;
    try {
      await replyToDirector({ data: { body: reply } });
      setReply("");
      toast.success("Mensagem enviada à Diretoria.");
      await loadInbox();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    }
  };

  const handleReport = async () => {
    try {
      await createAnonymousReport({ data: report });
      setReport({ category: "geral", title: "", body: "" });
      toast.success("Denúncia anônima enviada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a denúncia.");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`relative gap-2 rounded-full border-bronze/40 bg-white text-wine hover:bg-cream ${
            mobile ? "h-11 w-full justify-center" : "h-11 px-4"
          } ${hasSignal ? "shadow-[0_0_22px_rgba(182,127,61,0.38)]" : ""}`}
          onClick={() => {
            if (!open) loadInbox();
          }}
        >
          <BellRing className={`h-4 w-4 ${hasSignal ? "text-bronze" : "text-wine"}`} />
          Diretoria
          {hasSignal && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-bronze px-1 text-[10px] font-bold text-white shadow-[0_0_16px_rgba(182,127,61,0.7)]">
              {signalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,420px)] rounded-xl p-0">
        <div className="border-b border-border bg-cream px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-lg font-bold text-wine">Diretoria</p>
              <p className="text-xs text-brown-soft">Avisos, comunicados e contato direto</p>
            </div>
            {hasSignal && <Sparkles className="h-5 w-5 animate-pulse text-bronze" />}
          </div>
        </div>

        <Tabs defaultValue="avisos" className="p-3">
          <TabsList className="grid h-auto grid-cols-3 bg-cream">
            <TabsTrigger
              value="avisos"
              className="text-xs data-[state=active]:bg-wine data-[state=active]:text-white"
            >
              Avisos
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="text-xs data-[state=active]:bg-wine data-[state=active]:text-white"
            >
              Chat
            </TabsTrigger>
            <TabsTrigger
              value="denuncia"
              className="text-xs data-[state=active]:bg-wine data-[state=active]:text-white"
            >
              Denúncia
            </TabsTrigger>
          </TabsList>

          <TabsContent value="avisos" className="mt-3 max-h-[420px] space-y-3 overflow-y-auto pr-1">
            {loading && <p className="py-6 text-center text-sm text-brown-soft">Carregando...</p>}
            {!loading && inbox.alerts.length === 0 && inbox.messages.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-brown-soft">
                Nenhum aviso da Diretoria no momento.
              </p>
            )}

            {inbox.alerts.map((alert) => (
              <article
                key={alert.id}
                className={`rounded-xl border p-3 ${
                  alert.tone === "urgent"
                    ? "border-wine/40 bg-rose-50"
                    : "border-bronze/40 bg-amber-50"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-bronze" />
                  <h3 className="font-bold text-wine">{alert.title}</h3>
                </div>
                <p className="text-sm text-brown">{alert.body}</p>
              </article>
            ))}

            {inbox.messages.map((message) => (
              <article
                key={message.id}
                className="rounded-xl border border-border bg-background p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-wine">{message.title}</h3>
                      {!message.read && (
                        <Badge className="rounded-full bg-bronze text-white">Novo</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-brown-soft">
                      {new Date(message.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {!message.read && (
                    <Button
                      onClick={() => handleMarkRead(message.id)}
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-2"
                      aria-label="Marcar como lido"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-sm text-brown">{message.body}</p>
              </article>
            ))}
          </TabsContent>

          <TabsContent value="chat" className="mt-3">
            <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-xl border border-border bg-cream p-3">
              {directMessages.length === 0 ? (
                <p className="py-8 text-center text-sm text-brown-soft">
                  Sem conversa direta ainda.
                </p>
              ) : (
                directMessages.map((message) => {
                  const fromMe = message.sender_id === user?.id;
                  return (
                    <div
                      key={message.id}
                      className={`flex ${fromMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[84%] rounded-2xl px-3 py-2 text-sm ${
                          fromMe ? "bg-wine text-white" : "bg-white text-brown"
                        }`}
                      >
                        <p>{message.body}</p>
                        <p
                          className={`mt-1 text-[10px] ${fromMe ? "text-white/70" : "text-brown-soft"}`}
                        >
                          {new Date(message.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Mensagem para a Diretoria"
              />
              <Button
                onClick={handleReply}
                disabled={!reply.trim()}
                className="rounded-full bg-wine text-white hover:bg-bronze"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="denuncia" className="mt-3 space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-cream p-3 text-sm text-brown">
              <ShieldAlert className="h-4 w-4 text-bronze" />O envio não registra seu nome no painel
              da Diretoria.
            </div>
            <Input
              value={report.category}
              onChange={(event) =>
                setReport((current) => ({ ...current, category: event.target.value }))
              }
              placeholder="Categoria"
            />
            <Input
              value={report.title}
              onChange={(event) =>
                setReport((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Título"
            />
            <Textarea
              value={report.body}
              onChange={(event) =>
                setReport((current) => ({ ...current, body: event.target.value }))
              }
              placeholder="Descreva a situação"
              className="min-h-28"
            />
            <Button
              onClick={handleReport}
              className="w-full rounded-full bg-wine text-white hover:bg-bronze"
            >
              Enviar denúncia anônima
            </Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
