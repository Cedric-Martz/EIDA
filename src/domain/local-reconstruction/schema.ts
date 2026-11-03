import { z } from "zod";

export const localPartInventoryItemSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  label: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  samPrompt: z.string().trim().min(1).max(120),
  imageIndex: z.number().int().min(1).max(48),
  thicknessMm: z.number().positive().max(100).nullable(),
  dimensionsMm: z
    .tuple([
      z.number().positive().max(100_000),
      z.number().positive().max(100_000),
      z.number().positive().max(100_000),
    ])
    .nullable(),
  dimensionSourceIds: z.array(z.string().trim().min(1).max(200)).max(10),
});

export const localPartInventorySchema = z.object({
  items: z.array(localPartInventoryItemSchema).min(1).max(24),
  notes: z.string().trim().max(1_000),
});

export const localGeometryPlanItemSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9-]*$/),
    primitive: z.enum([
      "mask_profile",
      "box",
      "rounded_box",
      "cylinder",
      "sphere",
      "plane",
    ]),
    dimensionsMm: z.tuple([
      z.number().positive().max(100_000),
      z.number().positive().max(100_000),
      z.number().positive().max(100_000),
    ]),
    cornerRadiusMm: z.number().positive().max(10_000).nullable(),
    confidence: z.number().min(0).max(1),
    basis: z.enum(["multi-view", "documented", "single-view"]),
    rationale: z.string().trim().min(1).max(500),
  })
  .superRefine((item, context) => {
    if (item.primitive === "rounded_box" && item.cornerRadiusMm === null) {
      context.addIssue({
        code: "custom",
        path: ["cornerRadiusMm"],
        message: "A rounded box requires a corner radius",
      });
    }
    if (item.primitive !== "rounded_box" && item.cornerRadiusMm !== null) {
      context.addIssue({
        code: "custom",
        path: ["cornerRadiusMm"],
        message: "Only a rounded box can define a corner radius",
      });
    }
  });

export const localGeometryPlanSchema = z.object({
  items: z.array(localGeometryPlanItemSchema).min(1).max(24),
  notes: z.string().trim().max(1_000),
});

export const localSegmentationMaskSchema = z.object({
  objectId: z.string().trim().min(1),
  bounds: z.object({
    left: z.number().int().nonnegative(),
    top: z.number().int().nonnegative(),
    right: z.number().int().positive(),
    bottom: z.number().int().positive(),
  }),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  svgPath: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
});

export const localSegmentationResultSchema = z.object({
  prompt: z.string().trim().min(1),
  masks: z.array(localSegmentationMaskSchema),
  diagnostics: z.array(z.string()),
});

export type LocalPartInventory = z.infer<typeof localPartInventorySchema>;
export type LocalPartInventoryItem = z.infer<
  typeof localPartInventoryItemSchema
>;
export type LocalGeometryPlan = z.infer<typeof localGeometryPlanSchema>;
export type LocalGeometryPlanItem = z.infer<typeof localGeometryPlanItemSchema>;
export type LocalSegmentationMask = z.infer<typeof localSegmentationMaskSchema>;
export type LocalSegmentationResult = z.infer<
  typeof localSegmentationResultSchema
>;
