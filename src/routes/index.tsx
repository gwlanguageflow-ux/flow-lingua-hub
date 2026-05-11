import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  CalendarCheck,
  GraduationCap,
  Headphones,
  BookOpenCheck,
  Trophy,
  Users,
  BarChart3,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GWLanguageFlow — Plataforma de aulas de idiomas" },
      {
        name: "description",
        content:
          "Plataforma profissional para aprender idiomas com método estruturado, professores especializados e acompanhamento contínuo.",
      },
      { property: "og:title", content: "GWLanguageFlow" },
      { property: "og:description", content: "Plataforma profissional de aulas de idiomas." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TrustBar />
        <Pillars />
        <Method />
        <PlansTeaser />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ---------- HERO ---------- */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="absolute inset-0 bg-gradient-soft" />
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-bronze/10 blur-3xl pointer-events-none" />

      <div className="container relative mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="grid gap-12 lg:grid-cols-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7 space-y-7"
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-bronze/30 bg-white px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-widest text-wine">
              <span className="h-1.5 w-1.5 rounded-full bg-bronze" />
              Plataforma GWLanguageFlow
            </span>

            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.02] text-wine">
              Domine um idioma <br />
              <span className="text-bronze italic">com método e propósito.</span>
            </h1>

            <p className="text-lg text-brown max-w-xl leading-relaxed">
              Aulas estruturadas, materiais exclusivos e acompanhamento contínuo. Uma plataforma feita para
              quem leva o aprendizado a sério.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link to="/auth/signup">
                <Button size="lg" className="bg-wine text-white hover:bg-wine-deep gap-2 h-12 px-6 text-base">
                  Começar agora <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/planos">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-wine/20 text-wine hover:bg-cream h-12 px-6 text-base"
                >
                  Ver planos
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-x-7 gap-y-3 pt-2 text-sm text-brown-soft">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-bronze" /> Pagamento seguro
              </span>
              <span className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-bronze" /> Cancele quando quiser
              </span>
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-bronze" /> Método validado
              </span>
            </div>
          </motion.div>

          {/* Painel mock — sensação de produto */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-5"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-warm opacity-20 rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl border border-border bg-white shadow-warm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-cream/60">
                  <div className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-wine/40" />
                    <span className="h-2.5 w-2.5 rounded-full bg-bronze/40" />
                    <span className="h-2.5 w-2.5 rounded-full bg-brown/30" />
                  </div>
                  <span className="text-[11px] text-brown-soft ml-2 font-mono">app.gwlanguageflow</span>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-bronze font-medium">Sua agenda</p>
                    <h3 className="font-display text-xl text-wine font-bold">Próximas aulas</h3>
                  </div>

                  {[
                    { d: "Hoje", h: "19:00", t: "Inglês — Conversation", c: "bronze" },
                    { d: "Quinta", h: "20:30", t: "Inglês — Revisão B2", c: "wine" },
                    { d: "Sábado", h: "10:00", t: "Listening + Reading", c: "brown" },
                  ].map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-bronze/40 transition"
                    >
                      <div className="text-center min-w-[52px]">
                        <p className="text-[10px] uppercase text-brown-soft">{a.d}</p>
                        <p className="font-display text-base text-wine font-bold">{a.h}</p>
                      </div>
                      <div className="flex-1 border-l border-border pl-3">
                        <p className="text-sm font-semibold text-wine">{a.t}</p>
                        <p className="text-[11px] text-brown-soft">Aula online · 60min</p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-bronze" />
                    </div>
                  ))}

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                    <Stat label="Aulas/mês" value="8" />
                    <Stat label="Streak" value="12d" />
                    <Stat label="Nível" value="B2" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="font-display text-xl font-bold text-wine">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-brown-soft">{label}</p>
    </div>
  );
}

/* ---------- TRUST BAR ---------- */
function TrustBar() {
  const items = [
    { v: "+1.200", l: "Alunos ativos", i: Users },
    { v: "98%", l: "Renovam o plano", i: BarChart3 },
    { v: "11", l: "Idiomas", i: GraduationCap },
    { v: "4.9", l: "Avaliação média", i: Sparkles },
  ];
  return (
    <section className="border-b border-border/60 bg-white">
      <div className="container mx-auto px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((it) => (
          <div key={it.l} className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cream flex items-center justify-center">
              <it.i className="h-5 w-5 text-bronze" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold text-wine leading-none">{it.v}</p>
              <p className="text-xs text-brown-soft mt-1">{it.l}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- PILLARS ---------- */
function Pillars() {
  const items = [
    {
      icon: BookOpenCheck,
      title: "Método estruturado",
      desc: "Trilhas pensadas por nível, com revisão, listening, reading e atividades práticas — entregues toda semana.",
    },
    {
      icon: Headphones,
      title: "Conversação real",
      desc: "Espaços dedicados para destravar a fala, quebrar bloqueios e ganhar autoconfiança em situações reais.",
    },
    {
      icon: GraduationCap,
      title: "Professores especialistas",
      desc: "Profissionais selecionados, com acompanhamento da diretoria pedagógica e padrão de qualidade GW.",
    },
  ];
  return (
    <section className="py-20 bg-cream/40">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-12">
          <p className="text-bronze text-xs uppercase tracking-widest font-medium">Por que GWLanguageFlow</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-wine mt-2">
            Uma plataforma. Um método. <span className="italic text-bronze">Resultados consistentes.</span>
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((it, i) => (
            <motion.div
              key={it.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl bg-white p-7 border border-border hover:border-bronze/40 hover:shadow-soft transition"
            >
              <div className="h-11 w-11 rounded-xl bg-bronze/10 flex items-center justify-center mb-5">
                <it.icon className="h-5 w-5 text-bronze" />
              </div>
              <h3 className="font-display text-xl font-bold text-wine mb-2">{it.title}</h3>
              <p className="text-brown text-sm leading-relaxed">{it.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- METHOD ---------- */
function Method() {
  const steps = [
    { n: "01", t: "Diagnóstico", d: "Você nos conta seu nível e objetivos." },
    { n: "02", t: "Plano e professor", d: "Escolha o plano e seja matriculado com um especialista." },
    { n: "03", t: "Aulas semanais", d: "Aulas online, materiais e atividades entregues no painel." },
    { n: "04", t: "Acompanhamento", d: "Avaliações, revisões e ajustes contínuos no seu plano." },
  ];
  return (
    <section className="py-20 border-t border-border/60">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-4 lg:sticky lg:top-24">
            <p className="text-bronze text-xs uppercase tracking-widest font-medium">Como funciona</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-wine mt-2">
              Do diagnóstico à fluência, sem improviso.
            </h2>
            <p className="text-brown mt-4">
              Cada aluno tem uma jornada acompanhada pela diretoria pedagógica da GW. Nada é deixado ao acaso.
            </p>
          </div>
          <div className="lg:col-span-8 space-y-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="flex gap-5 p-6 rounded-2xl border border-border bg-white hover:border-bronze/40 transition"
              >
                <span className="font-display text-4xl font-bold text-bronze/70 leading-none">{s.n}</span>
                <div>
                  <h3 className="font-display text-lg font-bold text-wine">{s.t}</h3>
                  <p className="text-sm text-brown mt-1">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- PLANS TEASER ---------- */
function PlansTeaser() {
  const cards = [
    { name: "Essencial", price: "179,90", tag: "Para começar com consistência" },
    { name: "Avançado", price: "299,90", tag: "Mais escolhido — evolução acelerada", featured: true },
    { name: "Conversation", price: "169,90", tag: "Destrave a fala" },
  ];
  return (
    <section className="py-20 bg-cream/40 border-t border-border/60">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-bronze text-xs uppercase tracking-widest font-medium">Planos</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-wine mt-2">
              Escolha o ritmo da sua jornada.
            </h2>
          </div>
          <Link to="/planos" className="text-sm font-semibold text-wine hover:text-bronze flex items-center gap-1">
            Comparar todos os planos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((c) => (
            <div
              key={c.name}
              className={`relative rounded-2xl border p-7 bg-white flex flex-col ${
                c.featured ? "border-bronze ring-2 ring-bronze/30 shadow-bronze" : "border-border"
              }`}
            >
              {c.featured && (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1 bg-bronze text-white text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full">
                  <Trophy className="h-3 w-3" /> Mais escolhido
                </span>
              )}
              <div className="flex items-center gap-2">
                {c.featured && <Trophy className="h-5 w-5 text-bronze" />}
                <h3 className="font-display text-2xl font-bold text-wine">{c.name}</h3>
              </div>
              <p className="text-sm text-brown-soft mt-1 min-h-[40px]">{c.tag}</p>
              <p className="font-display text-3xl font-bold text-wine mt-4">
                R$ {c.price}
                <span className="text-sm text-brown-soft font-sans"> /mês</span>
              </p>
              <Link to="/planos" className="mt-6">
                <Button
                  className={`w-full ${
                    c.featured ? "bg-bronze hover:bg-wine text-white" : "bg-wine hover:bg-wine-deep text-white"
                  }`}
                >
                  Ver detalhes
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- FINAL CTA ---------- */
function FinalCTA() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="rounded-3xl bg-wine text-white p-10 md:p-16 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-bronze/30 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-bronze/20 blur-2xl" />
          <div className="relative grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight">
                Pronto para começar de verdade?
              </h2>
              <p className="text-white/80 mt-4 max-w-md">
                Crie sua conta, escolha um plano e tenha sua primeira aula em até 48 horas.
              </p>
              <div className="flex flex-wrap gap-3 mt-7">
                <Link to="/auth/signup">
                  <Button size="lg" className="bg-bronze text-white hover:bg-white hover:text-wine">
                    Criar minha conta
                  </Button>
                </Link>
                <Link to="/planos">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/40 text-white hover:bg-white hover:text-wine"
                  >
                    Ver planos
                  </Button>
                </Link>
              </div>
            </div>
            <ul className="space-y-3 text-white/90 text-sm">
              {[
                "Plataforma 100% online com painel do aluno",
                "Materiais semanais entregues automaticamente",
                "Diretoria pedagógica acompanhando cada caso",
                "Pagamento por Cartão ou PIX, com nota fiscal",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="h-5 w-5 text-bronze flex-shrink-0 mt-0.5" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
