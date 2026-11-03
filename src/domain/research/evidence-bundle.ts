import { z } from "zod";
import { httpUrlSchema, researchSourceTypeSchema } from "./schema";

const sourceIdSchema = z.string().trim().min(1).max(200);
const finiteCoordinateSchema = z
  .number()
  .finite()
  .min(-1_000_000)
  .max(1_000_000);
const vector3Schema = z.tuple([
  finiteCoordinateSchema,
  finiteCoordinateSchema,
  finiteCoordinateSchema,
]);

export const cadAnalysisSchema = z.object({
  status: z.enum(["parsed", "unsupported", "failed"]),
  format: z.enum([
    "step",
    "dxf",
    "iges",
    "stl",
    "obj",
    "3mf",
    "gltf",
    "glb",
    "unknown",
  ]),
  fileName: z.string().trim().min(1).max(500),
  mediaType: z.string().trim().min(1).max(200).optional(),
  byteSize: z.number().int().nonnegative().max(15_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  unit: z.enum(["mm", "cm", "m", "inch", "foot", "unknown"]),
  boundsMm: z
    .object({
      min: vector3Schema,
      max: vector3Schema,
      dimensions: z.tuple([
        z.number().finite().nonnegative().max(1_000_000),
        z.number().finite().nonnegative().max(1_000_000),
        z.number().finite().nonnegative().max(1_000_000),
      ]),
    })
    .superRefine((bounds, context) => {
      for (let axis = 0; axis < 3; axis += 1) {
        if (bounds.min[axis] > bounds.max[axis]) {
          context.addIssue({
            code: "custom",
            path: ["max", axis],
            message: "CAD bounds minimum cannot exceed its maximum",
          });
        }
      }
    })
    .optional(),
  pointCount: z.number().int().nonnegative().max(5_000_000),
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
});

export const extractedDimensionSchema = z.object({
  sourceId: sourceIdSchema,
  sourceUrl: httpUrlSchema,
  label: z.string().trim().min(1).max(200),
  valuesMm: z.array(z.number().positive().max(100_000)).min(1).max(3),
  raw: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
  basis: z.enum(["page-text", "cad-bounds"]).default("page-text"),
  scope: z.enum(["device", "component", "unknown"]).default("unknown"),
  artifactUrl: httpUrlSchema.optional(),
});

export const extractedImageSchema = z.object({
  sourceId: sourceIdSchema,
  url: httpUrlSchema,
  alt: z.string().trim().max(500),
});

export const extractedArtifactSchema = z.object({
  sourceId: sourceIdSchema,
  url: httpUrlSchema,
  kind: z.enum(["pdf", "cad", "image", "archive", "other"]),
  label: z.string().trim().min(1).max(500),
  cadAnalysis: cadAnalysisSchema.optional(),
});

export const extractedWebSourceSchema = z.object({
  sourceId: sourceIdSchema,
  url: httpUrlSchema,
  title: z.string().trim().min(1).max(500),
  sourceType: researchSourceTypeSchema,
  status: z.enum(["extracted", "partial", "failed"]),
  excerpt: z.string().max(12_000),
  dimensions: z.array(extractedDimensionSchema).max(50),
  images: z.array(extractedImageSchema).max(20),
  artifacts: z.array(extractedArtifactSchema).max(50),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
});

export const webEvidenceBundleSchema = z.object({
  schemaVersion: z.literal(1),
  extractedAt: z.number().int().nonnegative(),
  sources: z.array(extractedWebSourceSchema).min(1).max(20),
});

export type ExtractedDimension = z.infer<typeof extractedDimensionSchema>;
export type CadAnalysis = z.infer<typeof cadAnalysisSchema>;
export type ExtractedImage = z.infer<typeof extractedImageSchema>;
export type ExtractedArtifact = z.infer<typeof extractedArtifactSchema>;
export type ExtractedWebSource = z.infer<typeof extractedWebSourceSchema>;
export type WebEvidenceBundle = z.infer<typeof webEvidenceBundleSchema>;
