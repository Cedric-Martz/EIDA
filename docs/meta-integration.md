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
generation and assembly validation are local and need no GPU worker. Processing
is sequential and only accepted visible masks become geometry.
The former `services/meta-pipeline` contract remains an experimental path, not a
runtime dependency.

The key comes from server-only `MODEL_API_KEY` in `.env.local`, or from a form
field sent only to the local route through `x-eida-meta-key`. The latter stays in
React memory unless the user opts into tab-scoped `sessionStorage`. It is never
written to IndexedDB, source control, logs or a `NEXT_PUBLIC_` variable.

Each transfer requires explicit consent. The key and raw provider response are
not stored. Generated geometry retains an `estimated` fidelity label because an
image contour cannot establish hidden surfaces, depth or metrological scale.

## Limitations and cost boundary

No paid search API, hosted GPU, photogrammetry/CAD service, database, object
storage or queue is used. Muse/SAM therefore depend on user/hackathon credits
and provider availability; extraction, contour processing, GLB generation and
rendering run on the local machine.

PDF text extraction, OCR, CAD parsing, automatic multi-view registration,
image downloading/analysis, input-token preflight, monetary budget enforcement
and textured hidden surfaces are not implemented. Technical files are indexed
as links, not parsed. A ruler, known dimension, measured drawing or imported
CAD still materially improves scale and fit. A protected remote backend would
be required for a public multi-user deployment with shared credentials,
authentication and server-enforced quotas.

## Security note

Do not use contributor/training-sharing mode for private user content without explicit product/legal review. Prefer Standard mode and document Meta's current retention and data usage terms.
