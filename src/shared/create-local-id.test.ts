import { describe, expect, it } from "vitest";
import { createLocalId } from "./create-local-id";

describe("createLocalId", () => {
  it("uses randomUUID when the browser provides it", () => {
    expect(
      createLocalId("photo", {
        randomUUID: () => "known-uuid",
      }),
    ).toBe("photo-known-uuid");
  });

  it("falls back to getRandomValues on older browsers", () => {
    const id = createLocalId("document", {
      getRandomValues(values) {
        values.set([1, 2, 3, 4]);
        return values;
      },
    });

    expect(id).toBe("document-1234");
  });

  it("still creates a namespaced identifier without Web Crypto", () => {
    expect(createLocalId("asset", null)).toMatch(/^asset-/);
  });
});
