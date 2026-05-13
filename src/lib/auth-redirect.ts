export function getAuthRedirectUrl(path: string) {
  const configuredOrigin =
    import.meta.env.VITE_APP_URL || process.env.VITE_APP_URL || process.env.APP_URL;
  const origin =
    configuredOrigin?.replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${origin}${normalizedPath}`;
}
