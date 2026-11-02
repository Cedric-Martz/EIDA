import { describe, expect, it } from "vitest";
import {
  cadAnalysisSchema,
  extractedArtifactSchema,
  extractedDimensionSchema,
} from "./evidence-bundle";

describe("web evidence bundle", () => {
  it("keeps parsed CAD bounds, fingerprint and provenance", () => {
    const analysis = cadAnalysisSchema.parse({
      status: "parsed",
      format: "step",
      fileName: "enclosure.step",
      byteSize: 1024,
      sha256: "a".repeat(64),
      unit: "mm",
      boundsMm: {
        min: [0, 0, 0],
        max: [200, 100, 8],
        dimensions: [200, 100, 8],
      },
      pointCount: 24,
      confidence: 0.9,
      warnings: [],
    });

    expect(
      extractedArtifactSchema.parse({
        sourceId: "source-1",
        url: "https://example.com/enclosure.step",
        kind: "cad",
        label: "Enclosure CAD",
        cadAnalysis: analysis,
      }),
    ).toMatchObject({ cadAnalysis: { status: "parsed" } });
  });

  it("defaults legacy text dimensions to unknown page-text evidence", () => {
    expect(
      extractedDimensionSchema.parse({
        sourceId: "source-1",
        sourceUrl: "https://example.com/manual",
        label: "width",
        valuesMm: [100],
        raw: "width: 100 mm",
        confidence: 0.8,
      }),
    ).toMatchObject({ basis: "page-text", scope: "unknown" });
  });
});
