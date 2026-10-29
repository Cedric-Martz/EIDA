import { describe, expect, it } from "vitest";
import { resolvePhotoObservations } from "./resolve-photo-observations";

const photos = [
  { id: "photo-a", index: 1, locator: "asset:photo-a" },
  { id: "photo-b", index: 2, locator: "asset:photo-b" },
  { id: "photo-c", index: 3, locator: "asset:photo-c" },
];

describe("resolvePhotoObservations", () => {
  it("creates deterministic photo evidence and observed geometry", () => {
    const input = {
      runId: "run-123",
      device: { model: "SM-T530", confirmedByUser: true },
      photos,
      analysis: {
        observations: [
          {
            label: "Rear camera",
            category: "camera",
            visibility: "visible" as const,
            description: "A circular camera opening is visible.",
            evidencePhotoIndices: [2],
          },
        ],
        notes: "",
      },
    };

    const first = resolvePhotoObservations(input);
    const second = resolvePhotoObservations(input);
    expect(second).toEqual(first);
    expect(first.evidence[0]).toMatchObject({
      kind: "photo",
      sourceId: "photo-b",
      locator: "asset:photo-b",
    });
    expect(first.components[0].claims[0].status).toBe("observed");
    expect(first.components[0].geometry).toMatchObject({
      kind: "parametric",
      primitive: "cylinder",
      estimated: true,
    });
  });

  it("never promotes uncertain observations to observed", () => {
    const project = resolvePhotoObservations({
      runId: "run-uncertain",
      device: { confirmedByUser: false },
      photos,
      analysis: {
        observations: [
          {
            label: "Side opening",
            category: "connector",
            visibility: "uncertain",
            description: "The opening may be a connector.",
            evidencePhotoIndices: [1],
          },
        ],
        notes: "",
      },
    });

    expect(project.components[0].claims[0].status).toBe("inferred");
    expect(project.components[0].geometry.kind).toBe("placeholder");
  });

  it("keeps physical candidates and drops cosmetic observations", () => {
    const project = resolvePhotoObservations({
      runId: "run-filtered",
      device: { confirmedByUser: false },
      photos,
      analysis: {
        observations: [
          {
            label: "Front Samsung text",
            category: "Branding",
            visibility: "visible",
            description: "Printed text on the bezel.",
            evidencePhotoIndices: [1],
          },
          {
            label: "Surface dust and smudges",
            category: "Condition",
            visibility: "visible",
            description: "Dust is visible.",
            evidencePhotoIndices: [1],
          },
          {
            label: "Physical home button",
            category: "Buttons",
            visibility: "visible",
            description: "An oval button is visible.",
            evidencePhotoIndices: [1, 2],
          },
          {
            label: "Capacitive navigation icons",
            category: "Buttons",
            visibility: "visible",
            description: "Two printed icons are visible.",
            evidencePhotoIndices: [1],
          },
        ],
        notes: "",
      },
    });

    expect(project.components).toHaveLength(1);
    expect(project.components[0]).toMatchObject({
      label: "Physical home button",
      category: "button",
      geometry: { kind: "parametric", primitive: "cylinder" },
    });
    expect(project.evidence).toHaveLength(2);
  });

  it("preserves contradictory claims on the same component", () => {
    const project = resolvePhotoObservations({
      runId: "run-contradiction",
      device: { confirmedByUser: false },
      photos,
      analysis: {
        observations: [
          {
            label: "Rear camera",
            category: "camera",
            visibility: "visible",
            description: "Visible in the rear view.",
            evidencePhotoIndices: [1],
          },
          {
            label: "Rear camera",
            category: "camera",
            visibility: "not_visible",
            description: "Not visible in the front view.",
            evidencePhotoIndices: [2],
          },
        ],
        notes: "Views disagree because they show different sides.",
      },
    });

    expect(project.components).toHaveLength(1);
    expect(project.components[0].claims.map((claim) => claim.status)).toEqual([
      "observed",
      "unknown",
    ]);
    expect(project.evidence).toHaveLength(2);
  });

  it("rejects references to photos outside the transmitted set", () => {
    expect(() =>
      resolvePhotoObservations({
        runId: "run-missing",
        device: { confirmedByUser: false },
        photos: photos.slice(0, 2),
        analysis: {
          observations: [
            {
              label: "Display",
              category: "display",
              visibility: "visible",
              description: "Display is visible.",
              evidencePhotoIndices: [3],
            },
          ],
          notes: "",
        },
      }),
    ).toThrow("Unknown photo index 3");
  });
});
