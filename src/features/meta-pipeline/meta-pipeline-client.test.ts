import { describe, expect, it, vi } from "vitest";
import { createMetaPipelineClient } from "./meta-pipeline-client";

const health = {
  ok: true,
  service: "eida-meta-pipeline",
  models: {
    reasoning: "Llama 4 Scout",
    segmentation: "SAM 3",
    matching: "DINOv3",
    reconstruction: "SAM 3D Objects",
  },
};

const stageIds = [
  "llama-evidence",
  "sam-segmentation",
  "dino-matching",
  "sam3d-reconstruction",
  "llama-assembly",
  "validation-delivery",
] as const;

describe("createMetaPipelineClient", () => {
  it("validates health responses and sends an optional bearer token", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(health), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const client = createMetaPipelineClient({
      endpoint: "https://gpu.example.com/",
      token: "secret",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(client.health()).resolves.toEqual(health);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gpu.example.com/health",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret" },
      }),
    );
  });

  it("rejects insecure remote endpoints", () => {
    expect(() =>
      createMetaPipelineClient({ endpoint: "http://gpu.example.com" }),
    ).toThrow(/HTTPS/);
  });

  it("submits photos and a JSON request as one reconstruction job", async () => {
    const job = {
      schemaVersion: 1,
      id: "job-1",
      projectId: "project-1",
      status: "queued",
      createdAt: 1,
      updatedAt: 1,
      stages: stageIds.map((id) => ({
        id,
        model: "Meta model",
        status: "pending",
        progress: 0,
        summary: "Waiting for compute",
        artifactCount: 0,
      })),
      artifacts: [],
      manifest: null,
      error: null,
    };
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response(JSON.stringify(job), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
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
    const client = createMetaPipelineClient({
      endpoint: "http://localhost:8001",
      fetchImpl: fetchImpl as typeof fetch,
    });

    await expect(
      client.createJob({ projectId: "project-1" }, photos),
    ).resolves.toMatchObject({ id: "job-1", status: "queued" });
    const call = fetchImpl.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("Expected a fetch call");
    const init = call[1];
    expect(init).toBeDefined();
    if (!init) throw new Error("Expected fetch options");
    expect(call[0]).toBe("http://localhost:8001/v1/reconstructions");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).getAll("photos")).toHaveLength(3);
    expect((init.body as FormData).get("request")).toBeInstanceOf(Blob);
  });
});
