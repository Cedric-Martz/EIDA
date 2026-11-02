import {
  mapAnythingHealthSchema,
  mapAnythingJobSchema,
  type MapAnythingHealth,
  type MapAnythingJob,
} from "@/domain/mapanything";
import type { LocalAssetRecord } from "@/storage/indexed-db/db";

type FetchLike = typeof fetch;

export type MapAnythingClient = {
  health(signal?: AbortSignal): Promise<MapAnythingHealth>;
  createJob(
    request: Record<string, unknown>,
    photos: readonly LocalAssetRecord[],
    signal?: AbortSignal,
  ): Promise<MapAnythingJob>;
  getJob(jobId: string, signal?: AbortSignal): Promise<MapAnythingJob>;
};

export function normalizeMapAnythingEndpoint(value: string): string {
  const url = new URL(value.trim());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new TypeError(
      "Use an HTTPS MapAnything endpoint, or HTTP only for localhost.",
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("The worker endpoint must not contain credentials.");
  }
  return url.toString().replace(/\/$/, "");
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`MapAnything worker returned HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("MapAnything worker returned invalid JSON.");
  }
}

export function createMapAnythingClient({
  endpoint,
  token = "",
  fetchImpl = fetch,
}: {
  endpoint: string;
  token?: string;
  fetchImpl?: FetchLike;
}): MapAnythingClient {
  const baseUrl = normalizeMapAnythingEndpoint(endpoint);
  const headers = token.trim()
    ? { Authorization: `Bearer ${token.trim()}` }
    : undefined;

  return {
    async health(signal) {
      const response = await fetchImpl(`${baseUrl}/health`, {
        cache: "no-store",
        signal,
      });
      return mapAnythingHealthSchema.parse(await readJson(response));
    },

    async createJob(request, photos, signal) {
      if (photos.length < 3 || photos.length > 8) {
        throw new TypeError(
          "MapAnything requires between three and eight photos.",
        );
      }
      const form = new FormData();
      form.set(
        "request",
        new Blob([JSON.stringify(request)], { type: "application/json" }),
        "request.json",
      );
      for (const [index, photo] of photos.entries()) {
        form.append(
          "photos",
          photo.blob,
          photo.name || `view-${index + 1}.jpg`,
        );
      }
      const response = await fetchImpl(`${baseUrl}/v1/maps`, {
        method: "POST",
        headers,
        body: form,
        cache: "no-store",
        signal,
      });
      return mapAnythingJobSchema.parse(await readJson(response));
    },

    async getJob(jobId, signal) {
      if (!/^[a-zA-Z0-9._-]{1,160}$/.test(jobId)) {
        throw new TypeError("Invalid MapAnything job identifier.");
      }
      const response = await fetchImpl(
        `${baseUrl}/v1/maps/${encodeURIComponent(jobId)}`,
        { headers, cache: "no-store", signal },
      );
      return mapAnythingJobSchema.parse(await readJson(response));
    },
  };
}
