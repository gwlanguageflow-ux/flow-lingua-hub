import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({ meta: [{ title: "Termos de Uso — GWLanguageFlow" }] }),
  component: () => <LegalPage page={legalPages["termos-de-uso"]} />,
});
