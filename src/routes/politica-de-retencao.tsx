import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/politica-de-retencao")({
  head: () => ({ meta: [{ title: "Política de Retenção — GWLanguageFlow" }] }),
  component: () => <LegalPage page={legalPages["politica-de-retencao"]} />,
});
