import { describe, expect, it } from "vitest";
import {
  discoveredSourceSchema,
  extractionClaimSchema,
  extractionLocatorSchema,
  httpUrlSchema,
  researchArtifactSchema,
  researchJobSchema,
  researchProviderResultSchema,
  selectedSourceSchema,
} from "./schema";

const license = {
  code: "cc-by-4.0" as const,
  label: "Creative Commons Attribution 4.0",
  url: "https://creativecommons.org/licenses/by/4.0/",
  attributionRequired: true,
  commercialUse: "allowed" as const,
  derivatives: "allowed" as const,
};

const source = {
  schemaVersion: 1 as const,
  id: "source-1",
  url: "https://example.com/manual.pdf",
  canonicalUrl: "https://example.com/manual.pdf",
  title: "Service manual",
  publisher: "Example Devices",
  sourceType: "service-manual" as const,
  provider: { id: "web", label: "Web research" },
  discoveredAt: 100,
  license,
  selection: "discovered" as const,
};

const artifact = {
  schemaVersion: 1 as const,
  id: "artifact-1",
  sourceId: source.id,
  kind: "pdf" as const,
  url: source.url,
  mediaType: "application/pdf",
  createdAt: 101,
};

const locator = {
  kind: "document-page" as const,
  sourceId: source.id,
  artifactId: artifact.id,
  page: 12,
  region: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 },
};

const claim = {
  schemaVersion: 1 as const,
  id: "claim-1",
  subject: "Battery",
  property: "width",
  value: 68,
  unit: "mm",
  basis: "documented" as const,
  confidence: 0.95,
  locators: [locator],
  extractedAt: 102,
};

const providerResult = {
  schemaVersion: 1 as const,
  provider: { id: "web", label: "Web research" },
  query: "Example Tablet 10",
  status: "succeeded" as const,
  startedAt: 100,
  completedAt: 110,
  sources: [source],
  artifacts: [artifact],
  claims: [claim],
  warnings: [],
  error: null,
};

describe("research schemas", () => {
  it("models a discovered source and a separately selected source", () => {
    expect(discoveredSourceSchema.parse(source)).toEqual(source);
    expect(
      selectedSourceSchema.parse({
        ...source,
        selection: "selected",
        selectedAt: 120,
      }),
    ).toMatchObject({ selection: "selected", selectedAt: 120 });
    expect(
      selectedSourceSchema.safeParse({ ...source, selection: "selected" })
        .success,
    ).toBe(false);
  });

  it("accepts only HTTP(S) URLs without embedded credentials", () => {
    expect(httpUrlSchema.safeParse("https://example.com/file").success).toBe(
      true,
    );
    expect(httpUrlSchema.safeParse("ftp://example.com/file").success).toBe(
      false,
    );
    expect(
      httpUrlSchema.safeParse("https://user:secret@example.com/file").success,
    ).toBe(false);
  });

  it("requires an artifact to have a remote or browser-local location", () => {
    expect(researchArtifactSchema.parse(artifact)).toEqual(artifact);
    expect(
      researchArtifactSchema.safeParse({
        ...artifact,
        url: undefined,
        storageKey: "research/artifact-1",
      }).success,
    ).toBe(true);
    expect(
      researchArtifactSchema.safeParse({ ...artifact, url: undefined }).success,
    ).toBe(false);
  });

  it("validates precise web, guide, document and artifact locators", () => {
    expect(extractionLocatorSchema.safeParse(locator).success).toBe(true);
    expect(
      extractionLocatorSchema.safeParse({
        kind: "guide-step",
        sourceId: source.id,
        guideId: 123,
        step: 4,
        image: 0,
      }).success,
    ).toBe(true);
    expect(
      extractionLocatorSchema.safeParse({
        kind: "web",
        sourceId: source.id,
        url: source.url,
        fragment: "dimensions",
      }).success,
    ).toBe(true);
    expect(
      extractionLocatorSchema.safeParse({
        kind: "artifact",
        sourceId: source.id,
        artifactId: artifact.id,
        path: "assembly/board.step",
      }).success,
    ).toBe(true);
  });

  it("rejects a document region outside normalized page bounds", () => {
    expect(
      extractionLocatorSchema.safeParse({
        ...locator,
        region: { x: 0.8, y: 0.2, width: 0.4, height: 0.4 },
      }).success,
    ).toBe(false);
  });

  it("requires every extracted claim to retain at least one locator", () => {
    expect(extractionClaimSchema.parse(claim)).toEqual(claim);
    expect(
      extractionClaimSchema.safeParse({ ...claim, locators: [] }).success,
    ).toBe(false);
    expect(
      extractionClaimSchema.safeParse({ ...claim, confidence: 1.1 }).success,
    ).toBe(false);
  });

  it("enforces provider result status and timing invariants", () => {
    expect(researchProviderResultSchema.parse(providerResult)).toEqual(
      providerResult,
    );
    expect(
      researchProviderResultSchema.safeParse({
        ...providerResult,
        completedAt: 99,
      }).success,
    ).toBe(false);
    expect(
      researchProviderResultSchema.safeParse({
        ...providerResult,
        status: "failed",
      }).success,
    ).toBe(false);
    expect(
      researchProviderResultSchema.safeParse({
        ...providerResult,
        error: {
          code: "provider_unavailable",
          message: "Unavailable",
          retryable: true,
        },
      }).success,
    ).toBe(false);
  });

  it("models queued, running and terminal research jobs", () => {
    const base = {
      schemaVersion: 1 as const,
      id: "job-1",
      query: providerResult.query,
      providerIds: ["web"],
      requestedAt: 90,
      providerResults: [],
      sources: [],
      error: null,
    };
    expect(
      researchJobSchema.safeParse({ ...base, status: "queued" }).success,
    ).toBe(true);
    expect(
      researchJobSchema.safeParse({
        ...base,
        status: "running",
        startedAt: 100,
      }).success,
    ).toBe(true);
    expect(
      researchJobSchema.safeParse({
        ...base,
        status: "succeeded",
        startedAt: 100,
        completedAt: 110,
        providerResults: [providerResult],
        sources: [source],
      }).success,
    ).toBe(true);
  });

  it("rejects impossible job states and duplicate providers", () => {
    const invalidJob = {
      schemaVersion: 1 as const,
      id: "job-1",
      query: "Tablet",
      providerIds: ["web", "web"],
      status: "failed" as const,
      requestedAt: 100,
      startedAt: 90,
      providerResults: [],
      sources: [],
      error: null,
    };
    expect(researchJobSchema.safeParse(invalidJob).success).toBe(false);
  });
});
