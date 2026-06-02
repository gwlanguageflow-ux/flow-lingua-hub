import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { checkRateLimit } from "@/server/rate-limit.server";

type AppRole = Enums<"app_role">;
type ClassMaterial = Pick<
  Tables<"class_materials">,
  | "class_id"
  | "created_by"
  | "file_mime_type"
  | "file_name"
  | "file_path"
  | "source"
  | "student_id"
  | "teacher_id"
>;
type ClassAssignment = Pick<
  Tables<"class_assignments">,
  "class_id" | "file_mime_type" | "file_name" | "file_path" | "student_id" | "teacher_id"
>;

const BUCKET = "learning-materials";
const PDF_MIME_TYPE = "application/pdf";

type AuthenticatedViewer = {
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

function isSafeLearningPath(path: string) {
  if (!path || path.includes("..") || path.includes("\\")) return false;
  return path.length <= 500 && path.toLowerCase().endsWith(".pdf");
}

function isPdfResource(resource: { file_mime_type: string | null; file_name: string | null }) {
  return (
    resource.file_mime_type === PDF_MIME_TYPE ||
    Boolean(resource.file_name?.toLowerCase().endsWith(".pdf"))
  );
}

async function requireViewer(request: Request): Promise<AuthenticatedViewer | Response> {
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

  const limit = checkRateLimit(`learning-file:${user.id}`, 80, 60_000);
  if (!limit.allowed) {
    return jsonResponse(
      { error: "Muitas tentativas de abertura. Aguarde um instante e tente novamente." },
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

  return { id: user.id, roles: (roleRows ?? []).map((item) => item.role) };
}

async function userIsClassMember(userId: string, classId: string | null) {
  if (!classId) return false;
  const { data, error } = await supabaseAdmin
    .from("class_members")
    .select("id")
    .eq("class_id", classId)
    .eq("student_id", userId)
    .eq("status", "ativo")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function userOwnsClass(userId: string, classId: string | null) {
  if (!classId) return false;
  const { data, error } = await supabaseAdmin
    .from("class_groups")
    .select("id")
    .eq("id", classId)
    .eq("teacher_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function canAccessMaterial(viewer: AuthenticatedViewer, material: ClassMaterial) {
  if (viewer.roles.includes("dev")) return true;
  if (!isPdfResource(material)) return false;
  if (material.created_by === viewer.id || material.teacher_id === viewer.id) return true;
  if (material.student_id === viewer.id) return true;
  if (
    material.source === "platform" &&
    viewer.roles.some((role) => role === "aluno" || role === "professor")
  ) {
    return true;
  }
  if (await userIsClassMember(viewer.id, material.class_id)) return true;
  return userOwnsClass(viewer.id, material.class_id);
}

async function canAccessAssignment(viewer: AuthenticatedViewer, assignment: ClassAssignment) {
  if (viewer.roles.includes("dev")) return true;
  if (!isPdfResource(assignment)) return false;
  if (assignment.teacher_id === viewer.id || assignment.student_id === viewer.id) return true;
  if (await userIsClassMember(viewer.id, assignment.class_id)) return true;
  return userOwnsClass(viewer.id, assignment.class_id);
}

async function hasAccessToPath(viewer: AuthenticatedViewer, path: string) {
  const [{ data: materials, error: materialError }, { data: assignments, error: assignmentError }] =
    await Promise.all([
      supabaseAdmin
        .from("class_materials")
        .select(
          "class_id,created_by,file_mime_type,file_name,file_path,source,student_id,teacher_id",
        )
        .eq("file_path", path),
      supabaseAdmin
        .from("class_assignments")
        .select("class_id,file_mime_type,file_name,file_path,student_id,teacher_id")
        .eq("file_path", path),
    ]);

  if (materialError) throw new Error(materialError.message);
  if (assignmentError) throw new Error(assignmentError.message);

  for (const material of (materials ?? []) as ClassMaterial[]) {
    if (await canAccessMaterial(viewer, material)) return true;
  }

  for (const assignment of (assignments ?? []) as ClassAssignment[]) {
    if (await canAccessAssignment(viewer, assignment)) return true;
  }

  return false;
}

export const Route = createFileRoute("/api/private/learning-file")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const viewer = await requireViewer(request);
        if (viewer instanceof Response) return viewer;

        const payload = (await request.json().catch(() => null)) as { path?: string } | null;
        const path = payload?.path?.trim() ?? "";

        if (!isSafeLearningPath(path)) {
          return jsonResponse(
            { error: "Arquivo invalido. Envie e abra apenas PDFs." },
            { status: 400 },
          );
        }

        try {
          const allowed = await hasAccessToPath(viewer, path);
          if (!allowed) {
            return jsonResponse(
              { error: "Voce nao tem permissao para abrir este arquivo." },
              { status: 403 },
            );
          }

          const { data, error } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(path, 60 * 30);

          if (error || !data?.signedUrl) {
            return jsonResponse(
              { error: error?.message ?? "Nao foi possivel gerar o link do arquivo." },
              { status: 500 },
            );
          }

          return jsonResponse({ signedUrl: data.signedUrl });
        } catch (error) {
          return jsonResponse(
            {
              error: error instanceof Error ? error.message : "Nao foi possivel validar o arquivo.",
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
