import { describe, expect, it } from "vitest";
import { geometryFromEvidence } from "./evidence-geometry";

describe("geometryFromEvidence", () => {
  it("keeps unsupported and inferred components as placeholders", () => {
    expect(geometryFromEvidence("camera", [])).toEqual({
      kind: "placeholder",
      estimated: true,
    });
    expect(
      geometryFromEvidence("camera", [
        {
          id: "claim",
          componentId: "camera",
          property: "presence",
          value: true,
          status: "inferred",
          evidenceIds: ["photo"],
        },
      ]),
    ).toEqual({ kind: "placeholder", estimated: true });
  });

  it("creates only an estimated millimetre primitive for observed categories", () => {
    const geometry = geometryFromEvidence("connector", [
      {
        id: "claim",
        componentId: "connector",
        property: "presence",
        value: true,
        status: "observed",
        evidenceIds: ["photo"],
      },
    ]);
    expect(geometry).toEqual({
      kind: "parametric",
      primitive: "box",
      dimensionsMm: [12, 6, 3],
      estimated: true,
    });
  });

  it("uses a round primitive for an observed home button", () => {
    const geometry = geometryFromEvidence(
      "button",
      [
        {
          id: "claim",
          componentId: "home-button",
          property: "presence",
          value: true,
          status: "observed",
          evidenceIds: ["photo"],
        },
      ],
      "Physical home button",
    );
    expect(geometry).toMatchObject({
      kind: "parametric",
      primitive: "cylinder",
      dimensionsMm: [13, 13, 3],
    });
  });
});
