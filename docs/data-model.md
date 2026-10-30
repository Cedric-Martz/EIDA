# Data model v1

`src/domain/evidence/schema.ts` contains the executable Zod schema. All persisted projects have `schemaVersion: 1`.

- `Evidence`: source (`photo`, `document`, `measurement`) plus a locator (image ID, PDF page, or measurement note).
- `ComponentClaim`: an individual assertion about presence, shape, dimension or location, with evidence IDs.
- `ComponentNode`: stable component ID, category, geometry specification, optional parent.
- `GeometrySpec`: parametric primitive, reference asset, or placeholder; all estimated dimensions must be marked.

The `validateProject` function rejects dangling evidence, duplicate component IDs, and observed/documented claims without an appropriate source type. **Source-type validation is not a semantic fact-check**. Future work must add source-to-device compatibility and evidence admissibility rules.

`src/domain/inference/run.ts` defines inference-run schema version 1. IndexedDB database version 2 stores these runs separately from photo blobs. A run contains its local ID, model, timestamps, status, consent timestamp, selected photo IDs and locators, validated observations, resolved project, sanitized error and aggregate token usage when exposed. It cannot contain an API key, raw image, extracted source body or private prompt field.

The current evidence-extraction bundle is transient workflow context. It contains
source IDs, URLs, bounded excerpts, detected dimensions, image links, technical
file links and warnings. HTML is fetched only for approved public HTTPS sources;
PDF/CAD/archive links are indexed but their binary contents are not parsed.

Photo observations map to claims as follows:

- `visible` → `observed`, with photo evidence;
- `uncertain` → `inferred`, never promoted to observed;
- `not_visible` → `unknown`.

Observations with the same normalized label and category become separate claims on one component. Conflicting statuses are retained rather than collapsed.

Never equate LLM confidence with calibrated probability.
