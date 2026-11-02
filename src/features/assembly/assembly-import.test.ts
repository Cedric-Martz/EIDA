import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AssemblyManifest } from "@/domain/assembly";
import {
  AssemblyImport,
  formatAssemblyImportError,
  parseAssemblyManifestJson,
  parseReconstructionJson,
} from "./assembly-import";

function manifest(): AssemblyManifest {
  return {
    schemaVersion: 1,
    id: "import-test",
    units: "mm",
    assets: [],
    materialProfiles: [],
    parts: [
      {
        id: "left",
        label: "Left",
        geometry: {
          kind: "parametric",
          primitive: "box",
          dimensionsMm: [10, 10, 10],
        },
        fidelity: { level: "estimated", evidenceIds: [] },
        transform: {
          positionMm: [0, 0, 0],
          rotationRad: [0, 0, 0],
          scale: [1, 1, 1],
        },
        explodedVectorMm: [-10, 0, 0],
        anchors: [],
      },
      {
        id: "right",
        label: "Right",
        geometry: {
          kind: "parametric",
          primitive: "box",
          dimensionsMm: [10, 10, 10],
        },
        fidelity: { level: "estimated", evidenceIds: [] },
        transform: {
          positionMm: [5, 0, 0],
          rotationRad: [0, 0, 0],
          scale: [1, 1, 1],
        },
        explodedVectorMm: [10, 0, 0],
        anchors: [],
      },
    ],
    mates: [],
  };
}

describe("assembly manifest JSON import", () => {
  it("returns a validated manifest and non-blocking diagnostics", () => {
    const result = parseAssemblyManifestJson(JSON.stringify(manifest()));
    expect(result.manifest.id).toBe("import-test");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "aabb-overlap",
        partIds: ["left", "right"],
      }),
    ]);
  });

  it("formats syntax and semantic failures for an alert", () => {
    try {
      parseAssemblyManifestJson("{broken");
    } catch (error) {
      expect(formatAssemblyImportError(error)).toBe(
        "The selected file is not valid JSON.",
      );
    }

    const input = manifest();
    input.parts[0].geometry = { kind: "asset", assetId: "missing" };
    try {
      parseAssemblyManifestJson(JSON.stringify(input));
    } catch (error) {
      expect(formatAssemblyImportError(error)).toContain(
        "unknown geometry asset",
      );
    }
  });

  it("compiles a portable EIDA primitive graph", async () => {
    const result = await parseReconstructionJson(
      JSON.stringify({
        schema: "eida-reconstruction-graph",
        schemaVersion: 1,
        id: "graph-import",
        projectId: "project-import",
        label: "Imported graph",
        units: "mm",
        coordinateSystem: "right-handed-y-up",
        createdAt: 1,
        assemblyBoundsMm: {
          minMm: [-20, -20, -20],
          maxMm: [20, 20, 20],
        },
        evidence: [],
        parts: [
          {
            id: "housing",
            label: "Housing",
            category: "housing",
            geometry: {
              kind: "primitive",
              primitive: "rounded_box",
              dimensionsMm: [30, 20, 4],
              cornerRadiusMm: 2,
            },
            transform: {
              positionMm: [0, 0, 0],
              rotationRad: [0, 0, 0],
              scale: [1, 1, 1],
            },
            explodedVectorMm: [0, 0, 10],
            fidelity: "estimated",
            evidence: {
              presence: [],
              outline: [],
              dimensions: [],
              depth: [],
              transform: [],
              material: [],
            },
            assumptions: [],
          },
        ],
        relations: [],
      }),
    );

    expect(result.manifest.parts[0]?.geometry).toMatchObject({
      kind: "parametric",
      primitive: "rounded_box",
    });
  });

  it("renders a labelled and described native file input", () => {
    const html = renderToStaticMarkup(
      createElement(AssemblyImport, {
        onManifestValidated: () => undefined,
      }),
    );
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="application/json,.json,.eida.json"');
    expect(html).toContain("aria-describedby=");
    expect(html).toContain("<label");
    expect(html).toContain("Choose manifest");
  });
});
