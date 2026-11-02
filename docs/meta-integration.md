# Meta Model API integration

Official docs: https://dev.meta.ai/docs/overview and https://dev.meta.ai/docs/models

- Base URL: `https://api.meta.ai/v1`
- Authentication: `Authorization: Bearer $MODEL_API_KEY`
- Muse Spark 1.3: `muse-spark-1.3`; both Responses and Chat Completions are supported. This single-shot slice uses `POST /chat/completions`.
- SAM 3.1: `sam-3.1`, image segmentation through Responses API; masks and boxes.

## Current path

The local Next.js server exposes four same-origin routes:

- `GET /api/meta/status` verifies the key and reports model availability.
- `POST /api/meta/inventory` sends the extracted approved-source snapshot and up
  to six explicitly approved photographs to Muse. A strict JSON schema limits the result to ten
  visible, segmentable parts.
- `POST /api/meta/segment` asks SAM 3.1 for one part mask. The official
  `@meta-sam/parser` package decodes the response stream and converts the mask to
  an SVG contour.
- `POST /api/research/extract` fetches approved public HTTPS sources and returns
  bounded text, documented dimensions, source images and technical-file links.

The browser then reprojects each contour into the source image, scales it from
the reference device envelope (or a complete high-confidence documented
dimension), simplifies it and extrudes it into a binary GLB. Geometry
generation and assembly validation are local. Processing is sequential and only
accepted visible masks become component geometry. When enabled, the narrower
`services/mapanything-worker` runs the official Apache MapAnything script in
parallel and returns a metric scene GLB plus a report. The former
`services/meta-pipeline` contract remains an experimental full-pipeline path.

The key comes from server-only `MODEL_API_KEY` in `.env.local`, or from a form
field sent only to the local route through `x-eida-meta-key`. The latter stays in
React memory unless the user opts into tab-scoped `sessionStorage`. It is never
written to IndexedDB, source control, logs or a `NEXT_PUBLIC_` variable.

Each transfer requires explicit consent. The key and raw provider response are
not stored. Generated geometry retains an `estimated` fidelity label because an
image contour cannot establish hidden surfaces, depth or metrological scale.

## Runtime boundary

No search API, database or object storage is required. Muse and SAM use the
configured Meta Model API account. Optional MapAnything processing runs on a
separate worker controlled by the operator. Contour processing, graph
compilation and rendering remain local.

MapAnything now provides optional multi-view registration and a scene-level
metric reference. Per-component mesh fitting, textured hidden surfaces, PDF
text extraction, OCR, input-token preflight and monetary budget enforcement are
not implemented. A ruler, known dimension, measured drawing or imported CAD
still materially improves scale and fit. A protected remote backend would be
required for a public multi-user deployment with shared credentials,
authentication and server-enforced quotas.

## Security note

Do not use contributor/training-sharing mode for private user content without explicit product/legal review. Prefer Standard mode and document Meta's current retention and data usage terms.
