import { describe, expect, it } from "vitest";
import { analyzeCadArtifact, cadFormatFromUrl } from "./cad-evidence";

describe("CAD evidence analysis", () => {
  it("detects supported CAD formats without trusting query strings", () => {
    expect(
      cadFormatFromUrl("https://example.com/files/chassis.STEP?download=1"),
    ).toBe("step");
    expect(cadFormatFromUrl("https://example.com/files/drawing.dxf")).toBe(
      "dxf",
    );
  });

  it("extracts millimetre bounds from ASCII STEP Cartesian points", () => {
    const body = Buffer.from(`ISO-10303-21;
      DATA;
      #1=SI_UNIT(.MILLI.,.METRE.);
      #2=CARTESIAN_POINT('',(-10.,-5.,0.));
      #3=CARTESIAN_POINT('',(110.,55.,8.));
      #4=CARTESIAN_POINT('',(40.,20.,3.));
      ENDSEC;
      END-ISO-10303-21;`);

    const analysis = analyzeCadArtifact({
      body,
      url: "https://example.com/chassis.step",
      mediaType: "application/step",
    });

    expect(analysis).toMatchObject({
      status: "parsed",
      format: "step",
      unit: "mm",
      pointCount: 3,
      boundsMm: {
        min: [-10, -5, 0],
        max: [110, 55, 8],
        dimensions: [120, 60, 8],
      },
    });
    expect(analysis.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses declared DXF extents and converts inches to millimetres", () => {
    const body = Buffer.from(
      [
        "0",
        "SECTION",
        "2",
        "HEADER",
        "9",
        "$INSUNITS",
        "70",
        "1",
        "9",
        "$EXTMIN",
        "10",
        "0",
        "20",
        "0",
        "30",
        "0",
        "9",
        "$EXTMAX",
        "10",
        "4",
        "20",
        "2",
        "30",
        "0.25",
        "0",
        "ENDSEC",
        "0",
        "EOF",
      ].join("\n"),
    );

    const analysis = analyzeCadArtifact({
      body,
      url: "https://example.com/enclosure.dxf",
    });

    expect(analysis).toMatchObject({
      status: "parsed",
      format: "dxf",
      unit: "inch",
      boundsMm: { dimensions: [101.6, 50.8, 6.35] },
    });
  });

  it("fingerprints unsupported CAD without claiming parsed geometry", () => {
    const analysis = analyzeCadArtifact({
      body: Buffer.from("solid fixture\nendsolid fixture"),
      url: "https://example.com/fixture.stl",
    });

    expect(analysis.status).toBe("unsupported");
    expect(analysis.boundsMm).toBeUndefined();
  });
});
