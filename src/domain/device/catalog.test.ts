import { describe, expect, it } from "vitest";
import { searchDeviceCatalog } from "./catalog";

describe("device catalog search", () => {
  it("finds a device by model, reference or manufacturer", () => {
    expect(searchDeviceCatalog("galaxy tab")[0]?.model).toContain("SM-T530");
    expect(searchDeviceCatalog("SM T530")[0]?.manufacturer).toBe("Samsung");
    expect(searchDeviceCatalog("Fairphone")[0]?.model).toBe("Fairphone 5");
  });

  it("accepts words in a flexible order", () => {
    expect(searchDeviceCatalog("phone google")[0]?.model).toBe("Pixel 8");
  });

  it("returns a small starter list for an empty query", () => {
    expect(searchDeviceCatalog("")).toHaveLength(6);
  });

  it("returns no false suggestion for an unknown object", () => {
    expect(searchDeviceCatalog("custom laboratory object")).toEqual([]);
  });
});
