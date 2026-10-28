import { z } from "zod";
export const evidenceStatusSchema = z.enum([
  "observed",
  "documented",
  "inferred",
  "unknown",
]);
export const evidenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["photo", "document", "measurement"]),
  sourceId: z.string().min(1),
  locator: z.string().optional(),
  description: z.string(),
});
export const claimSchema = z.object({
  id: z.string(),
  componentId: z.string(),
  property: z.string(),
  value: z.unknown(),
  status: evidenceStatusSchema,
  evidenceIds: z.array(z.string()),
});
export const geometrySchema = z.object({
  kind: z.enum(["parametric", "reference_asset", "placeholder"]),
  primitive: z.enum(["box", "cylinder", "plane"]).optional(),
  dimensionsMm: z
    .tuple([
      z.number().positive(),
      z.number().positive(),
      z.number().positive(),
    ])
    .optional(),
  assetId: z.string().optional(),
  estimated: z.boolean(),
});
export const componentSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  category: z.string(),
  claims: z.array(claimSchema),
  geometry: geometrySchema,
  parentId: z.string().optional(),
});
export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  device: z.object({
    manufacturer: z.string().optional(),
    model: z.string().optional(),
    confirmedByUser: z.boolean(),
  }),
  components: z.array(componentSchema),
  evidence: z.array(evidenceSchema),
});
export type Project = z.infer<typeof projectSchema>;
export type ComponentNode = z.infer<typeof componentSchema>;
