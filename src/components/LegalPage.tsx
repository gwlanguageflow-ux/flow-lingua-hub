import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { legalNavigation, type LegalPageContent } from "@/lib/legal-content";

export function LegalPage({ page }: { page: LegalPageContent }) {
  const Icon = page.icon;

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-wine/10 bg-white/90 backdrop-blur">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/privacidade">
              Central de Privacidade
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-xl border border-border bg-white p-3 shadow-soft lg:sticky lg:top-6">
          <Button asChild variant="ghost" className="mb-2 w-full justify-start rounded-lg">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Início
            </Link>
          </Button>
          <nav className="grid gap-1">
            {legalNavigation.map((item) => (
              <a
                key={item.slug}
                href={`/${item.slug}`}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  item.slug === page.slug
                    ? "bg-wine text-white"
                    : "text-brown-soft hover:bg-cream hover:text-wine"
                }`}
              >
                {item.title}
              </a>
            ))}
          </nav>
        </aside>

        <article className="rounded-xl border border-border bg-white p-5 shadow-soft md:p-8">
          <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-start">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cream text-bronze">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-bronze">
                Versão {page.version} • Atualizada em {page.updatedAt}
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold text-wine md:text-5xl">
                {page.title}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-brown-soft">{page.summary}</p>
            </div>
          </div>

          <div className="mt-7 space-y-7">
            {page.sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-display text-2xl font-bold text-wine">{section.title}</h2>
                <div className="mt-3 space-y-3">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-7 text-brown md:text-base">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
