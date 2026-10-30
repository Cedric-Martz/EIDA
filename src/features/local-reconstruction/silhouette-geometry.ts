import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import {
  Color,
  ExtrudeGeometry,
  Mesh,
  MeshStandardMaterial,
  Shape,
  Vector2,
} from "three";
import type { AssemblyManifest, DimensionsMm } from "@/domain/assembly";
import type {
  LocalPartInventory,
  LocalSegmentationResult,
} from "@/domain/local-reconstruction";
import type { LocalAssetRecord } from "@/storage/indexed-db/db";

type Point = readonly [number, number];

export type SegmentedPart = {
  item: LocalPartInventory["items"][number];
  segmentation: LocalSegmentationResult;
  photo: LocalAssetRecord;
};

const categoryDepth: Record<string, number> = {
  board: 1.6,
  battery: 5,
  display: 2.2,
  screen: 2.2,
  housing: 7,
  camera: 4,
  button: 3,
  connector: 4,
  speaker: 4,
};

const categoryColor: Record<string, string> = {
  board: "#2d735d",
  battery: "#899093",
  display: "#263942",
  screen: "#263942",
  housing: "#c9c8c1",
  camera: "#1e2528",
  button: "#9aa1a3",
  connector: "#8d9294",
  speaker: "#3b4346",
};

function polygonArea(points: readonly Point[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current[0] * next[1] - next[0] * current[1];
  }
  return area / 2;
}

export function svgPathPolygons(path: string): Point[][] {
  const tokens = path.match(/[MLZ]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi) ?? [];
  const polygons: Point[][] = [];
  let current: Point[] = [];
  let command = "";
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index]!;
    if (/^[MLZ]$/i.test(token)) {
      command = token.toUpperCase();
      index += 1;
      if (command === "M" && current.length >= 3) {
        polygons.push(current);
        current = [];
      }
      if (command === "Z") {
        if (current.length >= 3) polygons.push(current);
        current = [];
      }
      continue;
    }
    if (command !== "M" && command !== "L") {
      index += 1;
      continue;
    }
    const x = Number(token);
    const y = Number(tokens[index + 1]);
    if (Number.isFinite(x) && Number.isFinite(y)) current.push([x, y]);
    index += 2;
    if (command === "M") command = "L";
  }
  if (current.length >= 3) polygons.push(current);
  return polygons;
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  if (dx === 0 && dy === 0)
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
        (dx * dx + dy * dy),
    ),
  );
  return Math.hypot(
    point[0] - (start[0] + t * dx),
    point[1] - (start[1] + t * dy),
  );
}

export function simplifyPolygon(
  points: readonly Point[],
  tolerance = 1.25,
): Point[] {
  if (points.length <= 4) return [...points];
  const simplify = (input: readonly Point[]): Point[] => {
    let maxDistance = 0;
    let splitIndex = 0;
    for (let index = 1; index < input.length - 1; index += 1) {
      const distance = distanceToSegment(
        input[index]!,
        input[0]!,
        input[input.length - 1]!,
      );
      if (distance > maxDistance) {
        maxDistance = distance;
        splitIndex = index;
      }
    }
    if (maxDistance <= tolerance) return [input[0]!, input[input.length - 1]!];
    return [
      ...simplify(input.slice(0, splitIndex + 1)).slice(0, -1),
      ...simplify(input.slice(splitIndex)),
    ];
  };
  const closed = [...points, points[0]!];
  return simplify(closed).slice(0, -1);
}

async function imageSize(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

function arrayBufferToDataUrl(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:model/gltf-binary;base64,${btoa(binary)}`;
}

async function exportPartGlb(
  pointsMm: readonly Point[],
  depthMm: number,
  color: string,
): Promise<ArrayBuffer> {
  const shape = new Shape(pointsMm.map(([x, y]) => new Vector2(x, -y)));
  const geometry = new ExtrudeGeometry(shape, {
    depth: depthMm,
    bevelEnabled: true,
    bevelSize: Math.min(0.45, depthMm * 0.08),
    bevelThickness: Math.min(0.35, depthMm * 0.08),
    bevelSegments: 2,
    curveSegments: 1,
  });
  geometry.center();
  geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({
    color: new Color(color),
    roughness: 0.48,
    metalness: 0.08,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = "SAM 3.1 silhouette reconstruction";
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(mesh, {
    binary: true,
    onlyVisible: true,
  });
  geometry.dispose();
  material.dispose();
  if (!(result instanceof ArrayBuffer)) {
    throw new Error("GLB export returned JSON instead of binary data.");
  }
  return result;
}

export async function buildSilhouetteAssembly({
  projectId,
  label,
  dimensionsMm,
  parts,
}: {
  projectId: string;
  label: string;
  dimensionsMm: DimensionsMm;
  parts: readonly SegmentedPart[];
}): Promise<AssemblyManifest> {
  const assets: AssemblyManifest["assets"] = [];
  const assemblyParts: AssemblyManifest["parts"] = [];

  for (const [index, part] of parts.entries()) {
    const mask = part.segmentation.masks[0];
    if (!mask || !mask.svgPath) continue;
    const polygons = svgPathPolygons(mask.svgPath);
    const outline = polygons.sort(
      (left, right) =>
        Math.abs(polygonArea(right)) - Math.abs(polygonArea(left)),
    )[0];
    if (!outline) continue;
    const sourceSize = await imageSize(part.photo.blob);
    const imageLong = Math.max(sourceSize.width, sourceSize.height);
    const imageShort = Math.min(sourceSize.width, sourceSize.height);
    const deviceLong = Math.max(dimensionsMm[0], dimensionsMm[1]);
    const deviceShort = Math.min(dimensionsMm[0], dimensionsMm[1]);
    const mmPerPixel = Math.min(
      deviceLong / imageLong,
      deviceShort / imageShort,
    );
    // SAM's mask raster can be smaller than its source-pixel bounding box.
    // Reproject the local mask coordinates into source-image pixels before
    // applying the physical scale, otherwise parts may be visibly undersized.
    const maskToSourceX = (mask.bounds.right - mask.bounds.left) / mask.width;
    const maskToSourceY = (mask.bounds.bottom - mask.bounds.top) / mask.height;
    const simplified = simplifyPolygon(outline).map(
      ([x, y]) =>
        [
          x * maskToSourceX * mmPerPixel,
          y * maskToSourceY * mmPerPixel,
        ] as Point,
    );
    if (simplified.length < 3) continue;
    const depthMm =
      part.item.thicknessMm ??
      categoryDepth[part.item.category.toLowerCase()] ??
      3;
    const xs = simplified.map((point) => point[0]);
    const ys = simplified.map((point) => point[1]);
    const widthMm = Math.max(...xs) - Math.min(...xs);
    const heightMm = Math.max(...ys) - Math.min(...ys);
    const glb = await exportPartGlb(
      simplified,
      depthMm,
      categoryColor[part.item.category.toLowerCase()] ?? "#76858a",
    );
    const assetId = `sam-mask-${part.item.id}`;
    assets.push({
      id: assetId,
      label: `${part.item.label} · SAM 3.1 silhouette`,
      uri: arrayBufferToDataUrl(glb),
      format: "glb",
      millimetresPerAssetUnit: 1,
      boundsMm: {
        minMm: [-widthMm / 2, -heightMm / 2, -depthMm / 2],
        maxMm: [widthMm / 2, heightMm / 2, depthMm / 2],
      },
      evidenceIds: [],
    });
    const centerX = (mask.bounds.left + mask.bounds.right) / 2;
    const centerY = (mask.bounds.top + mask.bounds.bottom) / 2;
    assemblyParts.push({
      id: part.item.id,
      label: part.item.label,
      category: part.item.category,
      geometry: { kind: "asset", assetId },
      fidelity: {
        level: "estimated",
        evidenceIds: [],
        note: "Outline reconstructed from a SAM 3.1 mask; depth and scale remain estimated unless measured.",
      },
      transform: {
        positionMm: [
          (centerX - sourceSize.width / 2) * mmPerPixel,
          -(centerY - sourceSize.height / 2) * mmPerPixel,
          index * Math.max(0.35, depthMm * 0.08),
        ],
        rotationRad: [0, 0, 0],
        scale: [1, 1, 1],
      },
      explodedVectorMm: [0, 0, 18 + index * 8],
      anchors: [],
    });
  }

  if (assemblyParts.length === 0) {
    throw new Error("No usable SAM mask was available for local geometry.");
  }

  return {
    schemaVersion: 1,
    id: `local-meta-${projectId}-${Date.now()}`,
    label: `${label} · Meta local reconstruction`,
    units: "mm",
    assemblyBoundsMm: {
      minMm: [-dimensionsMm[1] / 2, -dimensionsMm[0] / 2, -dimensionsMm[2]],
      maxMm: [dimensionsMm[1] / 2, dimensionsMm[0] / 2, dimensionsMm[2] * 3],
    },
    assets,
    materialProfiles: [],
    parts: assemblyParts,
    mates: [],
  };
}
