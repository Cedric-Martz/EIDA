import {
  localGeometryPlanSchema,
  localPartInventorySchema,
  localSegmentationResultSchema,
  type LocalGeometryPlan,
  type LocalPartInventory,
  type LocalSegmentationResult,
} from "@/domain/local-reconstruction";
import type { LocalAssetRecord } from "@/storage/indexed-db/db";
import { MAX_SOURCE_IMAGES, MAX_USER_PHOTOS } from "@/config/meta-models";

export type SourceVisualInput = {
  sourceId: string;
  url: string;
  alt: string;
};

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
  sourceImages,
  context,
  signal,
}: {
  key: string;
  model: string;
  photos: readonly LocalAssetRecord[];
  sourceImages: readonly SourceVisualInput[];
  context: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<LocalPartInventory> {
  const form = new FormData();
  form.set("model", model);
  form.set("context", JSON.stringify(context));
  for (const photo of photos.slice(0, MAX_USER_PHOTOS)) {
    form.append("photos", photo.blob, photo.name);
  }
  form.set(
    "sourceImages",
    JSON.stringify(sourceImages.slice(0, MAX_SOURCE_IMAGES)),
  );
  const response = await fetch("/api/meta/inventory", {
    method: "POST",
    headers: keyHeaders(key),
    body: form,
    signal,
  });
  const body = (await readJson(response)) as { inventory?: unknown };
  return localPartInventorySchema.parse(body.inventory);
}

export async function createLocalGeometryPlan({
  key,
  model,
  photos,
  sourceImages,
  analysis,
  signal,
}: {
  key: string;
  model: string;
  photos: readonly LocalAssetRecord[];
  sourceImages: readonly SourceVisualInput[];
  analysis: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<LocalGeometryPlan> {
  const form = new FormData();
  form.set("model", model);
  form.set("analysis", JSON.stringify(analysis));
  form.set(
    "sourceImages",
    JSON.stringify(sourceImages.slice(0, MAX_SOURCE_IMAGES)),
  );
  for (const photo of photos.slice(0, MAX_USER_PHOTOS)) {
    form.append("photos", photo.blob, photo.name);
  }
  const response = await fetch("/api/meta/geometry", {
    method: "POST",
    headers: keyHeaders(key),
    body: form,
    signal,
  });
  const body = (await readJson(response)) as { plan?: unknown };
  return localGeometryPlanSchema.parse(body.plan);
}

export async function downloadSourceImage(
  sourceImage: SourceVisualInput,
  projectId: string,
  signal?: AbortSignal,
): Promise<LocalAssetRecord> {
  const response = await fetch("/api/research/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    signal,
    body: JSON.stringify({ url: sourceImage.url }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
    } | null;
    throw new Error(
      typeof body?.error === "string"
        ? body.error
        : `Source image returned HTTP ${response.status}.`,
    );
  }
  const blob = await response.blob();
  const fileName = (() => {
    try {
      return decodeURIComponent(
        new URL(sourceImage.url).pathname.split("/").pop() || "source-image",
      ).slice(0, 200);
    } catch {
      return "source-image";
    }
  })();
  return {
    id: `web-image:${sourceImage.sourceId}:${sourceImage.url}`.slice(0, 500),
    projectId,
    kind: "photo",
    name: fileName,
    mimeType: blob.type || "image/jpeg",
    size: blob.size,
    createdAt: Date.now(),
    blob,
  };
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
