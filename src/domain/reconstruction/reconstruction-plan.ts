import type { SelectedSource } from "@/domain/research/schema";

export type ReconstructionStageId =
  | "source-review"
  | "evidence-extraction"
  | "geometry-acquisition"
  | "assembly-constraints"
  | "spatial-validation"
  | "render-optimization";

export type ReconstructionStage = {
  id: ReconstructionStageId;
  label: string;
  status: "complete" | "ready" | "waiting";
  detail: string;
};

export type ReconstructionPlan = {
  schemaVersion: 1;
  id: string;
  projectId: string;
  createdAt: number;
  selectedSourceIds: string[];
  sourceSnapshot: Array<{
    id: string;
    url: string;
    title: string;
    sourceType: SelectedSource["sourceType"];
    licenseCode: SelectedSource["license"]["code"];
  }>;
  readiness: {
    canStart: boolean;
    hasGeometrySource: boolean;
    hasDimensionalSource: boolean;
    hasVisualSource: boolean;
    localPhotoCount: number;
    canEstimateGeometry: boolean;
  };
  stages: ReconstructionStage[];
  warnings: string[];
};

const dimensionalTypes = new Set<SelectedSource["sourceType"]>([
  "service-manual",
  "parts-catalog",
  "technical-drawing",
  "cad-model",
  "datasheet",
]);

const visualTypes = new Set<SelectedSource["sourceType"]>([
  "teardown-guide",
  "repair-guide",
  "photo-set",
  "video",
]);

function stableFragment(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 54) || "project"
  );
}

export function buildReconstructionPlan({
  projectId,
  sources,
  photoCount = 0,
  createdAt = Date.now(),
}: {
  projectId: string;
  sources: readonly SelectedSource[];
  photoCount?: number;
  createdAt?: number;
}): ReconstructionPlan {
  const orderedSources = [...sources].sort(
    (left, right) =>
      left.selectedAt - right.selectedAt || left.id.localeCompare(right.id),
  );
  const hasGeometrySource = orderedSources.some(
    (source) => source.sourceType === "cad-model",
  );
  const hasDimensionalSource = orderedSources.some((source) =>
    dimensionalTypes.has(source.sourceType),
  );
  const hasVisualSource =
    photoCount > 0 ||
    orderedSources.some((source) => visualTypes.has(source.sourceType));
  const canStart = orderedSources.length > 0;
  const extractionReady = canStart;
  const canEstimateGeometry = canStart && photoCount >= 3;
  const geometryReady =
    hasGeometrySource || hasDimensionalSource || canEstimateGeometry;
  const warnings: string[] = [];

  if (!canStart) {
    warnings.push(
      "Approve at least one source before preparing reconstruction.",
    );
  }
  if (canStart && !hasDimensionalSource) {
    warnings.push(
      "No approved source currently documents dimensions; generated geometry must remain estimated.",
    );
  }
  if (canStart && !hasGeometrySource) {
    warnings.push(
      "No approved CAD asset is available; import one or build evidence-limited parametric geometry.",
    );
  }
  if (orderedSources.some((source) => source.license.code === "unknown")) {
    warnings.push(
      "At least one source has an unknown licence and must be reviewed before copying its assets.",
    );
  }

  const stages: ReconstructionStage[] = [
    {
      id: "source-review",
      label: "Approved source set",
      status: canStart ? "complete" : "waiting",
      detail: canStart
        ? `${orderedSources.length} source${orderedSources.length === 1 ? "" : "s"} approved by the user.`
        : "No source has been approved.",
    },
    {
      id: "evidence-extraction",
      label: "Cited claims and part inventory",
      status: extractionReady ? "ready" : "waiting",
      detail: extractionReady
        ? `${photoCount} local photo${photoCount === 1 ? "" : "s"} available. Fetch guide steps and extract a cited part inventory.`
        : "Waiting for an approved source.",
    },
    {
      id: "geometry-acquisition",
      label: "Geometry and dimensions",
      status: geometryReady ? "ready" : "waiting",
      detail: geometryReady
        ? hasGeometrySource || hasDimensionalSource
          ? "Import approved CAD or generate constrained parametric parts."
          : "Generate an explicitly estimated parametric draft from reviewed dimensions, photos, and documented parts."
        : "A measured drawing, datasheet, CAD asset, or manual is still needed.",
    },
    {
      id: "assembly-constraints",
      label: "Assembly transforms and mates",
      status: "waiting",
      detail:
        "Starts after part geometry and connection evidence are reviewed.",
    },
    {
      id: "spatial-validation",
      label: "Fit, overlap, and envelope checks",
      status: "waiting",
      detail: "Runs against the versioned assembly manifest.",
    },
    {
      id: "render-optimization",
      label: "GLB optimization and PBR presentation",
      status: "waiting",
      detail: "Presentation is applied only after spatial validation.",
    },
  ];

  return {
    schemaVersion: 1,
    id: `reconstruction-${stableFragment(projectId)}-${createdAt}`,
    projectId,
    createdAt,
    selectedSourceIds: orderedSources.map((source) => source.id),
    sourceSnapshot: orderedSources.map((source) => ({
      id: source.id,
      url: source.url,
      title: source.title,
      sourceType: source.sourceType,
      licenseCode: source.license.code,
    })),
    readiness: {
      canStart,
      hasGeometrySource,
      hasDimensionalSource,
      hasVisualSource,
      localPhotoCount: photoCount,
      canEstimateGeometry,
    },
    stages,
    warnings,
  };
}
