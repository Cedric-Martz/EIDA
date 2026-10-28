import { describe, expect, it } from "vitest";
import { hasMatchingImageSignature, isSupportedImageType } from "./image-file";

describe("image file validation", () => {
  it("accepts supported MIME types", () => {
    expect(isSupportedImageType("image/jpeg")).toBe(true);
    expect(isSupportedImageType("image/svg+xml")).toBe(false);
  });

  it("matches JPEG, PNG and WebP signatures", async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], {
      type: "image/jpeg",
    });
    const png = new Blob(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      { type: "image/png" },
    );
    const webp = new Blob(["RIFF", new Uint8Array(4), "WEBP"], {
      type: "image/webp",
    });

    await expect(hasMatchingImageSignature(jpeg)).resolves.toBe(true);
    await expect(hasMatchingImageSignature(png)).resolves.toBe(true);
    await expect(hasMatchingImageSignature(webp)).resolves.toBe(true);
  });

  it("rejects a spoofed image MIME type", async () => {
    const spoofed = new Blob(["not an image"], { type: "image/png" });
    await expect(hasMatchingImageSignature(spoofed)).resolves.toBe(false);
  });
});
