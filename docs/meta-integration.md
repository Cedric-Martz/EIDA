# Meta Model API integration

Official docs: https://dev.meta.ai/docs/overview and https://dev.meta.ai/docs/models

- Base URL: `https://api.meta.ai/v1`
- Authentication: `Authorization: Bearer $MODEL_API_KEY`
- Muse Spark 1.3: `muse-spark-1.3`; both Responses and Chat Completions are supported. This single-shot slice uses `POST /chat/completions`.
- SAM 3.1: `sam-3.1`, image segmentation through Responses API; masks and boxes.

## Current status

The static application includes browser-side BYOK configuration and a read-only connection test against `GET /models`. The key remains in React memory by default. At the user's request it may be kept in `sessionStorage` until the browser session ends. It is never included in the source, build, logs, IndexedDB project, or a `NEXT_PUBLIC_` variable.

The chosen model identifier is non-secret and may be saved in `localStorage`. The interface now supports a deliberately limited first analysis slice: after the
connection test succeeds, the user must explicitly consent before three locally
stored photos are sent to the selected model through `POST /chat/completions`.
The response is constrained to and validated against a small observation schema.
Validated observations pass through a deterministic resolver that creates photo
evidence, claims and conservative geometry. The resolved graph is persisted in
IndexedDB and can replace the synthetic fixture in the viewer. Estimated geometry
remains explicitly marked and is not verified CAD.

Each run stores only its local ID, model, timestamps, status, consent, exact
photo identifiers/locators, validated observations, resolved graph, sanitized
errors and aggregate token usage when returned. The key, request images, private
prompt and raw provider response are not stored in the run.

## Not yet implemented

PDF inputs, segmentation payloads, input-token preflight, monetary cost
calculation, server-enforced budgets and rate limiting remain incomplete. The
adapter performs one bounded retry for `429`/`5xx`; all tests inject a fake fetch
implementation and never contact Meta.

For the public research prototype, future inference may use the visitor's own key directly from the browser when the provider's CORS policy permits it. Each transfer requires explicit consent and a clear cost/privacy notice. Never put a maintainer-owned or shared provider credential in browser code or a `NEXT_PUBLIC_` variable.

A separately deployed authenticated service remains required for shared credentials, managed billing, server-enforced quotas, organization accounts, or providers that do not permit browser requests.

## Security note

Do not use contributor/training-sharing mode for private user content without explicit product/legal review. Prefer Standard mode and document Meta's current retention and data usage terms.
