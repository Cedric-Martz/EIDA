import { describe, expect, it } from "vitest";
import { explodedPosition } from "./explode";
describe("explodedPosition", () => {
  it("centers a three-part assembly", () => {
    expect(explodedPosition(0, 3, 2)).toEqual([0, 0, -2]);
    expect(explodedPosition(2, 3, 2)).toEqual([0, 0, 2]);
  });
  it("handles a single part", () =>
    expect(explodedPosition(0, 1, 2)).toEqual([0, 0, 0]));
});
