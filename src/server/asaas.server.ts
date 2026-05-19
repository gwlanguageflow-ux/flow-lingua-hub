type AsaasEnvironment = "sandbox" | "production";
type JsonBody = Record<string, unknown>;

export type AsaasPixAddressKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export type AsaasTransferResponse = {
  id: string;
  status?: string | null;
  value?: number | null;
  netValue?: number | null;
  transferFee?: number | null;
  effectiveDate?: string | null;
  transactionReceiptUrl?: string | null;
  failReason?: string | null;
  [key: string]: unknown;
};

export type AsaasCustomerResponse = {
  id: string;
  name?: string | null;
  email?: string | null;
  cpfCnpj?: string | null;
  [key: string]: unknown;
};

export type AsaasPixAutomaticAuthorizationResponse = {
  id: string;
  status?: string | null;
  customerId?: string | null;
  immediateQrCode?: {
    payload?: string | null;
    encodedImage?: string | null;
    expirationDate?: string | null;
    conciliationIdentifier?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type AsaasPaymentResponse = {
  id: string;
  status?: string | null;
  value?: number | null;
  dueDate?: string | null;
  invoiceUrl?: string | null;
  externalReference?: string | null;
  [key: string]: unknown;
};

function getEnvironment(): AsaasEnvironment {
  return process.env.ASAAS_ENVIRONMENT === "production" ? "production" : "sandbox";
}

export function isAsaasConfigured() {
  return Boolean(process.env.ASAAS_API_KEY?.trim());
}

export function getAsaasWebhookToken() {
  return process.env.ASAAS_WEBHOOK_TOKEN?.trim() ?? "";
}

export function requireAsaasConfig() {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Asaas nao configurado. Adicione ASAAS_API_KEY na Vercel antes de usar Pix automatico ou saque Pix automatico.",
    );
  }

  const baseUrl =
    process.env.ASAAS_API_BASE_URL?.trim() ??
    (getEnvironment() === "production"
      ? "https://api.asaas.com/v3"
      : "https://api-sandbox.asaas.com/v3");

  return { apiKey, baseUrl };
}

async function asaasRequest<T>(path: string, init: RequestInit = {}) {
  const { apiKey, baseUrl } = requireAsaasConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "GWLanguageFlow/1.0",
      access_token: apiKey,
      ...(init.headers ?? {}),
    },
  });

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
    const message =
      typeof body === "object" &&
      body !== null &&
      "errors" in body &&
      Array.isArray((body as { errors?: unknown }).errors)
        ? (body as { errors: Array<{ description?: string; message?: string }> }).errors
            .map((item) => item.description ?? item.message)
            .filter(Boolean)
            .join(" | ")
        : `Asaas retornou HTTP ${response.status}`;
    throw new Error(message || `Asaas retornou HTTP ${response.status}`);
  }

  return body as T;
}

export function inferAsaasPixAddressKeyType(value: string): AsaasPixAddressKeyType {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "EMAIL";
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  if (digits.length >= 10 && digits.length <= 13) return "PHONE";
  return "EVP";
}

export async function createAsaasPixTransfer(input: {
  amount: number;
  pixKey: string;
  description: string;
  externalReference: string;
}) {
  const body: JsonBody = {
    value: Number(input.amount.toFixed(2)),
    operationType: "PIX",
    pixAddressKey: input.pixKey.trim(),
    pixAddressKeyType: inferAsaasPixAddressKeyType(input.pixKey),
    description: input.description.slice(0, 140),
    externalReference: input.externalReference.slice(0, 255),
  };

  return asaasRequest<AsaasTransferResponse>("/transfers", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function findAsaasCustomerByExternalReference(externalReference: string) {
  const params = new URLSearchParams({ externalReference, limit: "1" });
  const response = await asaasRequest<{ data?: AsaasCustomerResponse[] }>(`/customers?${params}`, {
    method: "GET",
  });
  return response.data?.[0] ?? null;
}

export async function createAsaasCustomer(input: {
  name: string;
  cpfCnpj: string;
  email?: string | null;
  externalReference: string;
}) {
  const existing = await findAsaasCustomerByExternalReference(input.externalReference);
  if (existing?.id) return existing;

  return asaasRequest<AsaasCustomerResponse>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
      email: input.email ?? undefined,
      externalReference: input.externalReference,
      notificationDisabled: true,
    }),
  });
}

export async function createAsaasPixAutomaticAuthorization(input: {
  customerId: string;
  contractId: string;
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
  startDate: string;
  finishDate?: string | null;
  value: number;
  description: string;
}) {
  return asaasRequest<AsaasPixAutomaticAuthorizationResponse>("/pix/automatic/authorizations", {
    method: "POST",
    body: JSON.stringify({
      customerId: input.customerId,
      contractId: input.contractId,
      frequency: input.frequency,
      startDate: input.startDate,
      finishDate: input.finishDate ?? undefined,
      value: Number(input.value.toFixed(2)),
      description: input.description.slice(0, 35),
      immediateQrCode: {
        paymentCreationMode: "SUBSCRIPTION",
      },
    }),
  });
}

export async function createAsaasPixAutomaticPayment(input: {
  customerId: string;
  authorizationId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}) {
  return asaasRequest<AsaasPaymentResponse>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: input.customerId,
      billingType: "PIX",
      value: Number(input.value.toFixed(2)),
      dueDate: input.dueDate,
      description: input.description.slice(0, 500),
      externalReference: input.externalReference.slice(0, 255),
      pixAutomaticAuthorizationId: input.authorizationId,
    }),
  });
}
