import { describe, expect, it } from "vitest";
import { validateProject } from "./validate";

describe("validateProject", () => {
  it("accepts an empty project", () => {
    expect(
      validateProject({
        schemaVersion: 1,
        id: "test",
        device: { confirmedByUser: false },
        components: [],
        evidence: [],
      }).id,
    ).toBe("test");
  });

  it("rejects a dangling evidence reference", () => {
    expect(() =>
      validateProject({
        schemaVersion: 1,
        id: "test",
        device: { confirmedByUser: false },
        evidence: [],
        components: [
          {
            id: "c",
            label: "part",
            category: "other",
            geometry: { kind: "placeholder", estimated: true },
            claims: [
              {
                id: "claim",
                componentId: "c",
                property: "presence",
                value: true,
                status: "inferred",
                evidenceIds: ["missing"],
              },
            ],
          },
        ],
      }),
    ).toThrow("Unknown evidence");
  });

  it("rejects a documented claim without document evidence", () => {
    expect(() =>
      validateProject({
        schemaVersion: 1,
        id: "test",
        device: { confirmedByUser: true, model: "SM-T530" },
        evidence: [
          {
            id: "photo-1",
            kind: "photo",
            sourceId: "photo-1",
            description: "Rear view",
          },
        ],
        components: [
          {
            id: "screen",
            label: "Screen",
            category: "display",
            geometry: { kind: "placeholder", estimated: true },
            claims: [
              {
                id: "claim-screen",
                componentId: "screen",
                property: "presence",
                value: true,
                status: "documented",
                evidenceIds: ["photo-1"],
              },
            ],
          },
        ],
      }),
    ).toThrow("Documented claim lacks document");
  });
});
