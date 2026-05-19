import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — GWLanguageFlow" }] }),
  component: () => <LegalPage page={legalPages["politica-de-privacidade"]} />,
});
