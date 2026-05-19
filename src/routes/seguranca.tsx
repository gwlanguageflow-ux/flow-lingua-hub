import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { legalPages } from "@/lib/legal-content";

export const Route = createFileRoute("/seguranca")({
  head: () => ({ meta: [{ title: "Segurança da Informação — GWLanguageFlow" }] }),
  component: () => <LegalPage page={legalPages.seguranca} />,
});
