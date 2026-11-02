import { createHash } from "node:crypto";
import type { CadAnalysis } from "@/domain/research/evidence-bundle";

type CadFormat = CadAnalysis["format"];
type CadUnit = CadAnalysis["unit"];
type Point3 = [number, number, number];

const FORMAT_BY_EXTENSION: Record<string, CadFormat> = {
  step: "step",
  stp: "step",
  dxf: "dxf",
  iges: "iges",
  igs: "iges",
  stl: "stl",
  obj: "obj",
  "3mf": "3mf",
  gltf: "gltf",
  glb: "glb",
};

const UNIT_SCALE_MM: Record<Exclude<CadUnit, "unknown">, number> = {
  mm: 1,
  cm: 10,
  m: 1_000,
  inch: 25.4,
  foot: 304.8,
};

function safeFileName(url: string): string {
  try {
    return (
      decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "")
        .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "-")
        .trim()
        .slice(0, 500) || "technical-file"
    );
  } catch {
    return "technical-file";
  }
}

export function cadFormatFromUrl(url: string): CadFormat {
  try {
    const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
    return extension
      ? (FORMAT_BY_EXTENSION[extension] ?? "unknown")
      : "unknown";
  } catch {
    return "unknown";
  }
}

function finiteCoordinate(value: string): number | null {
  const parsed = Number(value.trim().replace(/[dD]/, "E"));
  return Number.isFinite(parsed) && Math.abs(parsed) <= 1_000_000
    ? parsed
    : null;
}

function boundsFromPoints(points: readonly Point3[], scale: number) {
  if (points.length === 0) return undefined;
  const min: Point3 = [Infinity, Infinity, Infinity];
  const max: Point3 = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let axis = 0; axis < 3; axis += 1) {
      min[axis] = Math.min(min[axis], point[axis]! * scale);
      max[axis] = Math.max(max[axis], point[axis]! * scale);
    }
  }
  const dimensions: Point3 = [
    max[0] - min[0],
    max[1] - min[1],
    max[2] - min[2],
  ];
  if (dimensions.every((value) => value === 0)) return undefined;
  return { min, max, dimensions };
}

function stepUnit(text: string): CadUnit {
  if (/CONVERSION_BASED_UNIT\s*\(\s*['"](?:INCH|IN)['"]/i.test(text)) {
    return "inch";
  }
  if (/CONVERSION_BASED_UNIT\s*\(\s*['"](?:FOOT|FEET|FT)['"]/i.test(text)) {
    return "foot";
  }
  if (/SI_UNIT\s*\(\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/i.test(text)) {
    return "mm";
  }
  if (/SI_UNIT\s*\(\s*\.CENTI\.\s*,\s*\.METRE\.\s*\)/i.test(text)) {
    return "cm";
  }
  if (/SI_UNIT\s*\(\s*\$\s*,\s*\.METRE\.\s*\)/i.test(text)) {
    return "m";
  }
  return "unknown";
}

function parseStep(text: string) {
  const unit = stepUnit(text);
  const points: Point3[] = [];
  const pattern =
    /CARTESIAN_POINT\s*\(\s*(?:'[^']*'|\$)\s*,\s*\(([^()]*)\)\s*\)/gi;
  for (const match of text.matchAll(pattern)) {
    const values = match[1]!
      .split(",")
      .map(finiteCoordinate)
      .filter((value): value is number => value !== null);
    if (values.length >= 2)
      points.push([values[0]!, values[1]!, values[2] ?? 0]);
    if (points.length >= 1_000_000) break;
  }
  const warnings: string[] = [];
  if (unit === "unknown")
    warnings.push(
      "STEP length unit was not declared; millimetres were assumed.",
    );
  warnings.push(
    "STEP bounds are a Cartesian coordinate envelope; nested assembly placements are not resolved.",
  );
  const boundsMm = boundsFromPoints(
    points,
    unit === "unknown" ? 1 : UNIT_SCALE_MM[unit],
  );
  if (!boundsMm) warnings.push("No usable STEP Cartesian bounds were found.");
  return {
    unit,
    boundsMm,
    pointCount: points.length,
    confidence: boundsMm ? (unit === "unknown" ? 0.58 : 0.78) : 0,
    warnings,
  };
}

const DXF_UNITS: Record<number, CadUnit> = {
  0: "unknown",
  1: "inch",
  2: "foot",
  4: "mm",
  5: "cm",
  6: "m",
};

type DxfPair = { code: number; value: string };

function dxfPairs(text: string): DxfPair[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const pairs: DxfPair[] = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number(lines[index]!.trim());
    if (Number.isInteger(code))
      pairs.push({ code, value: lines[index + 1]!.trim() });
  }
  return pairs;
}

function dxfHeaderVector(
  pairs: readonly DxfPair[],
  name: string,
): Point3 | null {
  const index = pairs.findIndex(
    (pair) => pair.code === 9 && pair.value === name,
  );
  if (index < 0) return null;
  const point: Point3 = [0, 0, 0];
  let found = 0;
  for (let cursor = index + 1; cursor < pairs.length; cursor += 1) {
    const pair = pairs[cursor]!;
    if (pair.code === 9 || pair.code === 0) break;
    const axis: 0 | 1 | 2 | null =
      pair.code === 10 ? 0 : pair.code === 20 ? 1 : pair.code === 30 ? 2 : null;
    if (axis === null) continue;
    const value = finiteCoordinate(pair.value);
    if (value !== null) {
      point[axis] = value;
      found += 1;
    }
  }
  return found >= 2 ? point : null;
}

function parseDxf(text: string) {
  const pairs = dxfPairs(text);
  const unitIndex = pairs.findIndex(
    (pair) => pair.code === 9 && pair.value === "$INSUNITS",
  );
  const unitCode = unitIndex >= 0 ? Number(pairs[unitIndex + 1]?.value) : 0;
  const unit = DXF_UNITS[unitCode] ?? "unknown";
  const scale = unit === "unknown" ? 1 : UNIT_SCALE_MM[unit];
  const extMin = dxfHeaderVector(pairs, "$EXTMIN");
  const extMax = dxfHeaderVector(pairs, "$EXTMAX");
  const warnings: string[] = [];
  let points: Point3[] = [];
  let confidence = 0;
  if (extMin && extMax) {
    points = [extMin, extMax];
    confidence = unit === "unknown" ? 0.76 : 0.94;
  } else {
    const xs = pairs
      .filter((pair) => pair.code >= 10 && pair.code <= 18)
      .map((pair) => finiteCoordinate(pair.value))
      .filter((value): value is number => value !== null);
    const ys = pairs
      .filter((pair) => pair.code >= 20 && pair.code <= 28)
      .map((pair) => finiteCoordinate(pair.value))
      .filter((value): value is number => value !== null);
    const zs = pairs
      .filter((pair) => pair.code >= 30 && pair.code <= 38)
      .map((pair) => finiteCoordinate(pair.value))
      .filter((value): value is number => value !== null);
    const count = Math.min(xs.length, ys.length);
    points = Array.from({ length: Math.min(count, 1_000_000) }, (_, index) => [
      xs[index]!,
      ys[index]!,
      zs[index] ?? 0,
    ]);
    confidence = unit === "unknown" ? 0.58 : 0.7;
    warnings.push(
      "DXF header extents were missing; bounds were estimated from entity coordinates.",
    );
  }
  if (unit === "unknown")
    warnings.push(
      "DXF insertion units were not declared; millimetres were assumed.",
    );
  const boundsMm = boundsFromPoints(points, scale);
  if (!boundsMm) warnings.push("No usable DXF bounds were found.");
  return {
    unit,
    boundsMm,
    pointCount: points.length,
    confidence: boundsMm ? confidence : 0,
    warnings,
  };
}

export function analyzeCadArtifact({
  body,
  url,
  mediaType,
}: {
  body: Buffer;
  url: string;
  mediaType?: string;
}): CadAnalysis {
  const format = cadFormatFromUrl(url);
  const base = {
    format,
    fileName: safeFileName(url),
    ...(mediaType ? { mediaType } : {}),
    byteSize: body.byteLength,
    sha256: createHash("sha256").update(body).digest("hex"),
  };
  if (format !== "step" && format !== "dxf") {
    return {
      ...base,
      status: "unsupported",
      unit: "unknown",
      pointCount: 0,
      confidence: 0,
      warnings: [
        `${format.toUpperCase()} was downloaded and fingerprinted, but only STEP and ASCII DXF geometry are parsed in this version.`,
      ],
    };
  }
  if (body.includes(0)) {
    return {
      ...base,
      status: "failed",
      unit: "unknown",
      pointCount: 0,
      confidence: 0,
      warnings: [`Binary ${format.toUpperCase()} input is not supported.`],
    };
  }
  const parsed =
    format === "step"
      ? parseStep(body.toString("utf8"))
      : parseDxf(body.toString("utf8"));
  return {
    ...base,
    status: parsed.boundsMm ? "parsed" : "failed",
    ...parsed,
  };
}
