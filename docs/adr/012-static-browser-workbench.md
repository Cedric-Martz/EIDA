# ADR-012: Static browser workbench

Status: Superseded for the live reconstruction path by ADR-013. Retained for the static showcase.

## Context

The user requested that EIDA open directly in the 3D environment and that the current demonstrator work without a backend. The previous local probe routes were not part of the validated reconstruction path and prevented a purely static export.

## Decision

The original demonstrator was exported as static files. Three.js rendering and IndexedDB persistence run in the browser. That static target remains useful for GitHub Pages documentation and a synthetic 3D demo, but it is no longer the live reconstruction path.

Visitor-owned credentials may be used directly from the browser when the provider permits CORS, with explicit consent, input minimization, and cost disclosure. Shared credentials and managed quotas require a separately deployed, authenticated service. This ADR does not claim that model inference runs offline.

## Consequences

- The 3D demonstrator and documentation can be hosted on a static origin.
- Photos remain scoped to the browser origin and may be evicted.
- There is no cross-device synchronization or server backup.
- Live Meta inference is implemented only through the local Next.js proxy described by ADR-013; it must not be embedded in the static showcase.
- Provider CORS policy is an external dependency and may later require a proxy.
