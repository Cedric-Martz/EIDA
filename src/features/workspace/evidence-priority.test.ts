import { describe, expect, it } from "vitest";
import type { ExtractedWebSource } from "@/domain/research";
import type { TechnicalFileRecord } from "@/features/capture/technical-file-intake";
import { selectDimensionAuthority } from "./evidence-priority";

function localCad(confidence: number): TechnicalFileRecord {
  return {
    id: "technical-1",
    projectId: "project-1",
    kind: "document",
    name: "device.stp",
    mimeType: "model/step",
    size: 100,
    createdAt: 1,
    blob: new Blob(),
    cadAnalysis: {
      status: "parsed",
      format: "step",
      fileName: "device.stp",
      byteSize: 100,
      sha256: "a".repeat(64),
      unit: "mm",
      boundsMm: {
        min: [0, 0, 0],
        max: [243, 176, 8],
        dimensions: [243, 176, 8],
      },
      pointCount: 10,
      confidence,
      warnings: [],
    },
  };
}

function webSource(): ExtractedWebSource {
  return {
    sourceId: "manual",
    url: "https://example.com/manual",
    title: "Official manual",
    sourceType: "service-manual",
    status: "extracted",
    excerpt: "",
    images: [],
    artifacts: [],
    warnings: [],
    dimensions: [
      {
        sourceId: "manual",
        sourceUrl: "https://example.com/manual",
        label: "Overall dimensions",
        valuesMm: [200, 100, 7],
        raw: "200 × 100 × 7 mm",
        confidence: 0.95,
        basis: "page-text",
        scope: "device",
      },
    ],
  };
}

describe("evidence dimension priority", () => {
  it("prefers a reliable local CAD envelope over documented dimensions", () => {
    const authority = selectDimensionAuthority({
      manualDimensions: [10, 9, 8],
      localFiles: [localCad(0.78)],
      webSources: [webSource()],
    });
    expect(authority.kind).toBe("local-cad");
    expect(authority.dimensionsMm).toEqual([243, 176, 8]);
  });

  it("does not override documentation with a low-confidence CAD envelope", () => {
    const authority = selectDimensionAuthority({
      manualDimensions: [10, 9, 8],
      localFiles: [localCad(0.58)],
      webSources: [webSource()],
    });
    expect(authority.kind).toBe("documented");
    expect(authority.dimensionsMm).toEqual([200, 100, 7]);
  });
});
