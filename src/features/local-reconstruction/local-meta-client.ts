import {
  localPartInventorySchema,
  localSegmentationResultSchema,
  type LocalPartInventory,
  type LocalSegmentationResult,
} from "@/domain/local-reconstruction";
import type { LocalAssetRecord } from "@/storage/indexed-db/db";

export type LocalMetaStatus = {
  configured: boolean;
  connected: boolean;
  source: "missing" | "session" | "environment";
  models: string[];
  error?: string;
};

function keyHeaders(key: string): HeadersInit | undefined {
  return key.trim() ? { "x-eida-meta-key": key.trim() } : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const body = (await response.json()) as { error?: unknown };
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string"
        ? body.error
        : `Local Meta API returned HTTP ${response.status}.`,
    );
  }
  return body;
}

export async function checkLocalMeta(
  key: string,
  signal?: AbortSignal,
): Promise<LocalMetaStatus> {
  const response = await fetch("/api/meta/status", {
    headers: keyHeaders(key),
    cache: "no-store",
    signal,
  });
  const body = (await response.json()) as LocalMetaStatus;
  if (!response.ok && response.status !== 401) {
    throw new Error(body.error ?? `Connection failed (${response.status}).`);
  }
  return body;
}

export async function createLocalInventory({
  key,
  model,
  photos,
  context,
  signal,
}: {
  key: string;
  model: string;
  photos: readonly LocalAssetRecord[];
  context: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<LocalPartInventory> {
  const form = new FormData();
  form.set("model", model);
  form.set("context", JSON.stringify(context));
  for (const photo of photos.slice(0, 6)) {
    form.append("photos", photo.blob, photo.name);
  }
  const response = await fetch("/api/meta/inventory", {
    method: "POST",
    headers: keyHeaders(key),
    body: form,
    signal,
  });
  const body = (await readJson(response)) as { inventory?: unknown };
  return localPartInventorySchema.parse(body.inventory);
}

export async function segmentLocalPart({
  key,
  photo,
  prompt,
  signal,
}: {
  key: string;
  photo: LocalAssetRecord;
  prompt: string;
  signal?: AbortSignal;
}): Promise<LocalSegmentationResult> {
  const form = new FormData();
  form.set("prompt", prompt);
  form.set("photo", photo.blob, photo.name);
  const response = await fetch("/api/meta/segment", {
    method: "POST",
    headers: keyHeaders(key),
    body: form,
    signal,
  });
  return localSegmentationResultSchema.parse(await readJson(response));
}
