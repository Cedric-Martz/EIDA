import Dexie, { type EntityTable } from "dexie";

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

export const db = new Dexie("eida-local") as Dexie & {
  projects: EntityTable<LocalProjectRecord, "id">;
  assets: EntityTable<LocalAssetRecord, "id">;
};

db.version(1).stores({
  projects: "id,updatedAt",
  assets: "id,projectId,kind,createdAt",
});
// Browser-only module. Keep it outside domain code and future server modules.
