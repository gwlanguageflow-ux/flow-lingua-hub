import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Headphones,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import heroStudent from "@/assets/hero-student.jpg";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GWLanguageFlow — Plataforma profissional de idiomas" },
      {
        name: "description",
        content:
          "GWLanguageFlow é uma plataforma profissional para aprender idiomas com método estruturado, professores especialistas, materiais semanais e acompanhamento pedagógico.",
      },
      { property: "og:title", content: "GWLanguageFlow" },
      {
        property: "og:description",
        content:
          "Uma plataforma de idiomas com método, direção pedagógica e rotina real de estudo.",
      },
    ],
  }),
  component: HomePage,
});

const schedule = [
  {
    day: "Hoje",
    time: "19:00",
    title: "Inglês — Conversation Lab",
    teacher: "Prof. Helena",
    status: "Sala liberada",
  },
  {
    day: "Quinta",
    time: "20:30",
    title: "Revisão B2 + escrita",
    teacher: "Prof. Matheus",
    status: "Material entregue",
  },
  {
    day: "Sábado",
    time: "10:00",
    title: "Listening intensivo",
    teacher: "Prof. Clara",
    status: "Atividade aberta",
  },
];

const qualityMetrics = [
  { value: "+1.200", label: "alunos ativos" },
  { value: "98%", label: "renovação" },
  { value: "11", label: "idiomas" },
  { value: "4.9", label: "avaliação média" },
];

function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <QualityRail />
        <MethodArchitecture />
        <FlowExperience />
        <PlansTeaser />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/70 bg-cream">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroStudent})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 hidden md:block"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,251,244,0.98) 0%, rgba(255,251,244,0.92) 42%, rgba(255,251,244,0.58) 68%, rgba(255,251,244,0.12) 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-cream/98 via-cream/88 to-cream/64 md:hidden"
        aria-hidden="true"
      />
      <div className="absolute inset-0 gw-grid opacity-55" aria-hidden="true" />

      <div className="container relative mx-auto px-4 py-10 md:py-20">
        <div className="grid min-h-[560px] items-center gap-8 md:min-h-[620px] lg:grid-cols-[1fr_520px]">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="max-w-3xl"
          >
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-bronze/35 bg-white/86 px-3 py-2 text-[11px] font-bold uppercase text-wine shadow-soft md:mb-7 md:px-4 md:text-xs">
              <span className="h-2 w-2 rounded-full bg-bronze" />
              Plataforma GWLanguageFlow
            </div>

            <h1 className="max-w-full font-display text-[2.6rem] font-bold leading-[1.04] text-wine sm:text-5xl md:text-7xl">
              GWLanguageFlow
            </h1>
            <p className="mt-4 max-w-2xl text-xl font-semibold leading-snug text-brown sm:text-2xl md:mt-5 md:text-3xl">
              Método, direção pedagógica e uma rotina digital para aprender idiomas com seriedade.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-brown-soft sm:text-base md:mt-5 md:text-lg md:leading-8">
              A plataforma organiza aula, material, atividade, professor e acompanhamento no mesmo
              fluxo. Menos improviso. Mais clareza para evoluir.
            </p>

            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap md:mt-8">
              <Link to="/auth/signup" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-12 w-full rounded-full bg-wine px-6 text-base text-white shadow-bronze hover:bg-wine-deep sm:w-auto"
                >
                  Começar agora <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/planos" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-full rounded-full border-wine/20 bg-white px-6 text-base text-wine shadow-soft transition-all duration-300 hover:border-bronze hover:bg-white hover:shadow-[0_0_28px_rgba(196,113,52,0.55)] active:scale-[0.98] sm:w-auto"
                >
                  Ver planos
                </Button>
              </Link>
            </div>

            <div className="mt-7 grid max-w-2xl gap-2 text-sm text-brown sm:grid-cols-3 md:mt-8 md:gap-3">
              <Proof icon={ShieldCheck} text="Pagamento seguro" />
              <Proof icon={CalendarCheck} text="Agenda guiada" />
              <Proof icon={Trophy} text="Padrão pedagógico GW" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="hidden lg:block"
          >
            <ProductCockpit />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Proof({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-white/74 px-3 py-2 shadow-soft">
      <Icon className="h-4 w-4 text-bronze" />
      <span>{text}</span>
    </div>
  );
}

function ProductCockpit() {
  return (
    <div className="relative">
      <div className="absolute -left-10 top-12 w-52 rounded-2xl border border-white/75 bg-white/88 p-4 shadow-warm backdrop-blur">
        <p className="text-xs font-bold uppercase text-bronze">Progresso</p>
        <div className="mt-4 space-y-3">
          {[
            ["Listening", "78%"],
            ["Speaking", "64%"],
            ["Writing", "71%"],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-xs text-brown">
                <span>{label}</span>
                <strong className="text-wine">{value}</strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-cream">
                <div className="h-full rounded-full bg-bronze" style={{ width: value }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="gw-panel overflow-hidden rounded-[2rem] backdrop-blur">
        <div className="flex items-center justify-between border-b border-border bg-white/75 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-wine/45" />
            <span className="h-2.5 w-2.5 rounded-full bg-bronze/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-olive/45" />
          </div>
          <span className="font-mono text-xs text-brown-soft">painel.gwlanguageflow</span>
        </div>

        <div className="bg-white/94 p-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase text-bronze">Sua agenda</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-wine">Próximas aulas</h2>
            </div>
            <div className="rounded-full bg-wine px-3 py-1 text-xs font-semibold text-white">
              B2 em evolução
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {schedule.map((item) => (
              <div
                key={item.title}
                className="grid grid-cols-[72px_1fr_auto] items-center gap-4 rounded-2xl border border-border bg-cream/45 p-4"
              >
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase text-brown-soft">{item.day}</p>
                  <p className="font-display text-xl font-bold text-wine">{item.time}</p>
                </div>
                <div className="border-l border-border pl-4">
                  <p className="font-semibold text-wine">{item.title}</p>
                  <p className="text-xs text-brown-soft">{item.teacher} · Aula online · 60min</p>
                  <p className="mt-1 text-xs font-semibold text-bronze">{item.status}</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-bronze" />
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-5">
            {[
              ["8", "aulas/mês"],
              ["12d", "sequência"],
              ["4", "materiais"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-white p-3 text-center shadow-soft">
                <p className="font-display text-2xl font-bold text-wine">{value}</p>
                <p className="text-xs uppercase text-brown-soft">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -bottom-8 right-8 w-60 rounded-2xl border border-white/75 bg-ink p-4 text-white shadow-warm">
        <div className="flex items-center gap-2">
          <MessagesSquare className="h-4 w-4 text-bronze" />
          <p className="text-sm font-semibold">Diretoria pedagógica</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/70">
          Revisão da semana liberada. Ajuste de speaking recomendado antes da próxima aula.
        </p>
      </div>
    </div>
  );
}

function QualityRail() {
  return (
    <section className="border-b border-border bg-white">
      <div className="container mx-auto grid gap-4 px-4 py-7 md:grid-cols-4">
        {qualityMetrics.map((metric) => (
          <div key={metric.label} className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream">
              <Sparkles className="h-5 w-5 text-bronze" />
            </div>
            <div>
              <p className="font-display text-3xl font-bold leading-none text-wine">
                {metric.value}
              </p>
              <p className="mt-1 text-sm text-brown-soft">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MethodArchitecture() {
  const pillars = [
    {
      icon: BookOpenCheck,
      title: "Trilha semanal",
      description:
        "Aula, revisão, listening, reading e atividade aparecem em sequência, sem depender de mensagens soltas.",
    },
    {
      icon: Headphones,
      title: "Fala acompanhada",
      description:
        "Conversação com objetivos claros, feedback e registro de pontos fortes e pontos de atenção.",
    },
    {
      icon: GraduationCap,
      title: "Professor orientado",
      description:
        "O professor trabalha com padrão pedagógico e, quando necessário, suporte direto da direção.",
    },
  ];

  return (
    <section className="gw-paper py-14 md:py-20">
      <div className="container mx-auto px-4">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-sm font-bold uppercase text-bronze">Método GW</p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-bold leading-tight text-wine md:text-5xl">
              Uma plataforma para estudar com ritmo, evidência e direção.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-brown md:mt-5 md:text-lg md:leading-8">
              O aluno sabe o que precisa fazer. O professor sabe o que precisa acompanhar. A direção
              pedagógica enxerga o percurso.
            </p>
          </div>

          <div className="space-y-5">
            {pillars.map((pillar, index) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="gw-panel gw-lift grid gap-4 rounded-[1.35rem] p-5 md:grid-cols-[72px_1fr] md:gap-5 md:rounded-[1.75rem] md:p-6"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-wine text-white">
                  <pillar.icon className="h-7 w-7 text-bronze" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-2xl font-bold text-bronze md:text-3xl">
                      0{index + 1}
                    </span>
                    <h3 className="font-display text-xl font-bold text-wine md:text-2xl">
                      {pillar.title}
                    </h3>
                  </div>
                  <p className="mt-2 leading-7 text-brown">{pillar.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowExperience() {
  const tools = [
    {
      icon: CalendarCheck,
      label: "Agenda",
      text: "Aulas, horário, link e status de presença no mesmo espaço.",
    },
    {
      icon: FileText,
      label: "Materiais",
      text: "PDFs, links, Word e conteúdos padrão da plataforma por turma.",
    },
    {
      icon: ClipboardCheck,
      label: "Atividades",
      text: "Entrega com prazo, correção, nota e histórico do aluno.",
    },
    {
      icon: MessagesSquare,
      label: "Chat",
      text: "Contato direto entre aluno, professor e secretaria pedagógica.",
    },
  ];

  return (
    <section className="border-y border-border bg-white py-14 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase text-bronze">Não é só aula online</p>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-wine md:text-5xl">
            A GWLanguageFlow funciona como uma central de aprendizagem.
          </h2>
          <p className="mt-4 text-base leading-7 text-brown-soft md:text-lg md:leading-8">
            A experiência foi pensada para reduzir ruído: cada parte do estudo tem lugar, dono e
            próximo passo.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:mt-12 md:grid-cols-4">
          {tools.map((tool) => (
            <div key={tool.label} className="gw-panel gw-lift rounded-[1.5rem] p-5">
              <tool.icon className="h-7 w-7 text-bronze" />
              <h3 className="mt-5 font-display text-xl font-bold text-wine">{tool.label}</h3>
              <p className="mt-2 text-sm leading-6 text-brown">{tool.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-9 overflow-hidden rounded-[1.35rem] bg-ink text-white shadow-warm md:mt-12 md:rounded-[2rem]">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-white/10 p-6 md:p-8 lg:border-b-0 lg:border-r">
              <p className="text-sm font-bold uppercase text-bronze">Visão de qualidade</p>
              <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                Acompanhamento que aparece antes do problema virar atraso.
              </h3>
              <p className="mt-4 text-sm leading-7 text-white/68">
                A plataforma foi preparada para registrar aulas, materiais, atividades e mensagens.
                Isso cria uma linha de acompanhamento para aluno, professor e direção.
              </p>
            </div>
            <div className="grid gap-px bg-white/10 md:grid-cols-3">
              {[
                ["Aula", "Presença, link e foco do encontro"],
                ["Material", "Conteúdo entregue por plano e turma"],
                ["Evolução", "Notas, feedbacks e histórico"],
              ].map(([title, text]) => (
                <div key={title} className="bg-ink p-7">
                  <p className="font-display text-2xl font-bold text-bronze">{title}</p>
                  <p className="mt-3 text-sm leading-6 text-white/68">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlansTeaser() {
  const cards = [
    { name: "Essencial", price: "R$ 179,90", detail: "Consistência semanal" },
    { name: "Avançado", price: "R$ 299,90", detail: "Evolução acelerada", featured: true },
    { name: "Conversation", price: "R$ 169,90", detail: "Fala e confiança" },
  ];

  return (
    <section className="gw-paper py-14 md:py-20">
      <div className="container mx-auto px-4">
        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold uppercase text-bronze">Planos</p>
            <h2 className="mt-3 max-w-3xl font-display text-3xl font-bold leading-tight text-wine md:text-5xl">
              Escolha o ritmo, não uma promessa vaga.
            </h2>
          </div>
          <Link
            to="/planos"
            className="inline-flex items-center gap-2 font-semibold text-wine transition hover:text-bronze"
          >
            Comparar todos os planos <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.name}
              className={`gw-panel rounded-[1.6rem] p-7 ${
                card.featured ? "border-bronze shadow-bronze" : ""
              }`}
            >
              {card.featured && (
                <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-bronze px-3 py-1 text-xs font-bold uppercase text-white">
                  <Trophy className="h-3.5 w-3.5" />
                  Mais escolhido
                </div>
              )}
              <h3 className="font-display text-2xl font-bold text-wine">{card.name}</h3>
              <p className="mt-2 text-sm text-brown-soft">{card.detail}</p>
              <p className="mt-7 font-display text-3xl font-bold text-wine md:text-4xl">
                {card.price}
                <span className="font-sans text-sm font-semibold text-brown-soft"> /mês</span>
              </p>
              <Link to="/planos" className="mt-7 block">
                <Button
                  className={`h-11 w-full rounded-full ${
                    card.featured
                      ? "bg-bronze text-white hover:bg-wine"
                      : "bg-wine text-white hover:bg-wine-deep"
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

function FinalCTA() {
  return (
    <section className="bg-white py-14 md:py-20">
      <div className="container mx-auto px-4">
        <div className="overflow-hidden rounded-[1.35rem] bg-wine text-white shadow-warm md:rounded-[2rem]">
          <div className="grid lg:grid-cols-[1fr_0.9fr]">
            <div className="p-6 md:p-12">
              <p className="text-sm font-bold uppercase text-bronze">Próximo passo</p>
              <h2 className="mt-3 max-w-xl font-display text-3xl font-bold leading-tight text-white md:text-5xl">
                Comece com estrutura desde o primeiro acesso.
              </h2>
              <p className="mt-4 max-w-lg leading-8 text-white/78">
                Crie sua conta, escolha um plano e entre em uma jornada com aula, material,
                professor e acompanhamento.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/auth/signup">
                  <Button
                    size="lg"
                    className="h-12 rounded-full bg-bronze px-6 text-white hover:bg-white hover:text-wine"
                  >
                    Criar minha conta
                  </Button>
                </Link>
                <Link to="/planos">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-full border-white bg-white px-6 text-wine transition-all duration-300 hover:border-bronze hover:bg-white hover:text-wine hover:shadow-[0_0_28px_rgba(196,113,52,0.85)] active:scale-[0.98]"
                  >
                    Ver planos
                  </Button>
                </Link>
              </div>
            </div>
            <div className="grid gap-px bg-white/10 md:grid-cols-2 lg:grid-cols-1">
              {[
                "Painel do aluno com agenda, materiais e atividades",
                "Professores selecionados e acompanhamento pedagógico",
                "Pagamento por cartão ou PIX com registro de assinatura",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 bg-wine-deep/45 p-7">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-bronze" />
                  <p className="text-sm leading-6 text-white/82">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
