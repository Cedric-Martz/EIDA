import { z } from "zod";
import { deviceSchema, projectSchema } from "@/domain/evidence/schema";
import { photoAnalysisSchema } from "./observation";

export const inferenceUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  totalTokens: z.number().int().nonnegative().optional(),
});

export const inferencePhotoSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(1).max(3),
  locator: z.string().min(1),
});

export const inferenceRunSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    projectId: z.string().min(1),
    // Default keeps schema-v1 runs created before device selection compatible.
    device: deviceSchema.default({ confirmedByUser: false }),
    model: z.string().min(1),
    createdAt: z.number().int().nonnegative(),
    completedAt: z.number().int().nonnegative().optional(),
    status: z.enum(["pending", "succeeded", "failed"]),
    consent: z.object({
      approvedAt: z.number().int().nonnegative(),
      photoIds: z.array(z.string().min(1)).length(3),
    }),
    photos: z.array(inferencePhotoSchema).length(3),
    observations: photoAnalysisSchema.nullable(),
    resolvedProject: projectSchema.nullable(),
    usage: inferenceUsageSchema.nullable(),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        httpStatus: z.number().int().min(400).max(599).optional(),
      })
      .nullable(),
  })
  .superRefine((run, context) => {
    const photoIds = run.photos.map((photo) => photo.id);
    const indices = run.photos.map((photo) => photo.index);
    if (new Set(photoIds).size !== 3 || new Set(indices).size !== 3) {
      context.addIssue({
        code: "custom",
        message: "Inference photo references must be unique",
        path: ["photos"],
      });
    }
    if (photoIds.some((id, index) => run.consent.photoIds[index] !== id)) {
      context.addIssue({
        code: "custom",
        message: "Consent must reference the exact transmitted photo order",
        path: ["consent", "photoIds"],
      });
    }
    if (
      run.status === "succeeded" &&
      (run.completedAt === undefined ||
        run.observations === null ||
        run.resolvedProject === null ||
        run.error !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A successful run requires observations and a resolved project",
        path: ["status"],
      });
    }
    if (
      run.status === "failed" &&
      (run.completedAt === undefined ||
        run.error === null ||
        run.resolvedProject !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "A failed run requires a sanitized error",
        path: ["status"],
      });
    }
    if (run.status === "pending" && run.completedAt !== undefined) {
      context.addIssue({
        code: "custom",
        message: "A pending run cannot have a completion timestamp",
        path: ["completedAt"],
      });
    }
  });

export type InferenceUsage = z.infer<typeof inferenceUsageSchema>;
export type InferenceRun = z.infer<typeof inferenceRunSchema>;
