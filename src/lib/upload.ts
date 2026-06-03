import { supabase } from "@/integrations/supabase/client";

export const LEARNING_PDF_MIME_TYPE = "application/pdf";
export const LEARNING_FILE_ACCEPT = ".pdf,application/pdf";

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

type SignedLearningUpload = UploadedLearningFile & {
  token: string;
};

let lastLearningUploadError: string | null = null;
let lastLearningOpenError: string | null = null;

export function getLastLearningUploadError() {
  return lastLearningUploadError;
}

export function getLastLearningOpenError() {
  return lastLearningOpenError;
}

export function isLearningPdfFile(file: File) {
  return file.type === LEARNING_PDF_MIME_TYPE || file.name.toLowerCase().endsWith(".pdf");
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
  if (!isLearningPdfFile(file)) {
    lastLearningUploadError = "Envie apenas arquivos em PDF.";
    return null;
  }

  const fileName = safeFileName(file.name || "material.pdf");
  const pdfFileName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  const path = `${userId}/materials/${Date.now()}-${pdfFileName}`;
  const contentType = LEARNING_PDF_MIME_TYPE;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    lastLearningUploadError = "Sessao expirada. Entre novamente.";
    return null;
  }

  const uploaded = await uploadLearningFileWithSignedUrl({
    token: session.access_token,
    path,
    file,
    contentType,
  });
  if (uploaded) return uploaded;

  const fallbackUploaded = await uploadLearningFileThroughAppServer({
    token: session.access_token,
    path,
    file,
    contentType,
  });
  if (fallbackUploaded) return fallbackUploaded;

  console.error("[learning-materials] upload failed", {
    message: lastLearningUploadError,
    name: file.name,
    type: file.type,
    size: file.size,
  });
  return null;
}

async function uploadLearningFileWithSignedUrl({
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
    const response = await fetch("/api/private/learning-upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path,
        name: file.name,
        mimeType: contentType,
        size: file.size,
      }),
    });

    if (!response.ok) {
      lastLearningUploadError = await readUploadError(response);
      return null;
    }

    const signed = (await response.json()) as SignedLearningUpload;
    if (!signed.path || !signed.token) {
      lastLearningUploadError = "Nao foi possivel preparar o envio do arquivo.";
      return null;
    }

    const { error } = await supabase.storage
      .from("learning-materials")
      .uploadToSignedUrl(signed.path, signed.token, file, {
        contentType,
      });

    if (error) {
      lastLearningUploadError = error.message;
      return null;
    }

    return {
      path: signed.path,
      name: file.name || signed.name,
      mimeType: contentType,
    };
  } catch (error) {
    lastLearningUploadError =
      error instanceof Error ? error.message : "Falha de rede no upload assinado.";
    return null;
  }
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
  lastLearningOpenError = null;
  const pendingWindow = typeof window !== "undefined" ? window.open("", "_blank") : null;
  if (pendingWindow) {
    pendingWindow.document.title = "Abrindo PDF";
    pendingWindow.document.body.innerHTML =
      '<p style="font-family: Arial, sans-serif; padding: 24px;">Abrindo PDF...</p>';
  }

  const closePendingWindow = () => {
    try {
      pendingWindow?.close();
    } catch {
      // Some in-app browsers block window management; ignore and keep the real error.
    }
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    closePendingWindow();
    lastLearningOpenError = "Sessao expirada. Entre novamente.";
    return false;
  }

  try {
    const response = await fetch("/api/private/learning-file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      closePendingWindow();
      lastLearningOpenError = await readUploadError(response);
      return false;
    }

    const data = (await response.json()) as { signedUrl?: string };
    if (!data.signedUrl) {
      closePendingWindow();
      lastLearningOpenError = "Link do arquivo nao foi gerado.";
      return false;
    }

    if (pendingWindow) {
      pendingWindow.opener = null;
      pendingWindow.location.href = data.signedUrl;
    } else {
      window.location.assign(data.signedUrl);
    }
    return true;
  } catch (error) {
    closePendingWindow();
    lastLearningOpenError = error instanceof Error ? error.message : "Falha de rede ao abrir.";
    return false;
  }
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
