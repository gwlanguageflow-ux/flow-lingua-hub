export const COOKIE_CONSENT_STORAGE_KEY = "gwlf_cookie_consent_v2026_05_19";
export const COOKIE_VISITOR_STORAGE_KEY = "gwlf_privacy_visitor_id";
export const POLICY_VERSION = "2026.05.19";
export const PRIVACY_POLICY_VERSION = "2026.05.19";
export const COOKIES_POLICY_VERSION = "2026.05.19";

export type ConsentCategory =
  | "necessary"
  | "analytics"
  | "marketing"
  | "preferences"
  | "third_parties";

export type ConsentCategoryState = Record<ConsentCategory, boolean>;

export type StoredConsent = {
  categories: ConsentCategoryState;
  acceptedAll: boolean;
  rejectedAll: boolean;
  policyVersion: string;
  privacyPolicyVersion: string;
  cookiesPolicyVersion: string;
  createdAt: string;
  visitorId: string;
};

export const consentCategoryLabels: Record<ConsentCategory, string> = {
  necessary: "Necessários",
  analytics: "Analíticos",
  marketing: "Marketing",
  preferences: "Preferências",
  third_parties: "Terceiros",
};

export const consentCategoryDescriptions: Record<ConsentCategory, string> = {
  necessary:
    "Mantêm login, segurança, checkout, preferências essenciais e funcionamento da plataforma.",
  analytics: "Permitem medir uso e estabilidade quando uma ferramenta analítica for habilitada.",
  marketing: "Liberam pixels, campanhas e mensuração de anúncios apenas depois da autorização.",
  preferences: "Guardam escolhas de interface, como ajustes de navegação e experiência.",
  third_parties:
    "Autorizam integrações não essenciais fora da GWLanguageFlow, quando configuradas.",
};

export const defaultConsentCategories: ConsentCategoryState = {
  necessary: true,
  analytics: false,
  marketing: false,
  preferences: false,
  third_parties: false,
};

export function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateVisitorId() {
  if (typeof window === "undefined") return createVisitorId();
  const current = window.localStorage.getItem(COOKIE_VISITOR_STORAGE_KEY);
  if (current) return current;
  const next = createVisitorId();
  window.localStorage.setItem(COOKIE_VISITOR_STORAGE_KEY, next);
  return next;
}

export function readStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    if (
      parsed.policyVersion !== POLICY_VERSION ||
      parsed.privacyPolicyVersion !== PRIVACY_POLICY_VERSION ||
      parsed.cookiesPolicyVersion !== COOKIES_POLICY_VERSION
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredConsent(consent: Omit<StoredConsent, "createdAt" | "visitorId">) {
  const stored: StoredConsent = {
    ...consent,
    createdAt: new Date().toISOString(),
    visitorId: getOrCreateVisitorId(),
  };
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(stored));
  window.dispatchEvent(new CustomEvent("gwlf:cookie-consent-updated", { detail: stored }));
  return stored;
}

export function clearStoredConsent() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("gwlf:cookie-consent-updated"));
}

export function hasConsentFor(category: ConsentCategory) {
  if (category === "necessary") return true;
  return readStoredConsent()?.categories[category] === true;
}
