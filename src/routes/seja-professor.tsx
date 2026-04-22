import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Sparkles, DollarSign, Calendar, Users } from "lucide-react";

export const Route = createFileRoute("/seja-professor")({
  head: () => ({ meta: [{ title: "Seja professor — GWLanguageFlow" }, { name: "description", content: "Ensine idiomas pela GWLanguageFlow e receba alunos do mundo todo." }] }),
  component: () => (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="py-16 bg-gradient-soft">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h1 className="font-display text-4xl md:text-5xl text-wine font-bold mb-4">Ensine. Inspire. <span className="text-bronze italic">Floresça.</span></h1>
            <p className="text-brown text-lg mb-8">Crie seu perfil em minutos e comece a receber alunos do mundo todo.</p>
            <Link to="/auth/signup"><Button size="lg" className="bg-bronze text-white hover:bg-wine shadow-bronze">Começar agora</Button></Link>
          </div>
        </section>
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-5xl grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: DollarSign, t: "Você no controle", d: "Defina seus valores e receba pelas aulas." },
              { icon: Calendar, t: "Sua agenda", d: "Você decide os dias e horários disponíveis." },
              { icon: Users, t: "Alunos ativos", d: "Comunidade crescente buscando aulas." },
              { icon: Sparkles, t: "Pagamento seguro", d: "Recebimentos processados com segurança." },
            ].map((b, i) => (
              <div key={i} className="rounded-2xl border border-border p-6">
                <b.icon className="h-7 w-7 text-bronze mb-3" />
                <h3 className="font-display text-lg text-wine mb-2">{b.t}</h3>
                <p className="text-sm text-brown">{b.d}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  ),
});
