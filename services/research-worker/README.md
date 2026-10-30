# EIDA research worker

Optional future companion service for a static GitHub Pages application. The
current local Next.js route already extracts approved public pages without this
worker. The frontend remains usable without either service; this worker would
add server-side source discovery and normalized iFixit guide ingestion.

## Routes

- `GET /health`
- `POST /v1/research` with `{ "query": "Samsung SM-T530", "limit": 15 }`
- `GET /v1/ifixit/guides/:guideId`

The worker always searches the public iFixit API. Set the
`BRAVE_SEARCH_API_KEY` secret to add general web results:

```bash
npx wrangler secret put BRAVE_SEARCH_API_KEY
```

Set `ALLOWED_ORIGINS` to the comma-separated production GitHub Pages origin
and local development origins. Never put provider secrets in the static Next.js
bundle.

Deploy from this directory with `npx wrangler deploy` only if a paid/managed
Cloudflare deployment is later approved. Then provide the URL to the static
build as `NEXT_PUBLIC_EIDA_RESEARCH_API`.

## Boundaries

The service returns links and structured guide steps; it does not claim that a
guide contains measured CAD. iFixit results retain their CC BY-NC-SA 3.0
licence marker. Results from the open web default to an unknown licence and
must be reviewed before ingestion or redistribution.
