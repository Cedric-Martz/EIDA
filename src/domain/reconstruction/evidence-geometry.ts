import type { ComponentNode } from "@/domain/evidence/schema";

type GeometrySpec = ComponentNode["geometry"];

const illustrativeGeometry: Record<
  string,
  {
    primitive: "box" | "cylinder" | "plane";
    dimensionsMm: [number, number, number];
  }
> = {
  battery: { primitive: "box", dimensionsMm: [105, 65, 5] },
  board: { primitive: "box", dimensionsMm: [95, 35, 2] },
  button: { primitive: "box", dimensionsMm: [18, 7, 3] },
  camera: { primitive: "cylinder", dimensionsMm: [12, 12, 5] },
  connector: { primitive: "box", dimensionsMm: [12, 6, 3] },
  display: { primitive: "plane", dimensionsMm: [160, 100, 1] },
  housing: { primitive: "box", dimensionsMm: [180, 110, 6] },
  microphone: { primitive: "cylinder", dimensionsMm: [4, 4, 2] },
  sensor: { primitive: "cylinder", dimensionsMm: [6, 6, 2] },
  slot: { primitive: "box", dimensionsMm: [18, 7, 2] },
  speaker: { primitive: "box", dimensionsMm: [28, 8, 3] },
  screen: { primitive: "plane", dimensionsMm: [160, 100, 1] },
};

export function geometryFromEvidence(
  category: string,
  claims: ComponentNode["claims"],
  label = "",
): GeometrySpec {
  const hasObservedPresence = claims.some(
    (claim) =>
      claim.property === "presence" &&
      claim.status === "observed" &&
      claim.evidenceIds.length > 0,
  );
  const normalizedCategory = category.trim().toLowerCase();
  let knownPrimitive = illustrativeGeometry[normalizedCategory];
  if (
    normalizedCategory === "button" &&
    /\b(home|round|circular|oval)\b/i.test(label)
  ) {
    knownPrimitive = {
      primitive: "cylinder",
      dimensionsMm: [13, 13, 3],
    };
  }

  if (!hasObservedPresence || !knownPrimitive) {
    return {
      kind: "placeholder",
      estimated: true,
    };
  }

  return {
    kind: "parametric",
    primitive: knownPrimitive.primitive,
    dimensionsMm: knownPrimitive.dimensionsMm,
    estimated: true,
  };
}
