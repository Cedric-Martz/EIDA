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

export const DATABASE_VERSION = 2;

export const DATABASE_STORES = {
  projects: "id,updatedAt",
  assets: "id,projectId,kind,createdAt",
  inferenceRuns: "id,projectId,status,createdAt,model",
} as const;

export const db = new Dexie("eida-local") as Dexie & {
  projects: EntityTable<LocalProjectRecord, "id">;
  assets: EntityTable<LocalAssetRecord, "id">;
  inferenceRuns: EntityTable<InferenceRun, "id">;
};

db.version(1).stores({
  projects: "id,updatedAt",
  assets: "id,projectId,kind,createdAt",
});

// Version 2 only adds a table. Existing v1 projects and assets are preserved
// without rewriting their records.
db.version(DATABASE_VERSION).stores(DATABASE_STORES);
// Browser-only module. Keep it outside domain code and future server modules.
