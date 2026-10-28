import type { Project } from "@/domain/evidence/schema";
// Synthetic demo data: NOT a verified SM-T530 teardown or a measured CAD model.
export const demoProject: Project = {
  schemaVersion: 1,
  id: "synthetic-demo",
  device: {
    manufacturer: "Samsung",
    model: "SM-T530",
    confirmedByUser: false,
  },
  evidence: [],
  components: [
    {
      id: "screen",
      label: "Display",
      category: "display",
      claims: [
        {
          id: "screen-presence",
          componentId: "screen",
          property: "presence",
          value: "demo fixture only",
          status: "unknown",
          evidenceIds: [],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "box",
        dimensionsMm: [243, 170, 4],
        estimated: true,
      },
    },
    {
      id: "frame",
      label: "Internal frame",
      category: "structure",
      claims: [
        {
          id: "frame-presence",
          componentId: "frame",
          property: "presence",
          value: "demo fixture only",
          status: "unknown",
          evidenceIds: [],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "box",
        dimensionsMm: [243, 170, 3],
        estimated: true,
      },
    },
    {
      id: "board",
      label: "Logic board",
      category: "electronics",
      claims: [
        {
          id: "board-presence",
          componentId: "board",
          property: "presence",
          value: "demo fixture only",
          status: "unknown",
          evidenceIds: [],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "box",
        dimensionsMm: [85, 65, 2],
        estimated: true,
      },
    },
    {
      id: "battery",
      label: "Battery volume",
      category: "battery",
      claims: [
        {
          id: "battery-presence",
          componentId: "battery",
          property: "presence",
          value: "unknown volume",
          status: "unknown",
          evidenceIds: [],
        },
      ],
      geometry: {
        kind: "placeholder",
        primitive: "box",
        dimensionsMm: [110, 90, 5],
        estimated: true,
      },
    },
    {
      id: "camera",
      label: "Camera module",
      category: "camera",
      claims: [
        {
          id: "camera-presence",
          componentId: "camera",
          property: "presence",
          value: "demo fixture only",
          status: "unknown",
          evidenceIds: [],
        },
      ],
      geometry: {
        kind: "placeholder",
        primitive: "box",
        dimensionsMm: [22, 22, 7],
        estimated: true,
      },
    },
    {
      id: "back",
      label: "Rear housing",
      category: "housing",
      claims: [
        {
          id: "back-presence",
          componentId: "back",
          property: "presence",
          value: "demo fixture only",
          status: "unknown",
          evidenceIds: [],
        },
      ],
      geometry: {
        kind: "parametric",
        primitive: "box",
        dimensionsMm: [243, 170, 5],
        estimated: true,
      },
    },
  ],
};
