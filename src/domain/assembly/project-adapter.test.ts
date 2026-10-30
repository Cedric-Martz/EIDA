import { describe, expect, it } from "vitest";
import type { Project } from "@/domain/evidence/schema";
import type { AssemblyManifest, AssemblyPart } from "./schema";
import {
  assemblyManifestToProject,
  type AssemblyDefinitionClaimValue,
} from "./project-adapter";

function part(id: string, overrides: Partial<AssemblyPart> = {}): AssemblyPart {
  return {
    id,
    label: id,
    geometry: {
      kind: "parametric",
      primitive: "box",
      dimensionsMm: [10, 10, 2],
    },
    fidelity: { level: "estimated", evidenceIds: [] },
    transform: {
      positionMm: [0, 0, 0],
      rotationRad: [0, 0, 0],
      scale: [1, 1, 1],
    },
    explodedVectorMm: [0, 0, 10],
    anchors: [],
    ...overrides,
  };
}

function manifest(): AssemblyManifest {
  return {
    schemaVersion: 1,
    id: "phone-assembly",
    units: "mm",
    assets: [
      {
        id: "board-glb",
        uri: "/board.glb",
        format: "glb",
        millimetresPerAssetUnit: 1000,
        boundsMm: { minMm: [-5, -3, -1], maxMm: [5, 3, 1] },
        evidenceIds: ["cad-document"],
      },
    ],
    materialProfiles: [
      {
        id: "pcb",
        label: "PCB",
        baseColor: [0.03, 0.28, 0.12],
        metalness: 0.1,
        roughness: 0.65,
      },
    ],
    parts: [
      part("board", {
        category: "electronics",
        geometry: { kind: "asset", assetId: "board-glb" },
        fidelity: {
          level: "exact",
          evidenceIds: ["cad-document", "unavailable-source"],
          note: "Manufacturer CAD",
        },
        materialProfileId: "pcb",
        anchors: [
          {
            id: "mount",
            pose: { positionMm: [1, 2, 0], rotationRad: [0, 0, 0] },
            evidenceIds: ["measurement"],
          },
        ],
      }),
      part("cover", {
        parentId: "board",
        geometry: {
          kind: "parametric",
          primitive: "rounded_box",
          dimensionsMm: [12, 8, 2],
          cornerRadiusMm: 1,
        },
        fidelity: { level: "measured", evidenceIds: ["measurement"] },
        anchors: [
          {
            id: "seat",
            pose: { positionMm: [0, 0, 0], rotationRad: [0, 0, 0] },
            evidenceIds: [],
          },
        ],
      }),
      part("lens", {
        geometry: {
          kind: "parametric",
          primitive: "sphere",
          dimensionsMm: [4, 4, 4],
        },
      }),
      part("unknown", {
        geometry: {
          kind: "placeholder",
          dimensionsMm: [7, 6, 5],
          reason: "Only partially visible",
        },
        fidelity: { level: "placeholder", evidenceIds: [] },
      }),
    ],
    mates: [
      {
        id: "cover-mate",
        kind: "fixed",
        source: { partId: "cover", anchorId: "seat" },
        target: { partId: "board", anchorId: "mount" },
        evidenceIds: ["cad-document"],
      },
    ],
  };
}

const evidence: Project["evidence"] = [
  {
    id: "cad-document",
    kind: "document",
    sourceId: "service-manual",
    locator: "page 12",
    description: "Manufacturer board drawing",
  },
  {
    id: "measurement",
    kind: "measurement",
    sourceId: "calipers",
    description: "Manual measurement",
  },
];

describe("assemblyManifestToProject", () => {
  it("maps asset bounds and keeps provenance without inventing evidence", () => {
    const project = assemblyManifestToProject(manifest(), {
      evidence,
      device: {
        manufacturer: "Example",
        model: "Phone 1",
        confirmedByUser: true,
      },
    });
    const board = project.components.find(
      (component) => component.id === "board",
    )!;
    expect(board.geometry).toEqual({
      kind: "reference_asset",
      assetId: "board-glb",
      dimensionsMm: [10, 6, 2],
      estimated: false,
    });
    expect(board.claims[0].status).toBe("documented");
    expect(board.claims[0].evidenceIds).toEqual([
      "cad-document",
      "measurement",
    ]);

    const value = board.claims[0].value as AssemblyDefinitionClaimValue;
    expect(value.fidelity.level).toBe("exact");
    expect(value.materialProfile?.id).toBe("pcb");
    expect(value.geometryAsset?.uri).toBe("/board.glb");
    expect(value.unresolvedEvidenceIds).toEqual(["unavailable-source"]);
    expect(project.evidence.map((item) => item.id)).not.toContain(
      "unavailable-source",
    );
  });

  it("uses safe legacy approximations while retaining source geometry", () => {
    const project = assemblyManifestToProject(manifest(), { evidence });
    const cover = project.components.find(
      (component) => component.id === "cover",
    )!;
    const lens = project.components.find(
      (component) => component.id === "lens",
    )!;
    const unknown = project.components.find(
      (component) => component.id === "unknown",
    )!;

    expect(cover.parentId).toBe("board");
    expect(cover.geometry).toMatchObject({
      kind: "parametric",
      primitive: "box",
      dimensionsMm: [12, 8, 2],
      estimated: true,
    });
    expect(cover.claims[0].status).toBe("observed");
    expect(
      (cover.claims[0].value as AssemblyDefinitionClaimValue).sourceGeometry,
    ).toMatchObject({ primitive: "rounded_box", cornerRadiusMm: 1 });

    expect(lens.geometry).toEqual({
      kind: "placeholder",
      dimensionsMm: [4, 4, 4],
      estimated: true,
    });
    expect(unknown.geometry).toEqual({
      kind: "placeholder",
      dimensionsMm: [7, 6, 5],
      estimated: true,
    });
  });

  it("downgrades unsupported fidelity claims instead of fabricating proof", () => {
    const project = assemblyManifestToProject(manifest());
    const board = project.components.find(
      (component) => component.id === "board",
    )!;
    expect(board.claims[0]).toMatchObject({
      status: "inferred",
      evidenceIds: [],
    });
    expect(
      (board.claims[0].value as AssemblyDefinitionClaimValue)
        .unresolvedEvidenceIds,
    ).toEqual(["cad-document", "unavailable-source", "measurement"]);
  });

  it("revalidates the manifest before adapting it", () => {
    const input = manifest();
    input.parts[0].geometry = { kind: "asset", assetId: "missing" };
    expect(() => assemblyManifestToProject(input)).toThrow(
      "unknown geometry asset",
    );
  });
});
