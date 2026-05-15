import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  ClipboardCheck,
  HeartHandshake,
  ShieldCheck,
  Target,
} from "lucide-react";
import heroStudent from "@/assets/hero-student.jpg";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — GWLanguageFlow" },
      {
        name: "description",
        content:
          "Conheça a direção pedagógica, o método e o padrão de qualidade da GWLanguageFlow.",
      },
    ],
  }),
  component: AboutPage,
});

const principles = [
  {
    icon: Target,
    title: "Objetivo antes do conteúdo",
    text: "A jornada parte do nível, da meta e da rotina real do aluno. O conteúdo serve ao progresso, não ao improviso.",
  },
  {
    icon: BookOpenCheck,
    title: "Material com continuidade",
    text: "Cada entrega semanal conecta aula, revisão e atividade. O aluno sabe o que fazer depois do encontro ao vivo.",
  },
  {
    icon: ClipboardCheck,
    title: "Registro pedagógico",
    text: "A plataforma preserva histórico, notas, feedbacks e materiais para que o acompanhamento não dependa de memória.",
  },
  {
    icon: HeartHandshake,
    title: "Ensino humano",
    text: "Tecnologia organiza a experiência, mas a evolução acontece com professor, escuta e orientação próxima.",
  },
];

function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="gw-paper border-b border-border py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid gap-12 lg:grid-cols-[1fr_0.78fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase text-bronze">Sobre a GWLanguageFlow</p>
                <h1 className="mt-3 max-w-4xl font-display text-5xl font-bold leading-tight text-wine md:text-6xl">
                  Um método. Uma direção. Uma plataforma que acompanha.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-brown">
                  A GWLanguageFlow foi idealizada pela diretora{" "}
                  <strong className="text-wine">Eloiza Gramacho</strong> para unir ensino de
                  idiomas, gestão pedagógica e experiência digital em um único lugar.
                </p>
                <p className="mt-4 max-w-2xl leading-8 text-brown-soft">
                  Cada aluno entra em uma rotina com aula, material, atividade e acompanhamento.
                  Cada professor trabalha com clareza de turma, agenda, conteúdo e histórico.
                </p>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-border bg-white shadow-warm">
                <img
                  src={heroStudent}
                  alt="Aluna em ambiente de estudo online"
                  className="h-72 w-full object-cover"
                />
                <div className="p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold text-wine">
                    <ShieldCheck className="h-5 w-5 text-bronze" />
                    Padrão pedagógico GW
                  </div>
                  <p className="mt-3 text-sm leading-6 text-brown-soft">
                    A direção acompanha a qualidade da experiência para que o aluno não receba só
                    aulas, mas um percurso.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase text-bronze">O que nos orienta</p>
              <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-wine md:text-5xl">
                A plataforma foi desenhada para diminuir distância entre intenção e prática.
              </h2>
            </div>

            <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] border border-border bg-border shadow-soft md:grid-cols-2">
              {principles.map((principle) => (
                <div key={principle.title} className="bg-white p-7 md:p-8">
                  <principle.icon className="h-7 w-7 text-bronze" />
                  <h3 className="mt-5 font-display text-2xl font-bold text-wine">
                    {principle.title}
                  </h3>
                  <p className="mt-3 leading-7 text-brown-soft">{principle.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gw-paper border-y border-border py-16">
          <div className="container mx-auto px-4">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase text-bronze">Nossa diferença</p>
                <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-wine">
                  Não basta conectar aluno e professor.
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Direção", "Padrão pedagógico e suporte para a experiência."],
                  ["Rotina", "Aula, material e atividade em uma sequência visível."],
                  ["Confiança", "Pagamento, agenda e histórico registrados na plataforma."],
                ].map(([title, text]) => (
                  <div key={title} className="gw-panel rounded-[1.4rem] p-5">
                    <p className="font-display text-2xl font-bold text-wine">{title}</p>
                    <p className="mt-2 text-sm leading-6 text-brown-soft">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold leading-tight text-wine">
              Conheça a jornada antes de escolher seu plano.
            </h2>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link to="/planos">
                <Button className="h-12 rounded-full bg-wine px-6 text-white hover:bg-wine-deep">
                  Ver planos <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/seja-professor">
                <Button
                  variant="outline"
                  className="h-12 rounded-full border-wine/20 px-6 text-wine hover:bg-cream"
                >
                  Quero ensinar
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
