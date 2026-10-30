import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./worker";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("research worker", () => {
  it("exposes a health route", async () => {
    const response = await worker.fetch(
      new Request("https://research.example/health"),
      {},
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: "eida-research",
    });
  });

  it("rejects untrusted browser origins", async () => {
    const response = await worker.fetch(
      new Request("https://research.example/health", {
        headers: { origin: "https://attacker.example" },
      }),
      { ALLOWED_ORIGINS: "https://owner.github.io" },
    );

    expect(response.status).toBe(403);
  });

  it("normalizes public iFixit search results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              query: "Samsung SM-T530",
              results: [
                {
                  dataType: "guide",
                  guideid: 97059,
                  title: "Samsung sm-t530 Disassembly",
                  summary: "How to open the tablet",
                  url: "https://www.ifixit.com/Guide/Samsung+sm-t530+Disassembly/97059",
                  type: "technique",
                  modified_date: 1722024299,
                  image: {
                    medium:
                      "https://guide-images.cdn.ifixit.com/example.medium",
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const response = await worker.fetch(
      new Request("https://research.example/v1/research", {
        method: "POST",
        headers: {
          origin: "https://owner.github.io",
          "content-type": "application/json",
        },
        body: JSON.stringify({ query: "Samsung SM-T530" }),
      }),
      { ALLOWED_ORIGINS: "https://owner.github.io" },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://owner.github.io",
    );
    await expect(response.json()).resolves.toMatchObject({
      query: "Samsung SM-T530",
      sources: [
        {
          provider: "ifixit",
          sourceType: "teardown",
          license: "CC-BY-NC-SA-3.0",
        },
      ],
    });
  });
});
