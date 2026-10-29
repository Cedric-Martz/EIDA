import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import {
  DATABASE_STORES,
  DATABASE_VERSION,
  db,
  type LocalAssetRecord,
  type LocalProjectRecord,
} from "./db";

const DATABASE_NAME = "eida-local";

afterEach(async () => {
  db.close();
  await Dexie.delete(DATABASE_NAME);
});

describe("IndexedDB schema migration", () => {
  it("adds inference runs in version 2 without dropping version 1 records", async () => {
    const legacy = new Dexie(DATABASE_NAME);
    legacy.version(1).stores({
      projects: "id,updatedAt",
      assets: "id,projectId,kind,createdAt",
    });
    await legacy.open();
    await legacy.table<LocalProjectRecord>("projects").put({
      id: "legacy-project",
      title: "Legacy project",
      updatedAt: 1,
      data: { schemaVersion: 1 },
    });
    const blob = new Blob(["photo"], { type: "image/jpeg" });
    await legacy.table<LocalAssetRecord>("assets").put({
      id: "legacy-photo",
      projectId: "legacy-project",
      kind: "photo",
      name: "photo.jpg",
      mimeType: "image/jpeg",
      size: blob.size,
      createdAt: 1,
      blob,
    });
    legacy.close();

    await db.open();

    expect(DATABASE_VERSION).toBe(2);
    expect(DATABASE_STORES.inferenceRuns).toContain("projectId");
    expect(await db.projects.get("legacy-project")).toMatchObject({
      title: "Legacy project",
    });
    expect(await db.assets.get("legacy-photo")).toMatchObject({
      projectId: "legacy-project",
      kind: "photo",
    });
    expect(db.tables.map((table) => table.name)).toContain("inferenceRuns");
  });
});
