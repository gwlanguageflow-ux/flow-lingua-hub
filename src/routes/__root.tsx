import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { CookieConsent } from "@/components/CookieConsent";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-wine">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-bronze px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-wine"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "GWLanguageFlow — Aulas de idiomas com professores apaixonados" },
      {
        name: "description",
        content:
          "Marketplace de aulas de idiomas. Encontre o professor ideal e aprenda no seu ritmo.",
      },
      {
        property: "og:title",
        content: "GWLanguageFlow — Aulas de idiomas com professores apaixonados",
      },
      {
        property: "og:description",
        content:
          "Marketplace de aulas de idiomas. Encontre o professor ideal e aprenda no seu ritmo.",
      },
      { property: "og:type", content: "website" },
      {
        name: "twitter:title",
        content: "GWLanguageFlow — Aulas de idiomas com professores apaixonados",
      },
      {
        name: "twitter:description",
        content:
          "Marketplace de aulas de idiomas. Encontre o professor ideal e aprenda no seu ritmo.",
      },
      {
        property: "og:image",
        content: "/logo-gwenglishflow-social.png",
      },
      {
        name: "twitter:image",
        content: "/logo-gwenglishflow-social.png",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/logo-gwenglishflow-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <CookieConsent />
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
