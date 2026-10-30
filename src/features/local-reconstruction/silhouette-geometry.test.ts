import { describe, expect, it } from "vitest";
import { simplifyPolygon, svgPathPolygons } from "./silhouette-geometry";

describe("SAM silhouette geometry", () => {
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
});
