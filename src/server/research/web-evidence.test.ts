import { describe, expect, it } from "vitest";
import { extractDimensions, extractHtmlEvidence } from "./web-evidence";

const source = {
  id: "guide-1",
  url: "https://example.com/device/guide",
  title: "Device teardown",
  sourceType: "teardown-guide" as const,
};

describe("web evidence extraction", () => {
  it("extracts overall and labelled metric dimensions", () => {
    const dimensions = extractDimensions(
      "Dimensions: 243.4 × 176.4 × 7.95 mm. Battery thickness: 5.2 mm.",
      source,
    );

    expect(dimensions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "overall dimensions",
          valuesMm: [243.4, 176.4, 7.95],
        }),
        expect.objectContaining({ label: "thickness", valuesMm: [5.2] }),
      ]),
    );
  });

  it("keeps relevant text, source images and technical artifacts", () => {
    const result = extractHtmlEvidence(
      `<!doctype html><html><head><title>Exact teardown</title></head><body>
        <nav>Ignore navigation</nav>
        <h1>Tablet disassembly</h1>
        <p>Remove the battery connector from the motherboard.</p>
        <p>The device dimensions are 20 x 10 x 0.8 cm.</p>
        <img data-src="/images/battery-step.jpg" alt="Battery removal step">
        <a href="/assets/enclosure.step">Download enclosure CAD</a>
        <a href="/manual.pdf">Service manual</a>
      </body></html>`,
      source,
    );

    expect(result.status).toBe("extracted");
    expect(result.excerpt).toContain("battery connector");
    expect(result.dimensions[0]?.valuesMm).toEqual([200, 100, 8]);
    expect(result.images[0]?.url).toBe(
      "https://example.com/images/battery-step.jpg",
    );
    expect(result.artifacts.map((artifact) => artifact.kind)).toEqual([
      "cad",
      "pdf",
    ]);
  });
});
