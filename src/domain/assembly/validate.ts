import {
  assemblyManifestSchema,
  type AnchorReference,
  type AssemblyManifest,
  type AssemblyPart,
} from "./schema";

export type AssemblyValidationIssueCode =
  | "duplicate-anchor-id"
  | "duplicate-asset-id"
  | "duplicate-material-profile-id"
  | "duplicate-mate-id"
  | "duplicate-part-id"
  | "invalid-parametric-geometry"
  | "missing-geometry-asset"
  | "missing-material-profile"
  | "missing-mate-anchor"
  | "missing-mate-part"
  | "missing-parent"
  | "parent-cycle"
  | "placeholder-fidelity-mismatch";

export type AssemblyValidationIssue = {
  code: AssemblyValidationIssueCode;
  path: string;
  message: string;
};

export class AssemblyManifestValidationError extends Error {
  readonly issues: readonly AssemblyValidationIssue[];

  constructor(issues: readonly AssemblyValidationIssue[]) {
    super(
      `Invalid assembly manifest:\n${issues
        .map((issue) => `- ${issue.path}: ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "AssemblyManifestValidationError";
    this.issues = issues;
  }
}

function compareIssues(
  left: AssemblyValidationIssue,
  right: AssemblyValidationIssue,
): number {
  return (
    left.path.localeCompare(right.path) ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message)
  );
}

function indexFirstById<T extends { id: string }>(items: readonly T[]) {
  const result = new Map<string, T>();
  for (const item of items) {
    if (!result.has(item.id)) result.set(item.id, item);
  }
  return result;
}

function collectDuplicateIds<T extends { id: string }>(
  items: readonly T[],
  collectionPath: string,
  code: AssemblyValidationIssueCode,
  noun: string,
): AssemblyValidationIssue[] {
  const issues: AssemblyValidationIssue[] = [];
  const firstIndexById = new Map<string, number>();

  items.forEach((item, index) => {
    const firstIndex = firstIndexById.get(item.id);
    if (firstIndex === undefined) {
      firstIndexById.set(item.id, index);
      return;
    }

    issues.push({
      code,
      path: `${collectionPath}.${index}.id`,
      message: `Duplicate ${noun} ID "${item.id}" (first used at ${collectionPath}.${firstIndex}.id)`,
    });
  });

  return issues;
}

function canonicalCycle(ids: readonly string[]): string[] {
  if (ids.length < 2) return [...ids];

  const rotations = ids.map((_, index) => [
    ...ids.slice(index),
    ...ids.slice(0, index),
  ]);
  rotations.sort((left, right) =>
    left.join("\u0000").localeCompare(right.join("\u0000")),
  );
  return rotations[0];
}

function collectParentCycleIssues(
  parts: readonly AssemblyPart[],
  partById: ReadonlyMap<string, AssemblyPart>,
): AssemblyValidationIssue[] {
  const issues: AssemblyValidationIssue[] = [];
  const reportedCycles = new Set<string>();
  const partIndexById = new Map(parts.map((part, index) => [part.id, index]));

  for (const startingId of [...partById.keys()].sort()) {
    const path: string[] = [];
    const pathIndexById = new Map<string, number>();
    let currentId: string | undefined = startingId;

    while (currentId && partById.has(currentId)) {
      const repeatedAt = pathIndexById.get(currentId);
      if (repeatedAt !== undefined) {
        const cycle = canonicalCycle(path.slice(repeatedAt));
        const cycleKey = [...cycle].sort().join("\u0000");
        if (!reportedCycles.has(cycleKey)) {
          reportedCycles.add(cycleKey);
          const firstId = cycle[0];
          issues.push({
            code: "parent-cycle",
            path: `parts.${partIndexById.get(firstId) ?? 0}.parentId`,
            message: `Parent cycle detected: ${[...cycle, firstId].join(" -> ")}`,
          });
        }
        break;
      }

      pathIndexById.set(currentId, path.length);
      path.push(currentId);
      currentId = partById.get(currentId)?.parentId;
    }
  }

  return issues;
}

function validateAnchorReference(
  reference: AnchorReference,
  path: string,
  partById: ReadonlyMap<string, AssemblyPart>,
): AssemblyValidationIssue[] {
  const part = partById.get(reference.partId);
  if (!part) {
    return [
      {
        code: "missing-mate-part",
        path: `${path}.partId`,
        message: `Mate references unknown part "${reference.partId}"`,
      },
    ];
  }

  if (!part.anchors.some((anchor) => anchor.id === reference.anchorId)) {
    return [
      {
        code: "missing-mate-anchor",
        path: `${path}.anchorId`,
        message: `Mate references unknown anchor "${reference.anchorId}" on part "${reference.partId}"`,
      },
    ];
  }

  return [];
}

/**
 * Checks cross-record invariants after the Zod schema has established finite,
 * correctly shaped numeric data. The returned issue order is stable.
 */
export function collectAssemblyValidationIssues(
  manifest: AssemblyManifest,
): AssemblyValidationIssue[] {
  const issues: AssemblyValidationIssue[] = [
    ...collectDuplicateIds(
      manifest.assets,
      "assets",
      "duplicate-asset-id",
      "asset",
    ),
    ...collectDuplicateIds(
      manifest.materialProfiles,
      "materialProfiles",
      "duplicate-material-profile-id",
      "material profile",
    ),
    ...collectDuplicateIds(
      manifest.parts,
      "parts",
      "duplicate-part-id",
      "part",
    ),
    ...collectDuplicateIds(
      manifest.mates,
      "mates",
      "duplicate-mate-id",
      "mate",
    ),
  ];

  const assetById = indexFirstById(manifest.assets);
  const materialById = indexFirstById(manifest.materialProfiles);
  const partById = indexFirstById(manifest.parts);

  manifest.parts.forEach((part, partIndex) => {
    issues.push(
      ...collectDuplicateIds(
        part.anchors,
        `parts.${partIndex}.anchors`,
        "duplicate-anchor-id",
        "anchor",
      ),
    );

    if (part.parentId && !partById.has(part.parentId)) {
      issues.push({
        code: "missing-parent",
        path: `parts.${partIndex}.parentId`,
        message: `Part references unknown parent "${part.parentId}"`,
      });
    }

    if (
      part.geometry.kind === "asset" &&
      !assetById.has(part.geometry.assetId)
    ) {
      issues.push({
        code: "missing-geometry-asset",
        path: `parts.${partIndex}.geometry.assetId`,
        message: `Part references unknown geometry asset "${part.geometry.assetId}"`,
      });
    }

    if (part.materialProfileId && !materialById.has(part.materialProfileId)) {
      issues.push({
        code: "missing-material-profile",
        path: `parts.${partIndex}.materialProfileId`,
        message: `Part references unknown material profile "${part.materialProfileId}"`,
      });
    }

    if (
      part.geometry.kind === "placeholder" &&
      part.fidelity.level !== "placeholder"
    ) {
      issues.push({
        code: "placeholder-fidelity-mismatch",
        path: `parts.${partIndex}.fidelity.level`,
        message: "Placeholder geometry must have placeholder fidelity",
      });
    }

    if (part.geometry.kind === "parametric") {
      const radius = part.geometry.cornerRadiusMm;
      if (part.geometry.primitive === "rounded_box" && radius === undefined) {
        issues.push({
          code: "invalid-parametric-geometry",
          path: `parts.${partIndex}.geometry.cornerRadiusMm`,
          message: "Rounded boxes require a corner radius",
        });
      } else if (
        part.geometry.primitive === "rounded_box" &&
        radius !== undefined &&
        radius > Math.min(...part.geometry.dimensionsMm) / 2
      ) {
        issues.push({
          code: "invalid-parametric-geometry",
          path: `parts.${partIndex}.geometry.cornerRadiusMm`,
          message: "Corner radius cannot exceed half the smallest dimension",
        });
      } else if (
        part.geometry.primitive !== "rounded_box" &&
        radius !== undefined
      ) {
        issues.push({
          code: "invalid-parametric-geometry",
          path: `parts.${partIndex}.geometry.cornerRadiusMm`,
          message: "Corner radius is only valid for rounded boxes",
        });
      }
    }
  });

  issues.push(...collectParentCycleIssues(manifest.parts, partById));

  manifest.mates.forEach((mate, mateIndex) => {
    issues.push(
      ...validateAnchorReference(
        mate.source,
        `mates.${mateIndex}.source`,
        partById,
      ),
      ...validateAnchorReference(
        mate.target,
        `mates.${mateIndex}.target`,
        partById,
      ),
    );
  });

  return issues.sort(compareIssues);
}

/** Parse an unknown value and reject both schema and referential errors. */
export function validateAssemblyManifest(input: unknown): AssemblyManifest {
  const manifest = assemblyManifestSchema.parse(input);
  const issues = collectAssemblyValidationIssues(manifest);
  if (issues.length > 0) throw new AssemblyManifestValidationError(issues);
  return manifest;
}
