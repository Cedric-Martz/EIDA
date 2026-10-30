import { describe, expect, it } from "vitest";
import type { SelectedSource } from "@/domain/research/schema";
import { buildReconstructionPlan } from "./reconstruction-plan";

function source(
  id: string,
  sourceType: SelectedSource["sourceType"],
  licenseCode: SelectedSource["license"]["code"] = "cc-by-nc-sa-3.0",
): SelectedSource {
  return {
    schemaVersion: 1,
    id,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    title: id,
    sourceType,
    provider: { id: "test", label: "Test" },
    discoveredAt: 1,
    selection: "selected",
    selectedAt: 2,
    license: {
      code: licenseCode,
      label: licenseCode,
      attributionRequired: null,
      commercialUse: "unknown",
      derivatives: "unknown",
    },
  };
}

describe("buildReconstructionPlan", () => {
  it("blocks an empty source set without inventing progress", () => {
    const plan = buildReconstructionPlan({
      projectId: "project",
      sources: [],
      createdAt: 10,
    });

    expect(plan.readiness.canStart).toBe(false);
    expect(plan.stages[0].status).toBe("waiting");
    expect(plan.warnings[0]).toMatch(/Approve at least one source/);
  });

  it("keeps guide-only reconstruction estimated", () => {
    const plan = buildReconstructionPlan({
      projectId: "project",
      sources: [source("guide", "teardown-guide")],
      createdAt: 10,
    });

    expect(plan.readiness).toMatchObject({
      canStart: true,
      hasVisualSource: true,
      hasDimensionalSource: false,
      hasGeometrySource: false,
    });
    expect(plan.stages[1].status).toBe("ready");
    expect(plan.stages[2].status).toBe("waiting");
  });

  it("recognizes CAD and flags unknown licensing", () => {
    const plan = buildReconstructionPlan({
      projectId: "project",
      sources: [source("cad", "cad-model", "unknown")],
      createdAt: 10,
    });

    expect(plan.readiness.hasGeometrySource).toBe(true);
    expect(plan.readiness.hasDimensionalSource).toBe(true);
    expect(plan.stages[2].status).toBe("ready");
    expect(plan.warnings).toContain(
      "At least one source has an unknown licence and must be reviewed before copying its assets.",
    );
  });

  it("allows an estimated geometry draft when three local photos exist", () => {
    const plan = buildReconstructionPlan({
      projectId: "project",
      sources: [source("guide", "repair-guide")],
      photoCount: 4,
      createdAt: 10,
    });

    expect(plan.readiness.localPhotoCount).toBe(4);
    expect(plan.readiness.canEstimateGeometry).toBe(true);
    expect(plan.stages[2].status).toBe("ready");
    expect(plan.warnings).toContain(
      "No approved source currently documents dimensions; generated geometry must remain estimated.",
    );
  });
});
