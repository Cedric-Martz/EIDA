import {
  validateAssemblyManifest,
  type AssemblyManifest,
  type GeometryAsset,
} from "@/domain/assembly";
import type { ReconstructionGraph } from "./schema";
import { validateReconstructionGraph } from "./validate";

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function compileReconstructionGraph(
  input: ReconstructionGraph,
  generatedAssets: readonly GeometryAsset[] = [],
): AssemblyManifest {
  const graph = validateReconstructionGraph(input);
  const assetsById = new Map(generatedAssets.map((asset) => [asset.id, asset]));

  const parts: AssemblyManifest["parts"] = graph.parts.map((part) => {
    const evidenceIds = unique(Object.values(part.evidence).flat());
    const note = part.assumptions.length
      ? part.assumptions.map((assumption) => assumption.reason).join(" ")
      : "Compiled from an evidence-linked EIDA reconstruction graph.";
    const geometry: AssemblyManifest["parts"][number]["geometry"] =
      part.geometry.kind === "primitive"
        ? {
            kind: "parametric",
            primitive: part.geometry.primitive,
            dimensionsMm: part.geometry.dimensionsMm,
            cornerRadiusMm: part.geometry.cornerRadiusMm,
          }
        : part.geometry.kind === "profile-extrusion"
          ? { kind: "asset", assetId: part.geometry.assetId }
          : { kind: "asset", assetId: part.geometry.assetId };

    return {
      id: part.id,
      label: part.label,
      category: part.category,
      parentId: part.parentId,
      geometry,
      fidelity: { level: part.fidelity, evidenceIds, note },
      transform: part.transform,
      explodedVectorMm: part.explodedVectorMm,
      anchors: [],
    };
  });

  const requiredAssetIds = new Set(
    parts.flatMap((part) =>
      part.geometry.kind === "asset" ? [part.geometry.assetId] : [],
    ),
  );
  const assets = [...requiredAssetIds].flatMap((id) => {
    const asset = assetsById.get(id);
    if (!asset) throw new Error(`Graph asset \"${id}\" was not generated.`);
    return [asset];
  });

  return validateAssemblyManifest({
    schemaVersion: 1,
    id: `compiled-${graph.id}`,
    label: graph.label,
    units: "mm",
    assemblyBoundsMm: graph.assemblyBoundsMm,
    assets,
    materialProfiles: [],
    parts,
    mates: [],
  });
}
