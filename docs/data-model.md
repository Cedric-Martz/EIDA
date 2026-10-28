# Data model v1

`src/domain/evidence/schema.ts` contains the executable Zod schema. All persisted projects have `schemaVersion: 1`.

- `Evidence`: source (`photo`, `document`, `measurement`) plus a locator (image ID, PDF page, or measurement note).
- `ComponentClaim`: an individual assertion about presence, shape, dimension or location, with evidence IDs.
- `ComponentNode`: stable component ID, category, geometry specification, optional parent.
- `GeometrySpec`: parametric primitive, reference asset, or placeholder; all estimated dimensions must be marked.

The `validateProject` function rejects dangling evidence, duplicate component IDs, and observed/documented claims without an appropriate source type. **Source-type validation is not a semantic fact-check**. Future work must add source-to-device compatibility and evidence admissibility rules.

Never equate LLM confidence with calibrated probability.
