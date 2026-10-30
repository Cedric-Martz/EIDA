import type {
  ResearchError,
  ResearchErrorCode,
} from "@/domain/research/schema";
import { sanitizeNetworkPayload } from "./sanitize";

export type ResearchFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ResearchCallResult<T> =
  { ok: true; value: T } | { ok: false; error: ResearchError };

export const RESEARCH_ERROR_MESSAGES: Record<ResearchErrorCode, string> = {
  invalid_configuration: "The research service configuration is invalid.",
  invalid_request: "The research request is invalid.",
  unauthorized: "The research service rejected the request.",
  forbidden: "The research service does not allow this request.",
  not_found: "The requested research resource was not found.",
  rate_limited: "The research service rate limit was reached.",
  provider_unavailable: "The research provider is temporarily unavailable.",
  timeout: "The research request timed out.",
  aborted: "The research request was cancelled.",
  network_or_cors:
    "The browser could not reach the research service. Check its network and CORS configuration.",
  invalid_json: "The research service returned invalid JSON.",
  invalid_response: "The research service returned an invalid response.",
};

const RETRYABLE_CODES = new Set<ResearchErrorCode>([
  "rate_limited",
  "provider_unavailable",
  "timeout",
  "network_or_cors",
]);

export function researchError(
  code: ResearchErrorCode,
  httpStatus?: number,
): ResearchError {
  return {
    code,
    message: RESEARCH_ERROR_MESSAGES[code],
    retryable: RETRYABLE_CODES.has(code),
    ...(httpStatus === undefined ? {} : { httpStatus }),
  };
}

function codeForHttpStatus(status: number): ResearchErrorCode {
  if (status === 400 || status === 413 || status === 422) {
    return "invalid_request";
  }
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "invalid_response";
}

type FetchJsonOptions = {
  fetchImpl?: ResearchFetch;
  timeoutMs?: number;
  signal?: AbortSignal;
  init?: RequestInit;
};

export async function fetchSanitizedJson(
  url: string,
  options: FetchJsonOptions = {},
): Promise<ResearchCallResult<unknown>> {
  if (options.signal?.aborted) {
    return { ok: false, error: researchError("aborted") };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 12_000, 1), 120_000);
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...options.init,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: researchError(
          codeForHttpStatus(response.status),
          response.status,
        ),
      };
    }

    try {
      return {
        ok: true,
        value: sanitizeNetworkPayload(await response.json()),
      };
    } catch {
      return { ok: false, error: researchError("invalid_json") };
    }
  } catch {
    const code: ResearchErrorCode = timedOut
      ? "timeout"
      : options.signal?.aborted
        ? "aborted"
        : "network_or_cors";
    return { ok: false, error: researchError(code) };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}
