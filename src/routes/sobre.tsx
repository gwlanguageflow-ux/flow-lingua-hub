import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Target, Heart, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — GWLanguageFlow" },
      { name: "description", content: "Conheça a missão e o método da GWLanguageFlow." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border/60 bg-gradient-soft py-16">
          <div className="container mx-auto px-4 max-w-3xl">
            <p className="text-bronze text-xs uppercase tracking-widest font-medium">Sobre</p>
            <h1 className="font-display text-4xl md:text-5xl text-wine font-bold mt-3 leading-tight">
              Um método. Uma direção. <span className="italic text-bronze">Um propósito.</span>
            </h1>
            <p className="text-brown text-lg mt-5 leading-relaxed">
              A GWLanguageFlow é uma plataforma profissional de ensino de idiomas, idealizada pela diretora
              <strong className="text-wine"> Eloiza Gramacho</strong>. Aqui, cada aula tem método, cada aluno tem
              acompanhamento e cada professor segue o nosso padrão de qualidade.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-4 max-w-5xl grid gap-5 md:grid-cols-2">
            {[
              { i: Target, t: "Foco em resultado", d: "Trilhas estruturadas por objetivo, com revisão constante." },
              { i: Heart, t: "Ensino humano", d: "Professores próximos e atentos ao ritmo de cada aluno." },
              { i: ShieldCheck, t: "Pagamento seguro", d: "Cobrança via plataforma, com cartão ou PIX." },
              { i: Sparkles, t: "Materiais exclusivos", d: "Conteúdo autoral entregue toda semana no painel." },
            ].map((b) => (
              <div key={b.t} className="rounded-2xl border border-border bg-white p-7">
                <b.i className="h-6 w-6 text-bronze mb-4" />
                <h3 className="font-display text-xl text-wine font-bold mb-2">{b.t}</h3>
                <p className="text-sm text-brown">{b.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <Link to="/planos">
              <Button size="lg" className="bg-wine text-white hover:bg-wine-deep h-12 px-7">
                Conhecer os planos
              </Button>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
