import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/menores")({
  head: () => ({ meta: [{ title: "Política para Menores — GWLanguageFlow" }] }),
  component: () => <LegalPage page={legalPages.menores} />,
});
