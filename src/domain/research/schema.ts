import { z } from "zod";

const idSchema = z.string().trim().min(1).max(200);
const shortTextSchema = z.string().trim().min(1).max(500);

export const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(4_096)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.username === "" &&
        url.password === ""
      );
    } catch {
      return false;
    }
  }, "Expected an HTTP(S) URL without embedded credentials");

export const researchProviderSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i),
  label: z.string().trim().min(1).max(200),
});

export const researchLicenseCodeSchema = z.enum([
  "unknown",
  "proprietary",
  "public-domain",
  "cc0-1.0",
  "cc-by-3.0",
  "cc-by-4.0",
  "cc-by-sa-3.0",
  "cc-by-sa-4.0",
  "cc-by-nc-3.0",
  "cc-by-nc-4.0",
  "cc-by-nc-sa-3.0",
  "cc-by-nc-sa-4.0",
  "custom",
]);

export const researchLicenseSchema = z.object({
  code: researchLicenseCodeSchema,
  label: z.string().trim().min(1).max(200),
  url: httpUrlSchema.optional(),
  attributionRequired: z.boolean().nullable(),
  commercialUse: z.enum(["allowed", "forbidden", "unknown"]),
  derivatives: z.enum(["allowed", "share-alike", "forbidden", "unknown"]),
});

export const researchSourceTypeSchema = z.enum([
  "teardown-guide",
  "repair-guide",
  "service-manual",
  "parts-catalog",
  "technical-drawing",
  "cad-model",
  "datasheet",
  "product-page",
  "photo-set",
  "video",
  "forum",
  "repository",
  "web-page",
  "other",
]);

const sourceBaseSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  url: httpUrlSchema,
  canonicalUrl: httpUrlSchema,
  title: shortTextSchema,
  publisher: z.string().trim().min(1).max(200).optional(),
  sourceType: researchSourceTypeSchema,
  provider: researchProviderSchema,
  summary: z.string().trim().max(2_000).optional(),
  thumbnailUrl: httpUrlSchema.optional(),
  discoveredAt: z.number().int().nonnegative(),
  relevanceScore: z.number().min(0).max(1).optional(),
  license: researchLicenseSchema,
});

export const discoveredSourceSchema = sourceBaseSchema.extend({
  selection: z.literal("discovered"),
});

export const selectedSourceSchema = sourceBaseSchema.extend({
  selection: z.literal("selected"),
  selectedAt: z.number().int().nonnegative(),
});

export const researchSourceSchema = z.discriminatedUnion("selection", [
  discoveredSourceSchema,
  selectedSourceSchema,
]);

export const researchArtifactKindSchema = z.enum([
  "html",
  "pdf",
  "image",
  "video",
  "cad",
  "archive",
  "text",
  "other",
]);

export const researchArtifactSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    sourceId: idSchema,
    kind: researchArtifactKindSchema,
    url: httpUrlSchema.optional(),
    storageKey: z.string().trim().min(1).max(1_024).optional(),
    mediaType: z.string().trim().min(1).max(200).optional(),
    fileName: z.string().trim().min(1).max(500).optional(),
    byteSize: z.number().int().nonnegative().optional(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .optional(),
    createdAt: z.number().int().nonnegative(),
  })
  .refine(
    (artifact) =>
      artifact.url !== undefined || artifact.storageKey !== undefined,
    {
      message: "An artifact needs a remote URL or a browser storage key",
      path: ["url"],
    },
  );

const normalizedRegionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine(
    (region) => region.x + region.width <= 1 && region.y + region.height <= 1,
    "A normalized region must fit inside its page",
  );

export const webExtractionLocatorSchema = z.object({
  kind: z.literal("web"),
  sourceId: idSchema,
  url: httpUrlSchema,
  fragment: z.string().trim().min(1).max(500).optional(),
});

export const guideStepExtractionLocatorSchema = z.object({
  kind: z.literal("guide-step"),
  sourceId: idSchema,
  guideId: z.union([
    z.string().trim().min(1).max(100),
    z.number().int().positive(),
  ]),
  step: z.number().int().positive(),
  line: z.number().int().nonnegative().optional(),
  image: z.number().int().nonnegative().optional(),
});

export const documentExtractionLocatorSchema = z.object({
  kind: z.literal("document-page"),
  sourceId: idSchema,
  artifactId: idSchema,
  page: z.number().int().positive(),
  region: normalizedRegionSchema.optional(),
});

export const artifactExtractionLocatorSchema = z.object({
  kind: z.literal("artifact"),
  sourceId: idSchema,
  artifactId: idSchema,
  path: z.string().trim().min(1).max(1_024).optional(),
});

export const extractionLocatorSchema = z.discriminatedUnion("kind", [
  webExtractionLocatorSchema,
  guideStepExtractionLocatorSchema,
  documentExtractionLocatorSchema,
  artifactExtractionLocatorSchema,
]);

export const extractionClaimSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  subject: shortTextSchema,
  property: z.string().trim().min(1).max(200),
  value: z.unknown(),
  unit: z.string().trim().min(1).max(100).optional(),
  basis: z.enum(["documented", "measured", "inferred"]),
  confidence: z.number().min(0).max(1),
  locators: z.array(extractionLocatorSchema).min(1).max(100),
  extractedAt: z.number().int().nonnegative(),
});

export const researchErrorCodeSchema = z.enum([
  "invalid_configuration",
  "invalid_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "rate_limited",
  "provider_unavailable",
  "timeout",
  "aborted",
  "network_or_cors",
  "invalid_json",
  "invalid_response",
]);

export const researchErrorSchema = z.object({
  code: researchErrorCodeSchema,
  message: z.string().trim().min(1).max(500),
  retryable: z.boolean(),
  httpStatus: z.number().int().min(400).max(599).optional(),
});

export const researchProviderResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    provider: researchProviderSchema,
    query: z.string().trim().min(1).max(200),
    status: z.enum(["succeeded", "partial", "failed"]),
    startedAt: z.number().int().nonnegative(),
    completedAt: z.number().int().nonnegative(),
    sources: z.array(discoveredSourceSchema).max(500),
    artifacts: z.array(researchArtifactSchema).max(1_000),
    claims: z.array(extractionClaimSchema).max(5_000),
    warnings: z.array(z.string().trim().min(1).max(500)).max(100),
    error: researchErrorSchema.nullable(),
  })
  .superRefine((result, context) => {
    if (result.completedAt < result.startedAt) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "A provider cannot complete before it starts",
      });
    }
    if (result.status === "succeeded" && result.error !== null) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "A successful provider result cannot contain an error",
      });
    }
    if (result.status === "failed" && result.error === null) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "A failed provider result requires a sanitized error",
      });
    }
  });

export const researchSearchRequestSchema = z
  .object({
    schemaVersion: z.literal(1),
    query: z.string().trim().min(1).max(200),
    providerIds: z
      .array(researchProviderSchema.shape.id)
      .min(1)
      .max(20)
      .optional(),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .superRefine((request, context) => {
    if (
      request.providerIds &&
      new Set(request.providerIds).size !== request.providerIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["providerIds"],
        message: "Provider identifiers must be unique",
      });
    }
  });

export const researchServiceResponseSchema = z.object({
  schemaVersion: z.literal(1),
  results: z.array(researchProviderResultSchema).min(1).max(20),
});

export const researchJobSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    query: z.string().trim().min(1).max(200),
    providerIds: z.array(researchProviderSchema.shape.id).min(1).max(20),
    status: z.enum([
      "queued",
      "running",
      "succeeded",
      "partial",
      "failed",
      "cancelled",
    ]),
    requestedAt: z.number().int().nonnegative(),
    startedAt: z.number().int().nonnegative().optional(),
    completedAt: z.number().int().nonnegative().optional(),
    providerResults: z.array(researchProviderResultSchema).max(20),
    sources: z.array(researchSourceSchema).max(500),
    error: researchErrorSchema.nullable(),
  })
  .superRefine((job, context) => {
    if (new Set(job.providerIds).size !== job.providerIds.length) {
      context.addIssue({
        code: "custom",
        path: ["providerIds"],
        message: "Provider identifiers must be unique",
      });
    }

    if (job.startedAt !== undefined && job.startedAt < job.requestedAt) {
      context.addIssue({
        code: "custom",
        path: ["startedAt"],
        message: "A research job cannot start before it is requested",
      });
    }
    if (
      job.completedAt !== undefined &&
      (job.startedAt === undefined || job.completedAt < job.startedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "A research job cannot complete before it starts",
      });
    }

    if (
      job.status === "queued" &&
      (job.startedAt !== undefined || job.completedAt !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "A queued job cannot have start or completion timestamps",
      });
    }
    if (
      job.status === "running" &&
      (job.startedAt === undefined || job.completedAt !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "A running job needs a start but no completion timestamp",
      });
    }

    const terminal = ["succeeded", "partial", "failed", "cancelled"].includes(
      job.status,
    );
    if (terminal && job.completedAt === undefined) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "A terminal job requires a completion timestamp",
      });
    }
    if (job.status === "succeeded" && job.error !== null) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "A successful job cannot contain an error",
      });
    }
    if (job.status === "failed" && job.error === null) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "A failed job requires a sanitized error",
      });
    }
  });

export type ResearchProvider = z.infer<typeof researchProviderSchema>;
export type ResearchLicense = z.infer<typeof researchLicenseSchema>;
export type DiscoveredSource = z.infer<typeof discoveredSourceSchema>;
export type SelectedSource = z.infer<typeof selectedSourceSchema>;
export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type ResearchArtifact = z.infer<typeof researchArtifactSchema>;
export type ExtractionLocator = z.infer<typeof extractionLocatorSchema>;
export type ExtractionClaim = z.infer<typeof extractionClaimSchema>;
export type ResearchErrorCode = z.infer<typeof researchErrorCodeSchema>;
export type ResearchError = z.infer<typeof researchErrorSchema>;
export type ResearchProviderResult = z.infer<
  typeof researchProviderResultSchema
>;
export type ResearchSearchRequest = z.input<typeof researchSearchRequestSchema>;
export type ResearchJob = z.infer<typeof researchJobSchema>;
