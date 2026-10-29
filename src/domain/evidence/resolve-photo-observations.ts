import {
  photoAnalysisSchema,
  type PhotoAnalysis,
} from "@/domain/inference/observation";
import { geometryFromEvidence } from "@/domain/reconstruction/evidence-geometry";
import { validateProject } from "./validate";
import type { ComponentNode, Project } from "./schema";

export type PhotoReference = {
  id: string;
  index: number;
  locator: string;
};

export type ResolvePhotoObservationsInput = {
  runId: string;
  analysis: PhotoAnalysis;
  photos: PhotoReference[];
  device: Project["device"];
};

function stableFragment(value: string): string {
  const fragment = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return fragment || "item";
}

function claimStatus(
  visibility: PhotoAnalysis["observations"][number]["visibility"],
): "observed" | "inferred" | "unknown" {
  if (visibility === "visible") return "observed";
  if (visibility === "uncertain") return "inferred";
  return "unknown";
}

const categoryAliases: Record<string, string> = {
  battery: "battery",
  batteries: "battery",
  board: "board",
  boards: "board",
  button: "button",
  buttons: "button",
  camera: "camera",
  cameras: "camera",
  connector: "connector",
  connectors: "connector",
  control: "button",
  controls: "button",
  display: "display",
  enclosure: "housing",
  frame: "housing",
  housing: "housing",
  microphone: "microphone",
  microphones: "microphone",
  port: "connector",
  ports: "connector",
  screen: "display",
  sensor: "sensor",
  sensors: "sensor",
  slot: "slot",
  slots: "slot",
  speaker: "speaker",
  speakers: "speaker",
};

const ignoredCategories = new Set([
  "branding",
  "condition",
  "decoration",
  "general",
  "marking",
  "markings",
  "text",
]);

const ignoredLabelPattern =
  /\b(branding|dust|finish|icon|icons|label|logo|mark|marks|smudge|smudges|stain|text|wear)\b/i;

function categoryFromObservation(
  observation: PhotoAnalysis["observations"][number],
): string | null {
  const category = observation.category.trim().toLowerCase();
  if (
    ignoredCategories.has(category) ||
    ignoredLabelPattern.test(observation.label)
  ) {
    return null;
  }
  const knownCategory = categoryAliases[category];
  if (knownCategory) return knownCategory;

  const label = observation.label.toLowerCase();
  for (const [term, canonical] of Object.entries(categoryAliases)) {
    if (new RegExp(`\\b${term}\\b`, "i").test(label)) return canonical;
  }
  return null;
}

export function resolvePhotoObservations(
  input: ResolvePhotoObservationsInput,
): Project {
  const analysis = photoAnalysisSchema.parse(input.analysis);
  const photosByIndex = new Map<number, PhotoReference>();
  for (const photo of input.photos) {
    if (photosByIndex.has(photo.index)) {
      throw new Error(`Duplicate photo index ${photo.index}`);
    }
    photosByIndex.set(photo.index, photo);
  }

  const runFragment = stableFragment(input.runId);
  const evidence: Project["evidence"] = [];
  const components = new Map<
    string,
    Omit<ComponentNode, "geometry"> & { geometry?: ComponentNode["geometry"] }
  >();

  analysis.observations.forEach((observation, observationIndex) => {
    const category = categoryFromObservation(observation);
    if (!category) return;
    const photoReferences = observation.evidencePhotoIndices.map((index) => {
      const photo = photosByIndex.get(index);
      if (!photo) throw new Error(`Unknown photo index ${index}`);
      return photo;
    });
    const componentKey = `${stableFragment(category)}-${stableFragment(observation.label)}`;
    const componentId = `component-${componentKey}`;
    const evidenceIds = photoReferences.map((photo) => {
      const evidenceId = `evidence-${runFragment}-${observationIndex + 1}-${photo.index}`;
      evidence.push({
        id: evidenceId,
        kind: "photo",
        sourceId: photo.id,
        locator: photo.locator,
        description: `Photo ${photo.index}: ${observation.description}`,
      });
      return evidenceId;
    });
    const existing = components.get(componentKey) ?? {
      id: componentId,
      label: observation.label,
      category,
      claims: [],
    };
    existing.claims.push({
      id: `claim-${runFragment}-${observationIndex + 1}`,
      componentId,
      property: "presence",
      value: observation.description,
      status: claimStatus(observation.visibility),
      evidenceIds,
    });
    components.set(componentKey, existing);
  });

  const resolvedComponents: ComponentNode[] = Array.from(
    components.values(),
  ).map((component) => ({
    id: component.id,
    label: component.label,
    category: component.category,
    claims: component.claims,
    geometry: geometryFromEvidence(
      component.category,
      component.claims,
      component.label,
    ),
  }));

  return validateProject({
    schemaVersion: 1,
    id: `analysis-${runFragment}`,
    device: input.device,
    evidence,
    components: resolvedComponents,
  });
}
