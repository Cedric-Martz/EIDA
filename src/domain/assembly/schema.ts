import { z } from "zod";

const idSchema = z.string().trim().min(1);
const finiteNumberSchema = z.number().finite();
const positiveFiniteNumberSchema = finiteNumberSchema.positive();
const unitIntervalSchema = finiteNumberSchema.min(0).max(1);

/** All persisted lengths and positions in an assembly manifest are millimetres. */
export const millimetresSchema = finiteNumberSchema;

export const vector3MmSchema = z.tuple([
  millimetresSchema,
  millimetresSchema,
  millimetresSchema,
]);

export const dimensionsMmSchema = z.tuple([
  positiveFiniteNumberSchema,
  positiveFiniteNumberSchema,
  positiveFiniteNumberSchema,
]);

export const rotationRadiansSchema = z.tuple([
  finiteNumberSchema,
  finiteNumberSchema,
  finiteNumberSchema,
]);

export const scale3Schema = z.tuple([
  positiveFiniteNumberSchema,
  positiveFiniteNumberSchema,
  positiveFiniteNumberSchema,
]);

export const transformSchema = z.object({
  positionMm: vector3MmSchema,
  /** XYZ Euler angles, in radians. */
  rotationRad: rotationRadiansSchema,
  scale: scale3Schema,
});

export const anchorPoseSchema = z.object({
  positionMm: vector3MmSchema,
  /** XYZ Euler angles, in radians. */
  rotationRad: rotationRadiansSchema,
});

export const aabbMmSchema = z
  .object({
    minMm: vector3MmSchema,
    maxMm: vector3MmSchema,
  })
  .superRefine((bounds, context) => {
    for (let axis = 0; axis < 3; axis += 1) {
      if (bounds.minMm[axis] >= bounds.maxMm[axis]) {
        context.addIssue({
          code: "custom",
          message: "AABB minimum must be smaller than maximum on every axis",
          path: ["maxMm", axis],
        });
      }
    }
  });

export const fidelityLevelSchema = z.enum([
  "exact",
  "measured",
  "estimated",
  "placeholder",
]);

export const fidelityAssessmentSchema = z.object({
  level: fidelityLevelSchema,
  /** IDs from the owning project's evidence registry. */
  evidenceIds: z.array(idSchema),
  note: z.string().trim().min(1).optional(),
});

export const geometryAssetSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).optional(),
  uri: z.string().trim().min(1),
  format: z.enum(["glb", "gltf", "stl", "obj", "step"]),
  /** Conversion factor for source coordinates; GLB files commonly use 1000. */
  millimetresPerAssetUnit: positiveFiniteNumberSchema,
  /** Local-space bounds after applying millimetresPerAssetUnit. */
  boundsMm: aabbMmSchema.optional(),
  evidenceIds: z.array(idSchema),
});

export const assetPartGeometrySchema = z.object({
  kind: z.literal("asset"),
  assetId: idSchema,
});

export const parametricPartGeometrySchema = z.object({
  kind: z.literal("parametric"),
  primitive: z.enum(["box", "rounded_box", "cylinder", "sphere", "plane"]),
  /** Axis-aligned extents of the generated local geometry. */
  dimensionsMm: dimensionsMmSchema,
  cornerRadiusMm: positiveFiniteNumberSchema.optional(),
});

export const placeholderPartGeometrySchema = z.object({
  kind: z.literal("placeholder"),
  /** Optional dimensions allow spatial diagnostics without claiming real shape. */
  dimensionsMm: dimensionsMmSchema.optional(),
  reason: z.string().trim().min(1).optional(),
});

export const partGeometrySchema = z.discriminatedUnion("kind", [
  assetPartGeometrySchema,
  parametricPartGeometrySchema,
  placeholderPartGeometrySchema,
]);

export const pbrMaterialProfileSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1),
  /** Linear RGB channels in the 0..1 range. */
  baseColor: z.tuple([
    unitIntervalSchema,
    unitIntervalSchema,
    unitIntervalSchema,
  ]),
  metalness: unitIntervalSchema,
  roughness: unitIntervalSchema,
  opacity: unitIntervalSchema.optional(),
  emissiveColor: z
    .tuple([unitIntervalSchema, unitIntervalSchema, unitIntervalSchema])
    .optional(),
  emissiveIntensity: finiteNumberSchema.nonnegative().optional(),
  clearcoat: unitIntervalSchema.optional(),
  clearcoatRoughness: unitIntervalSchema.optional(),
  transmission: unitIntervalSchema.optional(),
  ior: finiteNumberSchema.min(1).max(2.333).optional(),
  normalScale: z.tuple([finiteNumberSchema, finiteNumberSchema]).optional(),
  doubleSided: z.boolean().optional(),
});

export const anchorSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).optional(),
  pose: anchorPoseSchema,
  evidenceIds: z.array(idSchema),
});

export const anchorReferenceSchema = z.object({
  partId: idSchema,
  anchorId: idSchema,
});

export const mateSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1).optional(),
  kind: z.enum(["fixed", "coincident", "axis", "planar"]),
  source: anchorReferenceSchema,
  target: anchorReferenceSchema,
  /** Optional target-relative offset; mates describe constraints but do not solve them. */
  offset: anchorPoseSchema.optional(),
  evidenceIds: z.array(idSchema),
});

export const assemblyPartSchema = z.object({
  id: idSchema,
  label: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  parentId: idSchema.optional(),
  geometry: partGeometrySchema,
  fidelity: fidelityAssessmentSchema,
  materialProfileId: idSchema.optional(),
  /** Parent-relative transform in the assembled state. */
  transform: transformSchema,
  /** Parent-space translation applied at explode factor 1. */
  explodedVectorMm: vector3MmSchema,
  anchors: z.array(anchorSchema),
});

export const assemblyManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  label: z.string().trim().min(1).optional(),
  units: z.literal("mm"),
  /** Optional world-space envelope used by out-of-bounds diagnostics. */
  assemblyBoundsMm: aabbMmSchema.optional(),
  assets: z.array(geometryAssetSchema),
  materialProfiles: z.array(pbrMaterialProfileSchema),
  parts: z.array(assemblyPartSchema),
  mates: z.array(mateSchema),
});

export type Millimetres = z.infer<typeof millimetresSchema>;
export type Vector3Mm = z.infer<typeof vector3MmSchema>;
export type DimensionsMm = z.infer<typeof dimensionsMmSchema>;
export type Transform = z.infer<typeof transformSchema>;
export type AabbMm = z.infer<typeof aabbMmSchema>;
export type FidelityLevel = z.infer<typeof fidelityLevelSchema>;
export type FidelityAssessment = z.infer<typeof fidelityAssessmentSchema>;
export type GeometryAsset = z.infer<typeof geometryAssetSchema>;
export type PartGeometry = z.infer<typeof partGeometrySchema>;
export type PbrMaterialProfile = z.infer<typeof pbrMaterialProfileSchema>;
export type Anchor = z.infer<typeof anchorSchema>;
export type AnchorReference = z.infer<typeof anchorReferenceSchema>;
export type Mate = z.infer<typeof mateSchema>;
export type AssemblyPart = z.infer<typeof assemblyPartSchema>;
export type AssemblyManifest = z.infer<typeof assemblyManifestSchema>;
