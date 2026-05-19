import { useEffect } from "react";
import { hasConsentFor, type ConsentCategory } from "@/lib/cookie-consent";

type ConsentScriptProps = {
  id: string;
  src: string;
  category: Exclude<ConsentCategory, "necessary">;
  async?: boolean;
  defer?: boolean;
};

export function ConsentScript({
  id,
  src,
  category,
  async = true,
  defer = true,
}: ConsentScriptProps) {
  useEffect(() => {
    const load = () => {
      if (!hasConsentFor(category)) return;
      if (document.getElementById(id)) return;

      const script = document.createElement("script");
      script.id = id;
      script.src = src;
      script.async = async;
      script.defer = defer;
      script.dataset.consentCategory = category;
      document.head.appendChild(script);
    };

    load();
    window.addEventListener("gwlf:cookie-consent-updated", load);
    return () => window.removeEventListener("gwlf:cookie-consent-updated", load);
  }, [async, category, defer, id, src]);

  return null;
}
