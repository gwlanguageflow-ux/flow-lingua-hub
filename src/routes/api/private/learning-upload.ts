import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Enums } from "@/integrations/supabase/types";
import { checkRateLimit } from "@/server/rate-limit.server";

type AppRole = Enums<"app_role">;

const BUCKET = "learning-materials";
const MAX_SERVER_UPLOAD_BYTES = 20 * 1024 * 1024;
const allowedUploadRoles = new Set<AppRole>(["dev", "professor"]);

type AuthenticatedUploader = {
  id: string;
  roles: AppRole[];
};

function jsonResponse(payload: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function isSafeLearningPath(path: string, userId: string) {
  if (!path.startsWith(`${userId}/materials/`)) return false;
  if (path.includes("..") || path.includes("\\")) return false;
  return path.length <= 500;
}

async function requireUploader(request: Request): Promise<AuthenticatedUploader | Response> {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return jsonResponse({ error: "Sessao expirada. Entre novamente." }, { status: 401 });

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) {
    return jsonResponse({ error: "Sessao invalida. Entre novamente." }, { status: 401 });
  }

  const limit = checkRateLimit(`learning-upload:${user.id}`, 25, 60_000);
  if (!limit.allowed) {
    return jsonResponse(
      { error: "Muitas tentativas de upload. Aguarde um instante e tente novamente." },
      { status: 429 },
    );
  }

  const { data: roleRows, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (rolesError) {
    return jsonResponse({ error: "Nao foi possivel validar suas permissoes." }, { status: 500 });
  }

  const roles = (roleRows ?? []).map((item) => item.role);
  if (!roles.some((role) => allowedUploadRoles.has(role))) {
    return jsonResponse(
      { error: "Somente professores e diretoria podem enviar materiais e exercicios." },
      { status: 403 },
    );
  }

  return { id: user.id, roles };
}

async function createSignedUpload(request: Request, uploader: AuthenticatedUploader) {
  const payload = (await request.json().catch(() => null)) as {
    path?: string;
    name?: string;
    mimeType?: string;
    size?: number;
  } | null;

  const fileName = safeFileName(payload?.name ?? "arquivo");
  const path = payload?.path || `${uploader.id}/materials/${Date.now()}-${fileName}`;
  const mimeType = payload?.mimeType || "application/octet-stream";

  if (!isSafeLearningPath(path, uploader.id)) {
    return jsonResponse({ error: "Caminho de arquivo invalido." }, { status: 400 });
  }

  if (payload?.size && payload.size > 500 * 1024 * 1024) {
    return jsonResponse({ error: "Arquivo muito grande para envio." }, { status: 413 });
  }

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) {
    return jsonResponse(
      { error: error?.message ?? "Nao foi possivel preparar o envio do arquivo." },
      { status: 500 },
    );
  }

  return jsonResponse({
    path,
    token: data.token,
    name: payload?.name || fileName || "arquivo",
    mimeType,
  });
}

async function uploadThroughServer(request: Request, uploader: AuthenticatedUploader) {
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const requestedPath = formData?.get("path");
  const requestedMimeType = formData?.get("mimeType");

  if (!(file instanceof File)) {
    return jsonResponse({ error: "Arquivo nao recebido." }, { status: 400 });
  }

  if (file.size > MAX_SERVER_UPLOAD_BYTES) {
    return jsonResponse(
      {
        error:
          "Arquivo grande demais para o envio auxiliar. Tente novamente ou use um arquivo menor.",
      },
      { status: 413 },
    );
  }

  const fileName = safeFileName(file.name || "arquivo");
  const path =
    typeof requestedPath === "string" && requestedPath
      ? requestedPath
      : `${uploader.id}/materials/${Date.now()}-${fileName}`;

  if (!isSafeLearningPath(path, uploader.id)) {
    return jsonResponse({ error: "Caminho de arquivo invalido." }, { status: 400 });
  }

  const mimeType =
    typeof requestedMimeType === "string" && requestedMimeType
      ? requestedMimeType
      : file.type || "application/octet-stream";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, {
    cacheControl: "3600",
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    return jsonResponse({ error: error.message }, { status: 500 });
  }

  return jsonResponse({
    path,
    name: file.name || fileName || "arquivo",
    mimeType,
  });
}

export const Route = createFileRoute("/api/private/learning-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const uploader = await requireUploader(request);
        if (uploader instanceof Response) return uploader;

        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          return createSignedUpload(request, uploader);
        }

        return uploadThroughServer(request, uploader);
      },
    },
  },
});
