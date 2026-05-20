// Server-only Stripe client. Do NOT import from client code.
import Stripe from "stripe";

let _stripe: Stripe | undefined;

function requireLiveStripeKeyInProduction(key: string) {
  if (process.env.NODE_ENV !== "production") return;
  if (key.startsWith("sk_test_") || key.startsWith("rk_test_")) {
    throw new Error("Configure STRIPE_SECRET_KEY com uma chave live da Stripe.");
  }
  if (!key.startsWith("sk_live_") && !key.startsWith("rk_live_")) {
    throw new Error("STRIPE_SECRET_KEY de producao invalida. Use uma chave live da Stripe.");
  }
}

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY nao configurada");
    requireLiveStripeKeyInProduction(key);
    _stripe = new Stripe(key);
  }
  return _stripe;
}
