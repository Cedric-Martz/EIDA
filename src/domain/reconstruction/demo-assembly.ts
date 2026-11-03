import type { AssemblyManifest } from "@/domain/assembly";
import { demoReferenceAssets } from "./demo-assets";

/**
 * Deterministic reference assembly for the hackathon demo. It combines an
 * official battery CAD envelope with evidence-constrained parametric proxies.
 * The fidelity notes are intentionally visible in the inspector.
 */
export const demoAssemblyManifest: AssemblyManifest = {
  schemaVersion: 1,
  id: "framework-laptop-13-reference-assembly",
  label: "Framework Laptop 13 evidence reference",
  units: "mm",
  assemblyBoundsMm: {
    minMm: [-148.315, -113, -114.49],
    maxMm: [148.315, 90, 114.49],
  },
  assets: [
    {
      id: "framework-battery-step-asset",
      label: "Official Framework 55 Wh battery CAD mesh",
      uri: demoReferenceAssets.cad.meshUrl,
      format: "glb",
      millimetresPerAssetUnit: 1,
      boundsMm: {
        minMm: [-120, -50.3, -3.818],
        maxMm: [120, 50.3, 3.818],
      },
      evidenceIds: ["cad-battery-step"],
    },
    ...demoReferenceAssets.hinges.map((hinge) => ({
      id: `framework-hinge-${hinge.side}-asset`,
      label: `Official Framework ${hinge.side} hinge CAD mesh`,
      uri: hinge.meshUrl,
      format: "glb" as const,
      millimetresPerAssetUnit: 1,
      boundsMm:
        hinge.side === "left"
          ? {
              minMm: [-22.9, -14.1725, -10.0407] as [number, number, number],
              maxMm: [22.9, 14.1725, 10.0407] as [number, number, number],
            }
          : {
              minMm: [-22.9, -14.056, -10.5668] as [number, number, number],
              maxMm: [22.9, 14.056, 10.5668] as [number, number, number],
            },
      evidenceIds: [hinge.evidenceId],
    })),
  ],
  materialProfiles: [
    {
      id: "glass",
      label: "Display glass proxy",
      baseColor: [0.06, 0.12, 0.15],
      metalness: 0.08,
      roughness: 0.13,
      clearcoat: 0.9,
      clearcoatRoughness: 0.15,
    },
    {
      id: "aluminium",
      label: "Aluminium housing proxy",
      baseColor: [0.56, 0.59, 0.61],
      metalness: 0.8,
      roughness: 0.3,
    },
    {
      id: "pcb",
      label: "PCB solder mask proxy",
      baseColor: [0.04, 0.3, 0.21],
      metalness: 0.08,
      roughness: 0.5,
      clearcoat: 0.16,
      clearcoatRoughness: 0.55,
    },
    {
      id: "battery-foil",
      label: "Battery enclosure proxy",
      baseColor: [0.36, 0.39, 0.41],
      metalness: 0.45,
      roughness: 0.4,
    },
    {
      id: "polymer",
      label: "Internal polymer proxy",
      baseColor: [0.13, 0.16, 0.17],
      metalness: 0.03,
      roughness: 0.62,
    },
  ],
  mates: [],
  parts: [
    {
      id: "screen",
      label: "Display assembly",
      category: "display",
      geometry: {
        kind: "parametric",
        primitive: "rounded_box",
        dimensionsMm: [289.933, 212.28, 2.1],
        cornerRadiusMm: 1,
      },
      fidelity: {
        level: "estimated",
        evidenceIds: ["photo-device-overview", "cad-display-step"],
        note: "Official CAD envelope with a stylized bezel and display surface.",
      },
      materialProfileId: "glass",
      transform: {
        positionMm: [0, -8, -112],
        rotationRad: [0, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [0, 10, -22],
      anchors: [],
    },
    {
      id: "hinge-left",
      label: "Left display hinge",
      category: "structure",
      geometry: {
        kind: "asset",
        assetId: "framework-hinge-left-asset",
      },
      fidelity: {
        level: "measured",
        evidenceIds: ["photo-internal-components", "cad-hinge-left-step"],
        note: "Official left hinge STEP triangulated locally for the web viewer.",
      },
      materialProfileId: "aluminium",
      transform: {
        positionMm: [-118, -101, -105],
        rotationRad: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [-14, 38, -12],
      anchors: [],
    },
    {
      id: "hinge-right",
      label: "Right display hinge",
      category: "structure",
      geometry: {
        kind: "asset",
        assetId: "framework-hinge-right-asset",
      },
      fidelity: {
        level: "measured",
        evidenceIds: ["photo-internal-components", "cad-hinge-right-step"],
        note: "Official right hinge STEP triangulated locally for the web viewer.",
      },
      materialProfileId: "aluminium",
      transform: {
        positionMm: [118, -101, -105],
        rotationRad: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [14, 38, -12],
      anchors: [],
    },
    {
      id: "input-cover",
      label: "Input cover",
      category: "housing",
      geometry: {
        kind: "parametric",
        primitive: "rounded_box",
        dimensionsMm: [286, 218, 3],
        cornerRadiusMm: 1,
      },
      fidelity: {
        level: "estimated",
        evidenceIds: ["photo-diy-setup", "document-ifixit-teardown"],
        note: "Presence is observed; the simplified outline is estimated.",
      },
      materialProfileId: "aluminium",
      transform: {
        positionMm: [0, -99, 0],
        rotationRad: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [0, 75, 10],
      anchors: [],
    },
    {
      id: "board",
      label: "Mainboard",
      category: "electronics",
      geometry: {
        kind: "parametric",
        primitive: "rounded_box",
        dimensionsMm: [205, 72, 2],
        cornerRadiusMm: 0.8,
      },
      fidelity: {
        level: "estimated",
        evidenceIds: [
          "photo-internal-components",
          "document-open-cad-repository",
        ],
        note: "Observed component with a photo-derived parametric envelope.",
      },
      materialProfileId: "pcb",
      transform: {
        positionMm: [18, -103, -63],
        rotationRad: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [12, 44, -10],
      anchors: [],
    },
    {
      id: "battery",
      label: "55 Wh battery",
      category: "battery",
      geometry: {
        kind: "asset",
        assetId: "framework-battery-step-asset",
      },
      fidelity: {
        level: "measured",
        evidenceIds: ["photo-internal-components", "cad-battery-step"],
        note: "Official CAD-backed envelope; the web viewer displays its bounds proxy.",
      },
      materialProfileId: "battery-foil",
      transform: {
        positionMm: [0, -103, 39],
        rotationRad: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [8, 28, 14],
      anchors: [],
    },
    {
      id: "fan",
      label: "Cooling fan",
      category: "structure",
      geometry: {
        kind: "parametric",
        primitive: "cylinder",
        dimensionsMm: [65, 65, 5.5],
      },
      fidelity: {
        level: "estimated",
        evidenceIds: ["photo-internal-components"],
        note: "Observed fan; diameter and depth are approximate.",
      },
      materialProfileId: "polymer",
      transform: {
        positionMm: [-105, -102, -63],
        rotationRad: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [-20, 36, -8],
      anchors: [],
    },
    {
      id: "speakers",
      label: "Stereo speakers",
      category: "electronics",
      geometry: {
        kind: "parametric",
        primitive: "rounded_box",
        dimensionsMm: [255, 18, 5],
        cornerRadiusMm: 1.5,
      },
      fidelity: {
        level: "estimated",
        evidenceIds: ["photo-internal-components"],
        note: "Both observed speaker modules are represented by one simplified proxy.",
      },
      materialProfileId: "polymer",
      transform: {
        positionMm: [0, -102, 99],
        rotationRad: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [0, 20, 24],
      anchors: [],
    },
    {
      id: "bottom-cover",
      label: "Bottom cover",
      category: "housing",
      geometry: {
        kind: "parametric",
        primitive: "rounded_box",
        dimensionsMm: [296.63, 228.98, 4],
        cornerRadiusMm: 1.5,
      },
      fidelity: {
        level: "estimated",
        evidenceIds: [
          "photo-device-overview",
          "document-official-specs",
          "document-open-cad-repository",
        ],
        note: "Official outer envelope with a simplified parametric cover shape.",
      },
      materialProfileId: "aluminium",
      transform: {
        positionMm: [0, -108, 0],
        rotationRad: [-Math.PI / 2, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [0, -9, 0],
      anchors: [],
    },
  ],
};
