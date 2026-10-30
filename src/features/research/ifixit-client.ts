import { z } from "zod";
import {
  type DiscoveredSource,
  type ResearchLicense,
  type ResearchProviderResult,
} from "@/domain/research/schema";
import { canonicalizeSourceUrl } from "@/domain/research/source-list";
import {
  fetchSanitizedJson,
  researchError,
  type ResearchCallResult,
  type ResearchFetch,
} from "./network";
import { normalizeResearchQuery, sanitizePlainText } from "./sanitize";

export const IFIXIT_API_BASE_URL = "https://www.ifixit.com/api/2.0";

export const IFIXIT_LICENSE: ResearchLicense = {
  code: "cc-by-nc-sa-3.0",
  label: "Creative Commons BY-NC-SA 3.0",
  url: "https://www.ifixit.com/Info/Licensing",
  attributionRequired: true,
  commercialUse: "forbidden",
  derivatives: "share-alike",
};

const IFIXIT_PROVIDER = { id: "ifixit", label: "iFixit" } as const;

const suggestItemSchema = z.object({
  dataType: z.literal("guide").optional(),
  guideid: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
  url: z.string().trim().optional(),
  summary: z.string().trim().max(2_000).optional(),
  category: z.string().trim().max(200).optional(),
  type: z.string().trim().max(100).optional(),
  image: z.object({ thumbnail: z.string().trim().optional() }).optional(),
});

const suggestResponseSchema = z.object({
  results: z.array(z.unknown()).max(100),
});

const rawGuideSchema = z.object({
  guideid: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
  url: z.string().trim().optional(),
  summary: z.string().trim().max(2_000).optional(),
  category: z.string().trim().max(200).optional(),
  type: z.string().trim().max(100).optional(),
  steps: z.array(z.unknown()).max(1_000).optional(),
});

const rawStepSchema = z.object({
  stepid: z.number().int().positive().optional(),
  orderby: z.number().int().nonnegative().optional(),
  title: z.string().trim().max(500).optional(),
  lines: z.array(z.unknown()).max(100).optional(),
  media: z.unknown().optional(),
});

const rawLineSchema = z.object({
  text: z.string().optional(),
  text_raw: z.string().optional(),
  text_rendered: z.string().optional(),
});

const rawMediaSchema = z.object({
  data: z.array(z.unknown()).max(100).optional(),
});

const rawImageSchema = z.object({
  original: z.string().optional(),
  large: z.string().optional(),
  standard: z.string().optional(),
  medium: z.string().optional(),
  thumbnail: z.string().optional(),
});

export type IfixitGuideStep = {
  id?: number;
  order: number;
  title?: string;
  lines: string[];
  imageUrls: string[];
};

export type IfixitGuide = {
  id: number;
  title: string;
  url: string;
  summary?: string;
  category?: string;
  license: ResearchLicense;
  steps: IfixitGuideStep[];
};

export type IfixitClient = {
  searchGuides(
    query: string,
    signal?: AbortSignal,
  ): Promise<ResearchCallResult<ResearchProviderResult>>;
  getGuide(
    guideId: number,
    signal?: AbortSignal,
  ): Promise<
    ResearchCallResult<{ guide: IfixitGuide; source: DiscoveredSource }>
  >;
};

export type IfixitClientConfig = {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: ResearchFetch;
  now?: () => number;
};

function isIfixitHost(hostname: string): boolean {
  return hostname === "ifixit.com" || hostname.endsWith(".ifixit.com");
}

function safeIfixitUrl(value: string | undefined, fallback: string): string {
  try {
    const parsed = new URL(value ?? fallback, "https://www.ifixit.com");
    if (parsed.protocol !== "https:" || !isIfixitHost(parsed.hostname)) {
      return fallback;
    }
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function sourceFromGuideLike(
  guide: z.infer<typeof suggestItemSchema>,
  discoveredAt: number,
  relevanceScore?: number,
): DiscoveredSource {
  const fallbackUrl = `https://www.ifixit.com/Guide/${guide.guideid}`;
  const url = safeIfixitUrl(guide.url, fallbackUrl);
  const thumbnailUrl = guide.image?.thumbnail
    ? safeIfixitUrl(guide.image.thumbnail, "")
    : undefined;
  const sourceType = /teardown|disassembly/i.test(guide.type ?? "")
    ? "teardown-guide"
    : "repair-guide";

  return {
    schemaVersion: 1,
    id: `ifixit-guide-${guide.guideid}`,
    url,
    canonicalUrl: canonicalizeSourceUrl(url),
    title: sanitizePlainText(guide.title, 500),
    publisher: "iFixit",
    sourceType,
    provider: IFIXIT_PROVIDER,
    discoveredAt,
    license: IFIXIT_LICENSE,
    selection: "discovered",
    ...(guide.summary
      ? { summary: sanitizePlainText(guide.summary, 2_000) }
      : {}),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    ...(relevanceScore === undefined ? {} : { relevanceScore }),
  };
}

function normalizeBaseUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !isIfixitHost(url.hostname)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function extractImageUrls(media: unknown): string[] {
  const parsedMedia = rawMediaSchema.safeParse(media);
  if (!parsedMedia.success || !parsedMedia.data.data) return [];
  const urls: string[] = [];
  for (const item of parsedMedia.data.data) {
    const image = rawImageSchema.safeParse(item);
    if (!image.success) continue;
    const candidate =
      image.data.original ??
      image.data.large ??
      image.data.standard ??
      image.data.medium ??
      image.data.thumbnail;
    if (!candidate) continue;
    const url = safeIfixitUrl(candidate, "");
    if (url) urls.push(url);
  }
  return Array.from(new Set(urls));
}

function extractSteps(value: unknown[] | undefined): IfixitGuideStep[] {
  if (!value) return [];
  const steps: IfixitGuideStep[] = [];
  for (const [index, item] of value.entries()) {
    const parsed = rawStepSchema.safeParse(item);
    if (!parsed.success) continue;
    const lines = (parsed.data.lines ?? [])
      .map((line) => rawLineSchema.safeParse(line))
      .filter((line) => line.success)
      .map((line) => {
        const data = line.data;
        return sanitizePlainText(
          data.text_raw ?? data.text ?? data.text_rendered ?? "",
          2_000,
        );
      })
      .filter(Boolean);
    steps.push({
      ...(parsed.data.stepid === undefined ? {} : { id: parsed.data.stepid }),
      order: parsed.data.orderby ?? index + 1,
      ...(parsed.data.title
        ? { title: sanitizePlainText(parsed.data.title, 500) }
        : {}),
      lines,
      imageUrls: extractImageUrls(parsed.data.media),
    });
  }
  return steps;
}

export function createIfixitClient(
  config: IfixitClientConfig = {},
): IfixitClient {
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? IFIXIT_API_BASE_URL);
  const now = config.now ?? Date.now;

  return {
    async searchGuides(query, signal) {
      if (baseUrl === null) {
        return { ok: false, error: researchError("invalid_configuration") };
      }
      const normalizedQuery = normalizeResearchQuery(query);
      if (!normalizedQuery) {
        return { ok: false, error: researchError("invalid_request") };
      }
      const startedAt = now();
      const response = await fetchSanitizedJson(
        `${baseUrl}/suggest/${encodeURIComponent(normalizedQuery)}?doctypes=guide`,
        {
          fetchImpl: config.fetchImpl,
          timeoutMs: config.timeoutMs,
          signal,
          init: { method: "GET", headers: { Accept: "application/json" } },
        },
      );
      if (!response.ok) return response;

      const envelope = suggestResponseSchema.safeParse(response.value);
      if (!envelope.success) {
        return { ok: false, error: researchError("invalid_response") };
      }

      const parsedItems = envelope.data.results.map((item) =>
        suggestItemSchema.safeParse(item),
      );
      const validItems = parsedItems
        .filter((item) => item.success)
        .map((item) => item.data);
      const skipped = parsedItems.length - validItems.length;
      const sources = validItems.map((item, index) =>
        sourceFromGuideLike(
          item,
          startedAt,
          validItems.length === 0
            ? undefined
            : (validItems.length - index) / validItems.length,
        ),
      );
      const warnings = skipped
        ? [
            `Ignored ${skipped} malformed iFixit result${skipped === 1 ? "" : "s"}.`,
          ]
        : [];

      return {
        ok: true,
        value: {
          schemaVersion: 1,
          provider: IFIXIT_PROVIDER,
          query: normalizedQuery,
          status: skipped ? "partial" : "succeeded",
          startedAt,
          completedAt: now(),
          sources,
          artifacts: [],
          claims: [],
          warnings,
          error: null,
        },
      };
    },

    async getGuide(guideId, signal) {
      if (baseUrl === null) {
        return { ok: false, error: researchError("invalid_configuration") };
      }
      if (!Number.isInteger(guideId) || guideId <= 0) {
        return { ok: false, error: researchError("invalid_request") };
      }
      const response = await fetchSanitizedJson(
        `${baseUrl}/guides/${guideId}`,
        {
          fetchImpl: config.fetchImpl,
          timeoutMs: config.timeoutMs,
          signal,
          init: { method: "GET", headers: { Accept: "application/json" } },
        },
      );
      if (!response.ok) return response;

      const parsed = rawGuideSchema.safeParse(response.value);
      if (!parsed.success || parsed.data.guideid !== guideId) {
        return { ok: false, error: researchError("invalid_response") };
      }
      const source = sourceFromGuideLike(parsed.data, now());
      return {
        ok: true,
        value: {
          source,
          guide: {
            id: parsed.data.guideid,
            title: sanitizePlainText(parsed.data.title, 500),
            url: source.url,
            license: IFIXIT_LICENSE,
            steps: extractSteps(parsed.data.steps),
            ...(parsed.data.summary
              ? { summary: sanitizePlainText(parsed.data.summary, 2_000) }
              : {}),
            ...(parsed.data.category
              ? { category: sanitizePlainText(parsed.data.category, 200) }
              : {}),
          },
        },
      };
    },
  };
}
