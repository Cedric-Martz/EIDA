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
  it("posts a normalized canonical request without credentials", async () => {
    const fetchImpl = vi.fn<ResearchFetch>(async () =>
      jsonResponse(responseBody()),
    );
    const result = await createExternalResearchClient({
      endpoint: "/api/research/search",
      fetchImpl,
    }).search({ query: " <b>Samsung</b>\u0000 SM-T530 ", limit: 5 });
    expect(result.ok && result.value[0].sources[0].title).toBe(
      "Service manual",
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("/api/research/search");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      schemaVersion: 1,
      query: "Samsung SM-T530",
      limit: 5,
    });
  });

  it.each([
    "http://research.example.com/search",
    "https://user:secret@research.example.com/search",
    "https://research.example.com/search?key=secret",
  ])("rejects unsafe endpoint %s", async (endpoint) => {
    const fetchImpl = vi.fn<ResearchFetch>();
    const result = await createExternalResearchClient({
      endpoint,
      fetchImpl,
    }).search({ query: "Tablet" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_configuration" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects noncanonical responses", async () => {
    const client = createExternalResearchClient({
      endpoint: "/api/research/search",
      fetchImpl: async () => jsonResponse({ query: "Tablet", sources: [] }),
    });
    expect(await client.search({ query: "Tablet" })).toMatchObject({
      ok: false,
      error: { code: "invalid_response" },
    });
  });

  it("rejects invalid requests locally", async () => {
    const fetchImpl = vi.fn<ResearchFetch>();
    const client = createExternalResearchClient({
      endpoint: "/api/research/search",
      fetchImpl,
    });
    expect(await client.search({ query: " <b></b> " })).toMatchObject({
      ok: false,
      error: { code: "invalid_request" },
    });
    expect(
      await client.search({ query: "Tablet", providerIds: ["web", "web"] }),
    ).toMatchObject({ ok: false, error: { code: "invalid_request" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [400, "invalid_request", false],
    [401, "unauthorized", false],
    [429, "rate_limited", true],
    [500, "provider_unavailable", true],
  ])("maps HTTP %i to stable error %s", async (status, code, retryable) => {
    const client = createExternalResearchClient({
      endpoint: "/api/research/search",
      fetchImpl: async () => jsonResponse({ error: "raw details" }, status),
    });
    expect(await client.search({ query: "Tablet" })).toMatchObject({
      ok: false,
      error: { code, retryable, httpStatus: status },
    });
  });
});
