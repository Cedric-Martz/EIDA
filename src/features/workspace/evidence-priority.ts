import type { DimensionsMm } from "@/domain/assembly";
import type { ExtractedWebSource } from "@/domain/research";
import type { TechnicalFileRecord } from "@/features/capture/technical-file-intake";

export type DimensionAuthority = {
  dimensionsMm: DimensionsMm;
  kind: "local-cad" | "remote-cad" | "documented" | "manual";
  label: string;
  confidence: number;
};

function normalize(values: readonly number[]): DimensionsMm {
  return [...values].sort((left, right) => right - left) as DimensionsMm;
}

export function selectDimensionAuthority({
  manualDimensions,
  localFiles,
  webSources,
}: {
  manualDimensions: DimensionsMm;
  localFiles: readonly TechnicalFileRecord[];
  webSources: readonly ExtractedWebSource[];
}): DimensionAuthority {
  const localCad = localFiles
    .filter(
      (file) =>
        file.cadAnalysis.status === "parsed" &&
        file.cadAnalysis.boundsMm !== undefined &&
        file.cadAnalysis.confidence >= 0.75,
    )
    .sort(
      (left, right) =>
        right.cadAnalysis.confidence - left.cadAnalysis.confidence,
    )[0];
  if (localCad?.cadAnalysis.boundsMm) {
    return {
      dimensionsMm: normalize(localCad.cadAnalysis.boundsMm.dimensions),
      kind: "local-cad",
      label: localCad.name,
      confidence: localCad.cadAnalysis.confidence,
    };
  }

  const dimensions = webSources.flatMap((source) =>
    source.dimensions.map((dimension) => ({ dimension, source })),
  );
  const remoteCad = dimensions
    .filter(
      ({ dimension }) =>
        dimension.valuesMm.length === 3 &&
        dimension.basis === "cad-bounds" &&
        dimension.scope === "device" &&
        dimension.confidence >= 0.75,
    )
    .sort(
      (left, right) => right.dimension.confidence - left.dimension.confidence,
    )[0];
  if (remoteCad) {
    return {
      dimensionsMm: normalize(remoteCad.dimension.valuesMm),
      kind: "remote-cad",
      label: remoteCad.source.title,
      confidence: remoteCad.dimension.confidence,
    };
  }

  const documented = dimensions
    .filter(
      ({ dimension }) =>
        dimension.valuesMm.length === 3 &&
        dimension.basis === "page-text" &&
        dimension.scope === "device" &&
        dimension.confidence >= 0.85,
    )
    .sort(
      (left, right) => right.dimension.confidence - left.dimension.confidence,
    )[0];
  if (documented) {
    return {
      dimensionsMm: normalize(documented.dimension.valuesMm),
      kind: "documented",
      label: documented.source.title,
      confidence: documented.dimension.confidence,
    };
  }

  return {
    dimensionsMm: manualDimensions,
    kind: "manual",
    label: "Manual reference",
    confidence: 1,
  };
}
