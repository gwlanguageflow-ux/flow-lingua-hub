const ABSOLUTE_URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/i;
const DOMAIN_URL_PATTERN =
  /(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?:\/[^\s<>"')\]]*)?/i;

function stripTrailingPunctuation(value: string) {
  return value.replace(/[.,;:!?]+$/g, "");
}

export function normalizeExternalUrl(value: string | null | undefined) {
  const raw = value?.trim();
  if (!raw) return null;

  const absolute = raw.match(ABSOLUTE_URL_PATTERN)?.[0];
  if (absolute) return stripTrailingPunctuation(absolute);

  const domain = raw.match(DOMAIN_URL_PATTERN)?.[0];
  if (!domain) return null;

  return `https://${stripTrailingPunctuation(domain)}`;
}
