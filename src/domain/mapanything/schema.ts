import { z } from "zod";

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i);

export const mapAnythingArtifactSchema = z.object({
  id: idSchema,
  kind: z.enum(["scene-glb", "report"]),
  label: z.string().trim().min(1).max(240),
  url: z.string().url(),
  mimeType: z.string().trim().min(1),
});

export const mapAnythingJobSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  projectId: idSchema,
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  photoCount: z.number().int().min(3).max(8),
  progress: z.number().min(0).max(1),
  message: z.string().trim().min(1),
  artifacts: z.array(mapAnythingArtifactSchema),
  error: z
    .object({
      code: z.string().trim().min(1),
      message: z.string().trim().min(1),
    })
    .nullable(),
});

export const mapAnythingHealthSchema = z.object({
  ok: z.literal(true),
  service: z.string().trim().min(1),
  model: z.string().trim().min(1),
  device: z.string().trim().min(1),
  ready: z.boolean(),
  maxPhotos: z.number().int().min(3).max(32),
  detail: z.string().trim().min(1),
});

export type MapAnythingArtifact = z.infer<typeof mapAnythingArtifactSchema>;
export type MapAnythingJob = z.infer<typeof mapAnythingJobSchema>;
export type MapAnythingHealth = z.infer<typeof mapAnythingHealthSchema>;
