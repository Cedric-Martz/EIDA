# ADR-013: Evidence-resolved browser inference

Status: Accepted

## Context

ADR-012 established a static browser workbench. The live path now uses a local
Next.js server because source extraction and Meta calls need a same-origin
proxy, while the static target remains a documentation/synthetic-demo build.
EIDA needs to retain provenance without turning model prose into documentary
evidence or storing credentials.

## Decision

For the restricted local prototype, fetch only approved public HTTPS sources,
extract bounded text/dimensions/image links/technical-file links, then send the
approved evidence snapshot and up to six user-approved photos through the local
server to Meta Chat Completions and SAM 3.1. Validate structured output before
building local silhouettes. Persist only metadata, consent, photo references,
validated observations, resolved evidence/claims, sanitized errors and
aggregate usage.

Only `visible` observations with photo evidence may create recognized parametric external geometry, and every unmeasured dimension remains `estimated`. Uncertain or unsupported shapes use placeholders. Keep the synthetic fixture available as an explicitly separate viewer source.

## Consequences

- Images, approved source context and the visitor-owned key necessarily pass
  through the local server to the provider, but credentials and raw payloads
  are not duplicated into inference-run records.
- The graph, not the provider narrative or Three.js scene, remains the source of truth.
- Shared credentials, organization accounts, managed billing, authentication and
  server quotas still require a protected service. No paid infrastructure is
  part of the current path.
- PDF/CAD parsing, OCR, multi-view registration, photogrammetry, hidden-surface
  reconstruction and material identification remain outside this slice.
