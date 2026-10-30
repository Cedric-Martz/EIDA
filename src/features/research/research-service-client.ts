import {
  discoveredSourceSchema,
  httpUrlSchema,
  researchSearchRequestSchema,
  researchServiceResponseSchema,
  type DiscoveredSource,
  type ResearchLicense,
  type ResearchProviderResult,
} from "@/domain/research/schema";
import { canonicalizeSourceUrl } from "@/domain/research/source-list";
import { z } from "zod";
import {
  fetchSanitizedJson,
  researchError,
  type ResearchCallResult,
  type ResearchFetch,
} from "./network";
import { normalizeResearchQuery } from "./sanitize";

export type ExternalResearchClientConfig = {
  endpoint: string;
  timeoutMs?: number;
  fetchImpl?: ResearchFetch;
};

export type ExternalResearchSearchInput = {
  query: string;
  providerIds?: string[];
  limit?: number;
};

export type ExternalResearchClient = {
  search(
    input: ExternalResearchSearchInput,
    signal?: AbortSignal,
  ): Promise<ResearchCallResult<ResearchProviderResult[]>>;
};

const legacySourceTypeSchema = z.enum([
  "teardown",
  "repair_guide",
  "service_manual",
  "datasheet",
  "cad",
  "repository",
  "web_page",
]);

const legacySourceSchema = z.object({
  externalId: z.string().trim().min(1).max(200),
  url: httpUrlSchema,
  title: z.string().trim().min(1).max(500),
  publisher: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(2_000),
  sourceType: legacySourceTypeSchema,
  provider: z.enum(["ifixit", "brave"]),
  license: z.enum(["CC-BY-NC-SA-3.0", "unknown"]),
  confidence: z.number().min(0).max(1),
  thumbnailUrl: httpUrlSchema.optional(),
  modifiedAt: z
    .string()
    .refine((value) => Number.isFinite(Date.parse(value)))
    .optional(),
});

const legacyWorkerResponseSchema = z.object({
  query: z.string().trim().min(1).max(200),
  sources: z.array(legacySourceSchema).max(500),
  meta: z.object({
    searchedAt: z
      .string()
      .refine((value) => Number.isFinite(Date.parse(value))),
    providers: z
      .array(z.enum(["ifixit", "brave"]))
      .min(1)
      .max(20),
    partial: z.boolean(),
    generalWebSearchConfigured: z.boolean(),
  }),
});

const UNKNOWN_LICENSE: ResearchLicense = {
  code: "unknown",
  label: "Unknown",
  attributionRequired: null,
  commercialUse: "unknown",
  derivatives: "unknown",
};

const IFIXIT_LEGACY_LICENSE: ResearchLicense = {
  code: "cc-by-nc-sa-3.0",
  label: "Creative Commons BY-NC-SA 3.0",
  url: "https://www.ifixit.com/Info/Licensing",
  attributionRequired: true,
  commercialUse: "forbidden",
  derivatives: "share-alike",
};

const legacySourceTypeMap = {
  teardown: "teardown-guide",
  repair_guide: "repair-guide",
  service_manual: "service-manual",
  datasheet: "datasheet",
  cad: "cad-model",
  repository: "repository",
  web_page: "web-page",
} as const;

function providerLabel(provider: "ifixit" | "brave"): string {
  return provider === "ifixit" ? "iFixit" : "Brave Search";
}

function normalizeLegacyWorkerResponse(
  value: unknown,
  expectedQuery: string,
): ResearchProviderResult[] | null {
  const parsed = legacyWorkerResponseSchema.safeParse(value);
  if (!parsed.success || parsed.data.query !== expectedQuery) return null;

  const discoveredAt = Date.parse(parsed.data.meta.searchedAt);
  const sources: DiscoveredSource[] = [];
  for (const legacy of parsed.data.sources) {
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeSourceUrl(legacy.url);
    } catch {
      return null;
    }
    const source = discoveredSourceSchema.safeParse({
      schemaVersion: 1,
      id: legacy.externalId,
      url: legacy.url,
      canonicalUrl,
      title: legacy.title,
      publisher: legacy.publisher,
      sourceType: legacySourceTypeMap[legacy.sourceType],
      provider: {
        id: legacy.provider,
        label: providerLabel(legacy.provider),
      },
      ...(legacy.summary ? { summary: legacy.summary } : {}),
      ...(legacy.thumbnailUrl ? { thumbnailUrl: legacy.thumbnailUrl } : {}),
      discoveredAt,
      relevanceScore: legacy.confidence,
      license:
        legacy.license === "CC-BY-NC-SA-3.0"
          ? IFIXIT_LEGACY_LICENSE
          : UNKNOWN_LICENSE,
      selection: "discovered",
    });
    if (!source.success) return null;
    sources.push(source.data);
  }

  const provenance = new Set(parsed.data.meta.providers);
  for (const source of sources)
    provenance.add(source.provider.id as "ifixit" | "brave");
  return Array.from(provenance, (provider): ResearchProviderResult => ({
    schemaVersion: 1,
    provider: { id: provider, label: providerLabel(provider) },
    query: expectedQuery,
    status: parsed.data.meta.partial ? "partial" : "succeeded",
    startedAt: discoveredAt,
    completedAt: discoveredAt,
    sources: sources.filter((source) => source.provider.id === provider),
    artifacts: [],
    claims: [],
    warnings: parsed.data.meta.partial
      ? ["The research service reported a partial provider result."]
      : [],
    error: null,
  }));
}

function parseServiceResponse(
  value: unknown,
  expectedQuery: string,
): ResearchProviderResult[] | null {
  const canonical = researchServiceResponseSchema.safeParse(value);
  if (canonical.success) {
    return canonical.data.results.every(
      (result) => result.query === expectedQuery,
    )
      ? canonical.data.results
      : null;
  }
  return normalizeLegacyWorkerResponse(value, expectedQuery);
}

function normalizeEndpoint(value: string): string | null {
  try {
    const endpoint = new URL(value);
    const localHttp =
      endpoint.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
    if (endpoint.protocol !== "https:" && !localHttp) return null;
    if (
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      return null;
    }
    return endpoint.toString();
  } catch {
    return null;
  }
}

export function createExternalResearchClient(
  config: ExternalResearchClientConfig,
): ExternalResearchClient {
  const endpoint = normalizeEndpoint(config.endpoint);

  return {
    async search(input, signal) {
      if (endpoint === null) {
        return { ok: false, error: researchError("invalid_configuration") };
      }

      const request = researchSearchRequestSchema.safeParse({
        schemaVersion: 1,
        query: normalizeResearchQuery(input.query),
        ...(input.providerIds === undefined
          ? {}
          : { providerIds: input.providerIds }),
        ...(input.limit === undefined ? {} : { limit: input.limit }),
      });
      if (!request.success) {
        return { ok: false, error: researchError("invalid_request") };
      }

      const response = await fetchSanitizedJson(endpoint, {
        fetchImpl: config.fetchImpl,
        timeoutMs: config.timeoutMs,
        signal,
        init: {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request.data),
        },
      });
      if (!response.ok) return response;

      const results = parseServiceResponse(response.value, request.data.query);
      if (results === null) {
        return { ok: false, error: researchError("invalid_response") };
      }
      return { ok: true, value: results };
    },
  };
}
