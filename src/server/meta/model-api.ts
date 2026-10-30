import type { NextRequest } from "next/server";

export const META_MODEL_API_BASE_URL = "https://api.meta.ai/v1";

export function metaApiKey(request: NextRequest): string | null {
  const sessionKey = request.headers.get("x-eida-meta-key")?.trim();
  const environmentKey = process.env.MODEL_API_KEY?.trim();
  const key = sessionKey || environmentKey;
  return key && key.length >= 16 ? key : null;
}

export function metaHeaders(key: string): HeadersInit {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function metaError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return body.error?.message ?? `Meta returned HTTP ${response.status}.`;
  } catch {
    return `Meta returned HTTP ${response.status}.`;
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${bytes.toString("base64")}`;
}

export async function* sseEvents(
  response: Response,
): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  if (!response.body) throw new Error("Meta returned an empty event stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        for (const line of block.split(/\r?\n/)) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") return;
          const event = JSON.parse(data) as { type?: unknown };
          if (typeof event.type === "string") {
            yield event as { type: string; [key: string]: unknown };
          }
        }
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
