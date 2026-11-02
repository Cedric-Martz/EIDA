# ADR-014: EIDA Reconstruction Graph

Status: Accepted

## Context

Compiling a SAM contour directly into GLB loses the distinction between an
observation, a geometric assumption and a rendering artifact. It also makes the
result difficult to revise when another photo, measurement or model becomes
available.

## Decision

Use a versioned `eida-reconstruction-graph` JSON document as the editable source
between Meta model results and viewer assets.

Each part stores a constrained geometry recipe, physical transform, exploded
offset, property-level evidence links and explicit assumptions. Relations remain
first-class graph records. The browser validates all references before a
deterministic compiler emits the existing assembly manifest and GLB assets.

The first implementation supports primitives, profile extrusions and references
to external meshes. Profile extrusions are populated from SAM 3.1 masks. The
mesh-reference recipe is reserved for a future SAM 3D/MapAnything adapter without
changing the graph contract.

## Consequences

- `.eida.json` is portable and downloadable; GLB is a derived artifact.
- New evidence can replace one property without regenerating unrelated parts.
- Unsupported geometry remains represented as an explicit assumption.
- Future Meta 3D models integrate through recipes and evidence records instead
  of becoming a second source of truth.
