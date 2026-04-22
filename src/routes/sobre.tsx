import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sobre")({
  head: () => ({ meta: [{ title: "Sobre — GWLanguageFlow" }, { name: "description", content: "Conheça a missão da GWLanguageFlow." }] }),
  component: () => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="font-display text-4xl md:text-5xl text-wine font-bold mb-6">Sobre a GWLanguageFlow</h1>
        <div className="prose text-brown space-y-4 text-lg">
          <p>A GWLanguageFlow nasceu de uma ideia simples: aprender um idioma deve ser uma experiência humana, próxima e prazerosa.</p>
          <p>Conectamos alunos a professores apaixonados ao redor do mundo, com agendamento simples, pagamento seguro e total transparência.</p>
          <p>Acreditamos que falar uma nova língua abre portas — e nossa missão é abrir essas portas para o maior número possível de pessoas.</p>
        </div>
        <Link to="/feed"><Button className="mt-8 bg-bronze text-white hover:bg-wine">Encontrar professor</Button></Link>
      </main>
      <SiteFooter />
    </div>
  ),
});
