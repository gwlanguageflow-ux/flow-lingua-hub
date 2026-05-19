export function sanitizeText(value: string, maxLength = 5000) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeNullableText(value: string | null | undefined, maxLength = 5000) {
  const sanitized = sanitizeText(value ?? "", maxLength);
  return sanitized.length > 0 ? sanitized : null;
}

export function sanitizePath(value: string | null | undefined) {
  return sanitizeText(value ?? "", 240).replace(/[^\w\-./:?=&%#]/g, "");
}
