import { describe, expect, it, vi } from "vitest";
import { analyzeMetaPhotos, buildMetaAnalysisRequest } from "./meta-model-api";

const validAnalysis = {
  observations: [
    {
      label: "Rear camera",
      category: "camera",
      visibility: "visible",
      description: "A camera opening is visible.",
      evidencePhotoIndices: [2],
    },
  ],
  notes: "Only externally visible features were reported.",
};

function photos() {
  return [1, 2, 3].map((index) => {
    const blob = new Blob([`photo-${index}`], { type: "image/jpeg" });
    return {
      id: `photo-${index}`,
      blob,
      mimeType: "image/jpeg",
      size: blob.size,
    };
  });
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Meta Model API adapter", () => {
  it("builds a documented chat-completions vision request", async () => {
    const request = await buildMetaAnalysisRequest("muse-spark-1.3", photos());
    const messages = request.messages as Array<Record<string, unknown>>;
    expect(messages[0].role).toBe("developer");
    const userContent = messages[1].content as Array<Record<string, unknown>>;
    expect(userContent).toHaveLength(4);
    expect(userContent[1]).toMatchObject({
      type: "image_url",
      image_url: { detail: "high" },
    });
    expect(request.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
    expect(messages[0].content).toContain("physically distinct parts");
    expect(messages[0].content).toContain(
      "Do not create observations for branding",
    );
  });

  it("uses a confirmed identity as context without treating it as evidence", async () => {
    const request = await buildMetaAnalysisRequest("muse-spark-1.3", photos(), {
      manufacturer: "Fairphone",
      model: "5",
      confirmedByUser: true,
    });
    const messages = request.messages as Array<Record<string, unknown>>;
    const userContent = messages[1].content as Array<Record<string, unknown>>;
    expect(userContent[0]).toMatchObject({ type: "text" });
    expect(userContent[0].text).toContain("Fairphone 5");
    expect(userContent[0].text).toContain("user-provided context");
  });

  it("keeps an unidentified device explicitly unknown", async () => {
    const request = await buildMetaAnalysisRequest("muse-spark-1.3", photos());
    const messages = request.messages as Array<Record<string, unknown>>;
    const userContent = messages[1].content as Array<Record<string, unknown>>;
    expect(userContent[0].text).toContain("device identity is unknown");
    expect(userContent[0].text).toContain("Do not guess");
  });

  it("validates a successful response and exposes aggregate tokens", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        id: "chatcmpl-1",
        choices: [{ message: { content: JSON.stringify(validAnalysis) } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 25,
          total_tokens: 125,
        },
      }),
    );
    const result = await analyzeMetaPhotos(
      "secret",
      "muse-spark-1.3",
      photos(),
      undefined,
      { fetchImpl },
    );
    expect(result).toMatchObject({
      ok: true,
      result: validAnalysis,
      usage: { inputTokens: 100, outputTokens: 25, totalTokens: 125 },
      providerRequestId: "chatcmpl-1",
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([
    [{ notes: "missing observations" }, "invalid_response"],
    [
      {
        observations: [
          {
            ...validAnalysis.observations[0],
            evidencePhotoIndices: [],
          },
        ],
        notes: "incomplete",
      },
      "invalid_response",
    ],
  ])("rejects incomplete output %#", async (content, expectedCode) => {
    const result = await analyzeMetaPhotos(
      "secret",
      "muse-spark-1.3",
      photos(),
      undefined,
      {
        fetchImpl: async () =>
          jsonResponse({
            choices: [{ message: { content: JSON.stringify(content) } }],
          }),
      },
    );
    expect(result).toMatchObject({ ok: false, code: expectedCode });
  });

  it("accepts contradictory observations without resolving them", async () => {
    const contradictory = {
      observations: [
        validAnalysis.observations[0],
        {
          ...validAnalysis.observations[0],
          visibility: "not_visible",
          description: "Not visible in the front view.",
          evidencePhotoIndices: [1],
        },
      ],
      notes: "Different views provide different visibility.",
    };
    const result = await analyzeMetaPhotos(
      "secret",
      "muse-spark-1.3",
      photos(),
      undefined,
      {
        fetchImpl: async () =>
          jsonResponse({
            choices: [{ message: { content: JSON.stringify(contradictory) } }],
          }),
      },
    );
    expect(result.ok && result.result.observations).toHaveLength(2);
  });

  it("rejects malformed JSON without throwing", async () => {
    const result = await analyzeMetaPhotos(
      "secret",
      "muse-spark-1.3",
      photos(),
      undefined,
      {
        fetchImpl: async () =>
          jsonResponse({ choices: [{ message: { content: "{" } }] }),
      },
    );
    expect(result).toMatchObject({ ok: false, code: "invalid_json" });
  });

  it("retries a quota response once and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: {} }, 429))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: JSON.stringify(validAnalysis) } }],
        }),
      );
    const result = await analyzeMetaPhotos(
      "secret",
      "muse-spark-1.3",
      photos(),
      undefined,
      { fetchImpl, retryDelayMs: 0 },
    );
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, "auth_rejected"],
    [403, "access_forbidden"],
    [400, "invalid_request"],
    [500, "provider_unavailable"],
  ])("maps HTTP %i to a stable sanitized error", async (status, code) => {
    const result = await analyzeMetaPhotos(
      "secret",
      "muse-spark-1.3",
      photos(),
      undefined,
      {
        fetchImpl: async () =>
          jsonResponse({ error: { message: "raw" } }, status),
        retryDelayMs: 0,
      },
    );
    expect(result).toMatchObject({ ok: false, code, httpStatus: status });
    expect(result.ok ? "" : result.message).not.toContain("raw");
  });

  it("distinguishes timeout from a CORS or network failure", async () => {
    const timeout = await analyzeMetaPhotos(
      "secret",
      "muse-spark-1.3",
      photos(),
      undefined,
      {
        fetchImpl: async () => {
          throw new DOMException("Aborted", "AbortError");
        },
      },
    );
    const network = await analyzeMetaPhotos(
      "secret",
      "muse-spark-1.3",
      photos(),
      undefined,
      {
        fetchImpl: async () => {
          throw new TypeError("Failed to fetch");
        },
      },
    );
    expect(timeout).toMatchObject({ ok: false, code: "timeout" });
    expect(network).toMatchObject({ ok: false, code: "network_or_cors" });
  });
});
