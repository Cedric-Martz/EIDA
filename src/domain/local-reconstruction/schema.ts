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
  photoIndex: z.number().int().min(1).max(6),
  thicknessMm: z.number().positive().max(100).nullable(),
});

export const localPartInventorySchema = z.object({
  items: z.array(localPartInventoryItemSchema).min(1).max(10),
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
export type LocalSegmentationMask = z.infer<typeof localSegmentationMaskSchema>;
export type LocalSegmentationResult = z.infer<
  typeof localSegmentationResultSchema
>;
