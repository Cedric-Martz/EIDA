import { describe, expect, it } from "vitest";
import { mapAnythingHealthSchema, mapAnythingJobSchema } from "./schema";

describe("MapAnything worker schemas", () => {
  it("accepts a ready worker and a completed metric scene", () => {
    expect(
      mapAnythingHealthSchema.parse({
        ok: true,
        service: "eida-mapanything-worker",
        model: "facebook/map-anything-apache",
        device: "cuda",
        ready: true,
        maxPhotos: 8,
        detail: "Ready for metric reconstruction.",
      }).ready,
    ).toBe(true);

    expect(
      mapAnythingJobSchema.parse({
        schemaVersion: 1,
        id: "map-job-1",
        projectId: "project-1",
        status: "succeeded",
        createdAt: 1,
        updatedAt: 2,
        photoCount: 4,
        progress: 1,
        message: "Metric scene ready.",
        artifacts: [
          {
            id: "map-job-1-scene",
            kind: "scene-glb",
            label: "Metric scene",
            url: "https://worker.example.com/artifacts/map-job-1/scene.glb",
            mimeType: "model/gltf-binary",
          },
        ],
        error: null,
      }).artifacts,
    ).toHaveLength(1);
  });
});
