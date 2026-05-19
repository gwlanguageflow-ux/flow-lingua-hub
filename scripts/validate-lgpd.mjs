import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const requiredFiles = [
  "docs/lgpd-data-map.md",
  "docs/third-party-processors.md",
  "src/components/CookieConsent.tsx",
  "src/components/ConsentScript.tsx",
  "src/routes/privacidade.tsx",
  "src/routes/admin.lgpd.tsx",
  "src/routes/politica-de-privacidade.tsx",
  "src/routes/politica-de-cookies.tsx",
  "src/routes/termos-de-uso.tsx",
  "src/routes/politica-de-retencao.tsx",
  "src/routes/seguranca.tsx",
  "src/routes/menores.tsx",
  "src/routes/api/public/consent.ts",
  "src/routes/api/public/security-event.ts",
  "src/routes/api/internal/lgpd-retention.ts",
  "supabase/migrations/20260519120000_lgpd_compliance_controls.sql",
];

const requiredTables = [
  "public.consents",
  "public.privacy_requests",
  "public.policy_versions",
  "public.audit_logs",
  "public.user_sessions",
  "public.security_events",
  "public.data_retention_rules",
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Arquivo obrigatorio ausente: ${file}`);
}

const migration = read("supabase/migrations/20260519120000_lgpd_compliance_controls.sql");
for (const table of requiredTables) {
  if (!migration.includes(table)) failures.push(`Tabela nao encontrada na migration: ${table}`);
}

for (const token of [
  "ENABLE ROW LEVEL SECURITY",
  "retention_cleanup_lgpd",
  "anonymize_profile_lgpd",
]) {
  if (!migration.includes(token)) failures.push(`Controle de banco ausente: ${token}`);
}

const cookieConsent = read("src/components/CookieConsent.tsx");
for (const category of ["necessary", "analytics", "marketing", "preferences", "third_parties"]) {
  if (!cookieConsent.includes(category))
    failures.push(`Categoria de consentimento ausente: ${category}`);
}

const rootRoute = read("src/routes/__root.tsx");
if (!rootRoute.includes("<CookieConsent />"))
  failures.push("Banner de cookies nao foi montado no root.");

const vercel = read("vercel.json");
for (const header of [
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
]) {
  if (!vercel.includes(header)) failures.push(`Header de seguranca ausente: ${header}`);
}
if (!vercel.includes("/api/internal/lgpd-retention")) {
  failures.push("Cron de retencao LGPD nao esta configurado.");
}

const sourceSurface = [
  "src/routes/__root.tsx",
  "src/components/ConsentScript.tsx",
  "src/lib/legal-content.ts",
]
  .map(read)
  .join("\n");
for (const directScript of ["googletagmanager.com", "connect.facebook.net", "fbq(", "gtag("]) {
  if (sourceSurface.includes(directScript)) {
    failures.push(`Script externo nao essencial encontrado fora do consentimento: ${directScript}`);
  }
}

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Validacao LGPD tecnica concluida com sucesso.");

function read(file) {
  return readFileSync(join(root, file), "utf8");
}
