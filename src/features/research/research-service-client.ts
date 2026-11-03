import {
  researchSearchRequestSchema,
  researchServiceResponseSchema,
  type ResearchProviderResult,
} from "@/domain/research/schema";
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

// Live search may fan out through several web queries. Keep the browser alive
// longer than the server-side provider deadline so a partial response (for
// example, iFixit results plus a timed-out web provider) can still be shown.
export const DEFAULT_RESEARCH_TIMEOUT_MS = 65_000;

function parseServiceResponse(
  value: unknown,
  expectedQuery: string,
): ResearchProviderResult[] | null {
  const canonical = researchServiceResponseSchema.safeParse(value);
  return canonical.success &&
    canonical.data.results.every((result) => result.query === expectedQuery)
    ? canonical.data.results
    : null;
}

function normalizeEndpoint(value: string): string | null {
  if (/^\/[a-z0-9/_-]*$/i.test(value)) return value;
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
        timeoutMs: config.timeoutMs ?? DEFAULT_RESEARCH_TIMEOUT_MS,
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
