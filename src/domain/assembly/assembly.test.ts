import { describe, expect, it } from "vitest";
import {
  AssemblyManifestValidationError,
  collectAssemblyValidationIssues,
  deriveAssembledBounds,
  deriveAssembledTransforms,
  deriveExplodedTransforms,
  diagnoseAssembly,
  validateAssemblyManifest,
  type AssemblyManifest,
  type AssemblyPart,
} from "./index";

const identityTransform = {
  positionMm: [0, 0, 0] as [number, number, number],
  rotationRad: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
};

function part(id: string, overrides: Partial<AssemblyPart> = {}): AssemblyPart {
  return {
    id,
    label: id,
    geometry: {
      kind: "parametric",
      primitive: "box",
      dimensionsMm: [10, 10, 10],
    },
    fidelity: { level: "measured", evidenceIds: [`evidence-${id}`] },
    transform: structuredClone(identityTransform),
    explodedVectorMm: [0, 0, 0],
    anchors: [],
    ...overrides,
  };
}

function manifest(): AssemblyManifest {
  return {
    schemaVersion: 1,
    id: "assembly",
    units: "mm",
    assemblyBoundsMm: {
      minMm: [-100, -100, -100],
      maxMm: [100, 100, 100],
    },
    assets: [
      {
        id: "mesh-board",
        uri: "/models/board.glb",
        format: "glb",
        millimetresPerAssetUnit: 1000,
        boundsMm: { minMm: [-5, -3, -1], maxMm: [5, 3, 1] },
        evidenceIds: ["cad-board"],
      },
    ],
    materialProfiles: [
      {
        id: "abs",
        label: "ABS plastic",
        baseColor: [0.1, 0.1, 0.1],
        metalness: 0,
        roughness: 0.72,
      },
    ],
    parts: [
      part("housing", {
        materialProfileId: "abs",
        geometry: {
          kind: "parametric",
          primitive: "rounded_box",
          dimensionsMm: [100, 60, 12],
          cornerRadiusMm: 3,
        },
        anchors: [
          {
            id: "board-seat",
            pose: { positionMm: [0, 0, 0], rotationRad: [0, 0, 0] },
            evidenceIds: ["service-manual"],
          },
        ],
      }),
      part("board", {
        parentId: "housing",
        geometry: { kind: "asset", assetId: "mesh-board" },
        fidelity: { level: "exact", evidenceIds: ["cad-board"] },
        anchors: [
          {
            id: "mount",
            pose: { positionMm: [0, 0, 0], rotationRad: [0, 0, 0] },
            evidenceIds: ["cad-board"],
          },
        ],
      }),
    ],
    mates: [
      {
        id: "board-to-housing",
        kind: "fixed",
        source: { partId: "board", anchorId: "mount" },
        target: { partId: "housing", anchorId: "board-seat" },
        evidenceIds: ["service-manual"],
      },
    ],
  };
}

describe("assembly manifest validation", () => {
  it("accepts a fully referenced, evidence-aware manifest", () => {
    const parsed = validateAssemblyManifest(manifest());
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.parts[1].fidelity).toEqual({
      level: "exact",
      evidenceIds: ["cad-board"],
    });
  });

  it("rejects non-finite transform values at the schema boundary", () => {
    const input = manifest();
    input.parts[0].transform.positionMm[0] = Number.POSITIVE_INFINITY;
    expect(() => validateAssemblyManifest(input)).toThrow();
  });

  it("reports duplicate IDs and missing geometry assets deterministically", () => {
    const input = manifest();
    input.parts.push(part("board"));
    input.parts[1].geometry = { kind: "asset", assetId: "missing" };

    const issues = collectAssemblyValidationIssues(input);
    expect(issues.map((issue) => issue.code)).toContain("duplicate-part-id");
    expect(issues.map((issue) => issue.code)).toContain(
      "missing-geometry-asset",
    );
    expect(collectAssemblyValidationIssues(input)).toEqual(issues);
    expect(() => validateAssemblyManifest(input)).toThrow(
      AssemblyManifestValidationError,
    );
  });

  it("rejects parent cycles", () => {
    const input = manifest();
    input.parts[0].parentId = "board";
    const issues = collectAssemblyValidationIssues(input);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "parent-cycle",
        message: "Parent cycle detected: board -> housing -> board",
      }),
    );
  });

  it("rejects dangling mate part and anchor references", () => {
    const input = manifest();
    input.mates[0].source = { partId: "missing", anchorId: "mount" };
    input.mates[0].target.anchorId = "missing-seat";
    expect(
      collectAssemblyValidationIssues(input).map((issue) => issue.code),
    ).toEqual(["missing-mate-part", "missing-mate-anchor"]);
  });
});

describe("assembly transform derivation", () => {
  it("composes parent-relative translation and rotation", () => {
    const input = manifest();
    input.parts[0].transform.positionMm = [10, 0, 0];
    input.parts[0].transform.rotationRad = [0, 0, Math.PI / 2];
    input.parts[1].transform.positionMm = [2, 0, 0];

    const transforms = deriveAssembledTransforms(input);
    expect(transforms.get("housing")?.worldPositionMm).toEqual([10, 0, 0]);
    const boardPosition = transforms.get("board")?.worldPositionMm;
    expect(boardPosition?.[0]).toBeCloseTo(10);
    expect(boardPosition?.[1]).toBeCloseTo(2);
    expect(boardPosition?.[2]).toBeCloseTo(0);
  });

  it("applies exploded vectors in parent space and inherits parent motion", () => {
    const input = manifest();
    input.parts[0].transform.positionMm = [10, 0, 0];
    input.parts[0].transform.rotationRad = [0, 0, Math.PI / 2];
    input.parts[0].explodedVectorMm = [0, 0, 10];
    input.parts[1].transform.positionMm = [2, 0, 0];
    input.parts[1].explodedVectorMm = [0, 5, 0];

    const transforms = deriveExplodedTransforms(input, 0.5);
    const boardPosition = transforms.get("board")?.worldPositionMm;
    expect(boardPosition?.[0]).toBeCloseTo(7.5);
    expect(boardPosition?.[1]).toBeCloseTo(2);
    expect(boardPosition?.[2]).toBeCloseTo(5);
    expect(() => deriveExplodedTransforms(input, Number.NaN)).toThrow(
      "Explode factor",
    );
  });
});

describe("assembly spatial diagnostics", () => {
  it("uses asset bounds when deriving world-space AABBs", () => {
    const bounds = deriveAssembledBounds(manifest()).get("board");
    expect(bounds?.worldBoundsMm).toEqual({
      minMm: [-5, -3, -1],
      maxMm: [5, 3, 1],
    });
  });

  it("reports sibling overlaps and containment overflow without failing", () => {
    const input = manifest();
    input.assemblyBoundsMm = {
      minMm: [-5, -5, -5],
      maxMm: [5, 5, 5],
    };
    input.parts = [
      part("housing", {
        geometry: {
          kind: "parametric",
          primitive: "box",
          dimensionsMm: [10, 10, 10],
        },
      }),
      part("a", {
        parentId: "housing",
        geometry: {
          kind: "parametric",
          primitive: "box",
          dimensionsMm: [4, 4, 4],
        },
        transform: { ...identityTransform, positionMm: [4, 0, 0] },
      }),
      part("b", {
        parentId: "housing",
        geometry: {
          kind: "parametric",
          primitive: "box",
          dimensionsMm: [4, 4, 4],
        },
        transform: { ...identityTransform, positionMm: [3, 0, 0] },
      }),
    ];
    input.mates = [];

    const diagnostics = diagnoseAssembly(input);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "aabb-overlap",
      "part-outside-assembly",
      "part-outside-parent",
    ]);
    expect(diagnostics[0]).toMatchObject({
      partIds: ["a", "b"],
      overlapMm: [3, 4, 4],
      overlapVolumeMm3: 48,
    });
    expect(diagnostics[2]).toMatchObject({
      partIds: ["a", "housing"],
      overflowMm: [1, 0, 0],
    });
  });

  it("omits geometry without dimensions from broad-phase diagnostics", () => {
    const input = manifest();
    input.parts.push(
      part("unknown", {
        geometry: { kind: "placeholder", reason: "No dimensions found" },
        fidelity: { level: "placeholder", evidenceIds: [] },
      }),
    );
    expect(deriveAssembledBounds(input).has("unknown")).toBe(false);
  });
});
