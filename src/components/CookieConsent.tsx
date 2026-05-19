import { useEffect, useMemo, useState } from "react";
import { Cookie, Settings2, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COOKIES_POLICY_VERSION,
  POLICY_VERSION,
  PRIVACY_POLICY_VERSION,
  consentCategoryDescriptions,
  consentCategoryLabels,
  defaultConsentCategories,
  readStoredConsent,
  saveStoredConsent,
  type ConsentCategory,
  type ConsentCategoryState,
  type StoredConsent,
} from "@/lib/cookie-consent";

const categoryOrder: ConsentCategory[] = [
  "necessary",
  "analytics",
  "marketing",
  "preferences",
  "third_parties",
];

async function persistConsent(consent: StoredConsent) {
  await fetch("/api/public/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitorId: consent.visitorId,
      categories: consent.categories,
      acceptedAll: consent.acceptedAll,
      rejectedAll: consent.rejectedAll,
    }),
  }).catch(() => undefined);
}

export function CookieConsent() {
  const [stored, setStored] = useState<StoredConsent | null>(null);
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [categories, setCategories] = useState<ConsentCategoryState>(defaultConsentCategories);

  useEffect(() => {
    const current = readStoredConsent();
    setStored(current);
    setOpen(!current);
    if (current) setCategories(current.categories);
  }, []);

  const hasDecision = !!stored;
  const allOptionalEnabled = useMemo(
    () => categoryOrder.every((category) => categories[category]),
    [categories],
  );

  const applyConsent = async (
    nextCategories: ConsentCategoryState,
    mode: "all" | "reject" | "custom",
  ) => {
    const normalized = { ...nextCategories, necessary: true };
    const next = saveStoredConsent({
      categories: normalized,
      acceptedAll: mode === "all",
      rejectedAll: mode === "reject",
      policyVersion: POLICY_VERSION,
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      cookiesPolicyVersion: COOKIES_POLICY_VERSION,
    });
    setStored(next);
    setCategories(normalized);
    setOpen(false);
    setCustomizing(false);
    await persistConsent(next);
  };

  const acceptAll = () =>
    applyConsent(
      {
        necessary: true,
        analytics: true,
        marketing: true,
        preferences: true,
        third_parties: true,
      },
      "all",
    );

  const rejectAll = () => applyConsent(defaultConsentCategories, "reject");
  const saveCustom = () => applyConsent(categories, allOptionalEnabled ? "all" : "custom");

  if (!open && hasDecision) {
    return (
      <button
        type="button"
        onClick={() => {
          setCategories(readStoredConsent()?.categories ?? defaultConsentCategories);
          setOpen(true);
          setCustomizing(true);
        }}
        className="fixed bottom-4 left-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-wine/15 bg-white text-wine shadow-soft transition hover:-translate-y-0.5 hover:border-bronze"
        aria-label="Preferências de cookies"
      >
        <Cookie className="h-5 w-5" />
      </button>
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-5 sm:pb-5">
      <div className="mx-auto max-w-5xl rounded-xl border border-wine/12 bg-white shadow-2xl">
        <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream text-bronze">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-wine">Privacidade e cookies</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-brown-soft">
                Usamos cookies necessários para login, segurança e funcionamento. Analytics,
                marketing, preferências e terceiros só são liberados com sua autorização.
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-brown-soft">
                <a href="/politica-de-cookies" className="text-bronze hover:text-wine">
                  Política de Cookies
                </a>
                <a href="/politica-de-privacidade" className="text-bronze hover:text-wine">
                  Política de Privacidade
                </a>
                <span>Versão {POLICY_VERSION}</span>
              </div>
            </div>
          </div>

          {hasDecision && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-brown-soft hover:bg-cream hover:text-wine md:static"
              aria-label="Fechar preferências de cookies"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {customizing && (
          <div className="border-t border-border px-4 py-4 sm:px-5">
            <div className="grid gap-3 md:grid-cols-2">
              {categoryOrder.map((category) => (
                <label
                  key={category}
                  className="flex cursor-pointer gap-3 rounded-xl border border-border bg-cream/60 p-3"
                >
                  <input
                    type="checkbox"
                    checked={categories[category]}
                    disabled={category === "necessary"}
                    onChange={(event) =>
                      setCategories((current) => ({
                        ...current,
                        [category]: event.target.checked,
                        necessary: true,
                      }))
                    }
                    className="mt-1 h-4 w-4 accent-wine"
                  />
                  <span>
                    <span className="block text-sm font-bold text-wine">
                      {consentCategoryLabels[category]}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-brown-soft">
                      {consentCategoryDescriptions[category]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:justify-end sm:p-5">
          <Button type="button" variant="outline" onClick={rejectAll} className="rounded-lg">
            Rejeitar todos
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCustomizing((value) => !value)}
            className="rounded-lg"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Personalizar
          </Button>
          {customizing ? (
            <Button type="button" onClick={saveCustom} className="rounded-lg bg-wine text-white">
              Salvar preferências
            </Button>
          ) : (
            <Button type="button" onClick={acceptAll} className="rounded-lg bg-wine text-white">
              Aceitar todos
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
