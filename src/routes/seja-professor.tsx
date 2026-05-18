import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  FileText,
  GraduationCap,
  MessagesSquare,
  ShieldCheck,
  UploadCloud,
  Users,
  Wallet,
} from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/seja-professor")({
  head: () => ({
    meta: [
      { title: "Seja professor — GWLanguageFlow" },
      {
        name: "description",
        content:
          "Crie seu perfil profissional na GWLanguageFlow, organize turmas, materiais, atividades e recebimentos.",
      },
    ],
  }),
  component: TeacherPage,
});

const teacherTools = [
  {
    icon: CalendarCheck,
    title: "Agenda e turmas",
    text: "Organize aulas por idioma, turma, dia, horário e link da sala online.",
  },
  {
    icon: FileText,
    title: "Materiais",
    text: "Use materiais padrão da plataforma ou envie seus próprios arquivos para cada turma.",
  },
  {
    icon: MessagesSquare,
    title: "Comunicação",
    text: "Converse com alunos e secretaria pedagógica no ambiente da plataforma.",
  },
  {
    icon: Wallet,
    title: "Carteira",
    text: "Acompanhe saldo, histórico e solicitações de saque via Pix.",
  },
];

function TeacherPage() {
  return (
    <div className="gw-app-shell flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="gw-paper border-b border-border py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase text-bronze">Professor GWLanguageFlow</p>
                <h1 className="mt-3 max-w-3xl font-display text-5xl font-bold leading-tight text-wine md:text-6xl">
                  Ensine com autonomia, sem perder estrutura.
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-brown">
                  A GWLanguageFlow combina perfil público, agenda, turmas, materiais, atividades,
                  secretaria pedagógica e carteira do professor em uma experiência profissional.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/auth/signup">
                    <Button className="h-12 rounded-lg bg-wine px-6 text-white shadow-bronze hover:bg-wine-deep">
                      Começar cadastro <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/sobre">
                    <Button
                      variant="outline"
                      className="h-12 rounded-lg border-wine/20 bg-white px-6 text-wine hover:bg-cream"
                    >
                      Conhecer o método
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="gw-ink-panel overflow-hidden rounded-xl text-white shadow-warm">
                <div className="border-b border-white/10 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold uppercase text-bronze">Painel do professor</p>
                      <h2 className="mt-1 font-display text-3xl font-bold text-white">
                        Operação da semana
                      </h2>
                    </div>
                    <GraduationCap className="h-8 w-8 text-bronze" />
                  </div>
                </div>
                <div className="grid gap-px bg-white/10 md:grid-cols-2">
                  {[
                    ["2", "aulas hoje"],
                    ["18", "alunos ativos"],
                    ["R$ 1.248", "saldo disponível"],
                    ["4", "atividades abertas"],
                  ].map(([value, label]) => (
                    <div key={label} className="bg-ink p-6">
                      <p className="font-display text-4xl font-bold text-bronze">{value}</p>
                      <p className="mt-1 text-sm text-white/65">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="p-6">
                  <div className="rounded-lg border border-white/10 bg-white/7 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck className="h-4 w-4 text-bronze" />
                      Modelo financeiro
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      A operação está preparada para remunerar 90% ao professor e 10% à plataforma,
                      com registro de recebimentos e solicitação de saque.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase text-bronze">Ferramentas de trabalho</p>
              <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-wine md:text-5xl">
                Um painel feito para professor operar, não só aparecer.
              </h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {teacherTools.map((tool) => (
                <div key={tool.title} className="gw-panel gw-lift rounded-xl p-6">
                  <tool.icon className="h-7 w-7 text-bronze" />
                  <h3 className="mt-5 font-display text-xl font-bold text-wine">{tool.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-brown-soft">{tool.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gw-paper border-y border-border py-16">
          <div className="container mx-auto px-4">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
              <div>
                <p className="text-sm font-bold uppercase text-bronze">Como você trabalha</p>
                <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-wine">
                  Estrutura para aula, relacionamento e receita.
                </h2>
                <p className="mt-4 leading-7 text-brown-soft">
                  O professor mantém autonomia, mas a experiência acontece dentro de um padrão de
                  qualidade que protege aluno, professor e plataforma.
                </p>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-soft">
                {[
                  {
                    icon: Users,
                    title: "Turmas e alunos agrupados",
                    text: "Perfis separados por turma para mensagem, nota, atividade e acompanhamento.",
                  },
                  {
                    icon: UploadCloud,
                    title: "Upload de materiais e atividades",
                    text: "Envie PDF, Word ou link com título, prazo e turma de destino.",
                  },
                  {
                    icon: Banknote,
                    title: "Recebimentos transparentes",
                    text: "Saldo disponível, total recebido e histórico de transferências via Pix.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="grid gap-4 border-b border-border p-6 last:border-b-0 md:grid-cols-[56px_1fr]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cream">
                      <item.icon className="h-6 w-6 text-bronze" />
                    </div>
                    <div>
                      <h3 className="font-display text-2xl font-bold text-wine">{item.title}</h3>
                      <p className="mt-2 leading-7 text-brown-soft">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl overflow-hidden rounded-xl bg-wine text-white shadow-warm">
              <div className="grid gap-px bg-white/10 md:grid-cols-[1fr_0.85fr]">
                <div className="bg-wine p-8 md:p-10">
                  <p className="text-sm font-bold uppercase text-bronze">Credenciamento</p>
                  <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-white">
                    Crie seu perfil e prepare sua vitrine profissional.
                  </h2>
                  <p className="mt-4 leading-7 text-white/76">
                    O perfil público já fica preparado para futuras publicações, imagem, legenda e
                    presença no feed de professores.
                  </p>
                  <Link to="/auth/signup" className="mt-7 inline-block">
                    <Button className="h-12 rounded-lg bg-bronze px-6 text-white hover:bg-white hover:text-wine">
                      Quero me cadastrar
                    </Button>
                  </Link>
                </div>
                <div className="space-y-4 bg-wine-deep/35 p-8 md:p-10">
                  {[
                    "Perfil público editável",
                    "Agenda por idioma e disponibilidade",
                    "Carteira com saque via Pix",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-bronze" />
                      <span className="text-sm text-white/82">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
