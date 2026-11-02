import { z } from "zod";
import {
  aabbMmSchema,
  dimensionsMmSchema,
  rotationRadiansSchema,
  scale3Schema,
  vector3MmSchema,
} from "@/domain/assembly/schema";

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9:._-]*$/i);
const evidenceIdsSchema = z.array(idSchema).max(32);
const point2MmSchema = z.tuple([z.number().finite(), z.number().finite()]);

export const reconstructionEvidenceSchema = z.object({
  id: idSchema,
  kind: z.enum([
    "user-photo",
    "web-source",
    "document",
    "measurement",
    "segmentation-mask",
    "generated-mesh",
  ]),
  label: z.string().trim().min(1).max(240),
  locator: z.string().trim().min(1).max(2_000).optional(),
  sourceId: idSchema.optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
});

export const primitiveRecipeSchema = z.object({
  kind: z.literal("primitive"),
  primitive: z.enum(["box", "rounded_box", "cylinder", "sphere", "plane"]),
  dimensionsMm: dimensionsMmSchema,
  cornerRadiusMm: z.number().finite().positive().optional(),
});

export const profileExtrusionRecipeSchema = z.object({
  kind: z.literal("profile-extrusion"),
  profileMm: z.array(point2MmSchema).min(3).max(2_048),
  depthMm: z.number().finite().positive(),
  bevelMm: z.number().finite().nonnegative().optional(),
  assetId: idSchema,
});

export const meshReferenceRecipeSchema = z.object({
  kind: z.literal("mesh-reference"),
  assetId: idSchema,
  format: z.enum(["glb", "gltf", "ply", "obj", "stl"]),
  boundsMm: aabbMmSchema,
});

export const reconstructionGeometryRecipeSchema = z.discriminatedUnion("kind", [
  primitiveRecipeSchema,
  profileExtrusionRecipeSchema,
  meshReferenceRecipeSchema,
]);

export const propertyEvidenceSchema = z.object({
  presence: evidenceIdsSchema,
  outline: evidenceIdsSchema,
  dimensions: evidenceIdsSchema,
  depth: evidenceIdsSchema,
  transform: evidenceIdsSchema,
  material: evidenceIdsSchema,
});

export const reconstructionAssumptionSchema = z.object({
  id: idSchema,
  property: z.enum(["outline", "dimensions", "depth", "transform", "material"]),
  reason: z.string().trim().min(1).max(500),
  impact: z.enum(["visual", "spatial", "mechanical"]),
});

export const reconstructionPartSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(80),
  parentId: idSchema.optional(),
  geometry: reconstructionGeometryRecipeSchema,
  transform: z.object({
    positionMm: vector3MmSchema,
    rotationRad: rotationRadiansSchema,
    scale: scale3Schema,
  }),
  explodedVectorMm: vector3MmSchema,
  fidelity: z.enum(["exact", "measured", "estimated", "placeholder"]),
  evidence: propertyEvidenceSchema,
  assumptions: z.array(reconstructionAssumptionSchema).max(24),
});

export const reconstructionRelationSchema = z.object({
  id: idSchema,
  kind: z.enum([
    "inside",
    "attached-to",
    "aligned-with",
    "above",
    "below",
    "connected-to",
  ]),
  sourcePartId: idSchema,
  targetPartId: idSchema,
  evidenceIds: evidenceIdsSchema,
});

export const reconstructionGraphSchema = z.object({
  schema: z.literal("eida-reconstruction-graph"),
  schemaVersion: z.literal(1),
  id: idSchema,
  projectId: idSchema,
  label: z.string().trim().min(1).max(240),
  units: z.literal("mm"),
  coordinateSystem: z.literal("right-handed-y-up"),
  createdAt: z.number().int().nonnegative(),
  assemblyBoundsMm: aabbMmSchema,
  evidence: z.array(reconstructionEvidenceSchema).max(512),
  parts: z.array(reconstructionPartSchema).min(1).max(128),
  relations: z.array(reconstructionRelationSchema).max(512),
});

export type ReconstructionEvidence = z.infer<
  typeof reconstructionEvidenceSchema
>;
export type ReconstructionPart = z.infer<typeof reconstructionPartSchema>;
export type ReconstructionRelation = z.infer<
  typeof reconstructionRelationSchema
>;
export type ReconstructionGraph = z.infer<typeof reconstructionGraphSchema>;
