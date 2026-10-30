import { describe, expect, it, vi } from "vitest";
import type { ResearchFetch } from "./network";
import { createIfixitClient, IFIXIT_LICENSE } from "./ifixit-client";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("public iFixit browser adapter", () => {
  it("uses the public suggest endpoint and maps guides to research sources", async () => {
    const fetchImpl = vi.fn<ResearchFetch>(async () =>
      jsonResponse({
        query: "Galaxy Tab SM-T530",
        results: [
          {
            dataType: "guide",
            guideid: 123,
            title: "<b>Galaxy Tab teardown</b>",
            url: "https://www.ifixit.com/Teardown/Galaxy+Tab/123",
            summary: "Internal <em>assembly</em> photos",
            type: "teardown",
            image: {
              thumbnail:
                "https://guide-images.cdn.ifixit.com/igi/example.thumbnail",
            },
          },
        ],
      }),
    );
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(110);
    const result = await createIfixitClient({ fetchImpl, now }).searchGuides(
      " Galaxy\u0000 Tab SM-T530 ",
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        provider: { id: "ifixit", label: "iFixit" },
        query: "Galaxy Tab SM-T530",
        status: "succeeded",
        startedAt: 100,
        completedAt: 110,
        sources: [
          {
            id: "ifixit-guide-123",
            title: "Galaxy Tab teardown",
            sourceType: "teardown-guide",
            license: IFIXIT_LICENSE,
            selection: "discovered",
          },
        ],
      },
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain(
      "/suggest/Galaxy%20Tab%20SM-T530?doctypes=guide",
    );
    expect(init).toMatchObject({
      method: "GET",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
  });

  it("falls back to a trusted iFixit guide URL and drops off-domain images", async () => {
    const result = await createIfixitClient({
      fetchImpl: async () =>
        jsonResponse({
          results: [
            {
              dataType: "guide",
              guideid: 123,
              title: "Battery replacement",
              url: "https://evil.example/phishing",
              image: { thumbnail: "https://evil.example/tracker.gif" },
            },
          ],
        }),
      now: () => 100,
    }).searchGuides("Tablet");
    expect(result.ok && result.value.sources[0]).toMatchObject({
      url: "https://www.ifixit.com/Guide/123",
      canonicalUrl: "https://www.ifixit.com/Guide/123",
    });
    expect(
      result.ok ? result.value.sources[0].thumbnailUrl : "unexpected failure",
    ).toBeUndefined();
  });

  it("keeps valid suggestions while reporting malformed ones", async () => {
    const result = await createIfixitClient({
      fetchImpl: async () =>
        jsonResponse({
          results: [
            { guideid: -1, title: "Invalid" },
            { guideid: 2, title: "Valid guide" },
          ],
        }),
      now: () => 100,
    }).searchGuides("Tablet");
    expect(result).toMatchObject({
      ok: true,
      value: {
        status: "partial",
        sources: [{ id: "ifixit-guide-2" }],
        warnings: ["Ignored 1 malformed iFixit result."],
      },
    });
  });

  it("loads and sanitizes guide steps without exposing raw HTML", async () => {
    const result = await createIfixitClient({
      fetchImpl: async () =>
        jsonResponse({
          guideid: 42,
          title: "<b>Display replacement</b>",
          url: "https://www.ifixit.com/Guide/Display+Replacement/42",
          summary: "Open the <em>tablet</em>.",
          category: "Example Tablet",
          steps: [
            {
              stepid: 7,
              orderby: 1,
              title: "<strong>Open housing</strong>",
              lines: [
                { text_rendered: "<p>Remove the rear cover.</p>" },
                { text_raw: "Remove six screws." },
              ],
              media: {
                data: [
                  {
                    original:
                      "https://guide-images.cdn.ifixit.com/igi/photo-original",
                  },
                  { original: "https://tracker.example/photo" },
                ],
              },
            },
          ],
        }),
      now: () => 100,
    }).getGuide(42);

    expect(result).toMatchObject({
      ok: true,
      value: {
        source: { id: "ifixit-guide-42", selection: "discovered" },
        guide: {
          id: 42,
          title: "Display replacement",
          summary: "Open the tablet .",
          license: IFIXIT_LICENSE,
          steps: [
            {
              id: 7,
              order: 1,
              title: "Open housing",
              lines: ["Remove the rear cover.", "Remove six screws."],
              imageUrls: [
                "https://guide-images.cdn.ifixit.com/igi/photo-original",
              ],
            },
          ],
        },
      },
    });
  });

  it("rejects invalid input locally", async () => {
    const fetchImpl = vi.fn<ResearchFetch>();
    const client = createIfixitClient({ fetchImpl });
    expect(await client.searchGuides(" <b></b> ")).toMatchObject({
      ok: false,
      error: { code: "invalid_request" },
    });
    expect(await client.getGuide(0)).toMatchObject({
      ok: false,
      error: { code: "invalid_request" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a mismatched guide response", async () => {
    const result = await createIfixitClient({
      fetchImpl: async () => jsonResponse({ guideid: 99, title: "Other" }),
    }).getGuide(42);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_response" },
    });
  });

  it("uses stable sanitized errors for HTTP failures", async () => {
    const result = await createIfixitClient({
      fetchImpl: async () =>
        jsonResponse({ message: "raw rate limit detail" }, 429),
    }).searchGuides("Tablet");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "rate_limited", retryable: true, httpStatus: 429 },
    });
    expect(result.ok ? "" : result.error.message).not.toContain("raw");
  });

  it("rejects an untrusted API base URL", async () => {
    const fetchImpl = vi.fn<ResearchFetch>();
    const result = await createIfixitClient({
      baseUrl: "https://evil.example/api/2.0",
      fetchImpl,
    }).searchGuides("Tablet");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid_configuration" },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
