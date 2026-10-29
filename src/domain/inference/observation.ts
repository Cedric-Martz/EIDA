import { z } from "zod";

export const photoObservationSchema = z.object({
  label: z.string().trim().min(1),
  category: z.string().trim().min(1),
  visibility: z.enum(["visible", "uncertain", "not_visible"]),
  description: z.string().trim().min(1),
  evidencePhotoIndices: z
    .array(z.number().int().min(1).max(3))
    .min(1)
    .max(3)
    .refine((indices) => new Set(indices).size === indices.length, {
      message: "Photo references must be unique",
    }),
});

export const photoAnalysisSchema = z.object({
  observations: z.array(photoObservationSchema),
  notes: z.string(),
});

export type PhotoObservation = z.infer<typeof photoObservationSchema>;
export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;
