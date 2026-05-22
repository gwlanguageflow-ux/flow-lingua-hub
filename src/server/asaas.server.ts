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

export function getAsaasWebhookToken() {
  return readSecretEnv("ASAAS_WEBHOOK_TOKEN", "ASAAS_WEBHOOK_SECRET");
}

export function requireAsaasConfig() {
  const apiKey = readSecretEnv("ASAAS_API_KEY", "ASAAS_ACCESS_TOKEN", "ASAAS_API_TOKEN");
  if (!apiKey) {
    throw new Error(
      "Asaas nao configurado. A variavel ASAAS_API_KEY esta ausente ou vazia no runtime da Vercel.",
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
