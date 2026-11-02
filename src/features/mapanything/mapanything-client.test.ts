import { describe, expect, it, vi } from "vitest";
import { createMapAnythingClient } from "./mapanything-client";

const health = {
  ok: true,
  service: "eida-mapanything-worker",
  model: "facebook/map-anything-apache",
  device: "cuda",
  ready: true,
  maxPhotos: 8,
  detail: "Ready for metric reconstruction.",
};

const job = {
  schemaVersion: 1,
  id: "map-job-1",
  projectId: "project-1",
  status: "queued",
  createdAt: 1,
  updatedAt: 1,
  photoCount: 3,
  progress: 0,
  message: "Queued for metric reconstruction.",
  artifacts: [],
  error: null,
};

describe("createMapAnythingClient", () => {
  it("checks health and submits three to eight photos", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        return new Response(
          JSON.stringify(String(input).endsWith("/health") ? health : job),
          {
            status: String(input).endsWith("/health") ? 200 : 202,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    );
    const client = createMapAnythingClient({
      endpoint: "http://localhost:8001/",
      token: "worker-token",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const photos = [1, 2, 3].map((index) => ({
      id: `photo-${index}`,
      projectId: "project-1",
      kind: "photo" as const,
      name: `view-${index}.jpg`,
      mimeType: "image/jpeg",
      size: 5,
      createdAt: index,
      blob: new Blob(["photo"], { type: "image/jpeg" }),
    }));

    await expect(client.health()).resolves.toEqual(health);
    await expect(
      client.createJob({ projectId: "project-1" }, photos),
    ).resolves.toMatchObject({ id: "map-job-1" });
    const createCall = fetchImpl.mock.calls[1];
    expect(createCall?.[0]).toBe("http://localhost:8001/v1/maps");
    expect(createCall?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer worker-token" },
      }),
    );
  });

  it("rejects insecure remote endpoints", () => {
    expect(() =>
      createMapAnythingClient({ endpoint: "http://gpu.example.com" }),
    ).toThrow(/HTTPS/);
  });
});
