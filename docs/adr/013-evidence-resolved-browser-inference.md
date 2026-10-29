# ADR-013: Evidence-resolved browser inference

Status: Accepted

## Context

ADR-012 established a static browser workbench and allowed visitor-owned keys when provider CORS permits direct calls. The Meta connection and a real consented Muse photo test have now been verified. EIDA needs to retain provenance without turning model prose into documentary evidence or storing credentials.

## Decision

For the restricted BYOK prototype, send exactly three user-approved photos directly from the browser to Meta Chat Completions. Validate structured output before passing it to a pure deterministic resolver. Persist a versioned run containing only metadata, consent, exact photo references, validated observations, resolved evidence/claims, sanitized errors and aggregate usage.

Only `visible` observations with photo evidence may create recognized parametric external geometry, and every unmeasured dimension remains `estimated`. Uncertain or unsupported shapes use placeholders. Keep the synthetic fixture available as an explicitly separate viewer source.

## Consequences

- Images and the visitor-owned key necessarily leave the browser for the direct provider call, but neither is duplicated into inference-run records.
- The graph, not the provider narrative or Three.js scene, remains the source of truth.
- Shared credentials, organization accounts, managed billing and server quotas still require a protected service.
- PDF grounding and segmentation remain later, separately consented integrations.
