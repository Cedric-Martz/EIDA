import {
  metaPipelineHealthSchema,
  metaReconstructionJobSchema,
  type MetaPipelineHealth,
  type MetaReconstructionJob,
} from "@/domain/meta-pipeline";
import type { LocalAssetRecord } from "@/storage/indexed-db/db";

type FetchLike = typeof fetch;

export type MetaPipelineClient = {
  health(signal?: AbortSignal): Promise<MetaPipelineHealth>;
  createJob(
    request: Record<string, unknown>,
    photos: readonly LocalAssetRecord[],
    signal?: AbortSignal,
  ): Promise<MetaReconstructionJob>;
  getJob(jobId: string, signal?: AbortSignal): Promise<MetaReconstructionJob>;
};

function normalizeEndpoint(value: string): string {
  const url = new URL(value.trim());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new TypeError(
      "Use an HTTPS pipeline endpoint, or HTTP only for localhost.",
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new TypeError("The pipeline endpoint must not contain credentials.");
  }
  return url.toString().replace(/\/$/, "");
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`Meta pipeline returned HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Meta pipeline returned invalid JSON.");
  }
}

export function createMetaPipelineClient({
  endpoint,
  token = "",
  fetchImpl = fetch,
}: {
  endpoint: string;
  token?: string;
  fetchImpl?: FetchLike;
}): MetaPipelineClient {
  const baseUrl = normalizeEndpoint(endpoint);
  const headers = token.trim()
    ? { Authorization: `Bearer ${token.trim()}` }
    : undefined;

  return {
    async health(signal) {
      const response = await fetchImpl(`${baseUrl}/health`, {
        headers,
        cache: "no-store",
        signal,
      });
      return metaPipelineHealthSchema.parse(await readJson(response));
    },

    async createJob(request, photos, signal) {
      if (photos.length < 3) {
        throw new TypeError("At least three photos are required.");
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
          photo.name ||
            `view-${index + 1}.${photo.mimeType.split("/")[1] ?? "jpg"}`,
        );
      }
      const response = await fetchImpl(`${baseUrl}/v1/reconstructions`, {
        method: "POST",
        headers,
        body: form,
        cache: "no-store",
        signal,
      });
      return metaReconstructionJobSchema.parse(await readJson(response));
    },

    async getJob(jobId, signal) {
      if (!/^[a-zA-Z0-9._-]{1,160}$/.test(jobId)) {
        throw new TypeError("Invalid reconstruction job identifier.");
      }
      const response = await fetchImpl(
        `${baseUrl}/v1/reconstructions/${encodeURIComponent(jobId)}`,
        { headers, cache: "no-store", signal },
      );
      return metaReconstructionJobSchema.parse(await readJson(response));
    },
  };
}
