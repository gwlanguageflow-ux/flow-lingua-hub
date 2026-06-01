import { supabase } from "@/integrations/supabase/client";

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    cacheControl: "3600",
  });
  if (error) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

export type UploadedLearningFile = {
  path: string;
  name: string;
  mimeType: string;
};

let lastLearningUploadError: string | null = null;

export function getLastLearningUploadError() {
  return lastLearningUploadError;
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

export async function uploadLearningFile(
  userId: string,
  file: File,
): Promise<UploadedLearningFile | null> {
  lastLearningUploadError = null;
  const path = `${userId}/materials/${Date.now()}-${safeFileName(file.name)}`;
  const contentType = file.type || "application/octet-stream";

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    lastLearningUploadError = "Sessao expirada. Entre novamente.";
    return null;
  }

  try {
    const signedResponse = await fetch("/api/private/learning-upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        name: file.name,
        mimeType: contentType,
        size: file.size,
      }),
    });

    if (signedResponse.ok) {
      const signed = (await signedResponse.json()) as {
        path: string;
        token: string;
        name: string;
        mimeType: string;
      };
      const { error } = await supabase.storage
        .from("learning-materials")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          cacheControl: "3600",
          contentType,
        });

      if (!error) {
        return { path: signed.path, name: signed.name, mimeType: signed.mimeType };
      }

      lastLearningUploadError = error.message;
      console.error("[learning-materials] signed upload failed", {
        message: error.message,
        name: file.name,
        type: file.type,
        size: file.size,
      });
    } else {
      lastLearningUploadError = await readUploadError(signedResponse);
    }
  } catch (error) {
    lastLearningUploadError = error instanceof Error ? error.message : "Falha de rede no upload.";
  }

  const fallback = await uploadLearningFileThroughAppServer({
    token: session.access_token,
    path,
    file,
    contentType,
  });
  if (fallback) return fallback;

  console.error("[learning-materials] upload failed", {
    message: lastLearningUploadError,
    name: file.name,
    type: file.type,
    size: file.size,
  });
  return null;
}

async function uploadLearningFileThroughAppServer({
  token,
  path,
  file,
  contentType,
}: {
  token: string;
  path: string;
  file: File;
  contentType: string;
}): Promise<UploadedLearningFile | null> {
  try {
    const formData = new FormData();
    formData.append("path", path);
    formData.append("file", file, file.name);
    formData.append("mimeType", contentType);

    const response = await fetch("/api/private/learning-upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      lastLearningUploadError = await readUploadError(response);
      return null;
    }

    const uploaded = (await response.json()) as UploadedLearningFile;
    return uploaded;
  } catch (error) {
    lastLearningUploadError = error instanceof Error ? error.message : "Falha de rede no upload.";
    return null;
  }
}

async function readUploadError(response: Response) {
  const fallback = `Upload retornou HTTP ${response.status}`;
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    try {
      return (await response.text()) || fallback;
    } catch {
      return fallback;
    }
  }
}

export async function openLearningFile(path: string) {
  const { data, error } = await supabase.storage
    .from("learning-materials")
    .createSignedUrl(path, 60 * 30);
  if (error || !data?.signedUrl) return false;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  return true;
}

export async function uploadTeacherPostImage(userId: string, file: File): Promise<string | null> {
  const path = `${userId}/posts/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from("teacher-posts").upload(path, file, {
    cacheControl: "3600",
  });
  if (error) return null;
  const { data } = supabase.storage.from("teacher-posts").getPublicUrl(path);
  return data.publicUrl;
}
