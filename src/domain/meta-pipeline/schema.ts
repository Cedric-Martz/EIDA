import { z } from "zod";
import { assemblyManifestSchema } from "@/domain/assembly";

export const metaStageIdSchema = z.enum([
  "llama-evidence",
  "sam-segmentation",
  "dino-matching",
  "sam3d-reconstruction",
  "llama-assembly",
  "validation-delivery",
]);

export const metaStageStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "blocked",
]);

export const metaArtifactSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum([
    "inventory",
    "mask",
    "correspondence",
    "mesh",
    "texture",
    "manifest",
    "report",
  ]),
  label: z.string().trim().min(1),
  url: z.string().url().optional(),
  mimeType: z.string().trim().min(1).optional(),
  partId: z.string().trim().min(1).optional(),
  sourceIds: z.array(z.string().trim().min(1)).default([]),
});

export const metaPipelineStageSchema = z.object({
  id: metaStageIdSchema,
  model: z.string().trim().min(1),
  status: metaStageStatusSchema,
  progress: z.number().min(0).max(1),
  summary: z.string().trim().min(1),
  artifactCount: z.number().int().nonnegative().default(0),
});

export const metaReconstructionJobSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  stages: z.array(metaPipelineStageSchema).length(6),
  artifacts: z.array(metaArtifactSchema),
  manifest: assemblyManifestSchema.nullable(),
  error: z
    .object({
      code: z.string().trim().min(1),
      message: z.string().trim().min(1),
    })
    .nullable(),
});

export const metaPipelineHealthSchema = z.object({
  ok: z.literal(true),
  service: z.string().trim().min(1),
  models: z.object({
    reasoning: z.string().trim().min(1),
    segmentation: z.string().trim().min(1),
    matching: z.string().trim().min(1),
    reconstruction: z.string().trim().min(1),
  }),
});

export type MetaStageId = z.infer<typeof metaStageIdSchema>;
export type MetaPipelineStage = z.infer<typeof metaPipelineStageSchema>;
export type MetaArtifact = z.infer<typeof metaArtifactSchema>;
export type MetaReconstructionJob = z.infer<typeof metaReconstructionJobSchema>;
export type MetaPipelineHealth = z.infer<typeof metaPipelineHealthSchema>;
