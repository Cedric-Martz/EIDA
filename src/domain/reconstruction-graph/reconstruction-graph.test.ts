import { describe, expect, it } from "vitest";
import type { GeometryAsset } from "@/domain/assembly";
import {
  compileReconstructionGraph,
  ReconstructionGraphValidationError,
  validateReconstructionGraph,
  type ReconstructionGraph,
} from ".";

function graph(): ReconstructionGraph {
  return {
    schema: "eida-reconstruction-graph",
    schemaVersion: 1,
    id: "graph-project-1",
    projectId: "project-1",
    label: "Evidence-linked device",
    units: "mm",
    coordinateSystem: "right-handed-y-up",
    createdAt: 1,
    assemblyBoundsMm: {
      minMm: [-100, -50, -10],
      maxMm: [100, 50, 20],
    },
    evidence: [
      { id: "photo:battery", kind: "user-photo", label: "Battery photo" },
      {
        id: "mask:battery",
        kind: "segmentation-mask",
        label: "Battery mask",
        sourceId: "photo:battery",
        confidence: 0.96,
      },
    ],
    parts: [
      {
        id: "battery",
        label: "Battery",
        category: "battery",
        geometry: {
          kind: "profile-extrusion",
          profileMm: [
            [-30, -45],
            [30, -45],
            [30, 45],
            [-30, 45],
          ],
          depthMm: 5,
          assetId: "sam-mask-battery",
        },
        transform: {
          positionMm: [0, 0, 0],
          rotationRad: [0, 0, 0],
          scale: [1, 1, 1],
        },
        explodedVectorMm: [0, 0, 30],
        fidelity: "estimated",
        evidence: {
          presence: ["photo:battery"],
          outline: ["mask:battery"],
          dimensions: [],
          depth: [],
          transform: ["mask:battery"],
          material: [],
        },
        assumptions: [
          {
            id: "assumption:battery:depth",
            property: "depth",
            reason: "No measured depth was available.",
            impact: "mechanical",
          },
        ],
      },
    ],
    relations: [],
  };
}

const asset: GeometryAsset = {
  id: "sam-mask-battery",
  uri: "data:model/gltf-binary;base64,AA==",
  format: "glb",
  millimetresPerAssetUnit: 1,
  boundsMm: { minMm: [-30, -45, -2.5], maxMm: [30, 45, 2.5] },
  evidenceIds: ["photo:battery", "mask:battery"],
};

describe("EIDA reconstruction graph", () => {
  it("validates and compiles an evidence-linked profile", () => {
    const parsed = validateReconstructionGraph(graph());
    const manifest = compileReconstructionGraph(parsed, [asset]);

    expect(manifest.parts[0]?.geometry).toEqual({
      kind: "asset",
      assetId: "sam-mask-battery",
    });
    expect(manifest.parts[0]?.fidelity.evidenceIds).toEqual([
      "photo:battery",
      "mask:battery",
    ]);
  });

  it("rejects references to evidence that is not in the graph", () => {
    const input = graph();
    input.parts[0]!.evidence.depth = ["measurement:missing"];

    expect(() => validateReconstructionGraph(input)).toThrow(
      ReconstructionGraphValidationError,
    );
  });

  it("refuses to compile a missing generated mesh", () => {
    expect(() => compileReconstructionGraph(graph(), [])).toThrow(
      'Graph asset "sam-mask-battery" was not generated.',
    );
  });
});
