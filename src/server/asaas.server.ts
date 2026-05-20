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

export function getAsaasWebhookToken() {
  return process.env.ASAAS_WEBHOOK_TOKEN?.trim() ?? "";
}

export function requireAsaasConfig() {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Asaas nao configurado. Adicione ASAAS_API_KEY na Vercel antes de usar saque Pix automatico.",
    );
  }

  const baseUrl = "https://api.asaas.com/v3";

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
    let message =
      typeof body === "object" &&
      body !== null &&
      "errors" in body &&
      Array.isArray((body as { errors?: unknown }).errors)
        ? (body as { errors: Array<{ description?: string; message?: string }> }).errors
            .map((item) => item.description ?? item.message)
            .filter(Boolean)
            .join(" | ")
        : `Asaas retornou HTTP ${response.status}`;
    if (response.status === 403 && message === "Asaas retornou HTTP 403") {
      message =
        "Asaas retornou HTTP 403. Verifique se a chave pertence ao ambiente correto e se o recurso solicitado esta liberado na conta Asaas.";
    }
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
