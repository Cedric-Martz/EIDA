import {
  photoAnalysisSchema,
  type PhotoAnalysis,
} from "@/domain/inference/observation";
import type { InferenceUsage } from "@/domain/inference/run";
import type { Project } from "@/domain/evidence/schema";

export const META_MODEL_API_BASE_URL = "https://api.meta.ai/v1";
const MAX_INLINE_PHOTO_BYTES = 12 * 1024 * 1024;

export const META_MODEL_OPTIONS = [
  { id: "muse-spark-1.3", label: "Muse Spark 1.3" },
  { id: "muse-spark-1.2", label: "Muse Spark 1.2" },
  { id: "muse-spark-1.1", label: "Muse Spark 1.1" },
  { id: "muse-wonder-1.0", label: "Muse Wonder 1.0" },
] as const;

export type MetaErrorCode =
  | "missing_key"
  | "missing_model"
  | "insufficient_photos"
  | "image_too_large"
  | "auth_rejected"
  | "access_forbidden"
  | "invalid_request"
  | "quota_exceeded"
  | "provider_unavailable"
  | "timeout"
  | "network_or_cors"
  | "invalid_json"
  | "invalid_response";

export type MetaConnectionResult =
  { ok: true } | { ok: false; message: string; code: MetaErrorCode };

export type MetaAnalysisResult = PhotoAnalysis;

export type AnalysisPhoto = {
  id: string;
  blob: Blob;
  mimeType: string;
  size: number;
};

export type MetaAnalysisCallResult =
  | {
      ok: true;
      result: MetaAnalysisResult;
      usage: InferenceUsage | null;
      providerRequestId?: string;
    }
  | {
      ok: false;
      message: string;
      code: MetaErrorCode;
      httpStatus?: number;
    };

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type RequestOptions = {
  fetchImpl?: FetchLike;
  retryDelayMs?: number;
  device?: Project["device"];
};

const errorMessages: Record<MetaErrorCode, string> = {
  missing_key: "Enter an API key.",
  missing_model: "Choose an analysis model.",
  insufficient_photos: "Add at least 3 photos before analysis.",
  image_too_large: "A selected photo exceeds the 12 MB analysis limit.",
  auth_rejected: "Meta Model API rejected this key.",
  access_forbidden: "This Meta project cannot access the requested resource.",
  invalid_request: "Meta rejected the analysis request format.",
  quota_exceeded: "The request limit was reached. Try again later.",
  provider_unavailable: "Meta Model API is temporarily unavailable.",
  timeout: "The Meta request timed out.",
  network_or_cors:
    "The browser could not reach Meta. Check network and CORS access.",
  invalid_json: "Meta returned invalid JSON.",
  invalid_response: "Meta returned an invalid analysis shape.",
};

function failure(
  code: MetaErrorCode,
  httpStatus?: number,
): Extract<MetaAnalysisCallResult, { ok: false }> {
  return {
    ok: false,
    code,
    message: errorMessages[code],
    ...(httpStatus === undefined ? {} : { httpStatus }),
  };
}

function codeForStatus(status: number): MetaErrorCode {
  if (status === 401) return "auth_rejected";
  if (status === 403) return "access_forbidden";
  if (status === 400 || status === 404 || status === 413 || status === 422) {
    return "invalid_request";
  }
  if (status === 429) return "quota_exceeded";
  return "provider_unavailable";
}

async function waitForRetry(delayMs: number, signal?: AbortSignal) {
  if (delayMs <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RequestOptions,
): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const first = await fetchImpl(url, init);
  if (first.status !== 429 && first.status < 500) return first;
  await waitForRetry(options.retryDelayMs ?? 250, init.signal ?? undefined);
  return fetchImpl(url, init);
}

async function blobToDataUrl(photo: AnalysisPhoto): Promise<string> {
  const bytes = new Uint8Array(await photo.blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${photo.mimeType};base64,${btoa(binary)}`;
}

export async function testMetaConnection(
  apiKey: string,
  signal?: AbortSignal,
  options: RequestOptions = {},
): Promise<MetaConnectionResult> {
  const key = apiKey.trim();
  if (!key) {
    return {
      ok: false,
      code: "missing_key",
      message: errorMessages.missing_key,
    };
  }

  try {
    const response = await fetchWithRetry(
      `${META_MODEL_API_BASE_URL}/models`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal,
      },
      options,
    );

    if (response.ok) return { ok: true };
    const code = codeForStatus(response.status);
    return { ok: false, code, message: errorMessages[code] };
  } catch (error) {
    const code =
      error instanceof DOMException && error.name === "AbortError"
        ? "timeout"
        : "network_or_cors";
    return { ok: false, code, message: errorMessages[code] };
  }
}

export async function buildMetaAnalysisRequest(
  model: string,
  photos: AnalysisPhoto[],
  device: Project["device"] = { confirmedByUser: false },
): Promise<Record<string, unknown>> {
  const imageParts = await Promise.all(
    photos.slice(0, 3).map(async (photo) => ({
      type: "image_url" as const,
      image_url: { url: await blobToDataUrl(photo), detail: "high" },
    })),
  );
  const knownIdentity = [device.manufacturer, device.model]
    .filter(Boolean)
    .join(" ");
  const identityInstruction = device.confirmedByUser
    ? `The user identifies the device as ${knownIdentity}. Treat that identity as user-provided context, not as visual evidence.`
    : "The device identity is unknown. Do not guess an exact manufacturer or model from appearance alone.";

  return {
    model: model.trim(),
    messages: [
      {
        role: "developer",
        content:
          "You inspect device photographs conservatively for a component-based 3D workspace. Report only physically distinct parts, modules, controls, sensors, slots or connectors that benefit from a separate 3D representation. Do not create observations for branding, printed text, decorative icons, dust, smudges, scratches, finish, general condition, or broad statements about what is not shown. Prefer these category names when applicable: display, housing, camera, button, connector, slot, sensor, speaker, microphone, battery, board. Never claim hidden internal parts, exact dimensions, material composition, safety, or model identity unless directly visible. Use uncertain or not_visible when appropriate.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${identityInstruction} Analyze these three views and return visible observations only. Photo indices are 1, 2, and 3 in the order supplied.`,
          },
          ...imageParts,
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "eida_photo_observations",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["observations", "notes"],
          properties: {
            observations: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "label",
                  "category",
                  "visibility",
                  "description",
                  "evidencePhotoIndices",
                ],
                properties: {
                  label: { type: "string" },
                  category: { type: "string" },
                  visibility: {
                    type: "string",
                    enum: ["visible", "uncertain", "not_visible"],
                  },
                  description: { type: "string" },
                  evidencePhotoIndices: {
                    type: "array",
                    items: { type: "integer", minimum: 1, maximum: 3 },
                  },
                },
              },
            },
            notes: { type: "string" },
          },
        },
      },
    },
  };
}

function readUsage(payload: Record<string, unknown>): InferenceUsage | null {
  const usage = payload.usage;
  if (typeof usage !== "object" || usage === null) return null;
  const record = usage as Record<string, unknown>;
  const result: InferenceUsage = {};
  if (typeof record.prompt_tokens === "number") {
    result.inputTokens = record.prompt_tokens;
  }
  if (typeof record.completion_tokens === "number") {
    result.outputTokens = record.completion_tokens;
  }
  if (typeof record.total_tokens === "number") {
    result.totalTokens = record.total_tokens;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export async function analyzeMetaPhotos(
  apiKey: string,
  model: string,
  photos: AnalysisPhoto[],
  signal?: AbortSignal,
  options: RequestOptions = {},
): Promise<MetaAnalysisCallResult> {
  const key = apiKey.trim();
  if (!key) return failure("missing_key");
  if (!model.trim()) return failure("missing_model");
  if (photos.length < 3) return failure("insufficient_photos");
  if (photos.slice(0, 3).some((photo) => photo.size > MAX_INLINE_PHOTO_BYTES)) {
    return failure("image_too_large");
  }

  try {
    const body = await buildMetaAnalysisRequest(model, photos, options.device);
    const response = await fetchWithRetry(
      `${META_MODEL_API_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal,
      },
      options,
    );

    if (!response.ok) {
      return failure(codeForStatus(response.status), response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return failure("invalid_json");
    }
    if (typeof payload !== "object" || payload === null) {
      return failure("invalid_response");
    }
    const record = payload as Record<string, unknown>;
    const choices = record.choices;
    const firstChoice = Array.isArray(choices) ? choices[0] : null;
    const message =
      typeof firstChoice === "object" && firstChoice !== null
        ? (firstChoice as Record<string, unknown>).message
        : null;
    const content =
      typeof message === "object" && message !== null
        ? (message as Record<string, unknown>).content
        : null;
    if (typeof content !== "string") return failure("invalid_response");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return failure("invalid_json");
    }
    const result = photoAnalysisSchema.safeParse(parsed);
    if (!result.success) return failure("invalid_response");

    return {
      ok: true,
      result: result.data,
      usage: readUsage(record),
      ...(typeof record.id === "string"
        ? { providerRequestId: record.id }
        : {}),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return failure("timeout");
    }
    return failure("network_or_cors");
  }
}
