import { describe, expect, it } from "vitest";
import { inferenceRunSchema } from "./run";

function pendingRun() {
  return {
    schemaVersion: 1,
    id: "run-1",
    projectId: "project-1",
    device: { confirmedByUser: false },
    model: "muse-spark-1.3",
    createdAt: 1,
    status: "pending",
    consent: {
      approvedAt: 1,
      photoIds: ["photo-1", "photo-2", "photo-3"],
    },
    photos: [1, 2, 3].map((index) => ({
      id: `photo-${index}`,
      index,
      locator: `asset:photo-${index}`,
    })),
    observations: null,
    resolvedProject: null,
    usage: null,
    error: null,
  };
}

describe("inferenceRunSchema", () => {
  it("retains only versioned non-secret run metadata", () => {
    const run = inferenceRunSchema.parse({
      ...pendingRun(),
      apiKey: "must-not-survive",
      rawImages: ["must-not-survive"],
      privatePrompt: "must-not-survive",
    });
    expect(run).not.toHaveProperty("apiKey");
    expect(run).not.toHaveProperty("rawImages");
    expect(run).not.toHaveProperty("privatePrompt");
    expect(run.photos.map((photo) => photo.id)).toEqual([
      "photo-1",
      "photo-2",
      "photo-3",
    ]);
  });

  it("requires the exact transmitted set of three photo references", () => {
    expect(() =>
      inferenceRunSchema.parse({
        ...pendingRun(),
        photos: pendingRun().photos.slice(0, 2),
      }),
    ).toThrow();
  });
});
