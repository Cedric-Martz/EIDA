import { describe, expect, it } from "vitest";
import {
  boundCanonicalDimensions,
  boundRoundedBoxRadius,
  ensureWebSourceEvidence,
  fitPolygonToCadBounds,
  simplifyPolygon,
  svgPathPolygons,
} from "./silhouette-geometry";

describe("SAM silhouette geometry", () => {
  it("bounds AI-estimated geometry to a plausible device envelope", () => {
    const bounded = boundCanonicalDimensions([400, 300, 80], [243, 176, 8]);
    expect(bounded[0]).toBeCloseTo(267.3);
    expect(bounded[1]).toBeCloseTo(193.6);
    expect(bounded[2]).toBe(20);
  });

  it("bounds rounded corners against the thinnest 3D dimension", () => {
    expect(boundRoundedBoxRadius(8, [240, 170, 4])).toBeCloseTo(1.96);
    expect(boundRoundedBoxRadius(null, [240, 170, 4])).toBeCloseTo(1.96);
  });

  it("extracts separate closed polygons from the official M/L/Z path form", () => {
    expect(svgPathPolygons("M0 0L10 0L10 10L0 10ZM2 2L3 2L3 3Z")).toEqual([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      [
        [2, 2],
        [3, 2],
        [3, 3],
      ],
    ]);
  });

  it("removes redundant contour points while keeping the silhouette", () => {
    const simplified = simplifyPolygon([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [3, 3],
      [0, 3],
    ]);
    expect(simplified.length).toBeLessThan(6);
    expect(simplified).toContainEqual([3, 3]);
  });

  it("fits a SAM outline to reviewed CAD bounds without losing its contour", () => {
    const fitted = fitPolygonToCadBounds(
      [
        [0, 0],
        [20, 0],
        [20, 10],
        [0, 10],
      ],
      [100, 50, 4],
    );

    expect(fitted).toEqual([
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ]);
  });

  it("creates the parent evidence for a public source image without documented dimensions", () => {
    const evidence = new Map();
    const id = ensureWebSourceEvidence(evidence, {
      kind: "web-source",
      sourceId: "ifixit-guide-112702",
      locator: "https://guide-images.cdn.ifixit.com/example.jpg",
    });

    expect(id).toBe("source:ifixit-guide-112702");
    expect(evidence.get(id!)).toMatchObject({
      id,
      kind: "web-source",
      locator: "https://guide-images.cdn.ifixit.com/example.jpg",
    });
  });
});
