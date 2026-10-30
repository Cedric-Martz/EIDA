import { z } from "zod";
import { httpUrlSchema, researchSourceTypeSchema } from "./schema";

const sourceIdSchema = z.string().trim().min(1).max(200);

export const extractedDimensionSchema = z.object({
  sourceId: sourceIdSchema,
  sourceUrl: httpUrlSchema,
  label: z.string().trim().min(1).max(200),
  valuesMm: z.array(z.number().positive().max(100_000)).min(1).max(3),
  raw: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
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
  sources: z.array(extractedWebSourceSchema).min(1).max(10),
});

export type ExtractedDimension = z.infer<typeof extractedDimensionSchema>;
export type ExtractedImage = z.infer<typeof extractedImageSchema>;
export type ExtractedArtifact = z.infer<typeof extractedArtifactSchema>;
export type ExtractedWebSource = z.infer<typeof extractedWebSourceSchema>;
export type WebEvidenceBundle = z.infer<typeof webEvidenceBundleSchema>;
