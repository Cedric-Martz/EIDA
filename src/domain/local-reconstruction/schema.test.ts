import { describe, expect, it } from "vitest";
import { localGeometryPlanSchema } from "./schema";

describe("local geometry reconciliation schema", () => {
  it("accepts an estimated canonical rounded box", () => {
    expect(
      localGeometryPlanSchema.safeParse({
        items: [
          {
            id: "rear-cover",
            primitive: "rounded_box",
            dimensionsMm: [240, 170, 6],
            cornerRadiusMm: 8,
            confidence: 0.78,
            basis: "multi-view",
            rationale: "Several views agree on a rectangular rear shell.",
          },
        ],
        notes: "Perspective reconciled across views.",
      }).success,
    ).toBe(true);
  });

  it("rejects a rounded box without a corner radius", () => {
    expect(
      localGeometryPlanSchema.safeParse({
        items: [
          {
            id: "rear-cover",
            primitive: "rounded_box",
            dimensionsMm: [240, 170, 6],
            cornerRadiusMm: null,
            confidence: 0.78,
            basis: "multi-view",
            rationale: "Several views agree on a rectangular rear shell.",
          },
        ],
        notes: "",
      }).success,
    ).toBe(false);
  });
});
