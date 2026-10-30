const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/g;
const HTML_TAGS = /<[^>]*>/g;

export function sanitizePlainText(value: string, maxLength = 20_000): string {
  return value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, " ")
    .replace(HTML_TAGS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeResearchQuery(value: string): string {
  return sanitizePlainText(value, 200);
}

export function sanitizeNetworkPayload(value: unknown, depth = 0): unknown {
  if (depth > 20) return null;
  if (typeof value === "string") return sanitizePlainText(value);
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 10_000)
      .map((item) => sanitizeNetworkPayload(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [rawKey, item] of Object.entries(value).slice(0, 10_000)) {
      const key = sanitizePlainText(rawKey, 200);
      if (!key || ["__proto__", "constructor", "prototype"].includes(key)) {
        continue;
      }
      output[key] = sanitizeNetworkPayload(item, depth + 1);
    }
    return output;
  }
  return null;
}
