export const LANGUAGES = [
  "Inglês",
  "Espanhol",
  "Francês",
  "Italiano",
  "Alemão",
  "Português",
  "Mandarim",
  "Japonês",
  "Coreano",
  "Russo",
  "Árabe",
];

export const LEVELS = [
  { value: "iniciante", label: "Iniciante" },
  { value: "basico", label: "Básico" },
  { value: "intermediario", label: "Intermediário" },
  { value: "avancado", label: "Avançado" },
  { value: "fluente", label: "Fluente" },
] as const;

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function sortLanguagesByCatalog(languages: string[]) {
  const seen = new Set<string>();
  const normalized = languages
    .map((language) => language.trim())
    .filter((language) => {
      if (!language || seen.has(language)) return false;
      seen.add(language);
      return true;
    });

  return normalized.sort((a, b) => {
    const aIndex = LANGUAGES.indexOf(a);
    const bIndex = LANGUAGES.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b, "pt-BR");
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}
