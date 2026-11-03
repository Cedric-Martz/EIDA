# Meta Model API integration

Official docs: https://dev.meta.ai/docs/overview and https://dev.meta.ai/docs/models

- Base URL: `https://api.meta.ai/v1`
- Authentication: `Authorization: Bearer $MODEL_API_KEY`
- Muse Spark 1.3: `muse-spark-1.3`; both Responses and Chat Completions are supported. This single-shot slice uses `POST /chat/completions`.
- SAM 3.1: `sam-3.1`, image segmentation through Responses API; masks and boxes.

## Current path

The local Next.js server exposes seven same-origin routes:

- `GET /api/meta/status` verifies the key and reports model availability.
- `POST /api/meta/inventory` sends the extracted approved-source snapshot, up
  to 16 user photographs and 32 public-source images to Muse. A strict JSON
  schema limits the result to 24 evidence-supported, segmentable parts.
- `POST /api/meta/segment` asks SAM 3.1 for one part mask. The official
  `@meta-sam/parser` package decodes the response stream and converts the mask to
  an SVG contour.
- `POST /api/meta/geometry` asks Muse to compare available viewpoints and
  return one validated canonical primitive or corrected profile envelope for
  every accepted SAM mask.
- `POST /api/research/extract` fetches approved public HTTPS sources and returns
  bounded text, documented dimensions, source images and technical-file links.
- `POST /api/research/search` combines iFixit with Muse Spark 1.3 live web
  search targeted at manuals, photographs, specifications and 3D/CAD assets.
- `POST /api/research/image` securely proxies a selected public image for SAM,
  with public-address checks, redirect limits and a 12 MB bound.

The browser combines each contour with the validated geometry plan. Regular
manufactured parts use canonical parametric primitives; genuinely irregular
parts retain a corrected mask profile before local GLB extrusion. Graph
compilation and assembly validation remain local. Only accepted visible masks
become component geometry, and inferred dimensions stay explicitly estimated.

The key comes from server-only `MODEL_API_KEY` in `.env.local`, or from a form
field sent only to the local route through `x-eida-meta-key`. The latter stays in
React memory unless the user opts into tab-scoped `sessionStorage`. It is never
written to IndexedDB, source control, logs or a `NEXT_PUBLIC_` variable.

Each transfer requires explicit consent. The key and raw provider response are
not stored. Generated geometry retains an `estimated` fidelity label because an
image contour cannot establish hidden surfaces, depth or metrological scale.

## Runtime boundary

No database or object storage is required. Muse web search, inventory and SAM
use the configured Meta Model API account. Contour processing, graph compilation
and rendering remain local.

Metric camera calibration, textured hidden surfaces, PDF text extraction, OCR,
input-token preflight and monetary budget enforcement are not implemented. A
ruler, known dimension, measured drawing or imported CAD still materially
improves scale and fit. A protected remote backend would be required for a
public multi-user deployment with shared credentials, authentication and
server-enforced quotas.

## Security note

Do not use contributor/training-sharing mode for private user content without explicit product/legal review. Prefer Standard mode and document Meta's current retention and data usage terms.
