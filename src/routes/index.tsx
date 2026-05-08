import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe2, Calendar, Star, Sparkles, MessageCircle } from "lucide-react";
import heroImg from "@/assets/hero-student.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GWLanguageFlow — Aulas de idiomas com professores apaixonados" },
      { name: "description", content: "Encontre o professor de idiomas ideal para você. Aulas online, agendamento simples e pagamento seguro." },
      { property: "og:title", content: "GWLanguageFlow" },
      { property: "og:description", content: "Marketplace de aulas de idiomas." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-soft" />
      <div className="container relative mx-auto px-4 py-16 md:py-24 grid gap-12 md:grid-cols-2 items-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-bronze/30 bg-cream px-4 py-1.5 text-xs font-medium text-wine">
            <Sparkles className="h-3.5 w-3.5 text-bronze" />
            Marketplace de aulas de idiomas
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold text-balance leading-[1.05] text-wine">
            O idioma certo,
            <br />
            <span className="text-bronze italic">com a pessoa certa.</span>
          </h1>
          <p className="text-lg text-brown max-w-lg text-balance">
            Conecte-se a professores apaixonados, escolha o seu ritmo e comece a falar uma nova língua hoje mesmo.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/auth/signup">
              <Button size="lg" className="bg-bronze text-white hover:bg-wine shadow-bronze gap-2">
                Encontrar professor <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth/signup">
              <Button size="lg" variant="outline" className="border-wine text-wine hover:bg-wine hover:text-white">
                Quero ensinar
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-6 pt-6 text-sm text-brown-soft">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => <div key={i} className="h-7 w-7 rounded-full bg-gradient-warm border-2 border-background" />)}
              </div>
              <span>+1.200 alunos</span>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 fill-bronze text-bronze" />)}
              <span className="ml-1">4.9</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative"
        >
          <div className="relative rounded-3xl overflow-hidden shadow-warm">
            <img
              src={heroImg}
              alt="Estudante feliz em aula de idioma online"
              width={1024}
              height={1024}
              className="w-full h-[480px] object-cover"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 rounded-2xl bg-white p-4 shadow-soft border border-border max-w-[220px]">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-warm flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-brown-soft">Próxima aula</p>
                <p className="text-sm font-semibold text-wine">Hoje, 19h</p>
              </div>
            </div>
          </div>
          <div className="absolute -top-4 -right-4 rounded-2xl bg-wine text-white p-4 shadow-warm">
            <Globe2 className="h-6 w-6 text-bronze mb-1" />
            <p className="text-2xl font-display font-bold">11+</p>
            <p className="text-xs text-white/80">idiomas</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Globe2,
      title: "Professores nativos",
      desc: "Aprenda com quem vive e respira o idioma todos os dias.",
    },
    {
      icon: Calendar,
      title: "Agenda flexível",
      desc: "Escolha o horário que cabe na sua rotina — semana ou fim de semana.",
    },
    {
      icon: Star,
      title: "Avaliações reais",
      desc: "Veja o que outros alunos disseram antes de agendar.",
    },
  ];
  return (
    <section className="py-20 bg-cream">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-wine">
            Aprender uma língua nunca foi tão pessoal.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl bg-background p-7 border border-border hover:shadow-soft transition-shadow"
            >
              <div className="h-12 w-12 rounded-xl bg-bronze/10 flex items-center justify-center mb-4">
                <it.icon className="h-6 w-6 text-bronze" />
              </div>
              <h3 className="font-display text-xl font-semibold text-wine mb-2">{it.title}</h3>
              <p className="text-brown text-sm leading-relaxed">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Crie sua conta", desc: "Diga o que você quer aprender e seu nível atual." },
    { n: "02", title: "Escolha um professor", desc: "Filtre por idioma, preço e disponibilidade." },
    { n: "03", title: "Agende e pague", desc: "Pagamento seguro antes da aula. Sem surpresas." },
    { n: "04", title: "Aprenda e avalie", desc: "Aula 1:1 e avaliação ao final para ajudar a comunidade." },
  ];
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-12">
          <p className="text-bronze font-medium uppercase tracking-widest text-xs mb-3">Como funciona</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-wine">
            Quatro passos. Zero complicação.
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-border p-6">
              <span className="font-display text-3xl text-bronze">{s.n}</span>
              <h3 className="font-display text-lg text-wine mt-3 mb-2">{s.title}</h3>
              <p className="text-sm text-brown">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="rounded-3xl bg-gradient-warm p-10 md:p-16 text-white shadow-warm relative overflow-hidden">
          <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-4">
              Pronto para começar a falar?
            </h2>
            <p className="text-white/90 text-lg mb-8">
              Crie sua conta grátis e encontre o professor perfeito em minutos.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/auth/signup">
                <Button size="lg" className="bg-white text-wine hover:bg-cream">
                  Criar minha conta
                </Button>
              </Link>
              <Link to="/feed">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-wine">
                  Explorar professores
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
