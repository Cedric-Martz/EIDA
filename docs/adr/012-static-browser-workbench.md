# ADR-012: Static browser workbench

Status: Accepted

## Context

The user requested that EIDA open directly in the 3D environment and that the current demonstrator work without a backend. The previous local probe routes were not part of the validated reconstruction path and prevented a purely static export.

## Decision

The current demonstrator is exported as static files. Three.js rendering and IndexedDB persistence run in the browser. The application has no API route. It provides a browser-side BYOK connector that can validate a visitor-owned Meta Model API key without performing inference.

Visitor-owned credentials may be used directly from the browser when the provider permits CORS, with explicit consent, input minimization, and cost disclosure. Shared credentials and managed quotas require a separately deployed, authenticated service. This ADR does not claim that model inference runs offline.

## Consequences

- The 3D demonstrator can be hosted on a static origin.
- Photos remain scoped to the browser origin and may be evicted.
- There is no cross-device synchronization or server backup.
- Live Meta inference remains unimplemented; only connection validation is active.
- Provider CORS policy is an external dependency and may later require a proxy.
