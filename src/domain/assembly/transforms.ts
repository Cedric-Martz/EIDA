import type {
  AssemblyManifest,
  AssemblyPart,
  Transform,
  Vector3Mm,
} from "./schema";
import { validateAssemblyManifest } from "./validate";

/** Column-major matrix compatible with Three.js Matrix4.fromArray. */
export type Matrix4Mm = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type DerivedPartTransform = {
  partId: string;
  localMatrix: Matrix4Mm;
  worldMatrix: Matrix4Mm;
  worldPositionMm: Vector3Mm;
};

const IDENTITY_MATRIX: Matrix4Mm = [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
];

function asMatrix4(values: readonly number[], context: string): Matrix4Mm {
  if (values.length !== 16 || values.some((value) => !Number.isFinite(value))) {
    throw new RangeError(`${context} produced a non-finite transform`);
  }
  return values as Matrix4Mm;
}

/** Convert an XYZ-Euler transform into a column-major affine matrix. */
export function transformToMatrix(transform: Transform): Matrix4Mm {
  const [x, y, z] = transform.rotationRad;
  const cosineX = Math.cos(x / 2);
  const cosineY = Math.cos(y / 2);
  const cosineZ = Math.cos(z / 2);
  const sineX = Math.sin(x / 2);
  const sineY = Math.sin(y / 2);
  const sineZ = Math.sin(z / 2);

  const quaternionX = sineX * cosineY * cosineZ + cosineX * sineY * sineZ;
  const quaternionY = cosineX * sineY * cosineZ - sineX * cosineY * sineZ;
  const quaternionZ = cosineX * cosineY * sineZ + sineX * sineY * cosineZ;
  const quaternionW = cosineX * cosineY * cosineZ - sineX * sineY * sineZ;

  const x2 = quaternionX + quaternionX;
  const y2 = quaternionY + quaternionY;
  const z2 = quaternionZ + quaternionZ;
  const xx = quaternionX * x2;
  const xy = quaternionX * y2;
  const xz = quaternionX * z2;
  const yy = quaternionY * y2;
  const yz = quaternionY * z2;
  const zz = quaternionZ * z2;
  const wx = quaternionW * x2;
  const wy = quaternionW * y2;
  const wz = quaternionW * z2;
  const [scaleX, scaleY, scaleZ] = transform.scale;
  const [positionX, positionY, positionZ] = transform.positionMm;

  return asMatrix4(
    [
      (1 - (yy + zz)) * scaleX,
      (xy + wz) * scaleX,
      (xz - wy) * scaleX,
      0,
      (xy - wz) * scaleY,
      (1 - (xx + zz)) * scaleY,
      (yz + wx) * scaleY,
      0,
      (xz + wy) * scaleZ,
      (yz - wx) * scaleZ,
      (1 - (xx + yy)) * scaleZ,
      0,
      positionX,
      positionY,
      positionZ,
      1,
    ],
    "Transform composition",
  );
}

/** Multiply two column-major matrices, returning left * right. */
export function multiplyMatrices(left: Matrix4Mm, right: Matrix4Mm): Matrix4Mm {
  const result = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let index = 0; index < 4; index += 1) {
        value += left[index * 4 + row] * right[column * 4 + index];
      }
      result[column * 4 + row] = value;
    }
  }
  return asMatrix4(result, "Matrix multiplication");
}

export function transformPoint(
  matrix: Matrix4Mm,
  pointMm: Vector3Mm,
): Vector3Mm {
  const [x, y, z] = pointMm;
  const result: Vector3Mm = [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
  if (result.some((value) => !Number.isFinite(value))) {
    throw new RangeError(
      "Point transformation produced non-finite coordinates",
    );
  }
  return result;
}

function explodedTransform(
  part: AssemblyPart,
  explodeFactor: number,
): Transform {
  return {
    ...part.transform,
    positionMm: [
      part.transform.positionMm[0] + part.explodedVectorMm[0] * explodeFactor,
      part.transform.positionMm[1] + part.explodedVectorMm[1] * explodeFactor,
      part.transform.positionMm[2] + part.explodedVectorMm[2] * explodeFactor,
    ],
  };
}

function deriveTransforms(
  input: AssemblyManifest,
  explodeFactor: number,
): ReadonlyMap<string, DerivedPartTransform> {
  if (!Number.isFinite(explodeFactor) || explodeFactor < 0) {
    throw new RangeError(
      "Explode factor must be a finite, non-negative number",
    );
  }

  const manifest = validateAssemblyManifest(input);
  const partById = new Map(manifest.parts.map((part) => [part.id, part]));
  const derivedById = new Map<string, DerivedPartTransform>();

  const resolvePart = (part: AssemblyPart): DerivedPartTransform => {
    const cached = derivedById.get(part.id);
    if (cached) return cached;

    const localMatrix = transformToMatrix(
      explodedTransform(part, explodeFactor),
    );
    const parent = part.parentId ? partById.get(part.parentId) : undefined;
    const parentMatrix = parent
      ? resolvePart(parent).worldMatrix
      : IDENTITY_MATRIX;
    const worldMatrix = multiplyMatrices(parentMatrix, localMatrix);
    const derived: DerivedPartTransform = {
      partId: part.id,
      localMatrix,
      worldMatrix,
      worldPositionMm: [worldMatrix[12], worldMatrix[13], worldMatrix[14]],
    };
    derivedById.set(part.id, derived);
    return derived;
  };

  // Resolve in manifest order so Map iteration is stable for rendering.
  for (const part of manifest.parts) resolvePart(part);

  return new Map(
    manifest.parts.map((part) => [part.id, derivedById.get(part.id)!]),
  );
}

export function deriveAssembledTransforms(
  manifest: AssemblyManifest,
): ReadonlyMap<string, DerivedPartTransform> {
  return deriveTransforms(manifest, 0);
}

/**
 * Derive world matrices after applying each part's parent-space exploded vector.
 * Descendants inherit their ancestors' exploded motion.
 */
export function deriveExplodedTransforms(
  manifest: AssemblyManifest,
  explodeFactor = 1,
): ReadonlyMap<string, DerivedPartTransform> {
  return deriveTransforms(manifest, explodeFactor);
}
