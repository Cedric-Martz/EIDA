export const META_MODEL_API_BASE_URL = "https://api.meta.ai/v1";

export const META_MODEL_OPTIONS = [
  { id: "muse-spark-1.3", label: "Muse Spark 1.3" },
  { id: "muse-spark-1.2", label: "Muse Spark 1.2" },
  { id: "muse-spark-1.1", label: "Muse Spark 1.1" },
  { id: "muse-wonder-1.0", label: "Muse Wonder 1.0" },
] as const;

export type MetaConnectionResult =
  { ok: true } | { ok: false; message: string };

export async function testMetaConnection(
  apiKey: string,
  signal?: AbortSignal,
): Promise<MetaConnectionResult> {
  const key = apiKey.trim();
  if (!key) return { ok: false, message: "Enter an API key." };

  try {
    const response = await fetch(`${META_MODEL_API_BASE_URL}/models`, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal,
    });

    if (response.ok) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, message: "Meta Model API rejected this key." };
    }
    if (response.status === 429) {
      return {
        ok: false,
        message: "The request limit was reached. Try again later.",
      };
    }
    return {
      ok: false,
      message: `Meta Model API returned status ${response.status}.`,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, message: "The connection test timed out." };
    }
    return {
      ok: false,
      message: "Connection failed. Check your network and try again.",
    };
  }
}
