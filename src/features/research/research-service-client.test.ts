import { describe, expect, it, vi } from "vitest";
import type { ResearchFetch } from "./network";
import { createExternalResearchClient } from "./research-service-client";

function responseBody() {
  return {
    schemaVersion: 1,
    results: [
      {
        schemaVersion: 1,
        provider: { id: "web", label: "Web Search" },
        query: "Samsung SM-T530",
        status: "succeeded",
        startedAt: 10,
        completedAt: 11,
        sources: [
          {
            schemaVersion: 1,
            id: "source-1",
            url: "https://example.com/manual",
            canonicalUrl: "https://example.com/manual",
            title: "<b>Service manual</b>",
            sourceType: "service-manual",
            provider: { id: "web", label: "Web Search" },
            discoveredAt: 10,
            license: {
              code: "unknown",
              label: "Unknown",
              attributionRequired: null,
              commercialUse: "unknown",
              derivatives: "unknown",
            },
            selection: "discovered",
          },
        ],
        artifacts: [],
        claims: [],
        warnings: [],
        error: null,
      },
    ],
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("external browser research client", () => {
  it("posts a normalized, versioned request without credentials", async () => {
    const fetchImpl = vi.fn<ResearchFetch>(async () =>
      jsonResponse(responseBody()),
    );
    const client = createExternalResearchClient({
      endpoint: "https://research.example.com/v1/search",
      fetchImpl,
    });
    const result = await client.search({
      query: " <b>Samsung</b>\u0000 SM-T530 ",
      providerIds: ["web"],
      limit: 5,
    });

    expect(result.ok && result.value[0].sources[0].title).toBe(
      "Service manual",
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://research.example.com/v1/search");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      schemaVersion: 1,
      query: "Samsung SM-T530",
      providerIds: ["web"],
      limit: 5,
    });
    expect(JSON.stringify(init?.headers)).not.toMatch(/authorization|api.key/i);
  });

  it.each([
    ["http://research.example.com/search", "invalid_configuration"],
    [
      "https://user:secret@research.example.com/search",
      "invalid_configuration",
    ],
    ["https://research.example.com/search?key=secret", "invalid_configuration"],
  ])("rejects unsafe endpoint %s", async (endpoint, code) => {
    const fetchImpl = vi.fn<ResearchFetch>();
    const result = await createExternalResearchClient({
      endpoint,
      fetchImpl,
    }).search({ query: "Tablet" });
    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("allows an HTTP localhost endpoint for local development", async () => {
    const client = createExternalResearchClient({
      endpoint: "http://localhost:8787/search",
      fetchImpl: async () => jsonResponse(responseBody()),
    });
    expect((await client.search({ query: "Samsung SM-T530" })).ok).toBe(true);
  });

  it("strictly normalizes the current worker payload into provider results", async () => {
    const client = createExternalResearchClient({
      endpoint: "https://research.example.com/v1/research",
      fetchImpl: async () =>
        jsonResponse({
          query: "Samsung SM-T530",
          sources: [
            {
              externalId: "ifixit-guide-97059",
              url: "https://www.ifixit.com/Guide/Samsung+SM-T530/97059?utm_source=test",
              title: "Samsung SM-T530 Disassembly",
              publisher: "iFixit",
              summary: "How to open the tablet",
              sourceType: "teardown",
              provider: "ifixit",
              license: "CC-BY-NC-SA-3.0",
              confidence: 0.9,
              thumbnailUrl:
                "https://guide-images.cdn.ifixit.com/example.medium",
              modifiedAt: "2026-10-29T10:00:00.000Z",
            },
            {
              externalId: "brave-1-example.com",
              url: "https://example.com/device.step",
              title: "Device STEP model",
              publisher: "example.com",
              summary: "A candidate model",
              sourceType: "cad",
              provider: "brave",
              license: "unknown",
              confidence: 0.64,
            },
          ],
          meta: {
            searchedAt: "2026-10-30T10:00:00.000Z",
            providers: ["ifixit", "brave"],
            partial: false,
            generalWebSearchConfigured: true,
          },
        }),
    });

    const result = await client.search({ query: "Samsung SM-T530" });
    expect(result).toMatchObject({
      ok: true,
      value: [
        {
          provider: { id: "ifixit", label: "iFixit" },
          sources: [
            {
              id: "ifixit-guide-97059",
              canonicalUrl:
                "https://www.ifixit.com/Guide/Samsung+SM-T530/97059",
              sourceType: "teardown-guide",
              relevanceScore: 0.9,
              license: { code: "cc-by-nc-sa-3.0" },
            },
          ],
        },
        {
          provider: { id: "brave", label: "Brave Search" },
          sources: [
            {
              id: "brave-1-example.com",
              sourceType: "cad-model",
              license: { code: "unknown" },
            },
          ],
        },
      ],
    });
  });

  it("carries a worker partial marker into every provider result", async () => {
    const client = createExternalResearchClient({
      endpoint: "https://research.example.com/v1/research",
      fetchImpl: async () =>
        jsonResponse({
          query: "Tablet",
          sources: [],
          meta: {
            searchedAt: "2026-10-30T10:00:00.000Z",
            providers: ["ifixit"],
            partial: true,
            generalWebSearchConfigured: false,
          },
        }),
    });
    expect(await client.search({ query: "Tablet" })).toMatchObject({
      ok: true,
      value: [
        {
          status: "partial",
          warnings: [
            "The research service reported a partial provider result.",
          ],
        },
      ],
    });
  });

  it.each([
    [
      "a mismatched response query",
      {
        query: "Different device",
        sources: [],
        meta: {
          searchedAt: "2026-10-30T10:00:00.000Z",
          providers: ["ifixit"],
          partial: false,
          generalWebSearchConfigured: false,
        },
      },
    ],
    [
      "an invalid source URL",
      {
        query: "Tablet",
        sources: [
          {
            externalId: "source-1",
            url: "javascript:alert(1)",
            title: "Bad source",
            publisher: "Unknown",
            summary: "",
            sourceType: "web_page",
            provider: "brave",
            license: "unknown",
            confidence: 0.5,
          },
        ],
        meta: {
          searchedAt: "2026-10-30T10:00:00.000Z",
          providers: ["brave"],
          partial: false,
          generalWebSearchConfigured: true,
        },
      },
    ],
    [
      "an unsupported legacy enum",
      {
        query: "Tablet",
        sources: [
          {
            externalId: "source-1",
            url: "https://example.com/source",
            title: "Unknown source",
            publisher: "Unknown",
            summary: "",
            sourceType: "executable",
            provider: "brave",
            license: "unknown",
            confidence: 0.5,
          },
        ],
        meta: {
          searchedAt: "2026-10-30T10:00:00.000Z",
          providers: ["brave"],
          partial: false,
          generalWebSearchConfigured: true,
        },
      },
    ],
  ])("rejects worker payload with %s", async (_label, payload) => {
    const client = createExternalResearchClient({
      endpoint: "https://research.example.com/v1/research",
      fetchImpl: async () => jsonResponse(payload),
    });
    expect(await client.search({ query: "Tablet" })).toMatchObject({
      ok: false,
      error: { code: "invalid_response" },
    });
  });

  it("rejects empty, duplicate-provider and oversized requests locally", async () => {
    const fetchImpl = vi.fn<ResearchFetch>();
    const client = createExternalResearchClient({
      endpoint: "https://research.example.com/search",
      fetchImpl,
    });
    expect(await client.search({ query: " <b></b> " })).toMatchObject({
      ok: false,
      error: { code: "invalid_request" },
    });
    expect(
      await client.search({ query: "Tablet", providerIds: ["web", "web"] }),
    ).toMatchObject({ ok: false, error: { code: "invalid_request" } });
    expect(await client.search({ query: "Tablet", limit: 101 })).toMatchObject({
      ok: false,
      error: { code: "invalid_request" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [400, "invalid_request", false],
    [401, "unauthorized", false],
    [403, "forbidden", false],
    [404, "not_found", false],
    [429, "rate_limited", true],
    [500, "provider_unavailable", true],
  ])("maps HTTP %i to stable error %s", async (status, code, retryable) => {
    const client = createExternalResearchClient({
      endpoint: "https://research.example.com/search",
      fetchImpl: async () =>
        jsonResponse({ error: "raw provider details" }, status),
    });
    const result = await client.search({ query: "Tablet" });
    expect(result).toMatchObject({
      ok: false,
      error: { code, retryable, httpStatus: status },
    });
    expect(result.ok ? "" : result.error.message).not.toContain("raw");
  });

  it("distinguishes invalid JSON and a schema-invalid response", async () => {
    const invalidJson = createExternalResearchClient({
      endpoint: "https://research.example.com/search",
      fetchImpl: async () => new Response("{", { status: 200 }),
    });
    const invalidShape = createExternalResearchClient({
      endpoint: "https://research.example.com/search",
      fetchImpl: async () => jsonResponse({ results: "not-an-array" }),
    });
    expect(await invalidJson.search({ query: "Tablet" })).toMatchObject({
      ok: false,
      error: { code: "invalid_json" },
    });
    expect(await invalidShape.search({ query: "Tablet" })).toMatchObject({
      ok: false,
      error: { code: "invalid_response" },
    });
  });

  it("returns a stable timeout for a stalled fetch", async () => {
    const fetchImpl: ResearchFetch = async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    const client = createExternalResearchClient({
      endpoint: "https://research.example.com/search",
      timeoutMs: 1,
      fetchImpl,
    });
    expect(await client.search({ query: "Tablet" })).toMatchObject({
      ok: false,
      error: { code: "timeout", retryable: true },
    });
  });

  it("does not start a fetch for an already cancelled request", async () => {
    const fetchImpl = vi.fn<ResearchFetch>();
    const controller = new AbortController();
    controller.abort();
    const client = createExternalResearchClient({
      endpoint: "https://research.example.com/search",
      fetchImpl,
    });
    expect(
      await client.search({ query: "Tablet" }, controller.signal),
    ).toMatchObject({ ok: false, error: { code: "aborted" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
