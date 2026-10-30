import type { ComponentNode, Project } from "@/domain/evidence/schema";
import { validateProject } from "@/domain/evidence/validate";
import type {
  Anchor,
  AssemblyManifest,
  AssemblyPart,
  FidelityAssessment,
  GeometryAsset,
  Mate,
  PartGeometry,
  PbrMaterialProfile,
  Transform,
  Vector3Mm,
} from "./schema";
import { validateAssemblyManifest } from "./validate";

type ProjectEvidence = Project["evidence"][number];
type ClaimStatus = ComponentNode["claims"][number]["status"];

export type AssemblyProjectAdapterOptions = {
  projectId?: string;
  device?: Partial<Project["device"]>;
  /** Existing, typed evidence records; the adapter never invents sources. */
  evidence?: readonly ProjectEvidence[];
};

export type AssemblyDefinitionClaimValue = {
  manifestId: string;
  manifestSchemaVersion: 1;
  fidelity: FidelityAssessment;
  sourceGeometry: PartGeometry;
  transform: Transform;
  explodedVectorMm: Vector3Mm;
  anchors: Anchor[];
  mates: Mate[];
  materialProfile?: PbrMaterialProfile;
  geometryAsset?: GeometryAsset;
  /** All provenance IDs supplied by the manifest, including unresolved ones. */
  sourceEvidenceIds: string[];
  /** IDs absent from the evidence records supplied to the adapter. */
  unresolvedEvidenceIds: string[];
};

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function dimensionsFromAsset(asset: GeometryAsset): Vector3Mm | undefined {
  if (!asset.boundsMm) return undefined;
  return [
    asset.boundsMm.maxMm[0] - asset.boundsMm.minMm[0],
    asset.boundsMm.maxMm[1] - asset.boundsMm.minMm[1],
    asset.boundsMm.maxMm[2] - asset.boundsMm.minMm[2],
  ];
}

function geometryForProject(
  part: AssemblyPart,
  assetById: ReadonlyMap<string, GeometryAsset>,
): ComponentNode["geometry"] {
  const fidelityIsEstimated = ["estimated", "placeholder"].includes(
    part.fidelity.level,
  );

  if (part.geometry.kind === "asset") {
    const asset = assetById.get(part.geometry.assetId)!;
    return {
      kind: "reference_asset",
      assetId: asset.id,
      dimensionsMm: dimensionsFromAsset(asset),
      estimated: fidelityIsEstimated,
    };
  }

  if (part.geometry.kind === "placeholder") {
    return {
      kind: "placeholder",
      dimensionsMm: part.geometry.dimensionsMm,
      estimated: true,
    };
  }

  if (part.geometry.primitive === "sphere") {
    return {
      kind: "placeholder",
      dimensionsMm: part.geometry.dimensionsMm,
      estimated: true,
    };
  }

  const primitive =
    part.geometry.primitive === "rounded_box" ? "box" : part.geometry.primitive;
  return {
    kind: "parametric",
    primitive,
    dimensionsMm: part.geometry.dimensionsMm,
    // The legacy schema cannot preserve a rounded-box radius.
    estimated: fidelityIsEstimated || part.geometry.primitive === "rounded_box",
  };
}

function sourceEvidenceIdsForPart(
  part: AssemblyPart,
  asset: GeometryAsset | undefined,
  mates: readonly Mate[],
): string[] {
  return uniqueIds([
    ...part.fidelity.evidenceIds,
    ...(asset?.evidenceIds ?? []),
    ...part.anchors.flatMap((anchor) => anchor.evidenceIds),
    ...mates.flatMap((mate) => mate.evidenceIds),
  ]);
}

function statusForFidelity(
  fidelity: FidelityAssessment,
  evidence: readonly ProjectEvidence[],
): ClaimStatus {
  if (fidelity.level === "placeholder") return "unknown";
  if (fidelity.level === "estimated") return "inferred";

  if (evidence.some((item) => item.kind === "measurement")) {
    return "observed";
  }
  if (evidence.some((item) => item.kind === "document")) {
    return "documented";
  }

  // A manifest fidelity label alone is not promoted to observed/documented.
  return "inferred";
}

/**
 * Build a v1 Project compatibility view of a rich assembly manifest.
 *
 * Geometry fields understood by the current viewer remain native. Richer
 * assembly data is retained in a structured claim so round-tripping does not
 * silently turn approximations or unresolved provenance into facts.
 */
export function assemblyManifestToProject(
  input: AssemblyManifest,
  options: AssemblyProjectAdapterOptions = {},
): Project {
  const manifest = validateAssemblyManifest(input);
  const evidence = [...(options.evidence ?? [])];
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const assetById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const materialById = new Map(
    manifest.materialProfiles.map((material) => [material.id, material]),
  );

  const components: ComponentNode[] = manifest.parts.map((part) => {
    const asset =
      part.geometry.kind === "asset"
        ? assetById.get(part.geometry.assetId)
        : undefined;
    const mates = manifest.mates.filter(
      (mate) =>
        mate.source.partId === part.id || mate.target.partId === part.id,
    );
    const sourceEvidenceIds = sourceEvidenceIdsForPart(part, asset, mates);
    const resolvedEvidence = sourceEvidenceIds.flatMap((id) => {
      const item = evidenceById.get(id);
      return item ? [item] : [];
    });
    const fidelityEvidence = uniqueIds([
      ...part.fidelity.evidenceIds,
      ...(asset?.evidenceIds ?? []),
    ]).flatMap((id) => {
      const item = evidenceById.get(id);
      return item ? [item] : [];
    });
    const unresolvedEvidenceIds = sourceEvidenceIds.filter(
      (id) => !evidenceById.has(id),
    );
    const value: AssemblyDefinitionClaimValue = {
      manifestId: manifest.id,
      manifestSchemaVersion: manifest.schemaVersion,
      fidelity: part.fidelity,
      sourceGeometry: part.geometry,
      transform: part.transform,
      explodedVectorMm: part.explodedVectorMm,
      anchors: part.anchors,
      mates,
      materialProfile: part.materialProfileId
        ? materialById.get(part.materialProfileId)
        : undefined,
      geometryAsset: asset,
      sourceEvidenceIds,
      unresolvedEvidenceIds,
    };

    return {
      id: part.id,
      label: part.label,
      category: part.category ?? "assembly-part",
      parentId: part.parentId,
      geometry: geometryForProject(part, assetById),
      claims: [
        {
          id: `${manifest.id}:${part.id}:assembly-definition`,
          componentId: part.id,
          property: "assemblyDefinition",
          value,
          status: statusForFidelity(part.fidelity, fidelityEvidence),
          evidenceIds: resolvedEvidence.map((item) => item.id),
        },
      ],
    };
  });

  return validateProject({
    schemaVersion: 1,
    id: options.projectId ?? manifest.id,
    device: {
      confirmedByUser: false,
      ...options.device,
    },
    components,
    evidence,
  });
}
