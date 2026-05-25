type JsonBody = Record<string, unknown>;

export type ValidapayPixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

type ValidapayEnvironment = "production" | "sandbox";

type ValidapayToken = {
  access_token: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export type ValidapayCheckoutSession = {
  id: string;
  url: string;
  priceId: string;
  [key: string]: unknown;
};

export type ValidapayProductResponse = {
  productId: string;
  prices?: Array<{
    priceId?: string;
    recurrenceType?: string;
    amount?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type ValidapayWithdrawalResponse = {
  withdrawalId: string;
  status?: string | null;
  amount?: number | null;
  accountNumber?: string | null;
  receiptUrl?: string | null;
  [key: string]: unknown;
};

let cachedToken:
  | {
      value: string;
      expiresAt: number;
      scope: string;
      environment: ValidapayEnvironment;
    }
  | undefined;

function readSecretEnv(...names: string[]) {
  for (const name of names) {
    const direct = process.env[name]?.trim();
    if (direct) return direct;
  }

  const normalizedNames = new Set(names.map((name) => name.trim().toUpperCase()));
  for (const [key, value] of Object.entries(process.env)) {
    if (normalizedNames.has(key.trim().toUpperCase())) {
      const secret = value?.trim();
      if (secret) return secret;
    }
  }

  return "";
}

function getValidapayEnvironment(): ValidapayEnvironment {
  const value = readSecretEnv("VALIDAPAY_ENVIRONMENT", "VALIDAPAY_AMBIENTE").toLowerCase();
  return value === "sandbox" ? "sandbox" : "production";
}

function getValidapayBases(environment = getValidapayEnvironment()) {
  if (environment === "sandbox") {
    return {
      apiBaseUrl: "https://sandbox.validapay.com.br",
      oauthBaseUrl: "https://oauth2-sandbox.validapay.com.br",
    };
  }

  return {
    apiBaseUrl: "https://api.validapay.com.br",
    oauthBaseUrl: "https://oauth2.validapay.com.br",
  };
}

export function getValidapayWebhookToken() {
  return readSecretEnv("VALIDAPAY_WEBHOOK_TOKEN", "VALIDAPAY_WEBHOOK_SECRET");
}

export function requireValidapayConfig() {
  const clientId = readSecretEnv("VALIDAPAY_CLIENT_ID");
  const clientSecret = readSecretEnv("VALIDAPAY_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "ValidaPay não configurado. Adicione VALIDAPAY_CLIENT_ID e VALIDAPAY_CLIENT_SECRET na Vercel.",
    );
  }

  return {
    clientId,
    clientSecret,
    environment: getValidapayEnvironment(),
    ...getValidapayBases(),
  };
}

async function getValidapayAccessToken(scope: string) {
  const config = requireValidapayConfig();
  const now = Date.now();
  if (
    cachedToken &&
    cachedToken.scope === scope &&
    cachedToken.environment === config.environment &&
    cachedToken.expiresAt > now + 60_000
  ) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope,
  });

  const response = await fetch(`${config.oauthBaseUrl}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "GWLanguageFlow/1.0",
    },
    body,
  });

  const token = await parseValidapayResponse<ValidapayToken>(response, "ValidaPay OAuth");
  if (!token.access_token) throw new Error("ValidaPay não retornou access_token.");

  cachedToken = {
    value: token.access_token,
    expiresAt: now + Math.max(Number(token.expires_in ?? 3000) - 60, 60) * 1000,
    scope,
    environment: config.environment,
  };

  return token.access_token;
}

async function parseValidapayResponse<T>(response: Response, context: string) {
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  if (!response.ok) {
    const errorBody = body as { error?: { message?: string; code?: string }; message?: string };
    const message =
      errorBody?.error?.message ??
      errorBody?.message ??
      `${context} retornou HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as T;
}

async function validapayRequest<T>(path: string, scope: string, init: RequestInit = {}) {
  const config = requireValidapayConfig();
  const token = await getValidapayAccessToken(scope);
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "GWLanguageFlow/1.0",
      ...(init.headers ?? {}),
    },
  });

  return parseValidapayResponse<T>(response, `ValidaPay ${path}`);
}

export function inferValidapayPixKeyType(value: string): ValidapayPixKeyType {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "EMAIL";
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  if (digits.length >= 10 && digits.length <= 13) return "PHONE";
  return "EVP";
}

export function mapValidapayWithdrawalStatus(status: string | null | undefined) {
  const normalized = status?.trim().toUpperCase();
  if (normalized === "DONE" || normalized === "COMPLETED" || normalized === "PAID") return "pago";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "cancelado";
  if (normalized === "FAILED" || normalized === "ERROR" || normalized === "REJECTED") {
    return "falhou";
  }
  return "em_processamento";
}

export function validapayPaymentMethod(method: "card" | "pix") {
  return method === "card" ? "creditcard" : "pix";
}

export function validapayRecurrenceType(interval: "mensal" | "trimestral" | "anual") {
  if (interval === "anual") return "YEARLY";
  return "MONTHLY";
}

export function validapayRecurrenceInterval(interval: "mensal" | "trimestral" | "anual") {
  return interval === "trimestral" ? 3 : 1;
}

export async function createValidapayProduct(input: {
  name: string;
  description: string | null;
  slug: string;
  amount: number;
  interval: "mensal" | "trimestral" | "anual";
}) {
  const recurrenceType = validapayRecurrenceType(input.interval);
  const recurrenceInterval = validapayRecurrenceInterval(input.interval);
  const body: JsonBody = {
    name: `${input.name} - GWLanguageFlow`,
    description: input.description ?? `Plano ${input.name} GWLanguageFlow`,
    statementDescriptor: "GWLANGUAGE",
    metadata: { externalId: input.slug },
    prices: [
      {
        title: input.name,
        recurrenceType,
        recurrenceInterval,
        description: input.description ?? input.name,
        amount: Number(input.amount.toFixed(2)),
      },
    ],
  };

  return validapayRequest<ValidapayProductResponse>("/v1/products", "products/write", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createValidapayCheckoutSession(input: {
  priceId: string;
  paymentMethod: "card" | "pix";
  customer: {
    email?: string | null;
    documentNumber?: string | null;
  };
}) {
  const customer: JsonBody = {};
  if (input.customer.email) customer.email = input.customer.email;
  if (input.customer.documentNumber) {
    customer.documentNumber = input.customer.documentNumber.replace(/\D/g, "");
  }

  const body: JsonBody = {
    priceId: input.priceId,
    allowedPaymentMethods: [validapayPaymentMethod(input.paymentMethod)],
  };
  if (Object.keys(customer).length) body.customer = customer;

  return validapayRequest<ValidapayCheckoutSession>("/v1/checkouts/session", "checkouts/write", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function createValidapayPixWithdrawal(input: {
  amount: number;
  pixKey: string;
  accountId?: string | null;
}) {
  const body: JsonBody = {
    amount: Number(input.amount.toFixed(2)),
    pixKey: input.pixKey.trim(),
    pixKeyType: inferValidapayPixKeyType(input.pixKey),
  };
  if (input.accountId) body.accountId = input.accountId;

  return validapayRequest<ValidapayWithdrawalResponse>("/v1/wallet/withdraw", "wallet/write", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
