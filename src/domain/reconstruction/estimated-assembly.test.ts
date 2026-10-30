import { describe, expect, it } from "vitest";
import type { SelectedSource } from "@/domain/research";
import { buildEstimatedAssembly } from "./estimated-assembly";

const selectedSource: SelectedSource = {
  schemaVersion: 1,
  id: "ifixit-guide-1",
  url: "https://www.ifixit.com/Guide/1",
  canonicalUrl: "https://www.ifixit.com/Guide/1",
  title: "Tablet Battery and Motherboard Replacement",
  sourceType: "repair-guide",
  provider: { id: "ifixit", label: "iFixit" },
  discoveredAt: 1,
  selection: "selected",
  selectedAt: 2,
  license: {
    code: "cc-by-nc-sa-3.0",
    label: "CC",
    attributionRequired: true,
    commercialUse: "forbidden",
    derivatives: "share-alike",
  },
};

describe("buildEstimatedAssembly", () => {
  it("creates a validated, explicitly estimated assembly from evidence", () => {
    const manifest = buildEstimatedAssembly({
      projectId: "project",
      deviceLabel: "Example tablet",
      dimensionsMm: [240, 170, 8],
      sources: [selectedSource],
      photoCount: 4,
      createdAt: 10,
    });

    expect(manifest.id).toBe("estimated-project-10");
    expect(manifest.parts.map((part) => part.id)).toEqual(
      expect.arrayContaining([
        "display",
        "frame",
        "rear-housing",
        "battery",
        "board",
      ]),
    );
    expect(
      manifest.parts.every((part) =>
        ["estimated", "placeholder"].includes(part.fidelity.level),
      ),
    ).toBe(true);
    expect(manifest.parts[0].fidelity.evidenceIds).toContain(selectedSource.id);
  });
});
