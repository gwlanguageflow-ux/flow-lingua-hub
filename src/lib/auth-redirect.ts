import { getProcessEnv } from "@/lib/env";

const DEFAULT_PUBLIC_APP_URL = "https://gwlanguageflow.com.br";

export function getAuthRedirectUrl(path: string) {
  const configuredOrigin =
    import.meta.env.VITE_APP_URL || getProcessEnv("VITE_APP_URL") || getProcessEnv("APP_URL");
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : configuredOrigin?.replace(/\/+$/, "") || DEFAULT_PUBLIC_APP_URL;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${origin}${normalizedPath}`;
}
