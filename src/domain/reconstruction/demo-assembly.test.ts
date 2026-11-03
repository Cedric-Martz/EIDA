import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deriveAssembledTransforms,
  validateAssemblyManifest,
} from "@/domain/assembly";
import { validateProject } from "@/domain/evidence/validate";
import { demoAssemblyManifest } from "./demo-assembly";
import { demoReferenceAssets } from "./demo-assets";
import { demoProject } from "./demo-project";

describe("reference demo fixture", () => {
  it("stays valid for the public GitHub Pages viewer", () => {
    expect(() => validateAssemblyManifest(demoAssemblyManifest)).not.toThrow();
    expect(() => validateProject(demoProject)).not.toThrow();
  });

  it("links every assembly evidence reference to the demo project", () => {
    const evidenceIds = new Set(demoProject.evidence.map((item) => item.id));
    const linkedIds = [
      ...demoAssemblyManifest.assets.flatMap((asset) => asset.evidenceIds),
      ...demoAssemblyManifest.parts.flatMap(
        (part) => part.fidelity.evidenceIds,
      ),
    ];
    expect(linkedIds.every((id) => evidenceIds.has(id))).toBe(true);
  });

  it("lays the chassis flat while keeping the display upright", () => {
    const parts = new Map(
      demoAssemblyManifest.parts.map((part) => [part.id, part]),
    );
    expect(parts.get("screen")?.transform.rotationRad).toEqual([0, 0, 0]);
    for (const id of [
      "input-cover",
      "hinge-left",
      "hinge-right",
      "board",
      "battery",
      "fan",
      "speakers",
      "bottom-cover",
    ]) {
      expect(parts.get(id)?.transform.rotationRad[0]).toBeCloseTo(-Math.PI / 2);
    }

    const transforms = deriveAssembledTransforms(demoAssemblyManifest);
    expect(transforms.get("screen")?.worldPositionMm[2]).toBeLessThan(-100);
    expect(transforms.get("bottom-cover")?.worldPositionMm[1]).toBeLessThan(
      -100,
    );
  });

  it("ships the attributed photos and checksum-verified official CAD", () => {
    for (const photo of demoReferenceAssets.photos) {
      expect(
        statSync(join(process.cwd(), "public", photo.src)).size,
      ).toBeGreaterThan(0);
    }

    const step = readFileSync(
      join(process.cwd(), "public", demoReferenceAssets.cad.downloadUrl),
    );
    expect(step.byteLength).toBeLessThanOrEqual(12_000_000);
    expect(createHash("sha256").update(step).digest("hex")).toBe(
      demoReferenceAssets.cad.sha256,
    );

    const meshAssets = [demoReferenceAssets.cad, ...demoReferenceAssets.hinges];
    for (const asset of meshAssets) {
      const mesh = readFileSync(join(process.cwd(), "public", asset.meshUrl));
      expect(createHash("sha256").update(mesh).digest("hex")).toBe(
        asset.meshSha256,
      );
    }
  });
});
