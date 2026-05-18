// Server-only Stripe client. Do NOT import from client code.
import Stripe from "stripe";

let _stripe: Stripe | undefined;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY nao configurada");
    _stripe = new Stripe(key);
  }
  return _stripe;
}
