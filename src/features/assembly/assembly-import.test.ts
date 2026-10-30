import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AssemblyManifest } from "@/domain/assembly";
import {
  AssemblyImport,
  formatAssemblyImportError,
  parseAssemblyManifestJson,
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

  it("renders a labelled and described native file input", () => {
    const html = renderToStaticMarkup(
      createElement(AssemblyImport, {
        onManifestValidated: () => undefined,
      }),
    );
    expect(html).toContain('type="file"');
    expect(html).toContain('accept="application/json,.json"');
    expect(html).toContain("aria-describedby=");
    expect(html).toContain("<label");
    expect(html).toContain("Choose manifest");
  });
});
