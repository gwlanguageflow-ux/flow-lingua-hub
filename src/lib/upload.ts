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
  const path = `${userId}/materials/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from("learning-materials").upload(path, file, {
    cacheControl: "3600",
  });
  if (error) return null;
  return { path, name: file.name, mimeType: file.type || "application/octet-stream" };
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
