import { MessageCircle } from "lucide-react";

const supportUrl =
  "https://wa.me/5575992373216?text=Ol%C3%A1%2C%20gostaria%20de%20suporte%20sobre%20a%20plataforma%20da%20GWLanguageFlow.";

export function SupportWhatsAppButton() {
  return (
    <a
      href={supportUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Abrir suporte pelo WhatsApp"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#1faf57] focus:outline-none focus:ring-4 focus:ring-[#25D366]/30"
    >
      <MessageCircle className="h-5 w-5" />
      Suporte
    </a>
  );
}
