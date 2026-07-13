export function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function countWildcards(value: string): number {
  return [...value].filter((char) => char === "*").length;
}

function matchesAllowedOrigin(normalizedOrigin: string, allowedOrigin: string): boolean {
  if (allowedOrigin === "*") return false;

  const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);
  if (!normalizedAllowedOrigin) return false;

  const wildcardCount = countWildcards(normalizedAllowedOrigin);
  if (wildcardCount === 0) return normalizedAllowedOrigin === normalizedOrigin;
  if (wildcardCount > 1) return false;

  try {
    const originUrl = new URL(normalizedOrigin);
    const allowedUrl = new URL(normalizedAllowedOrigin);
    const suffix = allowedUrl.hostname.startsWith("*.") ? allowedUrl.hostname.slice(1) : "";

    return (
      suffix.length > 0 &&
      originUrl.protocol === allowedUrl.protocol &&
      originUrl.port === allowedUrl.port &&
      originUrl.hostname.endsWith(suffix) &&
      originUrl.hostname.length > suffix.length
    );
  } catch {
    return false;
  }
}

export function isAllowedOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  if (!origin) return false;

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  return allowedOrigins.some((allowedOrigin) => matchesAllowedOrigin(normalizedOrigin, allowedOrigin));
}
