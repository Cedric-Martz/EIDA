import { describe, expect, it } from "vitest";
import { validateAssemblyManifest } from "@/domain/assembly";
import { demoAssemblyManifest } from "./demo-assembly";

describe("demo assembly fixture", () => {
  it("stays valid for the public GitHub Pages viewer", () => {
    expect(() => validateAssemblyManifest(demoAssemblyManifest)).not.toThrow();
  });
});
