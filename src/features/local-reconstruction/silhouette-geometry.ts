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
import {
  compileReconstructionGraph,
  validateReconstructionGraph,
  type ReconstructionEvidence,
  type ReconstructionGraph,
  type ReconstructionPart,
} from "@/domain/reconstruction-graph";
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

function graphId(prefix: string, value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${prefix}:${safe || "unknown"}`;
}

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

export function fitPolygonToCadBounds(
  points: readonly Point[],
  dimensionsMm: readonly [number, number, number],
): Point[] {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return [...points];
  }
  const [cadLong, cadShort] = dimensionsMm;
  const directRatioError = Math.abs(width / height - cadLong / cadShort);
  const swappedRatioError = Math.abs(width / height - cadShort / cadLong);
  const targetWidth =
    directRatioError <= swappedRatioError ? cadLong : cadShort;
  const targetHeight =
    directRatioError <= swappedRatioError ? cadShort : cadLong;
  return points.map(
    ([x, y]) =>
      [x * (targetWidth / width), y * (targetHeight / height)] as Point,
  );
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
  bevelMm = Math.min(0.45, depthMm * 0.08),
): Promise<ArrayBuffer> {
  const shape = new Shape(pointsMm.map(([x, y]) => new Vector2(x, -y)));
  const geometry = new ExtrudeGeometry(shape, {
    depth: depthMm,
    bevelEnabled: true,
    bevelSize: Math.min(bevelMm, depthMm * 0.45),
    bevelThickness: Math.min(bevelMm, depthMm * 0.35),
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

export async function generateGraphAssets(
  graph: ReconstructionGraph,
): Promise<AssemblyManifest["assets"]> {
  const validated = validateReconstructionGraph(graph);
  const assets: AssemblyManifest["assets"] = [];

  for (const part of validated.parts) {
    if (part.geometry.kind !== "profile-extrusion") continue;
    const xs = part.geometry.profileMm.map((point) => point[0]);
    const ys = part.geometry.profileMm.map((point) => point[1]);
    const widthMm = Math.max(...xs) - Math.min(...xs);
    const heightMm = Math.max(...ys) - Math.min(...ys);
    const glb = await exportPartGlb(
      part.geometry.profileMm,
      part.geometry.depthMm,
      categoryColor[part.category.toLowerCase()] ?? "#76858a",
      part.geometry.bevelMm,
    );
    assets.push({
      id: part.geometry.assetId,
      label: `${part.label} · compiled EIDA profile`,
      uri: arrayBufferToDataUrl(glb),
      format: "glb",
      millimetresPerAssetUnit: 1,
      boundsMm: {
        minMm: [-widthMm / 2, -heightMm / 2, -part.geometry.depthMm / 2],
        maxMm: [widthMm / 2, heightMm / 2, part.geometry.depthMm / 2],
      },
      evidenceIds: [...new Set(Object.values(part.evidence).flat())],
    });
  }

  return assets;
}

export type ReconstructionGraphBuild = {
  graph: ReconstructionGraph;
  manifest: AssemblyManifest;
};

export async function buildReconstructionGraphAssembly({
  projectId,
  label,
  dimensionsMm,
  parts,
}: {
  projectId: string;
  label: string;
  dimensionsMm: DimensionsMm;
  parts: readonly SegmentedPart[];
}): Promise<ReconstructionGraphBuild> {
  const graphParts: ReconstructionPart[] = [];
  const graphEvidence = new Map<string, ReconstructionEvidence>();
  const createdAt = Date.now();

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
    let simplified = simplifyPolygon(outline).map(
      ([x, y]) =>
        [
          x * maskToSourceX * mmPerPixel,
          y * maskToSourceY * mmPerPixel,
        ] as Point,
    );
    if (simplified.length < 3) continue;
    if (part.item.dimensionsMm) {
      simplified = fitPolygonToCadBounds(simplified, part.item.dimensionsMm);
    }
    const depthMm =
      part.item.dimensionsMm?.[2] ??
      part.item.thicknessMm ??
      categoryDepth[part.item.category.toLowerCase()] ??
      3;
    const xs = simplified.map((point) => point[0]);
    const ys = simplified.map((point) => point[1]);
    const assetId = `sam-mask-${part.item.id}`;
    const photoEvidenceId = graphId("photo", part.item.id);
    const maskEvidenceId = graphId("mask", part.item.id);
    const dimensionEvidence = part.item.dimensionSourceIds.map((sourceId) =>
      graphId("source", sourceId),
    );
    graphEvidence.set(photoEvidenceId, {
      id: photoEvidenceId,
      kind: "user-photo",
      label: part.photo.name,
      locator: part.photo.id,
    });
    graphEvidence.set(maskEvidenceId, {
      id: maskEvidenceId,
      kind: "segmentation-mask",
      label: `${part.item.label} · SAM 3.1 mask`,
      sourceId: photoEvidenceId,
      confidence: mask.confidence ?? undefined,
    });
    part.item.dimensionSourceIds.forEach((sourceId, index) => {
      const evidenceId = dimensionEvidence[index]!;
      graphEvidence.set(evidenceId, {
        id: evidenceId,
        kind: "document",
        label: `Reviewed dimension source · ${sourceId}`,
        locator: sourceId,
      });
    });
    const centerX = (mask.bounds.left + mask.bounds.right) / 2;
    const centerY = (mask.bounds.top + mask.bounds.bottom) / 2;
    const profileCenterX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const profileCenterY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const centeredProfile = simplified.map(
      ([x, y]) =>
        [x - profileCenterX, -(y - profileCenterY)] as [number, number],
    );
    const transformEvidence = [photoEvidenceId, maskEvidenceId];
    const depthDocumented =
      (part.item.dimensionsMm !== null || part.item.thicknessMm !== null) &&
      dimensionEvidence.length > 0;
    graphParts.push({
      id: part.item.id,
      label: part.item.label,
      category: part.item.category,
      geometry: {
        kind: "profile-extrusion",
        profileMm: centeredProfile,
        depthMm,
        bevelMm: Math.min(0.45, depthMm * 0.08),
        assetId,
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
      fidelity: depthDocumented ? "measured" : "estimated",
      evidence: {
        presence: [photoEvidenceId],
        outline: [maskEvidenceId],
        dimensions: dimensionEvidence,
        depth: depthDocumented ? dimensionEvidence : [],
        transform: transformEvidence,
        material: [],
      },
      assumptions: [
        ...(!depthDocumented
          ? [
              {
                id: `assumption:${part.item.id}:depth`,
                property: "depth" as const,
                reason: `Depth uses the EIDA ${part.item.category} prior because no component measurement was available.`,
                impact: "mechanical" as const,
              },
            ]
          : []),
        {
          id: `assumption:${part.item.id}:pose`,
          property: "transform" as const,
          reason:
            "The part centre is projected from its selected photo; multi-view registration can replace this transform later.",
          impact: "spatial" as const,
        },
      ],
    });
  }

  if (graphParts.length === 0) {
    throw new Error("No usable SAM mask was available for local geometry.");
  }

  const graph = validateReconstructionGraph({
    schema: "eida-reconstruction-graph",
    schemaVersion: 1,
    id: `graph-${projectId}-${createdAt}`,
    projectId,
    label: `${label} · Meta local reconstruction`,
    units: "mm",
    coordinateSystem: "right-handed-y-up",
    createdAt,
    assemblyBoundsMm: {
      minMm: [-dimensionsMm[1] / 2, -dimensionsMm[0] / 2, -dimensionsMm[2]],
      maxMm: [dimensionsMm[1] / 2, dimensionsMm[0] / 2, dimensionsMm[2] * 3],
    },
    evidence: [...graphEvidence.values()],
    parts: graphParts,
    relations: graphParts.slice(1).map((part, index) => ({
      id: `relation:${part.id}:above:${graphParts[index]!.id}`,
      kind: "above" as const,
      sourcePartId: part.id,
      targetPartId: graphParts[index]!.id,
      evidenceIds: part.evidence.transform,
    })),
  });
  const assets = await generateGraphAssets(graph);

  return { graph, manifest: compileReconstructionGraph(graph, assets) };
}

export async function buildSilhouetteAssembly(
  input: Parameters<typeof buildReconstructionGraphAssembly>[0],
): Promise<AssemblyManifest> {
  return (await buildReconstructionGraphAssembly(input)).manifest;
}
