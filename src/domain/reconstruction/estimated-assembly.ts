import type {
  AssemblyManifest,
  AssemblyPart,
  DimensionsMm,
} from "@/domain/assembly";
import { validateAssemblyManifest } from "@/domain/assembly";
import type { SelectedSource } from "@/domain/research";

export type EstimatedAssemblyInput = {
  projectId: string;
  deviceLabel: string;
  dimensionsMm: DimensionsMm;
  sources: readonly SelectedSource[];
  guideText?: readonly string[];
  photoCount: number;
  observedParts?: readonly { label: string; category: string }[];
  createdAt?: number;
};

type PartCandidate = {
  id: string;
  label: string;
  category: string;
  keywords: RegExp;
};

const INTERNAL_CANDIDATES: PartCandidate[] = [
  {
    id: "battery",
    label: "Battery volume",
    category: "battery",
    keywords: /\bbatter(?:y|ies)\b/i,
  },
  {
    id: "board",
    label: "Logic board",
    category: "electronics",
    keywords: /\b(?:motherboard|logic board|main board|circuit board|pcb)\b/i,
  },
  {
    id: "camera",
    label: "Camera module",
    category: "camera",
    keywords: /\bcamera\b/i,
  },
  {
    id: "connector",
    label: "Charging connector",
    category: "connector",
    keywords: /\b(?:usb|charging|charge|connector|port)\b/i,
  },
  {
    id: "buttons",
    label: "Button assembly",
    category: "button",
    keywords: /\b(?:button|volume|power)\b/i,
  },
  {
    id: "slot",
    label: "Card slot",
    category: "slot",
    keywords: /\b(?:sim|micro ?sd|card slot)\b/i,
  },
  {
    id: "speaker",
    label: "Speaker module",
    category: "speaker",
    keywords: /\bspeaker\b/i,
  },
];

export function inferDeviceDimensions(deviceLabel: string): DimensionsMm {
  if (/laptop|notebook|macbook/i.test(deviceLabel)) return [320, 220, 18];
  if (/tablet|ipad|galaxy tab|surface/i.test(deviceLabel)) {
    return [220, 145, 9];
  }
  if (/phone|iphone|galaxy s\b|pixel/i.test(deviceLabel)) return [150, 72, 9];
  return [160, 100, 12];
}

function safeFragment(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "device"
  );
}

function part(
  values: Omit<AssemblyPart, "fidelity" | "anchors">,
  evidenceIds: string[],
  note: string,
): AssemblyPart {
  return {
    ...values,
    fidelity: {
      level:
        values.geometry.kind === "placeholder" ? "placeholder" : "estimated",
      evidenceIds,
      note,
    },
    anchors: [],
  };
}

export function buildEstimatedAssembly(
  input: EstimatedAssemblyInput,
): AssemblyManifest {
  const [length, width, thickness] = input.dimensionsMm;
  const evidenceIds = input.sources.map((source) => source.id);
  const corpus = [
    input.deviceLabel,
    ...input.sources.flatMap((source) => [source.title, source.summary ?? ""]),
    ...(input.guideText ?? []),
    ...(input.observedParts ?? []).flatMap((item) => [
      item.label,
      item.category,
    ]),
  ].join("\n");
  const sourceNote = `Parametric estimate from ${input.sources.length} approved source${input.sources.length === 1 ? "" : "s"}, ${input.guideText?.length ?? 0} fetched guide extract${(input.guideText?.length ?? 0) === 1 ? "" : "s"}, and ${input.photoCount} local photo${input.photoCount === 1 ? "" : "s"}. Overall dimensions were supplied or reviewed by the user.`;
  const cornerRadius = Math.max(3, Math.min(length, width) * 0.045);
  const internalDepth = -Math.max(1.5, thickness * 0.42);
  const displayDepth = Math.max(1.2, thickness * 0.12);
  const frameDepth = Math.max(1.5, thickness * 0.18);
  const housingDepth = Math.max(1.6, thickness * 0.2);
  const selectedCandidates = INTERNAL_CANDIDATES.filter((candidate) =>
    candidate.keywords.test(corpus),
  );

  const parts: AssemblyPart[] = [
    part(
      {
        id: "display",
        label: "Display assembly",
        category: "display",
        geometry: {
          kind: "parametric",
          primitive: "rounded_box",
          dimensionsMm: [length * 0.96, width * 0.94, displayDepth],
          cornerRadiusMm: Math.min(cornerRadius * 0.78, displayDepth / 2),
        },
        materialProfileId: "glass",
        transform: {
          positionMm: [0, 0, thickness * 0.46],
          rotationRad: [0, 0, 0],
          scale: [1, 1, 1],
        },
        explodedVectorMm: [0, 0, Math.max(35, thickness * 5)],
      },
      evidenceIds,
      sourceNote,
    ),
    part(
      {
        id: "frame",
        label: "Internal frame",
        category: "structure",
        geometry: {
          kind: "parametric",
          primitive: "rounded_box",
          dimensionsMm: [length * 0.98, width * 0.98, frameDepth],
          cornerRadiusMm: Math.min(cornerRadius, frameDepth / 2),
        },
        materialProfileId: "metal",
        transform: {
          positionMm: [0, 0, thickness * 0.18],
          rotationRad: [0, 0, 0],
          scale: [1, 1, 1],
        },
        explodedVectorMm: [0, 0, Math.max(20, thickness * 3)],
      },
      evidenceIds,
      sourceNote,
    ),
    part(
      {
        id: "rear-housing",
        label: "Rear housing",
        category: "housing",
        geometry: {
          kind: "parametric",
          primitive: "rounded_box",
          dimensionsMm: [length, width, housingDepth],
          cornerRadiusMm: Math.min(cornerRadius, housingDepth / 2),
        },
        materialProfileId: "polymer",
        transform: {
          positionMm: [0, 0, -thickness * 0.48],
          rotationRad: [0, 0, 0],
          scale: [1, 1, 1],
        },
        explodedVectorMm: [0, 0, -Math.max(28, thickness * 4)],
      },
      evidenceIds,
      sourceNote,
    ),
  ];

  for (const candidate of selectedCandidates) {
    const index = parts.length;
    const column = (index - 3) % 2;
    const row = Math.floor((index - 3) / 2);
    const isBattery = candidate.id === "battery";
    const isBoard = candidate.id === "board";
    const partLength = isBattery
      ? length * 0.48
      : isBoard
        ? length * 0.36
        : length * 0.12;
    const partWidth = isBattery
      ? width * 0.54
      : isBoard
        ? width * 0.3
        : width * 0.13;
    parts.push(
      part(
        {
          id: candidate.id,
          label: candidate.label,
          category: candidate.category,
          geometry: {
            kind: "placeholder",
            dimensionsMm: [
              Math.max(8, partLength),
              Math.max(6, partWidth),
              Math.max(1.5, thickness * (isBattery ? 0.38 : 0.24)),
            ],
            reason:
              "Part presence is documented; exact outline and mounting points are not measured.",
          },
          materialProfileId: isBoard ? "pcb" : isBattery ? "foil" : "polymer",
          transform: {
            positionMm: [
              (column === 0 ? -1 : 1) * length * (isBattery ? 0.17 : 0.3),
              width * (0.25 - row * 0.24),
              internalDepth,
            ],
            rotationRad: [0, 0, 0],
            scale: [1, 1, 1],
          },
          explodedVectorMm: [
            (column === 0 ? -1 : 1) * (18 + row * 4),
            (row - 0.5) * 18,
            8 + row * 5,
          ],
        },
        evidenceIds,
        sourceNote,
      ),
    );
  }

  return validateAssemblyManifest({
    schemaVersion: 1,
    id: `estimated-${safeFragment(input.projectId)}-${input.createdAt ?? Date.now()}`,
    label: `${input.deviceLabel} · evidence-limited estimate`,
    units: "mm",
    assemblyBoundsMm: {
      minMm: [-length / 2, -width / 2, -thickness / 2],
      maxMm: [length / 2, width / 2, thickness / 2],
    },
    assets: [],
    materialProfiles: [
      {
        id: "glass",
        label: "Glass",
        baseColor: [0.04, 0.1, 0.13],
        metalness: 0.04,
        roughness: 0.12,
        clearcoat: 0.9,
        clearcoatRoughness: 0.12,
      },
      {
        id: "metal",
        label: "Metal frame",
        baseColor: [0.48, 0.52, 0.54],
        metalness: 0.75,
        roughness: 0.34,
      },
      {
        id: "polymer",
        label: "Polymer",
        baseColor: [0.5, 0.54, 0.56],
        metalness: 0.02,
        roughness: 0.58,
        clearcoat: 0.14,
      },
      {
        id: "pcb",
        label: "PCB",
        baseColor: [0.04, 0.3, 0.2],
        metalness: 0.08,
        roughness: 0.48,
      },
      {
        id: "foil",
        label: "Battery foil",
        baseColor: [0.46, 0.48, 0.5],
        metalness: 0.5,
        roughness: 0.4,
      },
    ],
    parts,
    mates: [],
  });
}
