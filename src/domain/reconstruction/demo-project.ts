import type { Project } from "@/domain/evidence/schema";
import { demoReferenceAssets } from "./demo-assets";

const INTERNAL_PHOTO = "photo-internal-components";
const DIY_PHOTO = "photo-diy-setup";
const OVERVIEW_PHOTO = "photo-device-overview";
const BATTERY_CAD = "cad-battery-step";
const DISPLAY_CAD = "cad-display-step";
const LEFT_HINGE_CAD = "cad-hinge-left-step";
const RIGHT_HINGE_CAD = "cad-hinge-right-step";
const OFFICIAL_SPECS = "document-official-specs";
const OPEN_CAD_REPOSITORY = "document-open-cad-repository";
const TEARDOWN = "document-ifixit-teardown";

/**
 * Curated, redistributable reference data for a deterministic demo. Presence
 * claims come from the linked photographs; dimensions and CAD claims retain
 * their official sources. Parametric geometry remains explicitly estimated.
 */
export const demoProject: Project = {
  schemaVersion: 1,
  id: "framework-laptop-13-reference-demo",
  device: {
    manufacturer: "Framework",
    model: "Laptop 13 (AMD 7040 Series)",
    confirmedByUser: false,
  },
  evidence: [
    ...demoReferenceAssets.photos.map((photo) => ({
      id: photo.evidenceId,
      kind: "photo" as const,
      sourceId: photo.sourceUrl,
      locator: photo.src,
      description: `${photo.alt}. ${photo.author}, ${photo.license}.`,
    })),
    {
      id: BATTERY_CAD,
      kind: "document",
      sourceId: demoReferenceAssets.cad.sourceUrl,
      locator: demoReferenceAssets.cad.downloadUrl,
      description:
        "Official Framework Laptop 13 battery STEP, published by Framework Computer Inc. under CC BY 4.0.",
    },
    {
      id: DISPLAY_CAD,
      kind: "document",
      sourceId: demoReferenceAssets.displayCad.sourceUrl,
      locator: demoReferenceAssets.displayCad.sourceUrl,
      description:
        "Official Framework Laptop 13 display assembly STEP, locally triangulated to GLB for the viewer.",
    },
    ...demoReferenceAssets.hinges.map((hinge) => ({
      id: hinge.evidenceId,
      kind: "document" as const,
      sourceId: hinge.sourceUrl,
      locator: hinge.sourceUrl,
      description: `Official Framework Laptop 13 ${hinge.side} hinge STEP, locally triangulated to GLB for the viewer.`,
    })),
    {
      id: OFFICIAL_SPECS,
      kind: "document",
      sourceId: "https://frame.work/laptop13/?tab=specs",
      locator: "Dimensions",
      description: "Official chassis envelope: 296.63 × 228.98 × 15.85 mm.",
    },
    {
      id: OPEN_CAD_REPOSITORY,
      kind: "document",
      sourceId: demoReferenceAssets.cad.repositoryUrl,
      locator: "Framework Laptop 13 open CAD repository",
      description: "Official chassis and module CAD repository, CC BY 4.0.",
    },
    {
      id: TEARDOWN,
      kind: "document",
      sourceId:
        "https://www.ifixit.com/Teardown/Framework+Laptop+Teardown/145124",
      locator: "Framework Laptop Teardown",
      description:
        "Independent iFixit teardown used as corroborating repair documentation.",
    },
  ],
  components: [
    {
      id: "screen",
      label: "Display assembly",
      category: "display",
      claims: [
        {
          id: "screen-presence",
          componentId: "screen",
          property: "presence",
          value: "13.5-inch display assembly",
          status: "documented",
          evidenceIds: [OVERVIEW_PHOTO, OFFICIAL_SPECS],
        },
        {
          id: "screen-depth",
          componentId: "screen",
          property: "depth",
          value: "Official display assembly CAD envelope",
          status: "documented",
          evidenceIds: [DISPLAY_CAD],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "box",
        dimensionsMm: [289.933, 212.28, 2.1],
        estimated: true,
      },
    },
    {
      id: "hinge-left",
      label: "Left display hinge",
      category: "structure",
      claims: [
        {
          id: "hinge-left-geometry",
          componentId: "hinge-left",
          property: "geometry",
          value: "Official left hinge assembly CAD",
          status: "documented",
          evidenceIds: [INTERNAL_PHOTO, LEFT_HINGE_CAD],
        },
      ],
      geometry: {
        kind: "reference_asset",
        assetId: "framework-hinge-left-asset",
        dimensionsMm: [45.8, 28.345, 20.081],
        estimated: false,
      },
    },
    {
      id: "hinge-right",
      label: "Right display hinge",
      category: "structure",
      claims: [
        {
          id: "hinge-right-geometry",
          componentId: "hinge-right",
          property: "geometry",
          value: "Official right hinge assembly CAD",
          status: "documented",
          evidenceIds: [INTERNAL_PHOTO, RIGHT_HINGE_CAD],
        },
      ],
      geometry: {
        kind: "reference_asset",
        assetId: "framework-hinge-right-asset",
        dimensionsMm: [45.8, 28.112, 21.134],
        estimated: false,
      },
    },
    {
      id: "input-cover",
      label: "Input cover",
      category: "housing",
      claims: [
        {
          id: "input-cover-presence",
          componentId: "input-cover",
          property: "presence",
          value: "Removable keyboard and touchpad cover",
          status: "observed",
          evidenceIds: [DIY_PHOTO, TEARDOWN],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "box",
        dimensionsMm: [286, 218, 3],
        estimated: true,
      },
    },
    {
      id: "board",
      label: "Mainboard",
      category: "electronics",
      claims: [
        {
          id: "mainboard-presence",
          componentId: "board",
          property: "presence",
          value: "AMD Ryzen 7040 Series mainboard",
          status: "observed",
          evidenceIds: [INTERNAL_PHOTO, DIY_PHOTO],
        },
        {
          id: "mainboard-shape",
          componentId: "board",
          property: "geometry",
          value: "Outline approximated from the internal reference view",
          status: "inferred",
          evidenceIds: [INTERNAL_PHOTO, OPEN_CAD_REPOSITORY],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "box",
        dimensionsMm: [205, 72, 2],
        estimated: true,
      },
    },
    {
      id: "battery",
      label: "55 Wh battery",
      category: "battery",
      claims: [
        {
          id: "battery-presence",
          componentId: "battery",
          property: "presence",
          value: "Replaceable 55 Wh battery",
          status: "observed",
          evidenceIds: [INTERNAL_PHOTO, TEARDOWN],
        },
        {
          id: "battery-envelope",
          componentId: "battery",
          property: "dimensions",
          value: [239, 93, 6],
          status: "documented",
          evidenceIds: [BATTERY_CAD],
        },
      ],
      geometry: {
        kind: "reference_asset",
        assetId: "framework-battery-step-asset",
        dimensionsMm: [239, 93, 6],
        estimated: false,
      },
    },
    {
      id: "fan",
      label: "Cooling fan",
      category: "structure",
      claims: [
        {
          id: "fan-presence",
          componentId: "fan",
          property: "presence",
          value: "Replaceable cooling fan",
          status: "observed",
          evidenceIds: [INTERNAL_PHOTO],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "cylinder",
        dimensionsMm: [65, 65, 5.5],
        estimated: true,
      },
    },
    {
      id: "speakers",
      label: "Stereo speakers",
      category: "electronics",
      claims: [
        {
          id: "speakers-presence",
          componentId: "speakers",
          property: "presence",
          value: "Paired internal speaker modules",
          status: "observed",
          evidenceIds: [INTERNAL_PHOTO],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "box",
        dimensionsMm: [255, 18, 5],
        estimated: true,
      },
    },
    {
      id: "bottom-cover",
      label: "Bottom cover",
      category: "housing",
      claims: [
        {
          id: "bottom-cover-presence",
          componentId: "bottom-cover",
          property: "presence",
          value: "Aluminium chassis bottom cover",
          status: "documented",
          evidenceIds: [OVERVIEW_PHOTO, OPEN_CAD_REPOSITORY],
        },
        {
          id: "chassis-envelope",
          componentId: "bottom-cover",
          property: "device envelope",
          value: [296.63, 228.98, 15.85],
          status: "documented",
          evidenceIds: [OFFICIAL_SPECS],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "box",
        dimensionsMm: [296.63, 228.98, 4],
        estimated: true,
      },
    },
  ],
};
