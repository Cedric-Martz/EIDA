import Dexie, { type EntityTable } from "dexie";
import type { InferenceRun } from "@/domain/inference/run";

export interface LocalProjectRecord {
  id: string;
  title: string;
  updatedAt: number;
  data: unknown;
}

export interface LocalAssetRecord {
  id: string;
  projectId: string;
  kind: "photo" | "document";
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
  blob: Blob;
}

export interface LocalResearchSourceRecord {
  id: string;
  projectId: string;
  selection: "discovered" | "selected";
  updatedAt: number;
  data: unknown;
}

export interface LocalAssemblyManifestRecord {
  id: string;
  projectId: string;
  updatedAt: number;
  data: unknown;
}

export interface LocalMetaJobRecord {
  id: string;
  projectId: string;
  status: string;
  updatedAt: number;
  data: unknown;
}

export const DATABASE_VERSION = 4;

export const DATABASE_STORES = {
  projects: "id,updatedAt",
  assets: "id,projectId,kind,createdAt",
  inferenceRuns: "id,projectId,status,createdAt,model",
  researchSources: "id,projectId,selection,updatedAt",
  assemblyManifests: "id,projectId,updatedAt",
  metaJobs: "id,projectId,status,updatedAt",
} as const;

export const db = new Dexie("eida-local") as Dexie & {
  projects: EntityTable<LocalProjectRecord, "id">;
  assets: EntityTable<LocalAssetRecord, "id">;
  inferenceRuns: EntityTable<InferenceRun, "id">;
  researchSources: EntityTable<LocalResearchSourceRecord, "id">;
  assemblyManifests: EntityTable<LocalAssemblyManifestRecord, "id">;
  metaJobs: EntityTable<LocalMetaJobRecord, "id">;
};

db.version(1).stores({
  projects: "id,updatedAt",
  assets: "id,projectId,kind,createdAt",
});

db.version(2).stores({
  projects: "id,updatedAt",
  assets: "id,projectId,kind,createdAt",
  inferenceRuns: "id,projectId,status,createdAt,model",
});

// Version 4 adds provenance, assembly and Meta pipeline job records without
// rewriting projects, photos, documents, or inference runs from earlier versions.
db.version(DATABASE_VERSION).stores(DATABASE_STORES);
// Browser-only module. Keep it outside domain code and future server modules.
