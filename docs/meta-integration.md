# Meta Model API integration

Official docs: https://dev.meta.ai/docs/overview and https://dev.meta.ai/docs/models

- Base URL: `https://api.meta.ai/v1`
- Authentication: `Authorization: Bearer $MODEL_API_KEY`
- Muse Spark 1.3: `muse-spark-1.3`, Responses API (`POST /responses` relative to base URL).
- SAM 3.1: `sam-3.1`, image segmentation through Responses API; masks and boxes.

## Current status

The static application includes browser-side BYOK configuration and a read-only connection test against `GET /models`. The key remains in React memory by default. At the user's request it may be kept in `sessionStorage` until the browser session ends. It is never included in the source, build, logs, IndexedDB project, or a `NEXT_PUBLIC_` variable.

The chosen model identifier is non-secret and may be saved in `localStorage`. The current interface does not send imported photographs and cannot trigger a paid inference call.

## Not yet implemented

Account entitlement, exact model names, image payload construction, PDF inputs, structured output schema enforcement, segmentation payloads, retries/backoff, token accounting, persisted consent, cost budgets and rate limiting. Treat these as explicit backlog items and verify current official documentation before implementation.

For the public research prototype, future inference may use the visitor's own key directly from the browser when the provider's CORS policy permits it. Each transfer requires explicit consent and a clear cost/privacy notice. Never put a maintainer-owned or shared provider credential in browser code or a `NEXT_PUBLIC_` variable.

A separately deployed authenticated service remains required for shared credentials, managed billing, server-enforced quotas, organization accounts, or providers that do not permit browser requests.

## Security note

Do not use contributor/training-sharing mode for private user content without explicit product/legal review. Prefer Standard mode and document Meta's current retention and data usage terms.
