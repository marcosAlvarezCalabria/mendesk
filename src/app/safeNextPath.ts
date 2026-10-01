const FALLBACK_PATH = "/orders";

const PRIVATE_PATH_PATTERNS = [
  /^\/orders(?:\/new|\/\d{6}-\d+(?:\/tickets)?)?$/,
  /^\/clients(?:\/new|\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/i,
  /^\/appointments(?:\/new|\/history|\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})?$/i,
  /^\/stats$/,
] as const;

export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return FALLBACK_PATH;
  }

  if (value.includes("\\") || value.includes("#")) {
    return FALLBACK_PATH;
  }

  try {
    if (/[\u0000-\u001f\u007f]/u.test(decodeURIComponent(value))) {
      return FALLBACK_PATH;
    }
  } catch {
    return FALLBACK_PATH;
  }

  const [pathname] = value.split("?", 1);

  if (/%(?:2f|5c)/i.test(pathname)) {
    return FALLBACK_PATH;
  }

  return PRIVATE_PATH_PATTERNS.some((pattern) => pattern.test(pathname)) ? value : FALLBACK_PATH;
}
