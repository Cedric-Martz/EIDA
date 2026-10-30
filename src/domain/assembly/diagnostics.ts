import type {
  AabbMm,
  AssemblyManifest,
  AssemblyPart,
  GeometryAsset,
  Vector3Mm,
} from "./schema";
import {
  deriveAssembledTransforms,
  transformPoint,
  type Matrix4Mm,
} from "./transforms";
import { validateAssemblyManifest } from "./validate";

export type AssemblyDiagnostic =
  | {
      code: "aabb-overlap";
      severity: "warning";
      partIds: readonly [string, string];
      message: string;
      overlapMm: Vector3Mm;
      overlapVolumeMm3: number;
    }
  | {
      code: "part-outside-parent" | "part-outside-assembly";
      severity: "warning";
      partIds: readonly string[];
      message: string;
      overflowMm: Vector3Mm;
    };

export type DerivedPartBounds = {
  partId: string;
  localBoundsMm: AabbMm;
  worldBoundsMm: AabbMm;
};

export type AssemblyDiagnosticOptions = {
  /** Differences at or below this threshold are treated as contact. */
  toleranceMm?: number;
};

function centeredBounds(dimensionsMm: Vector3Mm): AabbMm {
  return {
    minMm: [-dimensionsMm[0] / 2, -dimensionsMm[1] / 2, -dimensionsMm[2] / 2],
    maxMm: [dimensionsMm[0] / 2, dimensionsMm[1] / 2, dimensionsMm[2] / 2],
  };
}

function localBoundsForPart(
  part: AssemblyPart,
  assetById: ReadonlyMap<string, GeometryAsset>,
): AabbMm | undefined {
  if (part.geometry.kind === "asset") {
    return assetById.get(part.geometry.assetId)?.boundsMm;
  }
  if (part.geometry.kind === "parametric") {
    return centeredBounds(part.geometry.dimensionsMm);
  }
  if (part.geometry.dimensionsMm) {
    return centeredBounds(part.geometry.dimensionsMm);
  }
  return undefined;
}

export function transformAabb(bounds: AabbMm, matrix: Matrix4Mm): AabbMm {
  const corners: Vector3Mm[] = [];
  for (const x of [bounds.minMm[0], bounds.maxMm[0]]) {
    for (const y of [bounds.minMm[1], bounds.maxMm[1]]) {
      for (const z of [bounds.minMm[2], bounds.maxMm[2]]) {
        corners.push(transformPoint(matrix, [x, y, z]));
      }
    }
  }

  return {
    minMm: [
      Math.min(...corners.map((corner) => corner[0])),
      Math.min(...corners.map((corner) => corner[1])),
      Math.min(...corners.map((corner) => corner[2])),
    ],
    maxMm: [
      Math.max(...corners.map((corner) => corner[0])),
      Math.max(...corners.map((corner) => corner[1])),
      Math.max(...corners.map((corner) => corner[2])),
    ],
  };
}

/** Return bounds only for parts whose geometry supplies enough information. */
export function deriveAssembledBounds(
  input: AssemblyManifest,
): ReadonlyMap<string, DerivedPartBounds> {
  const manifest = validateAssemblyManifest(input);
  const transforms = deriveAssembledTransforms(manifest);
  const assetById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const result = new Map<string, DerivedPartBounds>();

  for (const part of manifest.parts) {
    const localBoundsMm = localBoundsForPart(part, assetById);
    const transform = transforms.get(part.id);
    if (!localBoundsMm || !transform) continue;
    result.set(part.id, {
      partId: part.id,
      localBoundsMm,
      worldBoundsMm: transformAabb(localBoundsMm, transform.worldMatrix),
    });
  }

  return result;
}

function overflowByAxis(inner: AabbMm, outer: AabbMm): Vector3Mm {
  return [0, 1, 2].map((axis) =>
    Math.max(
      outer.minMm[axis] - inner.minMm[axis],
      inner.maxMm[axis] - outer.maxMm[axis],
      0,
    ),
  ) as Vector3Mm;
}

function overlapByAxis(left: AabbMm, right: AabbMm): Vector3Mm {
  return [0, 1, 2].map((axis) =>
    Math.max(
      0,
      Math.min(left.maxMm[axis], right.maxMm[axis]) -
        Math.max(left.minMm[axis], right.minMm[axis]),
    ),
  ) as Vector3Mm;
}

function compareDiagnostics(
  left: AssemblyDiagnostic,
  right: AssemblyDiagnostic,
): number {
  return (
    left.code.localeCompare(right.code) ||
    left.partIds.join("\u0000").localeCompare(right.partIds.join("\u0000"))
  );
}

/**
 * Basic broad-phase diagnostics. These warnings are deliberately non-fatal:
 * an AABB overlap can be intentional, especially for nested or flexible parts.
 */
export function diagnoseAssembly(
  input: AssemblyManifest,
  options: AssemblyDiagnosticOptions = {},
): readonly AssemblyDiagnostic[] {
  const toleranceMm = options.toleranceMm ?? 0.01;
  if (!Number.isFinite(toleranceMm) || toleranceMm < 0) {
    throw new RangeError(
      "AABB tolerance must be a finite, non-negative number",
    );
  }

  const manifest = validateAssemblyManifest(input);
  const boundsByPartId = deriveAssembledBounds(manifest);
  const diagnostics: AssemblyDiagnostic[] = [];

  if (manifest.assemblyBoundsMm) {
    for (const part of manifest.parts) {
      const bounds = boundsByPartId.get(part.id)?.worldBoundsMm;
      if (!bounds) continue;
      const overflowMm = overflowByAxis(bounds, manifest.assemblyBoundsMm);
      if (overflowMm.some((overflow) => overflow > toleranceMm)) {
        diagnostics.push({
          code: "part-outside-assembly",
          severity: "warning",
          partIds: [part.id],
          message: `Part "${part.id}" exceeds the assembly envelope`,
          overflowMm,
        });
      }
    }
  }

  for (const part of manifest.parts) {
    if (!part.parentId) continue;
    const childBounds = boundsByPartId.get(part.id)?.worldBoundsMm;
    const parentBounds = boundsByPartId.get(part.parentId)?.worldBoundsMm;
    if (!childBounds || !parentBounds) continue;
    const overflowMm = overflowByAxis(childBounds, parentBounds);
    if (overflowMm.some((overflow) => overflow > toleranceMm)) {
      diagnostics.push({
        code: "part-outside-parent",
        severity: "warning",
        partIds: [part.id, part.parentId],
        message: `Part "${part.id}" exceeds parent "${part.parentId}" bounds`,
        overflowMm,
      });
    }
  }

  const siblingsByParent = new Map<string, AssemblyPart[]>();
  for (const part of manifest.parts) {
    const parentKey = part.parentId ?? "\u0000root";
    const siblings = siblingsByParent.get(parentKey) ?? [];
    siblings.push(part);
    siblingsByParent.set(parentKey, siblings);
  }

  for (const siblings of siblingsByParent.values()) {
    const ordered = [...siblings].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < ordered.length;
        rightIndex += 1
      ) {
        const left = ordered[leftIndex];
        const right = ordered[rightIndex];
        const leftBounds = boundsByPartId.get(left.id)?.worldBoundsMm;
        const rightBounds = boundsByPartId.get(right.id)?.worldBoundsMm;
        if (!leftBounds || !rightBounds) continue;
        const overlapMm = overlapByAxis(leftBounds, rightBounds);
        if (overlapMm.every((overlap) => overlap > toleranceMm)) {
          diagnostics.push({
            code: "aabb-overlap",
            severity: "warning",
            partIds: [left.id, right.id],
            message: `Sibling parts "${left.id}" and "${right.id}" have overlapping AABBs`,
            overlapMm,
            overlapVolumeMm3: overlapMm[0] * overlapMm[1] * overlapMm[2],
          });
        }
      }
    }
  }

  return diagnostics.sort(compareDiagnostics);
}
